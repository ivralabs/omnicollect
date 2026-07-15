'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  MapPin,
  Monitor,
  Compass,
  Ruler,
  Copy,
  Check,
  AlertTriangle,
  Plus,
  ArrowRight,
  Loader2,
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

type Step = 'details' | 'dimensions' | 'success';

interface FormData {
  name: string;
  address: string;
  site_type: string;
  facing: string;
  gps_lat: string;
  gps_lng: string;
  screen_width_mm: string;
  screen_height_mm: string;
}

interface SiteResponse {
  site: {
    id: string;
    name: string;
    address: string;
    site_type: string;
  };
  api_key: string;
}

export default function CreateSiteForm() {
  const router = useRouter();
  const [step, setStep] = useState<Step>('details');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SiteResponse | null>(null);
  const [copied, setCopied] = useState(false);

  const [formData, setFormData] = useState<FormData>({
    name: '',
    address: '',
    site_type: '',
    facing: '',
    gps_lat: '',
    gps_lng: '',
    screen_width_mm: '',
    screen_height_mm: '',
  });

  const updateField = (field: keyof FormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const validateDetails = (): boolean => {
    if (!formData.name.trim()) {
      setError('Site name is required');
      return false;
    }
    if (!formData.address.trim()) {
      setError('Address is required');
      return false;
    }
    if (!formData.site_type) {
      setError('Site type is required');
      return false;
    }
    setError(null);
    return true;
  };

  const handleNext = () => {
    if (step === 'details' && validateDetails()) {
      setStep('dimensions');
    }
  };

  const handleBack = () => {
    if (step === 'dimensions') {
      setStep('details');
    }
  };

  const handleSubmit = async () => {
    if (!validateDetails()) return;

    setIsSubmitting(true);
    setError(null);

    try {
      const body: Record<string, unknown> = {
        name: formData.name.trim(),
        address: formData.address.trim(),
        site_type: formData.site_type,
      };

      if (formData.facing) body.facing = formData.facing;
      if (formData.gps_lat) body.gps_lat = parseFloat(formData.gps_lat);
      if (formData.gps_lng) body.gps_lng = parseFloat(formData.gps_lng);
      if (formData.screen_width_mm) body.screen_width_mm = parseInt(formData.screen_width_mm, 10);
      if (formData.screen_height_mm) body.screen_height_mm = parseInt(formData.screen_height_mm, 10);

      const res = await fetch('/api/sites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to create site');
      }

      setResult(data as SiteResponse);
      setStep('success');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setIsSubmitting(false);
    }
  };

  const copyToClipboard = async () => {
    if (!result?.api_key) return;
    try {
      await navigator.clipboard.writeText(result.api_key);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Ignore copy errors
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      address: '',
      site_type: '',
      facing: '',
      gps_lat: '',
      gps_lng: '',
      screen_width_mm: '',
      screen_height_mm: '',
    });
    setStep('details');
    setError(null);
    setResult(null);
  };

  // Progress indicator
  const StepIndicator = () => (
    <div className="flex items-center gap-2 mb-8">
      <div className={`h-2 flex-1 rounded-full ${step === 'details' ? 'bg-[#14B8A6]' : 'bg-[#14B8A6]/30'}`} />
      <div className={`h-2 flex-1 rounded-full ${step === 'dimensions' || step === 'success' ? 'bg-[#14B8A6]' : 'bg-white/10'}`} />
      <div className={`h-2 flex-1 rounded-full ${step === 'success' ? 'bg-[#14B8A6]' : 'bg-white/10'}`} />
    </div>
  );

  if (step === 'success' && result) {
    return (
      <div className="max-w-2xl mx-auto">
        <Link
          href="/sites"
          className="inline-flex items-center gap-1.5 text-sm text-white/40 hover:text-white transition-colors mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Sites
        </Link>

        <div className="bg-white/5 border border-white/8 rounded-xl p-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 rounded-full bg-green-400/10 flex items-center justify-center">
              <Check className="w-6 h-6 text-green-400" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-white">Site Created</h1>
              <p className="text-sm text-white/50">{result.site.name}</p>
            </div>
          </div>

          <div className="bg-yellow-400/10 border border-yellow-400/20 rounded-lg p-4 mb-6">
            <div className="flex items-start gap-3">
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
          </div>

          <div className="mb-8">
            <label className="block text-xs text-white/50 uppercase tracking-wide mb-2">
              Site API Key
            </label>
            <div className="flex gap-2">
              <div className="flex-1 bg-lime-400/10 border border-lime-400/30 rounded-lg px-4 py-3 font-mono text-sm text-lime-300 break-all">
                {result.api_key}
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

          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={resetForm}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-white/10 hover:bg-white/15 text-white font-medium transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add Another Site
            </button>
            <Link
              href="/sites"
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-[#14B8A6] hover:bg-[#0d9488] text-white font-medium transition-colors"
            >
              Go to Sites
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      <Link
        href="/sites"
        className="inline-flex items-center gap-1.5 text-sm text-white/40 hover:text-white transition-colors mb-6"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Sites
      </Link>

      <div className="bg-white/5 border border-white/8 rounded-xl p-6 sm:p-8">
        <h1 className="text-2xl font-semibold text-white mb-2">Add New Site</h1>
        <p className="text-sm text-white/50 mb-6">Register a new billboard or screen location</p>

        <StepIndicator />

        {step === 'details' && (
          <div className="space-y-5">
            {/* Site Name */}
            <div>
              <label className="block text-sm font-medium text-white mb-2">
                Site Name <span className="text-red-400">*</span>
              </label>
              <div className="relative">
                <Monitor className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => updateField('name', e.target.value)}
                  placeholder="e.g., Main Road Billboard North"
                  className="w-full bg-white/5 border border-white/10 rounded-lg pl-10 pr-4 py-2.5 text-white placeholder:text-white/30 focus:outline-none focus:border-[#14B8A6] focus:ring-1 focus:ring-[#14B8A6] transition-colors"
                />
              </div>
            </div>

            {/* Address */}
            <div>
              <label className="block text-sm font-medium text-white mb-2">
                Address <span className="text-red-400">*</span>
              </label>
              <div className="relative">
                <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                <input
                  type="text"
                  value={formData.address}
                  onChange={(e) => updateField('address', e.target.value)}
                  placeholder="e.g., 123 Main Road, Johannesburg"
                  className="w-full bg-white/5 border border-white/10 rounded-lg pl-10 pr-4 py-2.5 text-white placeholder:text-white/30 focus:outline-none focus:border-[#14B8A6] focus:ring-1 focus:ring-[#14B8A6] transition-colors"
                />
              </div>
            </div>

            {/* Site Type */}
            <div>
              <label className="block text-sm font-medium text-white mb-2">
                Site Type <span className="text-red-400">*</span>
              </label>
              <select
                value={formData.site_type}
                onChange={(e) => updateField('site_type', e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-[#14B8A6] focus:ring-1 focus:ring-[#14B8A6] transition-colors appearance-none cursor-pointer"
                style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23999999' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 1rem center' }}
              >
                <option value="" disabled className="bg-[#0a0f0e]">Select site type...</option>
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
                  style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23999999' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 1rem center' }}
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
              <p className="text-xs text-white/40 mb-2">Optional — used for map view</p>
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

            {error && (
              <div className="text-sm text-red-400 bg-red-400/10 border border-red-400/20 rounded-lg px-4 py-3">
                {error}
              </div>
            )}

            <div className="flex justify-end pt-4">
              <button
                onClick={handleNext}
                className="flex items-center gap-2 px-6 py-2.5 rounded-lg bg-[#14B8A6] hover:bg-[#0d9488] text-white font-medium transition-colors"
              >
                Next
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {step === 'dimensions' && (
          <div className="space-y-5">
            {/* Screen Width */}
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
                  placeholder="Width in millimeters"
                  className="w-full bg-white/5 border border-white/10 rounded-lg pl-10 pr-16 py-2.5 text-white placeholder:text-white/30 focus:outline-none focus:border-[#14B8A6] focus:ring-1 focus:ring-[#14B8A6] transition-colors"
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-white/40">
                  mm
                </span>
              </div>
            </div>

            {/* Screen Height */}
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
                  placeholder="Height in millimeters"
                  className="w-full bg-white/5 border border-white/10 rounded-lg pl-10 pr-16 py-2.5 text-white placeholder:text-white/30 focus:outline-none focus:border-[#14B8A6] focus:ring-1 focus:ring-[#14B8A6] transition-colors"
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-white/40">
                  mm
                </span>
              </div>
            </div>

            <div className="bg-white/5 border border-white/10 rounded-lg p-4">
              <h3 className="text-sm font-medium text-white mb-2">Review Details</h3>
              <dl className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <dt className="text-white/50">Name:</dt>
                  <dd className="text-white">{formData.name}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-white/50">Address:</dt>
                  <dd className="text-white text-right max-w-[60%] truncate">{formData.address}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-white/50">Type:</dt>
                  <dd className="text-white">
                    {SITE_TYPES.find((t) => t.value === formData.site_type)?.label}
                  </dd>
                </div>
              </dl>
            </div>

            {error && (
              <div className="text-sm text-red-400 bg-red-400/10 border border-red-400/20 rounded-lg px-4 py-3">
                {error}
              </div>
            )}

            <div className="flex justify-between pt-4">
              <button
                onClick={handleBack}
                className="px-4 py-2.5 rounded-lg bg-white/10 hover:bg-white/15 text-white font-medium transition-colors"
              >
                Back
              </button>
              <button
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="flex items-center gap-2 px-6 py-2.5 rounded-lg bg-[#14B8A6] hover:bg-[#0d9488] disabled:bg-[#14B8A6]/50 text-white font-medium transition-colors"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    Create Site
                    <ArrowRight className="w-4 h-4" />
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
