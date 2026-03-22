import * as XLSX from 'xlsx';
import { v4 as uuidv4 } from 'uuid';
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type P = any;
import { getDb } from '../db/schema';
import { mapHeaders } from '../utils/columnMapper';
import {
  parseFollowerCount, parseRate, normalizePhone,
  extractHandle, extractUrl, detectPlatform, detectTier, nameSimilarity
} from '../utils/normalizer';

export interface ImportResult {
  sessionId: string;
  filename: string;
  added: number;
  updated: number;
  duplicates: number;
  errors: number;
  errorDetails: string[];
  preview?: InfluencerRow[];
}

export interface ColumnMapping {
  rawName: string;
  mappedField: string | null;
  confidence: number;
  index: number;
}

export interface InfluencerRow {
  [key: string]: unknown;
}

export interface PreviewResult {
  headers: ColumnMapping[];
  rows: InfluencerRow[];
  totalRows: number;
  sheetName: string;
}

/**
 * Parse an Excel/CSV buffer and return preview data with column mappings
 */
export function previewImport(buffer: Buffer, filename: string): PreviewResult[] {
  const wb = XLSX.read(buffer, { type: 'buffer', cellText: true, cellDates: true });
  const results: PreviewResult[] = [];

  for (const sheetName of wb.SheetNames) {
    const ws = wb.Sheets[sheetName];
    const rawData = XLSX.utils.sheet_to_json<unknown[]>(ws, {
      header: 1,
      defval: '',
      raw: false
    }) as unknown[][];

    if (rawData.length < 2) continue;

    // Find the header row (first row with multiple non-empty cells)
    let headerRowIdx = 0;
    for (let i = 0; i < Math.min(5, rawData.length); i++) {
      const row = rawData[i] as unknown[];
      const nonEmpty = row.filter(c => String(c || '').trim() !== '').length;
      if (nonEmpty >= 3) {
        headerRowIdx = i;
        break;
      }
    }

    const headerRow = (rawData[headerRowIdx] as unknown[]).map(c => String(c || '').trim());
    const headers = mapHeaders(headerRow);

    const dataRows = rawData.slice(headerRowIdx + 1).filter(row =>
      (row as unknown[]).some(c => String(c || '').trim() !== '')
    );

    const previewRows = dataRows.slice(0, 10).map(row => {
      const obj: InfluencerRow = {};
      headers.forEach(h => {
        if (h.mappedField) {
          obj[h.mappedField] = (row as unknown[])[h.index];
        }
        obj[`_raw_${h.index}`] = (row as unknown[])[h.index];
      });
      return obj;
    });

    results.push({
      sheetName,
      headers,
      rows: previewRows,
      totalRows: dataRows.length
    });
  }

  return results;
}

/**
 * Process an Excel/CSV file and import influencers into the database
 */
export async function processImport(
  buffer: Buffer,
  filename: string,
  columnOverrides?: Record<string, string>, // { rawColName: schemaField }
  skipDuplicates = false
): Promise<ImportResult> {
  const db = getDb();
  const sessionId = uuidv4();
  const errorDetails: string[] = [];
  let added = 0, updated = 0, duplicates = 0, errors = 0;

  // Create import session
  db.prepare(`
    INSERT INTO import_sessions (id, filename, status)
    VALUES (?, ?, 'processing')
  `).run(sessionId, filename);

  try {
    const wb = XLSX.read(buffer, { type: 'buffer', cellText: true });

    for (const sheetName of wb.SheetNames) {
      const ws = wb.Sheets[sheetName];
      const rawData = XLSX.utils.sheet_to_json<unknown[]>(ws, {
        header: 1,
        defval: '',
        raw: false
      }) as unknown[][];

      if (rawData.length < 2) continue;

      // Find header row
      let headerRowIdx = 0;
      for (let i = 0; i < Math.min(5, rawData.length); i++) {
        const row = rawData[i] as unknown[];
        const nonEmpty = row.filter(c => String(c || '').trim() !== '').length;
        if (nonEmpty >= 3) { headerRowIdx = i; break; }
      }

      const headerRow = (rawData[headerRowIdx] as unknown[]).map(c => String(c || '').trim());
      let headers = mapHeaders(headerRow);

      // Apply manual overrides
      if (columnOverrides) {
        headers = headers.map(h => ({
          ...h,
          mappedField: columnOverrides[h.rawName] || h.mappedField
        }));
      }

      const dataRows = rawData.slice(headerRowIdx + 1).filter(row =>
        (row as unknown[]).some(c => String(c || '').trim() !== '')
      );

      for (let rowIdx = 0; rowIdx < dataRows.length; rowIdx++) {
        const row = dataRows[rowIdx] as unknown[];

        try {
          const mapped: Record<string, unknown> = {};
          headers.forEach(h => {
            if (h.mappedField) {
              mapped[h.mappedField] = row[h.index];
            }
          });

          const influencer = buildInfluencerFromRow(mapped, filename, sheetName);

          if (!influencer.name_english && !influencer.name_arabic) {
            continue; // skip empty rows
          }

          // Duplicate detection
          const dup = findDuplicate(influencer);
          if (dup) {
            duplicates++;
            if (!skipDuplicates) {
              // Update existing record
              updateInfluencer(dup.id, influencer);
              updated++;
              duplicates--;
            }
            continue;
          }

          // Insert new
          insertInfluencer(influencer);
          added++;

        } catch (rowErr) {
          errors++;
          errorDetails.push(`Row ${rowIdx + headerRowIdx + 2}: ${(rowErr as Error).message}`);
        }
      }
    }

    // Update session
    db.prepare(`
      UPDATE import_sessions SET
        status = 'completed',
        added = ?,
        updated = ?,
        duplicates = ?,
        errors = ?,
        error_details = ?,
        completed_at = datetime('now')
      WHERE id = ?
    `).run(added, updated, duplicates, errors, JSON.stringify(errorDetails), sessionId);

  } catch (err) {
    db.prepare(`UPDATE import_sessions SET status = 'failed', error_details = ? WHERE id = ?`)
      .run(JSON.stringify([(err as Error).message]), sessionId);
    throw err;
  }

  return { sessionId, filename, added, updated, duplicates, errors, errorDetails };
}

function buildInfluencerFromRow(
  mapped: Record<string, unknown>,
  filename: string,
  sheetName: string
): Record<string, unknown> {
  const inf: Record<string, unknown> = {
    id: uuidv4(),
    supplier_source: filename,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  // Names
  inf.name_english = cleanStr(mapped.name_english);
  inf.name_arabic = cleanStr(mapped.name_arabic);
  inf.nickname = cleanStr(mapped.nickname);

  // Handle cases where name is in a generic column
  if (!inf.name_english && !inf.name_arabic) {
    const genericName = cleanStr(mapped.name);
    if (genericName) {
      // Simple heuristic: if contains Arabic chars → name_arabic, else name_english
      if (/[\u0600-\u06FF]/.test(genericName)) {
        inf.name_arabic = genericName;
      } else {
        inf.name_english = genericName;
      }
    }
  }

  // Social handles & followers - handle the "single platform per row" pattern
  const platformStr = cleanStr(mapped.platform);
  const platform = detectPlatform(platformStr || '');
  const genericFollowers = parseFollowerCount(mapped.follower_count);
  const genericRate = parseRate(mapped.price);
  const genericLink = extractUrl(mapped.link || mapped.ig_url || mapped.tiktok_url);

  // Instagram
  const igRaw = cleanStr(mapped.ig_handle || mapped.ig_url);
  inf.ig_handle = igRaw ? extractHandle(igRaw, 'instagram') || igRaw : null;
  inf.ig_url = cleanStr(mapped.ig_url) || (igRaw?.startsWith('http') ? igRaw : null);
  inf.ig_followers = parseFollowerCount(mapped.ig_followers);
  inf.ig_rate = parseRate(mapped.ig_rate);

  // TikTok
  const ttRaw = cleanStr(mapped.tiktok_handle || mapped.tiktok_url);
  inf.tiktok_handle = ttRaw ? extractHandle(ttRaw, 'tiktok') || ttRaw : null;
  inf.tiktok_url = cleanStr(mapped.tiktok_url) || (ttRaw?.startsWith('http') ? ttRaw : null);
  inf.tiktok_followers = parseFollowerCount(mapped.tiktok_followers);
  inf.tiktok_rate = parseRate(mapped.tiktok_rate);

  // Snapchat
  const snapRaw = cleanStr(mapped.snap_handle || mapped.snap_url);
  inf.snap_handle = snapRaw ? extractHandle(snapRaw, 'snapchat') || snapRaw : null;
  inf.snap_url = cleanStr(mapped.snap_url) || (snapRaw?.startsWith('http') ? snapRaw : null);
  inf.snap_followers = parseFollowerCount(mapped.snap_followers);
  inf.snapchat_rate = parseRate(mapped.snapchat_rate);

  // Facebook
  const fbRaw = cleanStr(mapped.fb_handle || mapped.fb_url);
  inf.fb_handle = fbRaw ? extractHandle(fbRaw, 'facebook') || fbRaw : null;
  inf.fb_url = cleanStr(mapped.fb_url) || (fbRaw?.startsWith('http') ? fbRaw : null);
  inf.fb_followers = parseFollowerCount(mapped.fb_followers);
  inf.facebook_rate = parseRate(mapped.facebook_rate);

  // If platform column exists and generic followers/link, assign to correct platform
  if (platform && genericFollowers) {
    if (platform === 'instagram' && !inf.ig_followers) inf.ig_followers = genericFollowers;
    if (platform === 'tiktok' && !inf.tiktok_followers) inf.tiktok_followers = genericFollowers;
    if (platform === 'snapchat' && !inf.snap_followers) inf.snap_followers = genericFollowers;
    if (platform === 'facebook' && !inf.fb_followers) inf.fb_followers = genericFollowers;
  }
  if (platform && genericRate) {
    if (platform === 'instagram' && !inf.ig_rate) inf.ig_rate = genericRate;
    if (platform === 'tiktok' && !inf.tiktok_rate) inf.tiktok_rate = genericRate;
    if (platform === 'snapchat' && !inf.snapchat_rate) inf.snapchat_rate = genericRate;
    if (platform === 'facebook' && !inf.facebook_rate) inf.facebook_rate = genericRate;
  }
  if (platform && genericLink) {
    if (platform === 'instagram' && !inf.ig_url) inf.ig_url = genericLink;
    if (platform === 'tiktok' && !inf.tiktok_url) inf.tiktok_url = genericLink;
  }

  // Package rate fallback
  inf.package_rate = parseRate(mapped.package_rate);
  inf.rate_per_deliverable = parseRate(mapped.rate_per_deliverable);

  // If no platform-specific rate but we have a generic price/rate
  if (genericRate && !inf.ig_rate && !inf.tiktok_rate && !inf.snapchat_rate) {
    inf.package_rate = inf.package_rate || genericRate;
  }

  // Categories
  inf.main_category = cleanStr(mapped.main_category || mapped.category);
  inf.sub_category_1 = cleanStr(mapped.sub_category_1);
  inf.sub_category_2 = cleanStr(mapped.sub_category_2);

  // Account tier
  inf.account_tier = detectTier(mapped.account_tier || mapped.type);

  // Contact
  inf.phone_number = normalizePhone(mapped.phone_number);
  inf.way_of_contact = cleanStr(mapped.way_of_contact) || (inf.phone_number ? 'WhatsApp' : null);
  inf.email = cleanStr(mapped.email);

  // Location
  inf.nationality = cleanStr(mapped.nationality);
  inf.country = cleanStr(mapped.country) || cleanStr(mapped.address);
  inf.city = cleanStr(mapped.city);
  inf.address = cleanStr(mapped.address);

  // Verification
  const maw = cleanStr(mapped.mawthouq_certificate);
  inf.mawthouq_certificate = maw && !['no', 'n/a', '0', 'false'].includes(maw.toLowerCase()) ? 1 : 0;
  inf.national_id = cleanStr(mapped.national_id);

  // Notes
  inf.internal_notes = cleanStr(mapped.internal_notes);
  inf.tags = cleanStr(mapped.tags);

  return inf;
}

function cleanStr(val: unknown): string | null {
  if (val === null || val === undefined) return null;
  const str = String(val).trim();
  if (['', 'n/a', 'na', '-', '–', 'none', 'null', 'undefined'].includes(str.toLowerCase())) return null;
  return str;
}

function findDuplicate(influencer: Record<string, unknown>): { id: string } | null {
  const db = getDb();

  // Check by IG handle
  if (influencer.ig_handle) {
    const row = db.prepare('SELECT id FROM influencers WHERE ig_handle = ? AND is_archived = 0')
      .get(influencer.ig_handle as string) as { id: string } | undefined;
    if (row) return row;
  }

  // Check by TikTok handle
  if (influencer.tiktok_handle) {
    const row = db.prepare('SELECT id FROM influencers WHERE tiktok_handle = ? AND is_archived = 0')
      .get(influencer.tiktok_handle as string) as { id: string } | undefined;
    if (row) return row;
  }

  // Check by name similarity
  if (influencer.name_english) {
    const candidates = db.prepare('SELECT id, name_english FROM influencers WHERE is_archived = 0')
      .all() as { id: string; name_english: string }[];

    for (const c of candidates) {
      if (c.name_english && nameSimilarity(c.name_english, influencer.name_english as string) >= 0.9) {
        return { id: c.id };
      }
    }
  }

  return null;
}

function insertInfluencer(inf: Record<string, unknown>): void {
  const db = getDb();
  const fields = Object.keys(inf).filter(k => inf[k] !== null && inf[k] !== undefined);
  const placeholders = fields.map(() => '?').join(', ');
  const values = fields.map(f => inf[f]);

  db.prepare(`INSERT OR IGNORE INTO influencers (${fields.join(', ')}) VALUES (${placeholders})`)
    .run(...values as P[]);
}

function updateInfluencer(id: string, inf: Record<string, unknown>): void {
  const db = getDb();
  const updateFields = Object.keys(inf).filter(k =>
    !['id', 'created_at'].includes(k) && inf[k] !== null && inf[k] !== undefined
  );
  if (updateFields.length === 0) return;

  const setClause = updateFields.map(f => `${f} = ?`).join(', ');
  const values = updateFields.map(f => inf[f]);

  db.prepare(`UPDATE influencers SET ${setClause}, updated_at = datetime('now') WHERE id = ?`)
    .run(...values as P[], id);
}
