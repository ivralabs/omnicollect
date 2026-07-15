'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  MapPin,
  Monitor,
  Compass,
  Ruler,
  Copy,
  Check,
  AlertTriangle,
  RotateCcw,
  Trash2,
  Loader2,
  Save,
  X,
  Shield,
} from 'lucide-react';

const SITE_TYPES = [
  { value: 'billboard', label: 'Billboard' },
  { value: 'screen', label: 'Digital Screen' },
  { value: 'street_furniture', label: 'Street Furniture' },
  { value: 'transit', label: 'Transit' },
];

const FACING_DIRECTIONS = [
  { value: '', label: 'Select direction...' },
  { value: 'N', label: 'North' },
  { value: 'S', label: 'South' },
  { value: 'E', label: 'East' },
  { value: 'W', label: 'West' },
  { value: 'N/A', label: 'N/A' },
];

interface Site {
  id: string;
  name: string;
  address: string;
  site_type: string;
  facing: string | null;
  gps_lat: number | null;
  gps_lng: number | null;
  screen_width_mm: number | null;
  screen_height_mm: number | null;
  is_active: boolean;
  last_seen_at: string | null;
}

interface SiteSettingsFormProps {
  site: Site;
}

export default function SiteSettingsForm({ site }: SiteSettingsFormProps) {
  const router = useRouter();
  const [isSaving, setIsSaving] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [newApiKey, setNewApiKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const [formData, setFormData] = useState({
    name: site.name,
    address: site.address,
    site_type: site.site_type,
    facing: site.facing ?? '',
    gps_lat: site.gps_lat?.toString() ?? '',
    gps_lng: site.gps_lng?.toString() ?? '',
    screen_width_mm: site.screen_width_mm?.toString() ?? '',
    screen_height_mm: site.screen_height_mm?.toString() ?? '',
    is_active: site.is_active,
  });

  const updateField = (field: keyof typeof formData, value: string | boolean) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const body: Record<string, unknown> = {
        name: formData.name.trim(),
        address: formData.address.trim(),
        site_type: formData.site_type,
        is_active: formData.is_active,
      };

      if (formData.facing) body.facing = formData.facing;
      if (formData.gps_lat) body.gps_lat = parseFloat(formData.gps_lat);
      else body.gps_lat = null;
      if (formData.gps_lng) body.gps_lng = parseFloat(formData.gps_lng);
      else body.gps_lng = null;
      if (formData.screen_width_mm) body.screen_width_mm = parseInt(formData.screen_width_mm, 10);
      else body.screen_width_mm = null;
      if (formData.screen_height_mm) body.screen_height_mm = parseInt(formData.screen_height_mm, 10);
      else body.screen_height_mm = null;

      const res = await fetch(`/api/sites/${site.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to update site');
      }

      setSuccess('Site settings saved successfully');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setIsSaving(false);
    }
  };

  const handleRegenerateKey = async () => {
    setIsRegenerating(true);
    setError(null);
    setSuccess(null);
    setNewApiKey(null);

    try {
      const res = await fetch(`/api/sites/${site.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ regenerate_key: true }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to regenerate API key');
      }

      setNewApiKey(data.api_key);
      setSuccess('API key regenerated successfully');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setIsRegenerating(false);
    }
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    setError(null);

    try {
      const res = await fetch(`/api/sites/${site.id}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to delete site');
      }

      router.push('/sites');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
      setIsDeleting(false);
    }
  };

  const copyToClipboard = async () => {
    if (!newApiKey) return;
    try {
      await navigator.clipboard.writeText(newApiKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Ignore copy errors
    }
  };

  return (
    <div className="space-y-6">
      {/* Site Details Form */}
      <div className="bg-white/5 border border-white/8 rounded-xl p-6">
        <h2 className="text-lg font-medium text-white mb-6">Site Details</h2>

        <div className="space-y-5">
          {/* Site Name */}
          <div>
            <label className="block text-sm font-medium text-white mb-2">
              Site Name
            </label>
            <div className="relative">
              <Monitor className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
              <input
                type="text"
                value={formData.name}
                onChange={(e) => updateField('name', e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-lg pl-10 pr-4 py-2.5 text-white placeholder:text-white/30 focus:outline-none focus:border-[#14B8A6] focus:ring-1 focus:ring-[#14B8A6] transition-colors"
              />
            </div>
          </div>

          {/* Address */}
          <div>
            <label className="block text-sm font-medium text-white mb-2">
              Address
            </label>
            <div className="relative">
              <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
              <input
                type="text"
                value={formData.address}
                onChange={(e) => updateField('address', e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-lg pl-10 pr-4 py-2.5 text-white placeholder:text-white/30 focus:outline-none focus:border-[#14B8A6] focus:ring-1 focus:ring-[#14B8A6] transition-colors"
              />
            </div>
          </div>

          {/* Site Type */}
          <div>
            <label className="block text-sm font-medium text-white mb-2">
              Site Type
            </label>
            <select
              value={formData.site_type}
              onChange={(e) => updateField('site_type', e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-[#14B8A6] focus:ring-1 focus:ring-[#14B8A6] transition-colors appearance-none cursor-pointer"
              style={{
                backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23999999' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E")`,
                backgroundRepeat: 'no-repeat',
                backgroundPosition: 'right 1rem center',
              }}
            >
              {SITE_TYPES.map((t) => (
                <option key={t.value} value={t.value} className="bg-[#0a0f0e]">
                  {t.label}
                </option>
              ))}
            </select>
          </div>

          {/* Facing Direction */}
          <div>
            <label className="block text-sm font-medium text-white/70 mb-2">
              Facing Direction
            </label>
            <div className="relative">
              <Compass className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
              <select
                value={formData.facing}
                onChange={(e) => updateField('facing', e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-lg pl-10 pr-4 py-2.5 text-white focus:outline-none focus:border-[#14B8A6] focus:ring-1 focus:ring-[#14B8A6] transition-colors appearance-none cursor-pointer"
                style={{
                  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23999999' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E")`,
                  backgroundRepeat: 'no-repeat',
                  backgroundPosition: 'right 1rem center',
                }}
              >
                {FACING_DIRECTIONS.map((d) => (
                  <option key={d.value} value={d.value} className="bg-[#0a0f0e]">
                    {d.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* GPS Coordinates */}
          <div>
            <label className="block text-sm font-medium text-white/70 mb-2">
              GPS Coordinates
            </label>
            <p className="text-xs text-white/40 mb-2">Used for map view</p>
            <div className="grid grid-cols-2 gap-3">
              <input
                type="number"
                step="any"
                value={formData.gps_lat}
                onChange={(e) => updateField('gps_lat', e.target.value)}
                placeholder="Latitude"
                className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-white placeholder:text-white/30 focus:outline-none focus:border-[#14B8A6] focus:ring-1 focus:ring-[#14B8A6] transition-colors"
              />
              <input
                type="number"
                step="any"
                value={formData.gps_lng}
                onChange={(e) => updateField('gps_lng', e.target.value)}
                placeholder="Longitude"
                className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-white placeholder:text-white/30 focus:outline-none focus:border-[#14B8A6] focus:ring-1 focus:ring-[#14B8A6] transition-colors"
              />
            </div>
          </div>

          {/* Screen Dimensions */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-white/70 mb-2">
                Screen Width
              </label>
              <div className="relative">
                <Ruler className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                <input
                  type="number"
                  min="0"
                  value={formData.screen_width_mm}
                  onChange={(e) => updateField('screen_width_mm', e.target.value)}
                  placeholder="mm"
                  className="w-full bg-white/5 border border-white/10 rounded-lg pl-10 pr-4 py-2.5 text-white placeholder:text-white/30 focus:outline-none focus:border-[#14B8A6] focus:ring-1 focus:ring-[#14B8A6] transition-colors"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-white/70 mb-2">
                Screen Height
              </label>
              <div className="relative">
                <Ruler className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                <input
                  type="number"
                  min="0"
                  value={formData.screen_height_mm}
                  onChange={(e) => updateField('screen_height_mm', e.target.value)}
                  placeholder="mm"
                  className="w-full bg-white/5 border border-white/10 rounded-lg pl-10 pr-4 py-2.5 text-white placeholder:text-white/30 focus:outline-none focus:border-[#14B8A6] focus:ring-1 focus:ring-[#14B8A6] transition-colors"
                />
              </div>
            </div>
          </div>

          {/* Active Status */}
          <div className="flex items-center gap-3 pt-2">
            <input
              type="checkbox"
              id="is_active"
              checked={formData.is_active}
              onChange={(e) => updateField('is_active', e.target.checked)}
              className="w-4 h-4 rounded border-white/20 bg-white/5 text-[#14B8A6] focus:ring-[#14B8A6] focus:ring-offset-0"
            />
            <label htmlFor="is_active" className="text-sm text-white cursor-pointer">
              Site is active
            </label>
          </div>
        </div>

        {error && (
          <div className="mt-6 text-sm text-red-400 bg-red-400/10 border border-red-400/20 rounded-lg px-4 py-3">
            {error}
          </div>
        )}

        {success && !newApiKey && (
          <div className="mt-6 text-sm text-green-400 bg-green-400/10 border border-green-400/20 rounded-lg px-4 py-3">
            {success}
          </div>
        )}

        <div className="mt-6 flex justify-end">
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="flex items-center gap-2 px-6 py-2.5 rounded-lg bg-[#14B8A6] hover:bg-[#0d9488] disabled:bg-[#14B8A6]/50 text-white font-medium transition-colors"
          >
            {isSaving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                Save Changes
              </>
            )}
          </button>
        </div>
      </div>

      {/* API Key Section */}
      <div className="bg-white/5 border border-white/8 rounded-xl p-6">
        <div className="flex items-center gap-3 mb-4">
          <Shield className="w-5 h-5 text-[#14B8A6]" />
          <h2 className="text-lg font-medium text-white">API Key</h2>
        </div>

        <p className="text-sm text-white/50 mb-4">
          API key is hidden for security. If you have lost it, regenerate below.
        </p>

        {newApiKey ? (
          <div className="bg-yellow-400/10 border border-yellow-400/20 rounded-lg p-4 mb-4">
            <div className="flex items-start gap-3 mb-3">
              <AlertTriangle className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm text-yellow-200 font-medium">
                  Store this API key securely
                </p>
                <p className="text-sm text-yellow-200/70 mt-1">
                  Your edge device needs this key to authenticate. It will not be shown again.
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <div className="flex-1 bg-lime-400/10 border border-lime-400/30 rounded-lg px-4 py-3 font-mono text-sm text-lime-300 break-all">
                {newApiKey}
              </div>
              <button
                onClick={copyToClipboard}
                className="px-4 py-2 bg-white/10 hover:bg-white/15 rounded-lg text-white font-medium transition-colors flex items-center gap-2"
              >
                {copied ? (
                  <>
                    <Check className="w-4 h-4" />
                    Copied
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    Copy
                  </>
                )}
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={handleRegenerateKey}
            disabled={isRegenerating}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-white/10 hover:bg-white/15 disabled:bg-white/5 text-white font-medium transition-colors"
          >
            {isRegenerating ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Regenerating...
              </>
            ) : (
              <>
                <RotateCcw className="w-4 h-4" />
                Regenerate API Key
              </>
            )}
          </button>
        )}
      </div>

      {/* Danger Zone */}
      <div className="bg-red-400/5 border border-red-400/20 rounded-xl p-6">
        <div className="flex items-center gap-3 mb-4">
          <AlertTriangle className="w-5 h-5 text-red-400" />
          <h2 className="text-lg font-medium text-white">Danger Zone</h2>
        </div>

        <p className="text-sm text-white/50 mb-4">
          Deleting a site will permanently remove all associated data including readings, alerts, and campaign associations.
        </p>

        {!showDeleteConfirm ? (
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-red-400/10 hover:bg-red-400/20 text-red-400 font-medium transition-colors"
          >
            <Trash2 className="w-4 h-4" />
            Delete Site
          </button>
        ) : (
          <div className="bg-red-400/10 border border-red-400/20 rounded-lg p-4">
            <p className="text-sm text-white mb-4">
              Are you sure? This action cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/15 text-white font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={isDeleting}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-red-400 hover:bg-red-500 disabled:bg-red-400/50 text-white font-medium transition-colors"
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Deleting...
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    Yes, Delete Site
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
