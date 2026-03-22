/**
 * Fuzzy column mapper for Excel imports.
 * Maps various column name variants (English, Arabic, typos) to unified schema fields.
 */

// Canonical field -> list of known aliases (lower-cased, trimmed)
const COLUMN_ALIASES: Record<string, string[]> = {
  // Identity
  name_arabic: [
    'name arabic', 'arabic name', 'اسم', 'الاسم', 'الاسم بالعربي', 'الاسم العربي',
    'اسم بالعربي', 'اسم عربي', 'arabic', 'اسم المؤثر', 'المؤثر', 'الاسم بالعربية',
    'name_arabic', 'arabic_name', 'name ar'
  ],
  name_english: [
    'name english', 'english name', 'name', 'influencer name', 'influencer',
    'full name', 'name_english', 'english_name', 'name en', 'account name',
    'creator name', 'content creator'
  ],
  nickname: ['nickname', 'nick', 'username', 'alias', 'known as'],

  // Instagram
  ig_handle: [
    'ig', 'instagram', 'insta', 'ig handle', 'instagram handle', 'انستقرام',
    'ig account', 'instagram account', 'ig_handle', 'instagram_handle',
    'ig username', 'insta handle', '@instagram', 'ig name'
  ],
  ig_url: [
    'ig url', 'ig link', 'instagram url', 'instagram link', 'insta link',
    'ig profile', 'instagram profile', 'ig_url', 'instagram_url'
  ],
  ig_followers: [
    'ig followers', 'instagram followers', 'insta followers', 'ig following',
    'instagram following', 'ig follower count', 'insta follower count',
    'ig subs', 'followers instagram', 'instagram subs'
  ],

  // TikTok
  tiktok_handle: [
    'tiktok', 'tik tok', 'ttk', 'tt', 'tikTok handle', 'tiktok handle',
    'tiktok account', 'tiktok username', 'tiktok_handle', 'tik-tok',
    '@tiktok', 'تيك توك', 'تيكتوك'
  ],
  tiktok_url: [
    'tiktok url', 'tiktok link', 'tik tok link', 'ttk link', 'tiktok profile',
    'tiktok_url', 'tt link', 'tt url'
  ],
  tiktok_followers: [
    'tiktok followers', 'tik tok followers', 'ttk followers', 'tt followers',
    'tiktok following', 'tiktok subs', 'tt subs'
  ],

  // Snapchat
  snap_handle: [
    'snap', 'snapchat', 'snap handle', 'snapchat handle', 'snap account',
    'snapchat account', 'snap_handle', 'snapchat_handle', '@snapchat', 'سناب',
    'سناب شات', 'snapchat username'
  ],
  snap_url: [
    'snap url', 'snap link', 'snapchat url', 'snapchat link', 'snap_url'
  ],
  snap_followers: [
    'snap followers', 'snapchat followers', 'snap subs', 'snapchat subs'
  ],

  // Facebook
  fb_handle: [
    'facebook', 'fb', 'facebook handle', 'fb handle', 'fb account',
    'facebook account', 'fb_handle', 'facebook_handle', 'فيسبوك'
  ],
  fb_url: ['fb url', 'facebook url', 'fb link', 'facebook link'],
  fb_followers: ['fb followers', 'facebook followers', 'fb subs'],

  // Generic followers (when platform is a separate column)
  follower_count: [
    'followers', 'following count', 'follower count', 'subs', 'subscribers',
    'عدد المتابعين', 'متابعين', '#followers', 'no. of followers',
    'number of followers', 'follower', 'followers count', 'no of followers'
  ],

  // Platform (when in a separate column)
  platform: [
    'platform', 'social media', 'channel', 'social platform', 'media',
    'account type', 'network', 'البلاتفورم', 'المنصة',
    'account', 'social account', 'media channel'
  ],

  // Categories
  main_category: [
    'category', 'main category', 'niche', 'content type', 'type',
    'content category', 'main_category', 'primary category', 'التصنيف',
    'التخصص', 'مجال', 'القطاع', 'فئة', 'الفئة', 'account category'
  ],
  sub_category_1: [
    'sub category', 'subcategory', 'sub_category_1', 'sub category 1',
    'secondary category', 'sub niche'
  ],
  sub_category_2: [
    'sub category 2', 'sub_category_2', 'tertiary category', 'sub niche 2'
  ],

  // Tier
  account_tier: [
    'tier', 'account tier', 'influencer tier', 'type', 'account type',
    'size', 'account size', 'mega', 'macro', 'micro', 'nano',
    'level', 'influencer type'
  ],

  // Rates
  ig_rate: [
    'ig rate', 'instagram rate', 'ig price', 'instagram price',
    'ig cost', 'insta rate', 'ig_rate'
  ],
  tiktok_rate: [
    'tiktok rate', 'tik tok rate', 'tiktok price', 'tt rate',
    'ttk rate', 'tiktok_rate', 'tt price'
  ],
  snapchat_rate: [
    'snap rate', 'snapchat rate', 'snap price', 'snapchat price', 'snap_rate'
  ],
  facebook_rate: [
    'fb rate', 'facebook rate', 'fb price', 'facebook price', 'fb_rate'
  ],
  package_rate: [
    'package rate', 'package price', 'bundle rate', 'bundle price',
    'total rate', 'package', 'package_rate', 'combo rate'
  ],
  rate_per_deliverable: [
    'rate per deliverable', 'rate per post', 'per post rate', 'per deliverable',
    'post rate', 'price per post', 'rate_per_deliverable'
  ],
  price: [
    'price', 'rate', 'cost', 'fee', 'سعر', 'السعر', 'تكلفة', 'اسعار',
    'prices without vat', 'price without fees', 'booking price', 'selling',
    'price without vat', 'rate without vat', 'prices', 'fees'
  ],

  // Contact
  phone_number: [
    'phone', 'phone number', 'mobile', 'mobile number', 'contact number',
    'tel', 'telephone', 'رقم', 'رقم الهاتف', 'رقم التواصل', 'phone_number',
    'whatsapp', 'whatsapp number', 'cell'
  ],
  way_of_contact: [
    'way of contact', 'contact method', 'contact via', 'contact through',
    'how to contact', 'way_of_contact', 'contact type', 'communication'
  ],
  email: [
    'email', 'e-mail', 'mail', 'email address', 'contact email',
    'البريد', 'بريد إلكتروني'
  ],

  // Location
  nationality: [
    'nationality', 'جنسية', 'الجنسية', 'citizen', 'citizenship',
    'passport', 'national'
  ],
  country: [
    'country', 'دولة', 'البلد', 'location', 'country of residence',
    'based in', 'country_of_residence'
  ],
  city: [
    'city', 'مدينة', 'المدينة', 'town', 'region', 'area', 'district'
  ],
  address: [
    'address', 'عنوان', 'العنوان', 'full address', 'mailing address'
  ],

  // Verification
  mawthouq_certificate: [
    'mawthouq', 'mawthouq certificate', 'موثوق', 'certified', 'verification',
    'mawthouq_certificate', 'verified', 'certificate'
  ],
  national_id: [
    'national id', 'id number', 'iqama', 'residency id', 'national_id',
    'id', 'eid'
  ],

  // Media
  profile_photo_url: [
    'photo', 'profile photo', 'picture', 'image', 'profile picture',
    'avatar', 'profile image', 'photo url', 'profile_photo_url'
  ],
  media_kit_link: [
    'media kit', 'media kit link', 'portfolio', 'rate card',
    'media_kit_link', 'rate card link'
  ],

  // Notes
  internal_notes: [
    'notes', 'internal notes', 'comments', 'remarks', 'ملاحظات',
    'ملاحظة', 'note', 'internal_notes', 'memo', 'additional info'
  ],
  tags: [
    'tags', 'labels', 'tag', 'keywords', 'وسوم', 'تاغ'
  ],

  // Link (generic)
  link: [
    'link', 'url', 'profile link', 'platform link', 'social link',
    'account link', 'here', 'profile url'
  ]
};

