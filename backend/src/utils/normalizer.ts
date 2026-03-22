/**
 * Data normalization utilities for influencer data
 */

/**
 * Parse follower count strings like "1.2M", "25.4K", "1,200,000" → number
 */
export function parseFollowerCount(val: unknown): number | null {
  if (val === null || val === undefined || val === '') return null;
  const str = String(val).replace(/,/g, '').trim().toUpperCase();
  if (str === 'N/A' || str === '-' || str === 'NA') return null;

  const multipliers: Record<string, number> = { K: 1000, M: 1000000, B: 1000000000 };
  for (const [suffix, mult] of Object.entries(multipliers)) {
    if (str.endsWith(suffix)) {
      const num = parseFloat(str.slice(0, -1));
      return isNaN(num) ? null : Math.round(num * mult);
    }
  }

  const num = parseFloat(str);
  return isNaN(num) ? null : Math.round(num);
}

/**
 * Parse rate/price strings like "SAR 1,500", "sar1,650.00", "1500", "N/A" → number | null
 */
export function parseRate(val: unknown): number | null {
  if (val === null || val === undefined || val === '') return null;
  const str = String(val)
    .replace(/[,،]/g, '')
    .replace(/[A-Z]{2,3}/gi, '')  // remove currency codes
    .replace(/[$£€]/g, '')
    .trim();

  if (/^[-–—]$/.test(str) || str.toLowerCase() === 'n/a' || str.toLowerCase() === 'pending') return null;

  const num = parseFloat(str);
  return isNaN(num) ? null : num;
}

/**
 * Normalize phone number to international format
 */
export function normalizePhone(val: unknown): string | null {
  if (!val) return null;
  let str = String(val).replace(/[\s\-().]/g, '');
  if (str === '' || str.toLowerCase() === 'n/a') return null;

  // Remove leading zeros for Saudi numbers
  if (str.startsWith('05') && str.length === 10) {
    str = '+966' + str.slice(1);
  } else if (str.startsWith('5') && str.length === 9) {
    str = '+966' + str;
  } else if (str.startsWith('009665')) {
    str = '+966' + str.slice(5);
  } else if (!str.startsWith('+')) {
    str = '+' + str;
  }

  return str;
}

/**
 * Extract Instagram handle from URL or raw @handle
 */
export function extractHandle(val: unknown, platform: 'instagram' | 'tiktok' | 'snapchat' | 'facebook'): string | null {
  if (!val) return null;
  const str = String(val).trim();
  if (str === '' || str.toLowerCase() === 'n/a' || str === '-') return null;

  // Already a plain handle
  if (!str.includes('/') && !str.includes('.')) {
    return str.replace(/^@/, '');
  }

  // Extract from URL
  const patterns: Record<string, RegExp> = {
    instagram: /instagram\.com\/([^/?&#\s]+)/i,
    tiktok: /tiktok\.com\/@?([^/?&#\s]+)/i,
    snapchat: /snapchat\.com\/add\/([^/?&#\s]+)/i,
    facebook: /facebook\.com\/([^/?&#\s]+)/i,
  };

  const match = str.match(patterns[platform]);
  if (match) return match[1].replace(/^@/, '');

  // Extract @mention from text like "azez5500 (@azez5500) | TikTok"
  const atMatch = str.match(/@([a-zA-Z0-9._]+)/);
  if (atMatch) return atMatch[1];

  return null;
}

/**
 * Extract full URL from a cell value that might contain "Here", "Link", or an actual URL
 */
export function extractUrl(val: unknown): string | null {
  if (!val) return null;
  const str = String(val).trim();
  if (['here', 'link', 'n/a', '-', ''].includes(str.toLowerCase())) return null;
  if (str.startsWith('http')) return str;
  return null;
}

/**
 * Detect platform from a string
 */
export function detectPlatform(val: unknown): 'instagram' | 'tiktok' | 'snapchat' | 'facebook' | null {
  if (!val) return null;
  const str = String(val).toLowerCase().trim();
  if (str.includes('instagram') || str === 'ig' || str.includes('insta')) return 'instagram';
  if (str.includes('tiktok') || str.includes('tik tok') || str === 'ttk' || str === 'tt') return 'tiktok';
  if (str.includes('snap')) return 'snapchat';
  if (str.includes('facebook') || str === 'fb') return 'facebook';
  return null;
}

/**
 * Detect account tier from string
 */
export function detectTier(val: unknown): string | null {
  if (!val) return null;
  const str = String(val).toLowerCase().trim();
  if (str.includes('mega') || str.includes('celebrity')) return 'Mega';
  if (str.includes('macro') || str.includes('large')) return 'Macro';
  if (str.includes('micro')) return 'Micro';
  if (str.includes('nano')) return 'Nano';
  return str ? str.charAt(0).toUpperCase() + str.slice(1) : null;
}

/**
 * Fuzzy name similarity (Jaro-Winkler simplified)
 */
export function nameSimilarity(a: string, b: string): number {
  if (!a || !b) return 0;
  const na = a.toLowerCase().trim();
  const nb = b.toLowerCase().trim();
  if (na === nb) return 1;

  const maxLen = Math.max(na.length, nb.length);
  if (maxLen === 0) return 1;

  let matches = 0;
  const range = Math.floor(maxLen / 2) - 1;
  const aMatched = new Array(na.length).fill(false);
  const bMatched = new Array(nb.length).fill(false);

  for (let i = 0; i < na.length; i++) {
    const start = Math.max(0, i - range);
    const end = Math.min(i + range + 1, nb.length);
    for (let j = start; j < end; j++) {
      if (!bMatched[j] && na[i] === nb[j]) {
        aMatched[i] = true;
        bMatched[j] = true;
        matches++;
        break;
      }
    }
  }

  if (matches === 0) return 0;

  let t = 0;
  let k = 0;
  for (let i = 0; i < na.length; i++) {
    if (aMatched[i]) {
      while (!bMatched[k]) k++;
      if (na[i] !== nb[k]) t++;
      k++;
    }
  }

  const jaro = (matches / na.length + matches / nb.length + (matches - t / 2) / matches) / 3;
  const prefix = Math.min(4, [...na].findIndex((c, i) => c !== nb[i]) + 1 || 4);
  return jaro + prefix * 0.1 * (1 - jaro);
}
