export function formatFollowers(n?: number | null): string {
  if (!n) return '—';
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
  return n.toLocaleString();
}

export function formatRate(n?: number | null, currency = 'SAR'): string {
  if (!n) return '—';
  return `${currency} ${n.toLocaleString()}`;
}

export function getPrimaryPlatform(inf: { ig_handle?: string; tiktok_handle?: string; snap_handle?: string; fb_handle?: string }): string {
  if (inf.ig_handle) return 'Instagram';
  if (inf.tiktok_handle) return 'TikTok';
  if (inf.snap_handle) return 'Snapchat';
  if (inf.fb_handle) return 'Facebook';
  return '—';
}

export function getPrimaryFollowers(inf: {
  ig_handle?: string; ig_followers?: number;
  tiktok_handle?: string; tiktok_followers?: number;
  snap_handle?: string; snap_followers?: number;
}): number | null {
  if (inf.ig_handle && inf.ig_followers) return inf.ig_followers;
  if (inf.tiktok_handle && inf.tiktok_followers) return inf.tiktok_followers;
  if (inf.snap_handle && inf.snap_followers) return inf.snap_followers;
  return null;
}

export function getPrimaryRate(inf: {
  ig_rate?: number; tiktok_rate?: number; snapchat_rate?: number;
  facebook_rate?: number; package_rate?: number;
}): number | null {
  return inf.ig_rate || inf.tiktok_rate || inf.snapchat_rate || inf.facebook_rate || inf.package_rate || null;
}

export function getDisplayName(inf: { name_english?: string; name_arabic?: string; nickname?: string }): string {
  return inf.name_english || inf.name_arabic || inf.nickname || 'Unknown';
}

export function getTierColor(tier?: string): string {
  if (!tier) return 'gray';
  const t = tier.toLowerCase();
  if (t.includes('mega') || t.includes('celebrity')) return 'purple';
  if (t.includes('macro')) return 'blue';
  if (t.includes('micro')) return 'green';
  if (t.includes('nano')) return 'orange';
  return 'gray';
}

export function getCategoryColor(category?: string): string {
  if (!category) return 'gray';
  const c = category.toLowerCase();
  const colorMap: Record<string, string> = {
    beauty: 'pink',
    fashion: 'purple',
    food: 'orange',
    fitness: 'green',
    travel: 'blue',
    tech: 'indigo',
    lifestyle: 'teal',
    gaming: 'violet',
    sport: 'emerald',
    comedy: 'yellow',
  };
  for (const [key, color] of Object.entries(colorMap)) {
    if (c.includes(key)) return color;
  }
  return 'gray';
}

export function getCampaignStatusColor(status: string): string {
  const map: Record<string, string> = {
    draft: 'gray',
    sent: 'blue',
    approved: 'green',
    active: 'emerald',
    completed: 'purple',
  };
  return map[status] || 'gray';
}

export function isArabic(text: string): boolean {
  return /[\u0600-\u06FF]/.test(text);
}

export function formatDate(dateStr?: string): string {
  if (!dateStr) return '—';
  try {
    return new Date(dateStr).toLocaleDateString('en-GB', {
      day: '2-digit', month: 'short', year: 'numeric'
    });
  } catch {
    return dateStr;
  }
}

export function cn(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(' ');
}
