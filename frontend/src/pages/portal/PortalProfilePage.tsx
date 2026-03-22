import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Save, User } from 'lucide-react';
import toast from 'react-hot-toast';
import { portalGetProfile, portalUpdateProfile, portalApi } from '../../utils/api';

const CATEGORIES = [
  'Fashion', 'Beauty', 'Fitness', 'Food', 'Travel', 'Technology',
  'Gaming', 'Lifestyle', 'Entertainment', 'Sports', 'Business', 'Education', 'Other',
];

const PLATFORMS = ['Instagram', 'TikTok', 'YouTube', 'Snapchat', 'Twitter'];

export default function PortalProfilePage() {
  const queryClient = useQueryClient();
  const { data: profile, isLoading } = useQuery({
    queryKey: ['portal-profile'],
    queryFn: portalGetProfile,
  });

  const [form, setForm] = useState({
    name: '', handle: '', phone: '', bio: '',
    category: '', country: '', rate: '',
    platforms: [] as string[],
  });

  useEffect(() => {
    if (profile) {
      const p = profile as Record<string, unknown>;
      let parsedPlatforms: string[] = [];
      if (p.platforms) {
        try {
          parsedPlatforms = typeof p.platforms === 'string'
            ? JSON.parse(p.platforms)
            : (p.platforms as string[]);
        } catch { parsedPlatforms = []; }
      }
      setForm({
        name:      String(p.name     || ''),
        handle:    String(p.handle   || ''),
        phone:     String(p.phone    || ''),
        bio:       String(p.bio      || ''),
        category:  String(p.category || ''),
        country:   String(p.country  || ''),
        rate:      String(p.rate     || ''),
        platforms: parsedPlatforms,
      });
    }
  }, [profile]);

  const updateMutation = useMutation({
    mutationFn: async () => {
      // Update portal_users record
      await portalUpdateProfile({
        name:      form.name,
        handle:    form.handle,
        phone:     form.phone,
        bio:       form.bio,
        platforms: form.platforms,
      } as Parameters<typeof portalUpdateProfile>[0]);

      // Sync to linked influencer record
      const influencer_id = (profile as Record<string, unknown>)?.influencer_id;
      if (influencer_id) {
        const ig_handle   = PLATFORMS.includes('Instagram') && form.handle?.startsWith('@') ? form.handle : undefined;
        const tiktok_handle = undefined; // handle field is generic; leave platform-specific fields to OAuth

        const influencerUpdates: Record<string, unknown> = {
          name_english: form.name || undefined,
          main_category: form.category || undefined,
          country:       form.country  || undefined,
          phone_number:  form.phone    || undefined,
          internal_notes: form.bio     || undefined,
        };
        if (ig_handle) influencerUpdates.ig_handle = ig_handle;
        if (form.rate) influencerUpdates.ig_rate = parseFloat(form.rate) || undefined;

        await portalApi.put(`/influencers/${influencer_id}`, influencerUpdates);
      }
    },
    onSuccess: () => {
      toast.success('Profile updated');
      queryClient.invalidateQueries({ queryKey: ['portal-profile'] });
    },
    onError: () => toast.error('Failed to update profile'),
  });

  if (isLoading) return (
    <div className="max-w-lg space-y-4">
      <div className="skeleton h-8 w-32" />
      <div className="card p-6 space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="skeleton h-10 w-full" />
        ))}
      </div>
    </div>
  );

  const f = (field: 'name' | 'handle' | 'phone' | 'bio' | 'category' | 'country' | 'rate') => ({
    value: form[field] as string,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      setForm(p => ({ ...p, [field]: e.target.value })),
  });

  const togglePlatform = (platform: string) => {
    setForm(p => ({
      ...p,
      platforms: p.platforms.includes(platform)
        ? p.platforms.filter(pl => pl !== platform)
        : [...p.platforms, platform],
    }));
  };

  return (
    <div className="max-w-lg space-y-5">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-surface-overlay border border-surface-border flex items-center justify-center">
          <User className="w-5 h-5 text-gray-400" />
        </div>
        <div>
          <h1 className="text-lg font-bold text-white">My Profile</h1>
          <p className="text-xs text-gray-500">{String((profile as Record<string, unknown>)?.email || '')}</p>
        </div>
      </div>

      <div className="card p-6 space-y-4">
        {/* Basic info */}
        <div>
          <label className="label">Full Name</label>
          <input className="input" placeholder="Your name" {...f('name')} />
        </div>
        <div>
          <label className="label">Instagram / TikTok Handle</label>
          <input className="input" placeholder="@yourhandle" {...f('handle')} />
        </div>
        <div>
          <label className="label">Phone / WhatsApp</label>
          <input className="input" type="tel" placeholder="+966 5x xxx xxxx" {...f('phone')} />
        </div>
        <div>
          <label className="label">Bio</label>
          <textarea
            className="input resize-none h-24 text-sm"
            placeholder="Tell us about yourself..."
            {...f('bio')}
          />
        </div>

        {/* Extended fields */}
        <div>
          <label className="label">Category</label>
          <select className="input" {...f('category')}>
            <option value="">— Select category —</option>
            {CATEGORIES.map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Country</label>
          <input className="input" placeholder="e.g. Saudi Arabia" {...f('country')} />
        </div>
        <div>
          <label className="label">Rate (SAR per post)</label>
          <input className="input" type="number" placeholder="e.g. 2500" min="0" {...f('rate')} />
        </div>

        {/* Platforms checkboxes */}
        <div>
          <label className="label">Active Platforms</label>
          <div className="flex flex-wrap gap-2 mt-1">
            {PLATFORMS.map(platform => (
              <button
                key={platform}
                type="button"
                onClick={() => togglePlatform(platform)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                  form.platforms.includes(platform)
                    ? 'bg-blue-600 border-blue-500 text-white'
                    : 'bg-surface-overlay border-surface-border text-gray-400 hover:text-gray-200'
                }`}
              >
                {platform}
              </button>
            ))}
          </div>
        </div>

        <button
          onClick={() => updateMutation.mutate()}
          disabled={updateMutation.isPending}
          className="btn-primary w-full"
        >
          <Save className="w-4 h-4" />
          {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
        </button>
      </div>
    </div>
  );
}
