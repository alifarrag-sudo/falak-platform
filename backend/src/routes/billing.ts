/**
 * Billing routes — Stripe subscription management for agencies.
 * POST /api/billing/create-checkout  — creates Stripe Checkout session
 * POST /api/billing/portal           — opens Stripe Customer Portal
 * POST /api/billing/webhook          — Stripe webhook (raw body, before express.json)
 * GET  /api/billing/status           — current subscription status
 */
import { Router, Request, Response } from 'express';
import Stripe from 'stripe';
import { requireAuth, AuthRequest } from '../middleware/auth';
import { db } from '../db/connection';

const router = Router();

function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error('STRIPE_SECRET_KEY not configured in .env');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return new Stripe(key, { apiVersion: '2024-11-20.acacia' as any });
}

const PRICE_IDS: Record<string, string | undefined> = {
  starter:    process.env.STRIPE_PRICE_STARTER,
  pro:        process.env.STRIPE_PRICE_PRO,
  enterprise: process.env.STRIPE_PRICE_ENTERPRISE,
};

async function getAgencyForUser(userId: string): Promise<Record<string, unknown> | null> {
  const user = await db.get('SELECT linked_agency_id FROM users WHERE id = ?', [userId]) as { linked_agency_id: string | null } | undefined;
  if (!user?.linked_agency_id) return null;
  return await db.get('SELECT * FROM agencies WHERE id = ?', [user.linked_agency_id]) as Record<string, unknown> | null;
}

// ── POST /api/billing/create-checkout ─────────────────────────────────────────
router.post('/create-checkout', requireAuth('agency', 'platform_admin'), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { plan } = req.body as { plan: string };
    if (!['starter', 'pro', 'enterprise'].includes(plan)) {
      res.status(400).json({ error: 'plan must be starter, pro, or enterprise' }); return;
    }
    const priceId = PRICE_IDS[plan];
    if (!priceId) {
      res.status(503).json({ error: `Stripe price for "${plan}" not configured. Add STRIPE_PRICE_${plan.toUpperCase()} to .env` }); return;
    }

    const stripe = getStripe();
    const userId = (req.user as Record<string, unknown>).id as string;
    const agency = await getAgencyForUser(userId);
    if (!agency) { res.status(404).json({ error: 'No agency linked to this account' }); return; }

    // Create or reuse Stripe customer
    let customerId = agency.stripe_customer_id as string | null;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: (agency.contact_email as string) || undefined,
        name:  (agency.name as string) || undefined,
        metadata: { agency_id: String(agency.id) },
      });
      customerId = customer.id;
      await db.run('UPDATE agencies SET stripe_customer_id = ? WHERE id = ?', [customerId, agency.id]);
    }

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${frontendUrl}/billing?success=1`,
      cancel_url:  `${frontendUrl}/billing?cancelled=1`,
      metadata: { agency_id: String(agency.id), plan },
    });
    res.json({ url: session.url });
  } catch (err) {
    console.error('[billing] create-checkout error:', err);
    res.status(500).json({ error: (err as Error).message });
  }
});

// ── POST /api/billing/portal ───────────────────────────────────────────────────
router.post('/portal', requireAuth('agency', 'platform_admin'), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const stripe = getStripe();
    const userId = (req.user as Record<string, unknown>).id as string;
    const agency = await getAgencyForUser(userId);
    if (!agency) { res.status(404).json({ error: 'No agency linked to this account' }); return; }
    if (!agency.stripe_customer_id) {
      res.status(400).json({ error: 'No subscription found. Please subscribe to a plan first.' }); return;
    }

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const session = await stripe.billingPortal.sessions.create({
      customer: agency.stripe_customer_id as string,
      return_url: `${frontendUrl}/billing`,
    });
    res.json({ url: session.url });
  } catch (err) {
    console.error('[billing] portal error:', err);
    res.status(500).json({ error: (err as Error).message });
  }
});

// ── POST /api/billing/webhook ──────────────────────────────────────────────────
// Registered with express.raw() in index.ts — MUST come before express.json()
router.post('/webhook', async (req: Request, res: Response): Promise<void> => {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) { res.status(500).json({ error: 'STRIPE_WEBHOOK_SECRET not configured' }); return; }

  let event: Stripe.Event;
  try {
    const stripe = getStripe();
    event = stripe.webhooks.constructEvent(
      req.body as Buffer,
      req.headers['stripe-signature'] as string,
      webhookSecret
    );
  } catch (err) {
    res.status(400).json({ error: `Webhook signature failed: ${(err as Error).message}` }); return;
  }

  try {
    switch (event.type) {
      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const sub = event.data.object as Stripe.Subscription & { current_period_end?: number };
        const status = ['active', 'trialing'].includes(sub.status) ? 'active' : sub.status;
        const periodEnd = sub.current_period_end
          ? new Date(sub.current_period_end * 1000).toISOString()
          : null;
        await db.run(`UPDATE agencies SET subscription_status = ?, subscription_tier = ?,
          subscription_current_period_end = ? WHERE stripe_customer_id = ?`,
          [status, (sub.metadata?.plan as string) || 'starter', periodEnd, sub.customer as string]);
        break;
      }
      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription;
        await db.run(`UPDATE agencies SET subscription_status = 'cancelled' WHERE stripe_customer_id = ?`,
          [sub.customer as string]);
        break;
      }
      case 'invoice.payment_succeeded': {
        const inv = event.data.object as Stripe.Invoice & { subscription?: string };
        if (inv.subscription) {
          await db.run(`UPDATE agencies SET subscription_status = 'active' WHERE stripe_customer_id = ?`,
            [inv.customer as string]);
        }
        break;
      }
      case 'invoice.payment_failed': {
        const inv = event.data.object as Stripe.Invoice & { subscription?: string };
        if (inv.subscription) {
          await db.run(`UPDATE agencies SET subscription_status = 'past_due' WHERE stripe_customer_id = ?`,
            [inv.customer as string]);
        }
        break;
      }
    }
  } catch (err) {
    console.error('[billing] webhook handler error:', err);
  }

  res.json({ received: true });
});

// ── GET /api/billing/status ────────────────────────────────────────────────────
router.get('/status', requireAuth('agency', 'platform_admin'), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = (req.user as Record<string, unknown>).id as string;
    const agency = await getAgencyForUser(userId);
    if (!agency) { res.status(404).json({ error: 'No agency linked to this account' }); return; }

    res.json({
      plan:        agency.subscription_tier    || 'starter',
      status:      agency.subscription_status  || 'trial',
      period_end:  agency.subscription_current_period_end || null,
      has_customer: !!agency.stripe_customer_id,
    });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

export default router;
