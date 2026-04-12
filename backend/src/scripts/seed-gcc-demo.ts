/**
 * FALAK GCC Demo Seed — adds GCC market data ON TOP of the Egyptian seed.
 * Run with: npm run seed:gcc
 *
 * Does NOT modify seed-demo.ts or any Egyptian data.
 * All inserts use ON CONFLICT DO NOTHING — safe to re-run.
 *
 * Created:
 *   1 GCC agency user   agency@gcc.falak.io / Falak@Demo2026
 *   10 GCC influencers  KSA (4) · Kuwait (3) · UAE (2) · Qatar (1)
 *   2 GCC campaigns     Halla Shawarma · Almarai Summer GCC
 *   9 offers            SAR-priced, mixed statuses
 *   4 commissions       SAR revenue ledger entries
 */
import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.join(__dirname, '../../.env') });

import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { initializeDatabase } from '../db/schema';
import { db } from '../db/connection';

const DEMO_PASS_HASH = bcrypt.hashSync('Falak@Demo2026', 10);

/* ── Helpers ────────────────────────────────────────────────────────────────── */

async function upsertUser(email: string, role: string, displayName: string): Promise<string> {
  const existing = await db.get('SELECT id FROM users WHERE email = ?', [email]) as { id: string } | undefined;
  if (existing) { console.log(`  ✓ ${role}: ${email}`); return existing.id; }
  const id = uuidv4();
  await db.run(
    `INSERT INTO users (id, email, password_hash, role, display_name, status, is_demo) VALUES (?, ?, ?, ?, ?, 'active', 1)`,
    [id, email, DEMO_PASS_HASH, role, displayName],
  );
  console.log(`  + ${role}: ${email}`);
  return id;
}

/* ── Main ───────────────────────────────────────────────────────────────────── */

