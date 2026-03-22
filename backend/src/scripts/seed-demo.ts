/**
 * FALAK Demo Seed — creates realistic Egyptian influencer market data.
 * Run with: npm run seed:demo
 *
 * Demo accounts created:
 *   Platform Admin   admin@demo.falak.io      / Falak@Demo2026
 *   Agency           agency@demo.falak.io     / Falak@Demo2026
 *   Brand            brand@demo.falak.io      / Falak@Demo2026
 *   Talent Manager   manager@demo.falak.io    / Falak@Demo2026
 *   Creator Portal   creator@demo.falak.io    / Falak@Demo2026  (portal_users table)
 *   Fan              fan@demo.falak.io        / Falak@Demo2026  (fan_users table)
 *
 * Seeded: 12 Egyptian influencers, 3 campaigns, 6 offers, payments, templates
 */
import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.join(__dirname, '../../.env') });

import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { initializeDatabase, getDb } from '../db/schema';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type P = any;

const DEMO_PASS_HASH = bcrypt.hashSync('Falak@Demo2026', 10);

/* ── Helpers ────────────────────────────────────────────────────────────────── */

function upsertUser(email: string, role: string, displayName: string) {
  const db = getDb();
  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email as P) as { id: string } | undefined;
  if (existing) { console.log(`  ✓ ${role}: ${email}`); return existing.id; }
  const id = uuidv4();
  db.prepare(`INSERT INTO users (id, email, password_hash, role, display_name, status) VALUES (?, ?, ?, ?, ?, 'active')`)
    .run(id as P, email as P, DEMO_PASS_HASH as P, role as P, displayName as P);
  console.log(`  + ${role}: ${email}`);
  return id;
}

/* ── Main ───────────────────────────────────────────────────────────────────── */

async function seed() {
  initializeDatabase();
  const db = getDb();

  /* ── Platform users ──────────────────────────────────────────────────────── */
  console.log('\n── Platform Users ──────────────────────────────────────────');
  upsertUser('admin@demo.falak.io',   'platform_admin', 'Tarek Mansour (Admin)');
  upsertUser('agency@demo.falak.io',  'agency',         'New Step Media (Agency)');
  upsertUser('brand@demo.falak.io',   'brand',          'Juhayna Food Industries');
  upsertUser('manager@demo.falak.io', 'talent_manager', 'Rania Hassan (Manager)');

  /* ── Creator portal user ──────────────────────────────────────────────────── */
  console.log('\n── Creator Portal ──────────────────────────────────────────');
  const portalEmail = 'creator@demo.falak.io';
  let portalId: string;
  const existingPortal = db.prepare('SELECT id FROM portal_users WHERE email = ?').get(portalEmail as P) as { id: string } | undefined;
  if (!existingPortal) {
    portalId = uuidv4();
    db.prepare(`INSERT INTO portal_users (id, email, password_hash, name, handle, status) VALUES (?, ?, ?, ?, ?, 'active')`)
      .run(portalId as P, portalEmail as P, DEMO_PASS_HASH as P, 'Salma El-Masry' as P, '@salma.eg' as P);
    console.log(`  + Creator portal: ${portalEmail}`);
  } else {
    portalId = existingPortal.id;
    console.log(`  ✓ Creator portal: ${portalEmail}`);
  }

  /* ── Fan user ────────────────────────────────────────────────────────────── */
  console.log('\n── Fan Account ─────────────────────────────────────────────');
  const fanEmail = 'fan@demo.falak.io';
  const existingFan = db.prepare("SELECT id FROM users WHERE email = ? AND role = 'fan'").get(fanEmail as P);
  if (!existingFan) {
    const fanId = uuidv4();
    db.prepare(`INSERT INTO users (id, email, password_hash, role, display_name, status) VALUES (?, ?, ?, 'fan', ?, 'active')`)
      .run(fanId as P, fanEmail as P, DEMO_PASS_HASH as P, 'Ahmed Nasser (Fan)' as P);
    console.log(`  + Fan: ${fanEmail}`);
  } else {
    console.log(`  ✓ Fan: ${fanEmail}`);
  }

  /* ── Influencers ─────────────────────────────────────────────────────────── */
  console.log('\n── Egyptian Influencers ────────────────────────────────────');

  const influencers = [
    // ── Mega influencers ──
    {
      id: uuidv4(),
      name_english: 'Salma El-Masry',
      name_arabic: 'سلمى المصري',
      ig_handle: 'salma.elmasry',
      ig_followers: 1_420_000,
      ig_engagement_rate: 3.8,
      ig_rate: 28_000,
      tiktok_handle: 'salmaeg',
      tiktok_followers: 2_100_000,
      tiktok_rate: 35_000,
      main_category: 'Lifestyle',
      sub_category_1: 'Fashion',
      account_tier: 'mega',
      country: 'Egypt',
      city: 'Cairo',
      phone_number: '+201001234567',
      email: 'salma@demo.falak.io',
      trust_score: 95,
      trust_tier: 'TRUSTED',
      mawthouq_certificate: 1,
      tags: 'lifestyle,fashion,luxury,cairo',
      currency: 'EGP',
    },
    {
      id: uuidv4(),
      name_english: 'Karim Adel',
      name_arabic: 'كريم عادل',
      ig_handle: 'karimedge',
      ig_followers: 980_000,
      ig_engagement_rate: 4.1,
      ig_rate: 22_000,
      tiktok_handle: 'karim.edge',
      tiktok_followers: 3_800_000,
      tiktok_rate: 55_000,
      main_category: 'Comedy',
      sub_category_1: 'Entertainment',
      account_tier: 'mega',
      country: 'Egypt',
      city: 'Cairo',
      phone_number: '+201002345678',
      trust_score: 91,
      trust_tier: 'TRUSTED',
      mawthouq_certificate: 1,
      tags: 'comedy,entertainment,viral,tiktok',
      currency: 'EGP',
    },
    // ── Macro influencers ──
    {
      id: uuidv4(),
      name_english: 'Nour Ibrahim',
      name_arabic: 'نور إبراهيم',
      ig_handle: 'nouribee',
      ig_followers: 540_000,
      ig_engagement_rate: 5.2,
      ig_rate: 9_500,
      snap_handle: 'nour.snap',
      snap_followers: 320_000,
      snapchat_rate: 7_000,
      main_category: 'Beauty',
      sub_category_1: 'Skincare',
      account_tier: 'macro',
      country: 'Egypt',
      city: 'Alexandria',
      phone_number: '+201003456789',
      trust_score: 88,
      trust_tier: 'TRUSTED',
      mawthouq_certificate: 1,
      tags: 'beauty,skincare,makeup,egypt',
      currency: 'EGP',
    },
    {
      id: uuidv4(),
      name_english: 'Omar El-Sheikh',
      name_arabic: 'عمر الشيخ',
      ig_handle: 'omar.sheikh',
      ig_followers: 415_000,
      ig_engagement_rate: 4.7,
      ig_rate: 8_000,
      tiktok_handle: 'omarshk',
      tiktok_followers: 890_000,
      tiktok_rate: 14_000,
      main_category: 'Fitness',
      sub_category_1: 'Sports',
      account_tier: 'macro',
      country: 'Egypt',
      city: 'Cairo',
      phone_number: '+201004567890',
      trust_score: 86,
      trust_tier: 'TRUSTED',
      mawthouq_certificate: 1,
      tags: 'fitness,gym,sports,health',
      currency: 'EGP',
    },
    {
      id: uuidv4(),
      name_english: 'Yasmine Farouk',
      name_arabic: 'ياسمين فاروق',
      ig_handle: 'yasminefarouk',
      ig_followers: 680_000,
      ig_engagement_rate: 6.1,
      ig_rate: 12_000,
      snap_handle: 'yasmine.f',
      snap_followers: 450_000,
      snapchat_rate: 10_000,
      main_category: 'Food',
      sub_category_1: 'Recipes',
      account_tier: 'macro',
      country: 'Egypt',
      city: 'Giza',
      phone_number: '+201005678901',
      trust_score: 93,
      trust_tier: 'TRUSTED',
      mawthouq_certificate: 1,
      tags: 'food,cooking,recipes,arabic-food',
      currency: 'EGP',
    },
    // ── Micro influencers ──
    {
      id: uuidv4(),
      name_english: 'Hassan Gamal',
      name_arabic: 'حسن جمال',
      ig_handle: 'hassan.tech.eg',
      ig_followers: 82_000,
      ig_engagement_rate: 7.3,
      ig_rate: 2_200,
      tiktok_handle: 'hassantech',
      tiktok_followers: 195_000,
      tiktok_rate: 3_800,
      main_category: 'Technology',
      sub_category_1: 'Gadgets',
      account_tier: 'micro',
      country: 'Egypt',
      city: 'Cairo',
      phone_number: '+201006789012',
      trust_score: 79,
      trust_tier: 'VERIFIED',
      mawthouq_certificate: 0,
      tags: 'tech,gadgets,reviews,phones',
      currency: 'EGP',
    },
    {
      id: uuidv4(),
      name_english: 'Mariam Khaled',
      name_arabic: 'مريم خالد',
      ig_handle: 'mariamkh',
      ig_followers: 67_000,
      ig_engagement_rate: 8.9,
      ig_rate: 1_800,
      snap_handle: 'mariam.snap',
      snap_followers: 91_000,
      snapchat_rate: 2_500,
      main_category: 'Fashion',
      sub_category_1: 'Modest Fashion',
      account_tier: 'micro',
      country: 'Egypt',
      city: 'Cairo',
      phone_number: '+201007890123',
      trust_score: 74,
      trust_tier: 'VERIFIED',
      mawthouq_certificate: 0,
      tags: 'fashion,modest,hijab,ootd',
      currency: 'EGP',
    },
    {
      id: uuidv4(),
      name_english: 'Ahmed Shawky',
      name_arabic: 'أحمد شوقي',
      ig_handle: 'ahmedshawky.eg',
      ig_followers: 54_000,
      ig_engagement_rate: 6.4,
      ig_rate: 1_400,
      tiktok_handle: 'ahmedshawkyeg',
      tiktok_followers: 220_000,
      tiktok_rate: 3_200,
      main_category: 'Travel',
      sub_category_1: 'Culture',
      account_tier: 'micro',
      country: 'Egypt',
      city: 'Luxor',
      phone_number: '+201008901234',
      trust_score: 82,
      trust_tier: 'VERIFIED',
      mawthouq_certificate: 1,
      tags: 'travel,egypt,culture,tourism',
      currency: 'EGP',
    },
    // ── Nano influencers ──
    {
      id: uuidv4(),
      name_english: 'Dina Mostafa',
      name_arabic: 'دينا مصطفى',
      ig_handle: 'dina.wellness',
      ig_followers: 18_000,
      ig_engagement_rate: 11.2,
      ig_rate: 600,
      main_category: 'Wellness',
      sub_category_1: 'Mental Health',
      account_tier: 'nano',
      country: 'Egypt',
      city: 'Alexandria',
      phone_number: '+201009012345',
      trust_score: 68,
      trust_tier: 'VERIFIED',
      mawthouq_certificate: 0,
      tags: 'wellness,mentalhealth,selfcare',
      currency: 'EGP',
    },
    {
      id: uuidv4(),
      name_english: 'Mahmoud Fathy',
      name_arabic: 'محمود فتحي',
      ig_handle: 'mfathy.gaming',
      ig_followers: 31_000,
      ig_engagement_rate: 9.7,
      ig_rate: 900,
      tiktok_handle: 'mfathygaming',
      tiktok_followers: 78_000,
      tiktok_rate: 1_500,
      main_category: 'Gaming',
      sub_category_1: 'Esports',
      account_tier: 'nano',
      country: 'Egypt',
      city: 'Cairo',
      phone_number: '+201010123456',
      trust_score: 71,
      trust_tier: 'VERIFIED',
      mawthouq_certificate: 0,
      tags: 'gaming,esports,streaming,arabic',
      currency: 'EGP',
    },
    {
      id: uuidv4(),
      name_english: 'Aya Samir',
      name_arabic: 'آية سمير',
      ig_handle: 'ayasamir.home',
      ig_followers: 24_000,
      ig_engagement_rate: 10.5,
      ig_rate: 750,
      snap_handle: 'aya.home',
      snap_followers: 35_000,
      snapchat_rate: 1_000,
      main_category: 'Home & Decor',
      sub_category_1: 'Interior Design',
      account_tier: 'nano',
      country: 'Egypt',
      city: 'Giza',
      phone_number: '+201011234567',
      trust_score: 65,
      trust_tier: 'VERIFIED',
      mawthouq_certificate: 0,
      tags: 'home,decor,interior,egypt',
      currency: 'EGP',
    },
    {
      id: uuidv4(),
      name_english: 'Khaled Ragab',
      name_arabic: 'خالد رجب',
      ig_handle: 'khaledcars',
      ig_followers: 45_000,
      ig_engagement_rate: 5.8,
      ig_rate: 1_100,
      tiktok_handle: 'khaledcars.eg',
      tiktok_followers: 112_000,
      tiktok_rate: 2_000,
      main_category: 'Automotive',
      sub_category_1: 'Reviews',
      account_tier: 'micro',
      country: 'Egypt',
      city: 'Cairo',
      phone_number: '+201012345678',
      trust_score: 77,
      trust_tier: 'VERIFIED',
      mawthouq_certificate: 0,
      tags: 'cars,automotive,reviews,egypt',
      currency: 'EGP',
    },
  ];

  const insertInf = db.prepare(`
    INSERT OR IGNORE INTO influencers (
      id, name_english, name_arabic, ig_handle, ig_followers, ig_engagement_rate, ig_rate,
      tiktok_handle, tiktok_followers, tiktok_rate,
      snap_handle, snap_followers, snapchat_rate,
      main_category, sub_category_1, account_tier, country, city, phone_number, email,
      trust_score, mawthouq_certificate, tags, currency
    ) VALUES (
      ?, ?, ?, ?, ?, ?, ?,
      ?, ?, ?,
      ?, ?, ?,
      ?, ?, ?, ?, ?, ?, ?,
      ?, ?, ?, ?
    )
  `);

  for (const inf of influencers) {
    insertInf.run(
      inf.id as P, inf.name_english as P, inf.name_arabic as P,
      inf.ig_handle as P, inf.ig_followers as P, inf.ig_engagement_rate as P, inf.ig_rate as P,
      (inf.tiktok_handle ?? null) as P, (inf.tiktok_followers ?? null) as P, (inf.tiktok_rate ?? null) as P,
      (inf.snap_handle ?? null) as P, (inf.snap_followers ?? null) as P, (inf.snapchat_rate ?? null) as P,
      inf.main_category as P, (inf.sub_category_1 ?? null) as P,
      inf.account_tier as P, inf.country as P, inf.city as P,
      inf.phone_number as P, (inf.email ?? null) as P,
      inf.trust_score as P, inf.mawthouq_certificate as P, inf.tags as P, inf.currency as P
    );
    console.log(`  + ${inf.account_tier.padEnd(5)} ${inf.name_english.padEnd(22)} (@${inf.ig_handle})`);
  }

  // Update trust_tier column if it exists
  try {
    for (const inf of influencers) {
      db.prepare(`UPDATE influencers SET trust_tier = ? WHERE id = ?`).run(inf.trust_tier as P, inf.id as P);
    }
  } catch { /* column may not exist yet */ }

  /* ── Campaigns ───────────────────────────────────────────────────────────── */
  console.log('\n── Campaigns ───────────────────────────────────────────────');

  const campaigns = [
    {
      id: uuidv4(),
      name: 'Ramadan 2026 — Juhayna',
      client_name: 'Juhayna Food Industries',
      platform_focus: 'Instagram',
      start_date: '2026-03-01',
      end_date: '2026-03-30',
      budget: 450_000,
      status: 'active',
      brief: 'Ramadan awareness campaign for Juhayna dairy products. Content must show product naturally in family moments. 2 feed posts + 4 stories per influencer. Brand colours: white and green. No competitor mentions.',
    },
    {
      id: uuidv4(),
      name: 'Summer Glow — L\'Oréal Egypt',
      client_name: "L'Oréal Egypt",
      platform_focus: 'TikTok',
      start_date: '2026-05-01',
      end_date: '2026-06-30',
      budget: 220_000,
      status: 'draft',
      brief: 'Summer skincare line launch. Target 18–35 women. Show before/after transformation. Must use #SummerGlowEG hashtag. English and Arabic captions required.',
    },
    {
      id: uuidv4(),
      name: 'E-Commerce Day — Noon.com',
      client_name: 'Noon.com',
      platform_focus: 'Instagram + TikTok',
      start_date: '2026-04-01',
      end_date: '2026-04-15',
      budget: 180_000,
      status: 'completed',
      brief: 'Drive purchases during Noon\'s flash sale event. Promo code must be visible in first 3 seconds. Minimum 1M combined reach required.',
    },
  ];

  const insertCamp = db.prepare(`
    INSERT OR IGNORE INTO campaigns (id, name, client_name, platform_focus, start_date, end_date, budget, status, brief)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  for (const c of campaigns) {
    insertCamp.run(c.id as P, c.name as P, c.client_name as P, c.platform_focus as P,
      c.start_date as P, c.end_date as P, c.budget as P, c.status as P, c.brief as P);
    console.log(`  + [${c.status.padEnd(9)}] ${c.name}`);
  }

  // Add influencers to campaigns
  const insertCI = db.prepare(`INSERT OR IGNORE INTO campaign_influencers (id, campaign_id, influencer_id, platform, rate, num_posts) VALUES (?, ?, ?, ?, ?, ?)`);
  // Campaign 1 (Ramadan): macro + mega influencers
  for (let i = 0; i < 4; i++) {
    insertCI.run(uuidv4() as P, campaigns[0].id as P, influencers[i].id as P, 'Instagram' as P, influencers[i].ig_rate as P, 3 as P);
  }
  // Campaign 3 (Noon, completed): micro influencers
  for (let i = 5; i < 9; i++) {
    insertCI.run(uuidv4() as P, campaigns[2].id as P, influencers[i].id as P, 'TikTok' as P, influencers[i].tiktok_rate || influencers[i].ig_rate as P, 2 as P);
  }

  /* ── Offers ──────────────────────────────────────────────────────────────── */
  console.log('\n── Offers ──────────────────────────────────────────────────');

  const offers = [
    {
      id: uuidv4(),
      influencer_id: influencers[0].id, // Salma — linked to portal user
      campaign_id: campaigns[0].id,
      title: 'Ramadan Campaign — Salma El-Masry',
      platform: 'Instagram',
      deliverables: '2 Feed Posts + 4 Stories',
      rate: 28_000,
      currency: 'EGP',
      status: 'accepted',
      deadline: '2026-03-15',
      payment_status: 'unpaid',
    },
    {
      id: uuidv4(),
      influencer_id: influencers[1].id,
      campaign_id: campaigns[0].id,
      title: 'Ramadan Campaign — Karim Adel',
      platform: 'TikTok',
      deliverables: '2 TikTok Videos (60s)',
      rate: 55_000,
      currency: 'EGP',
      status: 'in_progress',
      deadline: '2026-03-18',
      payment_status: 'unpaid',
    },
    {
      id: uuidv4(),
      influencer_id: influencers[2].id,
      campaign_id: campaigns[0].id,
      title: 'Ramadan Campaign — Nour Ibrahim',
      platform: 'Instagram',
      deliverables: '1 Reel + 3 Stories',
      rate: 9_500,
      currency: 'EGP',
      status: 'sent',
      deadline: '2026-03-20',
      payment_status: null,
    },
    {
      id: uuidv4(),
      influencer_id: influencers[4].id,
      campaign_id: campaigns[2].id,
      title: 'Noon Flash Sale — Yasmine Farouk',
      platform: 'Instagram',
      deliverables: '3 Stories + 1 Feed Post',
      rate: 12_000,
      currency: 'EGP',
      status: 'completed',
      deadline: '2026-04-12',
      payment_status: 'paid',
    },
    {
      id: uuidv4(),
      influencer_id: influencers[5].id,
      campaign_id: campaigns[2].id,
      title: 'Noon Flash Sale — Hassan Gamal',
      platform: 'TikTok',
      deliverables: '2 TikTok Videos',
      rate: 3_800,
      currency: 'EGP',
      status: 'completed',
      deadline: '2026-04-10',
      payment_status: 'paid',
    },
    {
      id: uuidv4(),
      influencer_id: influencers[3].id,
      campaign_id: null,
      title: 'Gym Brand — Omar El-Sheikh (Direct)',
      platform: 'Instagram',
      deliverables: '1 Reel + 5 Stories',
      rate: 8_000,
      currency: 'EGP',
      status: 'submitted',
      deadline: '2026-03-25',
      payment_status: null,
    },
  ];

  const insertOffer = db.prepare(`
    INSERT OR IGNORE INTO portal_offers (id, influencer_id, campaign_id, title, platform, deliverables, rate, currency, status, deadline, payment_status, paid_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  for (const o of offers) {
    insertOffer.run(
      o.id as P, o.influencer_id as P, (o.campaign_id ?? null) as P,
      o.title as P, o.platform as P, o.deliverables as P, o.rate as P, o.currency as P,
      o.status as P, o.deadline as P,
      (o.payment_status ?? null) as P,
      (o.payment_status === 'paid' ? new Date().toISOString() : null) as P,
    );
    console.log(`  + [${o.status.padEnd(11)}] ${o.title} — EGP ${o.rate.toLocaleString()}`);
  }

  // Link portal user to Salma (first influencer)
  const pu = db.prepare('SELECT id, influencer_id FROM portal_users WHERE email = ?').get(portalEmail as P) as { id: string; influencer_id: string | null } | undefined;
  if (pu && !pu.influencer_id) {
    db.prepare('UPDATE portal_users SET influencer_id = ? WHERE id = ?').run(influencers[0].id as P, pu.id as P);
    console.log('\n  ✓ Portal user linked to Salma El-Masry');
  }
  // Link Salma's offers to the portal user
  if (pu) {
    db.prepare("UPDATE portal_offers SET portal_user_id = ? WHERE influencer_id = ?").run(pu.id as P, influencers[0].id as P);
  }

  /* ── Offer Templates ──────────────────────────────────────────────────────── */
  console.log('\n── Offer Templates ─────────────────────────────────────────');
  const templates = [
    {
      id: uuidv4(), name: 'Instagram Reel Package', platform: 'Instagram', content_type: 'Reel',
      deliverables: '1 Reel (30–60s) + 3 Stories + 1 Feed Post',
      brief: 'Show the product naturally in your content. Include a call-to-action and brand mention. Must be approved before posting.',
      currency: 'EGP', agency_notes: 'Send draft for review 5 business days before the posting date. English and Arabic captions required.',
    },
    {
      id: uuidv4(), name: 'TikTok Review Video', platform: 'TikTok', content_type: 'Video',
      deliverables: '2 TikTok Videos (45–60s each)',
      brief: 'Authentic review format: unboxing + impressions. Use trending audio. Brand hashtag mandatory. Disclose sponsored content with #ad.',
      currency: 'EGP', agency_notes: 'Hook must appear in first 2 seconds. Submit caption draft for approval.',
    },
    {
      id: uuidv4(), name: 'Snapchat Story Pack', platform: 'Snapchat', content_type: 'Story',
      deliverables: '5 Snaps + 1 Spotlight',
      brief: 'Day-in-the-life format featuring the product. Must include swipe-up link. Keep it candid and authentic.',
      currency: 'EGP', agency_notes: 'Provide story analytics screenshot 48h after posting.',
    },
  ];
  const insertTpl = db.prepare(`INSERT OR IGNORE INTO offer_templates (id, name, platform, content_type, deliverables, brief, currency, agency_notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`);
  for (const t of templates) {
    insertTpl.run(t.id as P, t.name as P, t.platform as P, t.content_type as P, t.deliverables as P, t.brief as P, t.currency as P, t.agency_notes as P);
    console.log(`  + ${t.name}`);
  }

  /* ── Summary ──────────────────────────────────────────────────────────────── */
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('  FALAK Demo Seed Complete!\n');
  console.log('  ┌─────────────────────┬────────────────────────────┬────────────────┐');
  console.log('  │ Role                │ Email                      │ Password       │');
  console.log('  ├─────────────────────┼────────────────────────────┼────────────────┤');
  console.log('  │ Platform Admin      │ admin@demo.falak.io        │ Falak@Demo2026 │');
  console.log('  │ Agency              │ agency@demo.falak.io       │ Falak@Demo2026 │');
  console.log('  │ Brand               │ brand@demo.falak.io        │ Falak@Demo2026 │');
  console.log('  │ Talent Manager      │ manager@demo.falak.io      │ Falak@Demo2026 │');
  console.log('  │ Creator Portal      │ creator@demo.falak.io      │ Falak@Demo2026 │');
  console.log('  │ Fan                 │ fan@demo.falak.io          │ Falak@Demo2026 │');
  console.log('  └─────────────────────┴────────────────────────────┴────────────────┘');
  console.log('');
  console.log('  Data: 12 Egyptian influencers · 3 campaigns · 6 offers · EGP pricing');
  console.log('  URLs: / (admin) · /portal/login (creator) · /fan (fan access)');
  console.log('═══════════════════════════════════════════════════════════════\n');
}

seed().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });
