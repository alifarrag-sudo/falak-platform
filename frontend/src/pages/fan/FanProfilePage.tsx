import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { User, Save, LogOut } from 'lucide-react';
import { fanGetMe, fanUpdateMe, fanLogout } from '../../utils/api';

export default function FanProfilePage() {
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data: profile, isLoading } = useQuery({ queryKey: ['fan-me'], queryFn: fanGetMe });

  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [bio, setBio] = useState('');
  const [country, setCountry] = useState('');
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    if (profile) {
      setName(profile.name || '');
      setUsername(profile.username || '');
      setBio(profile.bio || '');
      setCountry(profile.country || '');
    }
  }, [profile]);

  const updateMutation = useMutation({
    mutationFn: () => fanUpdateMe({ name, username, bio, country }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['fan-me'] });
      toast.success('Profile updated!');
      setEditing(false);
    },
    onError: () => toast.error('Failed to update profile'),
  });

  const handleLogout = () => {
    fanLogout();
    navigate('/fan/login');
  };

  if (isLoading) return <div className="max-w-lg mx-auto px-4 py-8"><div className="h-60 bg-[#1c1c1c] rounded-2xl animate-pulse" /></div>;

  return (
    <div className="max-w-lg mx-auto px-4 py-8">
      <h1 className="text-white text-2xl font-bold mb-6">My Profile</h1>

      {/* Avatar */}
      <div className="bg-[#1c1c1c] border border-[#2a2a2a] rounded-2xl p-6 mb-6 flex items-center gap-4">
        <div className="w-16 h-16 bg-gradient-to-br from-purple-600/30 to-pink-500/30 border border-purple-500/20 rounded-full flex items-center justify-center shrink-0">
          <span className="text-2xl font-bold text-purple-300">
            {(profile?.name || profile?.email || '?')[0].toUpperCase()}
          </span>
        </div>
        <div>
          <p className="text-white font-semibold">{profile?.name || 'Fan User'}</p>
          {profile?.username && <p className="text-gray-500 text-sm">@{profile.username}</p>}
          <p className="text-gray-600 text-xs">{profile?.email}</p>
        </div>
      </div>

      {/* Edit form */}
      <div className="bg-[#1c1c1c] border border-[#2a2a2a] rounded-2xl p-6 mb-4">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-white font-semibold">Account Details</h2>
          {!editing && (
            <button onClick={() => setEditing(true)} className="text-purple-400 text-sm hover:text-purple-300">Edit</button>
          )}
        </div>

        {editing ? (
          <div className="space-y-4">
            {[
              { label: 'Full Name', value: name, setter: setName, placeholder: 'Your name' },
              { label: 'Username', value: username, setter: setUsername, placeholder: '@yourhandle' },
              { label: 'Country', value: country, setter: setCountry, placeholder: 'Saudi Arabia' },
            ].map(({ label, value, setter, placeholder }) => (
              <div key={label}>
                <label className="text-gray-400 text-sm mb-1 block">{label}</label>
                <input
                  className="w-full bg-[#252525] border border-[#2a2a2a] rounded-xl px-4 py-3 text-white placeholder-gray-600 text-sm focus:outline-none focus:border-purple-500"
                  value={value}
                  onChange={e => setter(e.target.value)}
                  placeholder={placeholder}
                />
              </div>
            ))}
            <div>
              <label className="text-gray-400 text-sm mb-1 block">Bio</label>
              <textarea
                className="w-full bg-[#252525] border border-[#2a2a2a] rounded-xl px-4 py-3 text-white placeholder-gray-600 text-sm focus:outline-none focus:border-purple-500 resize-none h-24"
                value={bio}
                onChange={e => setBio(e.target.value)}
                placeholder="Tell creators a bit about yourself..."
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => updateMutation.mutate()}
                disabled={updateMutation.isPending}
                className="flex items-center gap-2 px-4 py-2.5 bg-white text-[#0f0f0f] text-sm font-semibold rounded-xl hover:bg-gray-100 disabled:opacity-50"
              >
                <Save className="w-4 h-4" /> Save
              </button>
              <button
                onClick={() => setEditing(false)}
                className="px-4 py-2.5 bg-[#252525] border border-[#2a2a2a] text-gray-400 text-sm rounded-xl hover:border-[#3a3a3a]"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {[
              { label: 'Email', value: profile?.email },
              { label: 'Name', value: profile?.name },
              { label: 'Username', value: profile?.username ? `@${profile.username}` : null },
              { label: 'Country', value: profile?.country },
            ].filter(f => f.value).map(({ label, value }) => (
              <div key={label} className="flex justify-between py-2 border-b border-[#2a2a2a]">
                <span className="text-gray-500 text-sm">{label}</span>
                <span className="text-white text-sm">{value}</span>
              </div>
            ))}
            {profile?.bio && (
              <div className="pt-2">
                <p className="text-gray-500 text-xs mb-1">Bio</p>
                <p className="text-gray-300 text-sm">{profile.bio}</p>
              </div>
            )}
          </div>
        )}
      </div>

      <button
        onClick={handleLogout}
        className="w-full flex items-center justify-center gap-2 py-3 bg-[#1c1c1c] border border-[#2a2a2a] text-red-400 rounded-2xl hover:bg-red-400/5 hover:border-red-400/20 transition-all text-sm font-medium"
      >
        <LogOut className="w-4 h-4" /> Sign Out
      </button>
    </div>
  );
}