async function seedGcc() {
  initializeDatabase();

  const created = { users: 0, influencers: 0, campaigns: 0, offers: 0, commissions: 0 };

  /* ── GCC Agency User ──────────────────────────────────────────────────────── */
  console.log('\n── GCC Agency User ──────────────────────────────────────────');
  const gccAgencyId = await upsertUser('agency@gcc.falak.io', 'agency', 'Nour Creative Agency');
  created.users++;

  // Persist GCC country/city on the agency record (best-effort — column may not exist)
  try {
    await db.run(
      `UPDATE users SET display_name = ?, country = ?, city = ? WHERE id = ?`,
      ['Nour Creative Agency', 'Saudi Arabia', 'Riyadh', gccAgencyId],
    );
  } catch { /* column not present — fine */ }

  /* ── GCC Influencers ──────────────────────────────────────────────────────── */
  console.log('\n── GCC Influencers ─────────────────────────────────────────');

  const influencers = [
    // ── KSA ── (4 influencers)
    {
      id: uuidv4(),
      name_english:       'Nour Al-Rashidi',
      name_arabic:        'نور الراشدي',
      // Primary platform: Snapchat
      snap_handle:        'nour.rashidi',
      snap_followers:     87_000,
      snapchat_rate:      3_500,
      ig_handle:          'nour.rashidi.ksa',
      ig_followers:       42_000,
      ig_engagement_rate: 6.2,
      ig_rate:            2_800,
      main_category:      'Lifestyle',
      sub_category_1:     'Daily Life',
      account_tier:       'micro',
      country:            'Saudi Arabia',
      city:               'Riyadh',
      phone_number:       '+966501001001',
      email:              'nour.rashidi@gcc.falak.io',
      trust_score:        90,
      trust_tier:         'TRUSTED',
      mawthouq_certificate: 1,
      mawthouq_link:      'https://mawthooq.com/verified/nour-rashidi',
      verified_status:    'verified',
      tags:               'lifestyle,ksa,riyadh,snapchat,arabic-content',
      currency:           'SAR',
    },
    {
      id: uuidv4(),
      name_english:       'Faisal Al-Otaibi',
      name_arabic:        'فيصل العتيبي',
      // Primary platform: TikTok
      tiktok_handle:      'faisal.ksa',
      tiktok_followers:   245_000,
      tiktok_rate:        8_500,
      ig_handle:          'faisalotaibi',
      ig_followers:       88_000,
      ig_engagement_rate: 4.8,
      ig_rate:            4_200,
      main_category:      'Food',
      sub_category_1:     'Restaurants',
      account_tier:       'macro',
      country:            'Saudi Arabia',
      city:               'Riyadh',
      phone_number:       '+966501002002',
      email:              'faisal.otaibi@gcc.falak.io',
      trust_score:        88,
      trust_tier:         'TRUSTED',
      mawthouq_certificate: 1,
      mawthouq_link:      'https://mawthooq.com/verified/faisal-otaibi',
      verified_status:    'verified',
      tags:               'food,restaurants,ksa,riyadh,tiktok,arabic-content',
      currency:           'SAR',
    },
    {
      id: uuidv4(),
      name_english:       'Sara Al-Qahtani',
      name_arabic:        'سارة القحطاني',
      // Primary platform: Instagram
      ig_handle:          'sara.qahtani',
      ig_followers:       124_000,
      ig_engagement_rate: 5.1,
      ig_rate:            5_500,
      tiktok_handle:      'saraqahtani',
      tiktok_followers:   67_000,
      tiktok_rate:        3_800,
      main_category:      'Beauty',
      sub_category_1:     'Skincare',
      account_tier:       'macro',
      country:            'Saudi Arabia',
      city:               'Jeddah',
      phone_number:       '+966501003003',
      email:              'sara.qahtani@gcc.falak.io',
      trust_score:        92,
      trust_tier:         'TRUSTED',
      mawthouq_certificate: 1,
      mawthouq_link:      'https://mawthooq.com/verified/sara-qahtani',
      verified_status:    'verified',
      tags:               'beauty,skincare,makeup,ksa,jeddah,bilingual',
      currency:           'SAR',
    },
    {
      id: uuidv4(),
      name_english:       'Omar Al-Zahrani',
      name_arabic:        'عمر الزهراني',
      // Primary platform: Snapchat
      snap_handle:        'omar.zahrani',
      snap_followers:     34_000,
      snapchat_rate:      2_000,
      ig_handle:          'omarzahrani',
      ig_followers:       18_000,
      ig_engagement_rate: 8.3,
      ig_rate:            1_400,
      main_category:      'Technology',
      sub_category_1:     'Gadgets',
      account_tier:       'micro',
      country:            'Saudi Arabia',
      city:               'Riyadh',
      phone_number:       '+966501004004',
      email:              'omar.zahrani@gcc.falak.io',
      trust_score:        62,
      trust_tier:         'PENDING',
      mawthouq_certificate: 0,
      verified_status:    'pending',
      tags:               'tech,gadgets,reviews,ksa,arabic-content',
      currency:           'SAR',
    },

    // ── Kuwait ── (3 influencers)
    {
      id: uuidv4(),
      name_english:       'Dana Al-Kuwaiti',
      name_arabic:        'دانة الكويتية',
      // Primary platform: Snapchat
      snap_handle:        'dana.kuwait',
      snap_followers:     56_000,
      snapchat_rate:      850,    // KWD
      ig_handle:          'danakuwaiti',
      ig_followers:       29_000,
      ig_engagement_rate: 7.1,
      ig_rate:            550,    // KWD
      main_category:      'Fashion',
      sub_category_1:     'Modest Fashion',
      account_tier:       'micro',
      country:            'Kuwait',
      city:               'Kuwait City',
      phone_number:       '+96550100100',
      email:              'dana.kuwaiti@gcc.falak.io',
      trust_score:        78,
      trust_tier:         'TRUSTED',
      mawthouq_certificate: 0,    // compliance not required in Kuwait
      verified_status:    'verified',
      tags:               'fashion,modest-fashion,kuwait,snapchat,arabic-content',
      currency:           'KWD',
    },
    {
      id: uuidv4(),
      name_english:       'Yousef Al-Khaled',
      name_arabic:        'يوسف الخالد',
      // Primary platform: Instagram
      ig_handle:          'yousef.khaled',
      ig_followers:       91_000,
      ig_engagement_rate: 5.5,
      ig_rate:            1_200,  // KWD
      tiktok_handle:      'yousefkhaled',
      tiktok_followers:   44_000,
      tiktok_rate:        700,    // KWD
      main_category:      'Food',
      sub_category_1:     'Food Reviews',
      account_tier:       'micro',
      country:            'Kuwait',
      city:               'Kuwait City',
      phone_number:       '+96550200200',
      email:              'yousef.khaled@gcc.falak.io',
      trust_score:        80,
      trust_tier:         'TRUSTED',
      mawthouq_certificate: 0,
      verified_status:    'verified',
      tags:               'food,restaurants,kuwait,bilingual,food-reviews',
      currency:           'KWD',
    },
    {
      id: uuidv4(),
      name_english:       'Mona Al-Sabah',
      name_arabic:        'منى الصباح',
      // Primary platform: TikTok
      tiktok_handle:      'mona.sabah',
      tiktok_followers:   178_000,
      tiktok_rate:        1_800,  // KWD
      ig_handle:          'monasabah',
      ig_followers:       63_000,
      ig_engagement_rate: 6.8,
      ig_rate:            1_100,  // KWD
      main_category:      'Lifestyle',
      sub_category_1:     'Home & Family',
      account_tier:       'macro',
      country:            'Kuwait',
      city:               'Kuwait City',
      phone_number:       '+96550300300',
      email:              'mona.sabah@gcc.falak.io',
      trust_score:        82,
      trust_tier:         'TRUSTED',
      mawthouq_certificate: 0,
      verified_status:    'verified',
      tags:               'lifestyle,home,family,kuwait,tiktok,arabic-content',
      currency:           'KWD',
    },

    // ── UAE ── (2 influencers)
    {
      id: uuidv4(),
      name_english:       'Layla Hassan',
      name_arabic:        'ليلى حسن',
      // Primary platform: Instagram
      ig_handle:          'layla.hassan.uae',
      ig_followers:       203_000,
      ig_engagement_rate: 4.3,
      ig_rate:            8_000,  // AED
      tiktok_handle:      'laylahassan',
      tiktok_followers:   91_000,
      tiktok_rate:        5_500,  // AED
      main_category:      'Luxury',
      sub_category_1:     'Fashion & Travel',
      account_tier:       'macro',
      country:            'UAE',
      city:               'Dubai',
      phone_number:       '+971501001001',
      email:              'layla.hassan@gcc.falak.io',
      trust_score:        89,
      trust_tier:         'TRUSTED',
      mawthouq_certificate: 1,    // UAE influencer licence equivalent
      verified_status:    'verified',
      tags:               'luxury,fashion,travel,uae,dubai,bilingual',
      currency:           'AED',
    },
    {
      id: uuidv4(),
      name_english:       'Ahmed Al-Maktoum',
      name_arabic:        'أحمد المكتوم',
      // Primary platform: TikTok
      tiktok_handle:      'ahmed.maktoum',
      tiktok_followers:   445_000,
      tiktok_rate:        15_000, // AED
      ig_handle:          'ahmedmaktoum',
      ig_followers:       178_000,
      ig_engagement_rate: 3.9,
      ig_rate:            11_000, // AED
      main_category:      'Automotive',
      sub_category_1:     'Supercars',
      account_tier:       'macro',
      country:            'UAE',
      city:               'Dubai',
      phone_number:       '+971501002002',
      email:              'ahmed.maktoum@gcc.falak.io',
      trust_score:        58,
      trust_tier:         'PENDING',
      mawthouq_certificate: 0,    // UAE licence pending
      verified_status:    'pending',
      tags:               'cars,automotive,supercars,uae,dubai,bilingual',
      currency:           'AED',
    },

    // ── Qatar ── (1 influencer)
    {
      id: uuidv4(),
      name_english:       'Khalid Al-Thani',
      name_arabic:        'خالد الثاني',
      // Primary platform: Instagram
      ig_handle:          'khalid.thani',
      ig_followers:       67_000,
      ig_engagement_rate: 5.8,
      ig_rate:            4_500,  // QAR
      tiktok_handle:      'khalidthani',
      tiktok_followers:   38_000,
      tiktok_rate:        2_800,  // QAR
      main_category:      'Sports',
      sub_category_1:     'Football',
      account_tier:       'micro',
      country:            'Qatar',
      city:               'Doha',
      phone_number:       '+97433100100',
      email:              'khalid.thani@gcc.falak.io',
      trust_score:        76,
      trust_tier:         'TRUSTED',
      mawthouq_certificate: 0,
      verified_status:    'verified',
      tags:               'sports,football,qatar,doha,arabic-content',
      currency:           'QAR',
    },
  ];

  for (const inf of influencers) {
    const result = await db.run(
      `INSERT INTO influencers (
        id, name_english, name_arabic, ig_handle, ig_followers, ig_engagement_rate, ig_rate,
        tiktok_handle, tiktok_followers, tiktok_rate,
        snap_handle, snap_followers, snapchat_rate,
        main_category, sub_category_1, account_tier, country, city, phone_number, email,
        trust_score, mawthouq_certificate, tags, currency, is_demo
      ) VALUES (
        ?, ?, ?, ?, ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, 1
      ) ON CONFLICT (id) DO NOTHING`,
      [
        inf.id, inf.name_english, inf.name_arabic,
        (inf as any).ig_handle ?? null, (inf as any).ig_followers ?? null,
        (inf as any).ig_engagement_rate ?? null, (inf as any).ig_rate ?? null,
        (inf as any).tiktok_handle ?? null, (inf as any).tiktok_followers ?? null,
        (inf as any).tiktok_rate ?? null,
        (inf as any).snap_handle ?? null, (inf as any).snap_followers ?? null,
        (inf as any).snapchat_rate ?? null,
        inf.main_category, (inf as any).sub_category_1 ?? null,
        inf.account_tier, inf.country, inf.city,
        inf.phone_number, (inf as any).email ?? null,
        inf.trust_score, inf.mawthouq_certificate,
        inf.tags, inf.currency,
      ],
    );
    if (result.rowCount > 0) created.influencers++;

    // Extended columns (best-effort — added via later migrations)
    try {
      await db.run(
        `UPDATE influencers SET trust_tier = ?, verified_status = ?, mawthouq_link = ? WHERE id = ?`,
        [
          (inf as any).trust_tier ?? null,
          (inf as any).verified_status ?? null,
          (inf as any).mawthouq_link ?? null,
          inf.id,
        ],
      );
    } catch { /* columns may not exist yet */ }

    const flag = result.rowCount > 0 ? '+' : '✓';
    const market = `(${inf.country.split(' ')[0].substring(0, 3).toUpperCase()})`;
    console.log(`  ${flag} ${inf.account_tier.padEnd(5)} ${market} ${inf.name_english.padEnd(22)} (${inf.currency})`);
  }

  /* ── GCC Campaigns ────────────────────────────────────────────────────────── */
  console.log('\n── GCC Campaigns ───────────────────────────────────────────');

  const HALLA_BRIEF = `Product launch campaign for Halla Shawarma's new Frisco-style shawarma menu, targeting Saudi foodies and dining-out audiences.

Content Requirements:
- Show the new Frisco shawarma sandwich naturally in a real dining moment
- Content must feel organic — avoid overly staged or promotional shots
- Arabic captions required; English subtitle optional
- Must include: #حلا_شاورما #FriscoByHalla hashtags
- No competitor restaurant mentions or visible logos

Deliverables per influencer (Snapchat):
- 3 Snap stories on launch day
- 1 TikTok video (30–45 seconds, hook in first 2 seconds)

Approval:
- Submit content plan 3 business days before the posting date
- Agency approval required before going live`;

  const ALMARAI_BRIEF = `GCC-wide summer activation for Almarai's refreshed juice and dairy range, targeting health-conscious consumers aged 18–40 across KSA, UAE, and Kuwait.

Content Requirements:
- Showcase Almarai products in fresh summer settings (outdoor, poolside, family moments)
- Emphasise natural ingredients and refreshment angle
- Captions in both Arabic and English
- Must use #AlmaraiSummer #صيف_المراعي hashtags
- Show the full product range — not just one SKU

Market split:
- KSA content (Arabic primary): 3 creators
- UAE content (Bilingual): 1 creator
- Kuwait content (Arabic): 1 creator

Approval:
- Submit storyboard/caption draft 5 business days before posting
- Agency to review and turn around feedback within 48 hours`;

  const campaigns = [
    {
      id:             uuidv4(),
      name:           'Halla Shawarma — Frisco Launch',
      client_name:    'Halla Shawarma KSA',
      platform_focus: 'Snapchat + TikTok',
      start_date:     '2026-04-15',
      end_date:       '2026-05-15',
      budget:         85_000,
      currency:       'SAR',
      status:         'active',
      brief:          HALLA_BRIEF,
    },
    {
      id:             uuidv4(),
      name:           'Almarai Summer — GCC',
      client_name:    'Almarai',
      platform_focus: 'Instagram + TikTok',
      start_date:     '2026-05-01',
      end_date:       '2026-07-31',
      budget:         240_000,
      currency:       'SAR',
      status:         'active',
      brief:          ALMARAI_BRIEF,
    },
  ];

  for (const c of campaigns) {
    // Try inserting with currency; fall back to without if column missing
    try {
      const result = await db.run(
        `INSERT INTO campaigns (id, name, client_name, platform_focus, start_date, end_date, budget, status, brief, currency, is_demo)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1) ON CONFLICT (id) DO NOTHING`,
        [c.id, c.name, c.client_name, c.platform_focus, c.start_date, c.end_date, c.budget, c.status, c.brief, c.currency],
      );
      if (result.rowCount > 0) created.campaigns++;
    } catch {
      // currency column may not exist — insert without it
      const result = await db.run(
        `INSERT INTO campaigns (id, name, client_name, platform_focus, start_date, end_date, budget, status, brief, is_demo)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1) ON CONFLICT (id) DO NOTHING`,
        [c.id, c.name, c.client_name, c.platform_focus, c.start_date, c.end_date, c.budget, c.status, c.brief],
      );
      if (result.rowCount > 0) created.campaigns++;
    }
    console.log(`  + [${c.status.padEnd(9)}] ${c.name} (${c.currency} ${c.budget.toLocaleString()})`);
  }

  // Link influencers to campaigns via campaign_influencers
  // Halla Shawarma: KSA Snapchat creators + food creator
  const hallaLinks = [
    { inf: influencers[0], platform: 'Snapchat', rate: influencers[0].snapchat_rate, posts: 3 }, // Nour (snap)
    { inf: influencers[1], platform: 'TikTok',   rate: influencers[1].tiktok_rate,   posts: 1 }, // Faisal (tiktok food)
    { inf: influencers[3], platform: 'Snapchat', rate: influencers[3].snapchat_rate, posts: 3 }, // Omar (snap)
    { inf: influencers[4], platform: 'Snapchat', rate: influencers[4].snapchat_rate, posts: 2 }, // Dana Kuwait
  ];
  for (const l of hallaLinks) {
    await db.run(
      `INSERT INTO campaign_influencers (id, campaign_id, influencer_id, platform, rate, num_posts) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT (id) DO NOTHING`,
      [uuidv4(), campaigns[0].id, l.inf.id, l.platform, l.rate, l.posts],
    );
  }

  // Almarai Summer GCC: KSA beauty + tiktok, UAE Instagram, Kuwait Instagram
  const almaraiLinks = [
    { inf: influencers[2], platform: 'Instagram', rate: influencers[2].ig_rate,        posts: 3 }, // Sara KSA beauty
    { inf: influencers[1], platform: 'TikTok',    rate: influencers[1].tiktok_rate,    posts: 2 }, // Faisal KSA food
    { inf: influencers[7], platform: 'Instagram', rate: influencers[7].ig_rate,        posts: 2 }, // Layla UAE
    { inf: influencers[8], platform: 'TikTok',    rate: influencers[8].tiktok_rate,    posts: 1 }, // Ahmed UAE
    { inf: influencers[5], platform: 'Instagram', rate: influencers[5].ig_rate,        posts: 2 }, // Yousef Kuwait
  ];
  for (const l of almaraiLinks) {
    await db.run(
      `INSERT INTO campaign_influencers (id, campaign_id, influencer_id, platform, rate, num_posts) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT (id) DO NOTHING`,
      [uuidv4(), campaigns[1].id, l.inf.id, l.platform, l.rate, l.posts],
    );
  }

  /* ── Offers ───────────────────────────────────────────────────────────────── */
  console.log('\n── GCC Offers ──────────────────────────────────────────────');

  const offers = [
    // ── Halla Shawarma campaign (4 offers) ──
    {
      id: uuidv4(),
      influencer_id: influencers[0].id,  // Nour Al-Rashidi — KSA snap
      campaign_id:   campaigns[0].id,
      title:         'Halla Shawarma Launch — نور الراشدي',
      platform:      'Snapchat',
      deliverables:  '3 Snap Stories + 1 TikTok (45s)',
      brief:         HALLA_BRIEF,
      agency_notes:  'Stories on launch day. Include product clearly in frame. Stories must have swipe-up or link sticker.',
      rate:          3_500,
      currency:      'SAR',
      status:        'content_approved',
      deadline:      '2026-04-20',
    },
    {
      id: uuidv4(),
      influencer_id: influencers[1].id,  // Faisal Al-Otaibi — KSA food TikTok
      campaign_id:   campaigns[0].id,
      title:         'Halla Shawarma Launch — فيصل العتيبي',
      platform:      'TikTok',
      deliverables:  '1 TikTok Video (45s)',
      brief:         HALLA_BRIEF,
      agency_notes:  'Hook must appear in first 2 seconds. Submit draft caption for approval before posting.',
      rate:          8_500,
      currency:      'SAR',
      status:        'content_submitted',
      deadline:      '2026-04-22',
    },
    {
      id: uuidv4(),
      influencer_id: influencers[3].id,  // Omar Al-Zahrani — KSA snap tech micro
      campaign_id:   campaigns[0].id,
      title:         'Halla Shawarma Launch — عمر الزهراني',
      platform:      'Snapchat',
      deliverables:  '3 Snap Stories',
      brief:         HALLA_BRIEF,
      agency_notes:  'Focus on the unboxing / first-bite moment. Snap stories on the same day.',
      rate:          2_000,
      currency:      'SAR',
      status:        'accepted',
      deadline:      '2026-04-20',
    },
    {
      id: uuidv4(),
      influencer_id: influencers[4].id,  // Dana Al-Kuwaiti — Kuwait snap fashion
      campaign_id:   campaigns[0].id,
      title:         'Halla Shawarma Launch — دانة الكويتية',
      platform:      'Snapchat',
      deliverables:  '2 Snap Stories',
      brief:         HALLA_BRIEF,
      agency_notes:  'Kuwait audience — use Kuwaiti Arabic dialect. Include delivery ordering CTA.',
      rate:          3_500,
      currency:      'SAR',
      status:        'accepted',
      deadline:      '2026-04-25',
    },

    // ── Almarai Summer GCC campaign (5 offers) ──
    {
      id: uuidv4(),
      influencer_id: influencers[2].id,  // Sara Al-Qahtani — KSA beauty Instagram
      campaign_id:   campaigns[1].id,
      title:         'Almarai Summer KSA — سارة القحطاني',
      platform:      'Instagram',
      deliverables:  '2 Feed Posts + 4 Stories',
      brief:         ALMARAI_BRIEF,
      agency_notes:  'Lead the KSA activation. Content must showcase summer outdoor setting. English + Arabic captions.',
      rate:          5_500,
      currency:      'SAR',
      status:        'content_approved',
      deadline:      '2026-05-10',
    },
    {
      id: uuidv4(),
      influencer_id: influencers[1].id,  // Faisal Al-Otaibi — KSA food TikTok
      campaign_id:   campaigns[1].id,
      title:         'Almarai Summer KSA TikTok — فيصل العتيبي',
      platform:      'TikTok',
      deliverables:  '2 TikTok Videos (45–60s each)',
      brief:         ALMARAI_BRIEF,
      agency_notes:  'Food/drink angle — show the juice as a meal companion. Must use #AlmaraiSummer in caption.',
      rate:          8_500,
      currency:      'SAR',
      status:        'accepted',
      deadline:      '2026-05-15',
    },
    {
      id: uuidv4(),
      influencer_id: influencers[7].id,  // Layla Hassan — UAE luxury Instagram
      campaign_id:   campaigns[1].id,
      title:         'Almarai Summer UAE — Layla Hassan',
      platform:      'Instagram',
      deliverables:  '2 Feed Posts + 3 Stories',
      brief:         ALMARAI_BRIEF,
      agency_notes:  'Dubai/UAE audience. Premium lifestyle angle — poolside or beach setting preferred.',
      rate:          12_000,
      currency:      'SAR',
      status:        'content_submitted',
      deadline:      '2026-05-20',
    },
    {
      id: uuidv4(),
      influencer_id: influencers[8].id,  // Ahmed Al-Maktoum — UAE TikTok
      campaign_id:   campaigns[1].id,
      title:         'Almarai Summer UAE TikTok — Ahmed Al-Maktoum',
      platform:      'TikTok',
      deliverables:  '1 TikTok Video (60s)',
      brief:         ALMARAI_BRIEF,
      agency_notes:  'Reach-heavy format. Humorous car/summer angle possible. Must tag @Almarai.',
      rate:          20_000,
      currency:      'SAR',
      status:        'content_approved',
      deadline:      '2026-05-18',
    },
    {
      id: uuidv4(),
      influencer_id: influencers[5].id,  // Yousef Al-Khaled — Kuwait Instagram food
      campaign_id:   campaigns[1].id,
      title:         'Almarai Summer Kuwait — يوسف الخالد',
      platform:      'Instagram',
      deliverables:  '1 Feed Post + 4 Stories',
      brief:         ALMARAI_BRIEF,
      agency_notes:  'Kuwait market. Pair with local food scene context. Kuwaiti Arabic dialect in caption.',
      rate:          5_000,
      currency:      'SAR',
      status:        'accepted',
      deadline:      '2026-05-22',
    },
  ];

  for (const o of offers) {
    const result = await db.run(
      `INSERT INTO portal_offers
        (id, influencer_id, campaign_id, title, platform, deliverables, brief, agency_notes, rate, currency, status, deadline, payment_status, paid_at, is_demo)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, 1) ON CONFLICT (id) DO NOTHING`,
      [
        o.id, o.influencer_id, o.campaign_id,
        o.title, o.platform, o.deliverables,
        o.brief, o.agency_notes,
        o.rate, o.currency,
        o.status, o.deadline,
      ],
    );
    if (result.rowCount > 0) created.offers++;
    console.log(`  + [${o.status.padEnd(16)}] ${o.title.substring(0, 42)} — SAR ${o.rate.toLocaleString()}`);
  }

  // Set sent_at on new offers
  await db.run(
    `UPDATE portal_offers SET sent_at = NOW() - INTERVAL '3 days'
     WHERE status IN ('accepted','content_submitted','content_approved')
       AND sent_at IS NULL`,
  );

  /* ── Commissions (SAR revenue ledger) ────────────────────────────────────── */
  console.log('\n── GCC Commissions ─────────────────────────────────────────');

  const gccAgency = await db.get("SELECT id FROM users WHERE email = 'agency@gcc.falak.io'") as { id: string } | undefined;

  // Record commissions for the two CONTENT_APPROVED offers (Nour + Sara + Ahmed)
  const commissions = [
    {
      id: uuidv4(), transaction_type: 'offer_commission',
      reference_id: offers[0].id,
      offer_title: offers[0].title,
      influencer_id: influencers[0].id,
      agency_id: gccAgency?.id ?? null,
      gross_amount: 3_500, commission_rate: 10, commission_amount: 350, net_amount: 3_150,
      currency: 'SAR', status: 'COLLECTED',
    },
    {
      id: uuidv4(), transaction_type: 'offer_commission',
      reference_id: offers[4].id,
      offer_title: offers[4].title,
      influencer_id: influencers[2].id,
      agency_id: gccAgency?.id ?? null,
      gross_amount: 5_500, commission_rate: 10, commission_amount: 550, net_amount: 4_950,
      currency: 'SAR', status: 'COLLECTED',
    },
    {
      id: uuidv4(), transaction_type: 'offer_commission',
      reference_id: offers[7].id,
      offer_title: offers[7].title,
      influencer_id: influencers[8].id,
      agency_id: gccAgency?.id ?? null,
      gross_amount: 20_000, commission_rate: 10, commission_amount: 2_000, net_amount: 18_000,
      currency: 'SAR', status: 'COLLECTED',
    },
    {
      id: uuidv4(), transaction_type: 'offer_commission',
      reference_id: offers[6].id,
      offer_title: offers[6].title,
      influencer_id: influencers[7].id,
      agency_id: gccAgency?.id ?? null,
      gross_amount: 12_000, commission_rate: 10, commission_amount: 1_200, net_amount: 10_800,
      currency: 'SAR', status: 'PENDING',
    },
  ];

  try {
    for (const c of commissions) {
      const isPaid = c.status === 'COLLECTED';
      await db.run(
        `INSERT INTO commissions
          (id, transaction_type, reference_id, offer_title, influencer_id, agency_id,
           gross_amount, commission_rate, commission_amount, net_amount, currency, status, collected_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ${isPaid ? 'NOW()' : 'NULL'})
         ON CONFLICT (id) DO NOTHING`,
        [
          c.id, c.transaction_type, c.reference_id, c.offer_title,
          c.influencer_id, c.agency_id,
          c.gross_amount, c.commission_rate, c.commission_amount,
          c.net_amount, c.currency, c.status,
        ],
      );
      created.commissions++;
      console.log(`  + [${c.status.padEnd(9)}] ${c.offer_title.substring(0, 40)} — SAR ${c.commission_amount.toLocaleString()}`);
    }
  } catch {
    console.log('  ⚠ commissions table not ready, skipping');
  }

  /* ── Summary ──────────────────────────────────────────────────────────────── */
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('  FALAK GCC Seed Complete!\n');
  console.log('  GCC Agency Login:');
  console.log('  ┌─────────────────────┬──────────────────────────────┬────────────────┐');
  console.log('  │ Role                │ Email                        │ Password       │');
  console.log('  ├─────────────────────┼──────────────────────────────┼────────────────┤');
  console.log('  │ Agency (GCC)        │ agency@gcc.falak.io          │ Falak@Demo2026 │');
  console.log('  └─────────────────────┴──────────────────────────────┴────────────────┘');
  console.log('');
  console.log(`  Records created this run:`);
  console.log(`    Users        ${created.users}`);
  console.log(`    Influencers  ${created.influencers}  (KSA: 4 · Kuwait: 3 · UAE: 2 · Qatar: 1)`);
  console.log(`    Campaigns    ${created.campaigns}  (Halla Shawarma · Almarai Summer GCC)`);
  console.log(`    Offers       ${created.offers}  (4 Halla · 5 Almarai — SAR pricing)`);
  console.log(`    Commissions  ${created.commissions}  (3 COLLECTED · 1 PENDING — SAR)`);
  console.log('');
  console.log('  Egyptian seed data is intact and unchanged.');
  console.log('═══════════════════════════════════════════════════════════════\n');
}

seedGcc().catch(err => {
  console.error('GCC seed failed:', err);
  process.exit(1);
});