/**
 * Normalize a string for comparison: lowercase, trim, collapse spaces
 */
function normalize(str: string): string {
  return str
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/[_\-]/g, ' ');
}

/**
 * Levenshtein distance for fuzzy matching
 */
function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  );
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}

/**
 * Similarity score 0-1 between two strings
 */
function similarity(a: string, b: string): number {
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1;
  return 1 - levenshtein(a, b) / maxLen;
}

/**
 * Map a raw column name to a schema field.
 * Returns { field, confidence } where confidence is 0-1.
 */
export function mapColumn(rawColumn: string): { field: string | null; confidence: number } {
  const norm = normalize(rawColumn);
  let bestField: string | null = null;
  let bestScore = 0;

  for (const [field, aliases] of Object.entries(COLUMN_ALIASES)) {
    for (const alias of aliases) {
      const normAlias = normalize(alias);

      // Exact match = 100%
      if (norm === normAlias) {
        return { field, confidence: 1.0 };
      }

      // Contains match — only when the shorter string is ≥60% of the longer
      if (norm.includes(normAlias) || normAlias.includes(norm)) {
        const shorter = Math.min(norm.length, normAlias.length);
        const longer = Math.max(norm.length, normAlias.length);
        if (shorter / longer >= 0.6) {
          const score = 0.85;
          if (score > bestScore) {
            bestScore = score;
            bestField = field;
          }
          continue;
        }
      }

      // Fuzzy similarity
      const sim = similarity(norm, normAlias);
      if (sim > bestScore && sim >= 0.75) {
        bestScore = sim;
        bestField = field;
      }
    }
  }

  return { field: bestField, confidence: bestScore };
}

/**
 * Map all columns in a header row to schema fields.
 * Returns array of { rawName, mappedField, confidence }
 */
export function mapHeaders(headers: string[]): Array<{
  rawName: string;
  mappedField: string | null;
  confidence: number;
  index: number;
}> {
  return headers.map((raw, index) => {
    const { field, confidence } = mapColumn(String(raw || ''));
    return {
      rawName: String(raw || ''),
      mappedField: confidence >= 0.75 ? field : null,
      confidence,
      index
    };
  });
}

export { COLUMN_ALIASES };
