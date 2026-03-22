import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Save, Upload, Download, Key, Palette, Building2, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';
import { getSettings, updateSettings, uploadLogo, exportAllData, getEnrichmentStatus, bulkEnrich } from '../utils/api';
import type { Settings } from '../types';
import { cn } from '../utils/helpers';

function SectionHeader({ icon: Icon, title }: { icon: React.ElementType; title: string }) {
  return (
    <div className="flex items-center gap-2 mb-4 pb-3 border-b border-surface-border">
      <Icon className="w-4 h-4 text-gray-400" />
      <h2 className="text-sm font-semibold text-gray-200">{title}</h2>
    </div>
  );
}

export default function SettingsPage() {
  const [form, setForm] = useState<Partial<Settings>>({} as Partial<Settings>);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [enrichLoading, setEnrichLoading] = useState(false);

  const { data: settings, isLoading } = useQuery({
    queryKey: ['settings'],
    queryFn: getSettings,
  });

  const { data: enrichStatus } = useQuery({
    queryKey: ['enrichment-status'],
    queryFn: getEnrichmentStatus,
    refetchInterval: 10000,
  });

  const saveMutation = useMutation({
    mutationFn: () => updateSettings(form),
    onSuccess: () => toast.success('Settings saved'),
    onError: () => toast.error('Failed to save'),
  });

  const logoMutation = useMutation({
    mutationFn: () => uploadLogo(logoFile!),
    onSuccess: (data) => {
      setForm(p => ({ ...p, logo_url: data.logo_url }));
      toast.success('Logo uploaded');
      setLogoFile(null);
    },
  });

  const handleBulkEnrich = async () => {
    setEnrichLoading(true);
    try {
      await bulkEnrich();
      toast.success('Bulk enrichment started in background');
    } finally {
      setEnrichLoading(false);
    }
  };

  if (settings && !form.company_name && !form.default_currency) {
    Object.assign(form, settings);
  }

  const f = (key: keyof Settings) => ({
    value: (form as Record<string, string>)[key] || (settings as Record<string, string> | undefined)?.[key] || '',
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm(p => ({ ...p, [key]: e.target.value }))
  });

  if (isLoading) return (
    <div className="space-y-4 max-w-2xl">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="card p-5 space-y-3">
          <div className="skeleton h-5 w-32" />
          <div className="skeleton h-10 w-full" />
        </div>
      ))}
    </div>
  );

  return (
    <div className="max-w-2xl space-y-5">
      {/* Company */}
      <div className="card p-5 space-y-4">
        <SectionHeader icon={Building2} title="Company" />
        <div>
          <label className="label">Company Name</label>
          <input className="input" placeholder="C&P" {...f('company_name')} />
        </div>
        <div>
          <label className="label">Logo</label>
          <div className="flex items-center gap-3">
            {(form.logo_url || settings?.logo_url) && (
              <img
                src={String(form.logo_url || settings?.logo_url || '')}
                alt="logo"
                className="h-12 object-contain border border-surface-border rounded-lg px-2 bg-surface-overlay"
              />
            )}
            <div className="flex gap-2">
              <label className="btn-secondary cursor-pointer">
                <Upload className="w-4 h-4" /> Choose Logo
                <input type="file" className="hidden" accept="image/*" onChange={e => setLogoFile(e.target.files?.[0] || null)} />
              </label>
              {logoFile && (
                <button onClick={() => logoMutation.mutate()} disabled={logoMutation.isPending} className="btn-primary">
                  {logoMutation.isPending ? 'Uploading...' : `Upload "${logoFile.name}"`}
                </button>
              )}
            </div>
          </div>
        </div>
        <div>
          <label className="label">Default Currency</label>
          <select className="input w-48" {...f('default_currency')}>
            <option value="SAR">SAR — Saudi Riyal</option>
            <option value="EGP">EGP — Egyptian Pound</option>
            <option value="USD">USD — US Dollar</option>
            <option value="AED">AED — UAE Dirham</option>
          </select>
        </div>
      </div>

      {/* PDF Styling */}
      <div className="card p-5 space-y-4">
        <SectionHeader icon={Palette} title="PDF Proposal Style" />
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Primary Color</label>
            <div className="flex gap-2 items-center">
              <input
                type="color"
                className="w-10 h-10 rounded-lg border border-surface-border cursor-pointer p-0.5 bg-surface-overlay"
                value={(form as Record<string,string>).pdf_primary_color || (settings as Record<string,string>|undefined)?.pdf_primary_color || '#1c1c1c'}
                onChange={e => setForm(p => ({ ...p, pdf_primary_color: e.target.value }))}
              />
              <input
                className="input flex-1"
                value={(form as Record<string,string>).pdf_primary_color || (settings as Record<string,string>|undefined)?.pdf_primary_color || '#1c1c1c'}
                onChange={e => setForm(p => ({ ...p, pdf_primary_color: e.target.value }))}
              />
            </div>
          </div>
          <div>
            <label className="label">Secondary Color</label>
            <div className="flex gap-2 items-center">
              <input
                type="color"
                className="w-10 h-10 rounded-lg border border-surface-border cursor-pointer p-0.5 bg-surface-overlay"
                value={(form as Record<string,string>).pdf_secondary_color || (settings as Record<string,string>|undefined)?.pdf_secondary_color || '#333333'}
                onChange={e => setForm(p => ({ ...p, pdf_secondary_color: e.target.value }))}
              />
              <input
                className="input flex-1"
                value={(form as Record<string,string>).pdf_secondary_color || (settings as Record<string,string>|undefined)?.pdf_secondary_color || '#333333'}
                onChange={e => setForm(p => ({ ...p, pdf_secondary_color: e.target.value }))}
              />
            </div>
          </div>
        </div>
      </div>

      {/* API Keys */}
      <div className="card p-5 space-y-4">
        <SectionHeader icon={Key} title="API Keys (for Social Data Enrichment)" />
        <div>
          <label className="label">RapidAPI Key</label>
          <input
            type="password"
            className="input font-mono"
            placeholder="Enter your RapidAPI key..."
            {...f('rapidapi_key')}
          />
          <p className="text-xs text-gray-500 mt-1.5">
            Fetches follower counts from Instagram &amp; TikTok. Subscribe to <em>Instagram Scraper API2</em> and <em>TikTok API23</em> on rapidapi.com.
          </p>
        </div>
      </div>

      {/* Data Enrichment */}
      <div className="card p-5 space-y-4">
        <SectionHeader icon={RefreshCw} title="Data Enrichment" />
        {enrichStatus && (
          <div className="grid grid-cols-3 gap-3">
            {(enrichStatus as Array<{ enrichment_status: string; count: number }>).map((s) => (
              <div key={s.enrichment_status} className="bg-surface-overlay rounded-lg p-3 text-center border border-surface-border">
                <div className="text-xl font-bold text-white">{s.count}</div>
                <div className="text-xs text-gray-500 mt-0.5">
                  {s.enrichment_status === 'pending'      ? 'Pending' :
                   s.enrichment_status === 'enriched'     ? 'Enriched' :
                   s.enrichment_status === 'lookup_failed'? 'Failed' : s.enrichment_status}
                </div>
              </div>
            ))}
          </div>
        )}
        <button onClick={handleBulkEnrich} disabled={enrichLoading} className="btn-primary">
          <RefreshCw className={cn('w-4 h-4', enrichLoading && 'animate-spin')} />
          {enrichLoading ? 'Starting...' : 'Bulk Enrich All Pending'}
        </button>
        <p className="text-xs text-gray-500">Enriches up to 50 influencers at a time in the background.</p>
      </div>

      {/* Data Export */}
      <div className="card p-5">
        <SectionHeader icon={Download} title="Data Backup" />
        <button onClick={exportAllData} className="btn-secondary">
          <Download className="w-4 h-4" /> Export All Data as Excel
        </button>
        <p className="text-xs text-gray-500 mt-2">Downloads all influencers as an Excel file.</p>
      </div>

      {/* Save */}
      <div className="flex justify-end pb-6">
        <button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending} className="btn-primary btn-lg">
          <Save className="w-4 h-4" /> {saveMutation.isPending ? 'Saving...' : 'Save Settings'}
        </button>
      </div>
    </div>
  );
}
