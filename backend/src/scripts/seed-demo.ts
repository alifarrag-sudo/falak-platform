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
import { createHash } from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { initializeDatabase, getDb } from '../db/schema';

function hashFanPassword(pw: string) {
  return createHash('sha256').update(pw + 'fan_salt').digest('hex');
}

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

  /* ── Fan user (fan_users table — separate from main auth) ───────────────── */
  console.log('\n── Fan Account ─────────────────────────────────────────────');
  const fanEmail = 'fan@demo.falak.io';
  const existingFan = db.prepare('SELECT id FROM fan_users WHERE email = ?').get(fanEmail as P);
  if (!existingFan) {
    const fanId = uuidv4();
    db.prepare(`INSERT INTO fan_users (id, email, password, name, username, bio, country) VALUES (?, ?, ?, ?, ?, ?, ?)`)
      .run(fanId as P, fanEmail as P, hashFanPassword('Falak@Demo2026') as P,
        'Ahmed Nasser' as P, 'ahmed_fan' as P,
        'Music & lifestyle enthusiast from Cairo 🎵 Love discovering new creators!' as P,
        'Egypt' as P);
    console.log(`  + Fan (fan_users): ${fanEmail}`);
  } else {
    console.log(`  ✓ Fan (fan_users): ${fanEmail}`);
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

  /* ── Fan Pricing ─────────────────────────────────────────────────────────── */
  console.log('\n── Fan Marketplace Pricing ─────────────────────────────────');

  const fanPricing = [
    { idx: 0, shoutout: 800,  video: 1500, photo: 600,  meetup: null, live: 1200, bio: 'Lifestyle & fashion creator from Cairo 🌟 Book a personalised shoutout or video message for you or your loved ones!' },
    { idx: 1, shoutout: 700,  video: 1200, photo: null,  meetup: null, live: 1000, bio: 'Comedy & entertainment creator 😂 Book a funny personalised video — birthdays, shoutouts, challenges!' },
    { idx: 2, shoutout: 500,  video: 900,  photo: 450,  meetup: null, live: null, bio: 'Beauty & skincare creator from Alex 💄 Book a personalised skincare advice video or a glam shoutout!' },
    { idx: 3, shoutout: 400,  video: 800,  photo: null,  meetup: 3000, live: null, bio: 'Fitness & sports creator 💪 Book a personalised workout tip video or a motivational shoutout!' },
    { idx: 4, shoutout: 450,  video: 850,  photo: 400,  meetup: null, live: null, bio: 'Food & recipe creator 🍽️ Book a personalised recipe video or a special shoutout for foodies!' },
    { idx: 5, shoutout: 200,  video: 400,  photo: 180,  meetup: null, live: null, bio: 'Tech reviewer & gadget nerd 📱 Book a personalised tech advice video or shoutout!' },
  ];

  const updateFanPricing = db.prepare(`
    UPDATE influencers SET
      fan_shoutout_price = ?, fan_video_price = ?, fan_photo_price = ?,
      fan_meetup_price = ?, fan_live_chat_price = ?,
      fan_bio = ?, fan_requests_enabled = 1, fan_response_time = '24h',
      currency = 'EGP'
    WHERE id = ?
  `);

  for (const p of fanPricing) {
    const inf = influencers[p.idx];
    updateFanPricing.run(
      p.shoutout as P, p.video as P, (p.photo ?? null) as P,
      (p.meetup ?? null) as P, (p.live ?? null) as P,
      p.bio as P, inf.id as P
    );
    console.log(`  + Fan pricing set for ${inf.name_english} (from EGP ${p.shoutout})`);
  }

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

  const RAMADAN_BRIEF = `Ramadan awareness campaign for Juhayna dairy products.

Content Requirements:
- Show the product naturally in warm family Ramadan moments (iftar table, suhoor, family gatherings)
- 2 feed posts + 4 stories per influencer
- Captions must be in Arabic with English subtitle
- Must include: #رمضان_مع_جهينة #Juhayna hashtags
- Brand colours: white and green — no clashing backgrounds
- No competitor brand mentions or logos in frame
- Story must include a swipe-up link to the Juhayna website

Approval Process:
- Submit draft content 5 business days before the posting date
- Agency will review and provide feedback within 48 hours
- Final approval required before any content goes live

Posting Schedule:
- Stories: first 15 days of Ramadan
- Feed posts: weeks 2 and 3 of Ramadan for maximum engagement`;

  const LOREAL_BRIEF = `Summer Glow skincare line launch for L'Oréal Egypt.

Target Audience: Women aged 18–35 interested in skincare and beauty.

Content Requirements:
- Show a before/after transformation using the Summer Glow product line
- Must use #SummerGlowEG hashtag in every post
- Captions required in both English AND Arabic
- Disclose sponsorship with #ad or #sponsored
- Natural outdoor lighting preferred — summer aesthetic

Deliverables:
- 2 TikTok videos (45–60 seconds each)
- Hook must appear in the first 2 seconds
- Submit caption draft for approval before posting`;

  const NOON_BRIEF = `Drive purchases during Noon's E-Commerce Day flash sale.

Key Requirements:
- Promo code MUST be visible in the first 3 seconds of the video
- Minimum 1M combined reach across all influencers
- Call-to-action: "Shop now on Noon — link in bio"
- Use your personal promo code for tracking

Content Format:
- 3 Instagram Stories with countdown to sale
- 1 feed post announcing the deal
- Story must include the Noon sticker/link`;

  const offers = [
    // Salma: SENT offer first — so creator can demo the accept flow
    {
      id: uuidv4(),
      influencer_id: influencers[0].id,
      campaign_id: campaigns[1].id, // L'Oréal draft campaign
      title: "Summer Glow Campaign — Salma El-Masry",
      platform: 'TikTok',
      deliverables: '2 TikTok Videos (60s each)',
      brief: LOREAL_BRIEF,
      agency_notes: 'Hook in first 2 seconds. Submit caption for approval before going live.',
      rate: 35_000,
      currency: 'EGP',
      status: 'sent',
      deadline: '2026-05-20',
      payment_status: null,
    },
    // Salma: ACCEPTED offer — so creator can demo submission
    {
      id: uuidv4(),
      influencer_id: influencers[0].id,
      campaign_id: campaigns[0].id,
      title: 'Ramadan Campaign — Salma El-Masry',
      platform: 'Instagram',
      deliverables: '2 Feed Posts + 4 Stories',
      brief: RAMADAN_BRIEF,
      agency_notes: 'Send draft content 5 business days before posting. English and Arabic captions required.',
      rate: 28_000,
      currency: 'EGP',
      status: 'accepted',
      deadline: '2026-03-28',
      payment_status: 'unpaid',
    },
    {
      id: uuidv4(),
      influencer_id: influencers[1].id,
      campaign_id: campaigns[0].id,
      title: 'Ramadan Campaign — Karim Adel',
      platform: 'TikTok',
      deliverables: '2 TikTok Videos (60s)',
      brief: RAMADAN_BRIEF,
      agency_notes: 'TikTok format. Hook must appear in first 2 seconds.',
      rate: 55_000,
      currency: 'EGP',
      status: 'in_progress',
      deadline: '2026-03-25',
      payment_status: 'unpaid',
    },
    {
      id: uuidv4(),
      influencer_id: influencers[2].id,
      campaign_id: campaigns[0].id,
      title: 'Ramadan Campaign — Nour Ibrahim',
      platform: 'Instagram',
      deliverables: '1 Reel + 3 Stories',
      brief: RAMADAN_BRIEF,
      agency_notes: 'Beauty angle — focus on self-care during Ramadan.',
      rate: 9_500,
      currency: 'EGP',
      status: 'sent',
      deadline: '2026-03-30',
      payment_status: null,
    },
    {
      id: uuidv4(),
      influencer_id: influencers[4].id,
      campaign_id: campaigns[2].id,
      title: 'Noon Flash Sale — Yasmine Farouk',
      platform: 'Instagram',
      deliverables: '3 Stories + 1 Feed Post',
      brief: NOON_BRIEF,
      agency_notes: 'Food/kitchen products focus. Use personal promo code.',
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
      brief: NOON_BRIEF,
      agency_notes: 'Tech/gadget products from Noon catalogue.',
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
      brief: 'Authentic gym workout content featuring the brand\'s protein supplement. Show real training session with natural product integration. Must include before/after comparison and personal recommendation.',
      agency_notes: 'Direct deal — no campaign attached. Send invoice to agency.',
      rate: 8_000,
      currency: 'EGP',
      status: 'submitted',
      deadline: '2026-03-25',
      payment_status: null,
    },
  ];

  const insertOffer = db.prepare(`
    INSERT OR IGNORE INTO portal_offers (id, influencer_id, campaign_id, title, platform, deliverables, brief, agency_notes, rate, currency, status, deadline, payment_status, paid_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  for (const o of offers) {
    insertOffer.run(
      o.id as P, o.influencer_id as P, (o.campaign_id ?? null) as P,
      o.title as P, o.platform as P, o.deliverables as P,
      (o.brief ?? null) as P, (o.agency_notes ?? null) as P,
      o.rate as P, o.currency as P,
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

  /* ── A. Set sent_at on offers ────────────────────────────────────────────── */
  db.prepare(`
    UPDATE portal_offers SET sent_at = datetime('now', '-2 days')
    WHERE status IN ('sent', 'accepted', 'in_progress', 'submitted', 'completed')
      AND sent_at IS NULL
  `).run();
  console.log('\n  ✓ Set sent_at on portal_offers');
  const agencyUser = db.prepare("SELECT id FROM users WHERE email = 'agency@demo.falak.io'").get() as { id: string } | undefined;

  /* ── B. Commissions (revenue dashboard demo) ─────────────────────────────── */
  console.log('\n── Commissions ─────────────────────────────────────────────');
  const commissions = [
    {
      id: uuidv4(), transaction_type: 'offer_commission', reference_id: offers[4].id,
      offer_title: offers[4].title, influencer_id: influencers[4].id,
      agency_id: agencyUser?.id ?? null,
      gross_amount: 12000, commission_rate: 10, commission_amount: 1200, net_amount: 10800,
      currency: 'EGP', status: 'COLLECTED', collected_at: "datetime('now')",
    },
    {
      id: uuidv4(), transaction_type: 'offer_commission', reference_id: offers[5].id,
      offer_title: offers[5].title, influencer_id: influencers[5].id,
      agency_id: agencyUser?.id ?? null,
      gross_amount: 3800, commission_rate: 10, commission_amount: 380, net_amount: 3420,
      currency: 'EGP', status: 'COLLECTED', collected_at: "datetime('now')",
    },
    {
      id: uuidv4(), transaction_type: 'offer_commission', reference_id: offers[2].id,
      offer_title: offers[2].title, influencer_id: influencers[1].id,
      agency_id: agencyUser?.id ?? null,
      gross_amount: 55000, commission_rate: 10, commission_amount: 5500, net_amount: 49500,
      currency: 'EGP', status: 'PENDING', collected_at: null,
    },
    {
      id: uuidv4(), transaction_type: 'offer_commission', reference_id: offers[1].id,
      offer_title: offers[1].title, influencer_id: influencers[0].id,
      agency_id: agencyUser?.id ?? null,
      gross_amount: 28000, commission_rate: 10, commission_amount: 2800, net_amount: 25200,
      currency: 'EGP', status: 'PENDING', collected_at: null,
    },
  ];
  try {
    for (const c of commissions) {
      if (c.collected_at) {
        db.prepare(`
          INSERT OR IGNORE INTO commissions
            (id, transaction_type, reference_id, offer_title, influencer_id, agency_id,
             gross_amount, commission_rate, commission_amount, net_amount, currency, status, collected_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
        `).run(
          c.id as P, c.transaction_type as P, c.reference_id as P, c.offer_title as P,
          c.influencer_id as P, c.agency_id as P,
          c.gross_amount as P, c.commission_rate as P, c.commission_amount as P,
          c.net_amount as P, c.currency as P, c.status as P,
        );
      } else {
        db.prepare(`
          INSERT OR IGNORE INTO commissions
            (id, transaction_type, reference_id, offer_title, influencer_id, agency_id,
             gross_amount, commission_rate, commission_amount, net_amount, currency, status, collected_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)
        `).run(
          c.id as P, c.transaction_type as P, c.reference_id as P, c.offer_title as P,
          c.influencer_id as P, c.agency_id as P,
          c.gross_amount as P, c.commission_rate as P, c.commission_amount as P,
          c.net_amount as P, c.currency as P, c.status as P,
        );
      }
      console.log(`  + [${c.status.padEnd(9)}] ${c.offer_title} — EGP ${c.commission_amount.toLocaleString()} commission`);
    }
  } catch (err) {
    console.log('  ⚠ commissions table not ready yet, skipping');
  }

  /* ── C. Loyalty points (creator portal — Silver tier) ────────────────────── */
  console.log('\n── Loyalty Points ──────────────────────────────────────────');
  const loyaltyEntries = [
    { id: uuidv4(), action: 'offer_accepted', points: 10, reference_id: offers[0].id, note: 'Offer accepted: Summer Glow' },
    { id: uuidv4(), action: 'offer_accepted', points: 10, reference_id: offers[1].id, note: 'Offer accepted: Ramadan Campaign' },
    { id: uuidv4(), action: 'offer_completed', points: 25, reference_id: offers[4].id, note: 'Offer completed: Noon Flash Sale Yasmine' },
    { id: uuidv4(), action: 'offer_accepted', points: 10, reference_id: offers[2].id, note: 'Offer accepted: Ramadan Karim' },
    { id: uuidv4(), action: 'offer_completed', points: 25, reference_id: offers[5].id, note: 'Offer completed: Noon Flash Sale Hassan' },
    { id: uuidv4(), action: 'offer_accepted', points: 10, reference_id: offers[3].id, note: 'Offer accepted: Ramadan Nour' },
  ];
  for (const lp of loyaltyEntries) {
    try {
      db.prepare(`
        INSERT OR IGNORE INTO loyalty_points (id, user_type, user_id, action, points, reference_id, note)
        VALUES (?, 'influencer', ?, ?, ?, ?, ?)
      `).run(lp.id as P, portalId as P, lp.action as P, lp.points as P, lp.reference_id as P, lp.note as P);
      console.log(`  + ${lp.action} (+${lp.points} pts) — ${lp.note}`);
    } catch {
      console.log('  ⚠ loyalty_points table not ready yet, skipping');
    }
  }

  /* ── D. Offer messages (messaging demo) ──────────────────────────────────── */
  console.log('\n── Offer Messages ──────────────────────────────────────────');
  const offerMessages = [
    {
      id: uuidv4(), offer_id: offers[1].id, sender_type: 'agency', sender_id: agencyUser?.id ?? '',
      body: "Hi Salma! We're excited to work with you on the Ramadan campaign. Quick note on the brief — the iftar scene should ideally show the full Juhayna product range if possible. Let us know if you need anything! 🌙",
    },
    {
      id: uuidv4(), offer_id: offers[1].id, sender_type: 'influencer', sender_id: portalId,
      body: "Thanks! I've reviewed the brief carefully. Happy to show the full range — I'm thinking a beautiful iftar spread with the yoghurt and juice. Will send a shot list for approval before I start filming. Should I also tag @Juhayna in the feed posts?",
    },
    {
      id: uuidv4(), offer_id: offers[1].id, sender_type: 'agency', sender_id: agencyUser?.id ?? '',
      body: "Yes, please tag @juhayna.eg on the feed posts. Looks like a great creative direction! Send the shot list when ready and we'll confirm within 24 hours. 🙌",
    },
  ];
  try {
    for (const msg of offerMessages) {
      db.prepare(`
        INSERT OR IGNORE INTO offer_messages (id, offer_id, sender_type, sender_id, body)
        VALUES (?, ?, ?, ?, ?)
      `).run(msg.id as P, msg.offer_id as P, msg.sender_type as P, msg.sender_id as P, msg.body as P);
      console.log(`  + [${msg.sender_type.padEnd(10)}] ${msg.body.slice(0, 60)}…`);
    }
  } catch {
    console.log('  ⚠ offer_messages table not ready yet, skipping');
  }

  /* ── E. Fan request (fulfilled with shareable delivery page) ──────────────── */
  console.log('\n── Fan Request (Fulfilled) ──────────────────────────────────');
  try {
    const fanUser = db.prepare("SELECT id FROM fan_users WHERE email = 'fan@demo.falak.io'").get() as { id: string } | undefined;
    if (fanUser) {
      const fanReqId = uuidv4();
      const SHARE_TOKEN = 'demodemolivefandelivery2026xx';
      db.prepare(`
        INSERT OR IGNORE INTO fan_requests
          (id, fan_user_id, influencer_id, request_type, title, message, budget, currency,
           status, influencer_note, delivery_url, delivery_note, share_token, fan_email,
           submitted_at, responded_at, fulfilled_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
                datetime('now', '-10 days'), datetime('now', '-9 days'), datetime('now', '-8 days'))
      `).run(
        fanReqId as P,
        fanUser.id as P,
        influencers[0].id as P,
        'video_message' as P,
        'Birthday video for my sister Nadia 🎂' as P,
        "Hi Salma! My sister Nadia is your biggest fan and her birthday is this Friday. Could you record a short video wishing her happy birthday and mentioning she's been following you since 2022? Would mean the world to her!" as P,
        1500 as P, 'EGP' as P, 'fulfilled' as P,
        'What a sweet request! Happy to do this for Nadia 💛' as P,
        'https://www.tiktok.com/@salma.elmasry' as P,
        'Nadia — Happy Birthday from Cairo! 🎉 You\'ve been such a wonderful supporter and I hope this year brings you everything you\'ve been wishing for! Keep shining! — سلمى 💛' as P,
        SHARE_TOKEN as P,
        'fan@demo.falak.io' as P,
      );
      console.log(`  + Fan request: Birthday video for Nadia (fulfilled)`);
      console.log(`  + Share token: ${SHARE_TOKEN}`);
      console.log(`  + Delivery URL: /fan/delivery/${SHARE_TOKEN}`);
    }
  } catch {
    console.log('  ⚠ fan_requests table not ready / missing columns, skipping');
  }

  /* ── F. Offer ratings ────────────────────────────────────────────────────── */
  console.log('\n── Offer Ratings ───────────────────────────────────────────');
  try {
    const ratings = [
      {
        id: uuidv4(), offer_id: offers[4].id, rater_type: 'agency', rater_id: agencyUser?.id ?? '',
        rating: 5, review: "Yasmine delivered outstanding content — the Ramadan aesthetic was spot on, engagement was 3× our benchmark. Promo code visible within the first 2 seconds exactly as briefed. Would absolutely work with her again!",
      },
      {
        id: uuidv4(), offer_id: offers[5].id, rater_type: 'agency', rater_id: agencyUser?.id ?? '',
        rating: 4, review: "Solid tech content from Hassan, CTR on the promo link was above average. Minor note: the hook could have been stronger, but the product integration felt authentic. Great overall.",
      },
    ];
    for (const r of ratings) {
      db.prepare(`
        INSERT OR IGNORE INTO offer_ratings (id, offer_id, rater_type, rater_id, rating, review)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(r.id as P, r.offer_id as P, r.rater_type as P, r.rater_id as P, r.rating as P, r.review as P);
      console.log(`  + [${r.rating}★] ${r.offer_id === offers[4].id ? 'Yasmine Farouk' : 'Hassan Gamal'} — ${r.review.slice(0, 50)}…`);
    }
  } catch {
    console.log('  ⚠ offer_ratings table not ready yet, skipping');
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
  console.log('  Data: 12 Egyptian influencers · 3 campaigns · 7 offers · EGP pricing');
  console.log('        4 commissions (2 COLLECTED · 2 PENDING) · 100 loyalty pts (Silver)');
  console.log('        3 offer messages · 1 fulfilled fan request · 2 offer ratings');
  console.log('  URLs: / (admin) · /portal/login (creator) · /fan (fan access)');
  console.log('  Fan delivery demo: /fan/delivery/demodemolivefandelivery2026xx');
  console.log('  Share token: demodemolivefandelivery2026xx');
  console.log('═══════════════════════════════════════════════════════════════\n');
}

seed().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });
