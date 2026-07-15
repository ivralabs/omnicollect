import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Format a number as ZAR currency: R 2 500 (space separator, no decimals on whole rands) */
export function formatZAR(amount: number): string {
  const rounded = Math.round(amount);
  const formatted = rounded.toLocaleString('en-ZA').replace(/,/g, ' ');
  return `R ${formatted}`;
}

/** Returns 'online' if last_seen_at is within the last 30 minutes */
export function deviceStatus(lastSeenAt: string | null | undefined): 'online' | 'offline' {
  if (!lastSeenAt) return 'offline';
  const diff = Date.now() - new Date(lastSeenAt).getTime();
  return diff < 30 * 60 * 1000 ? 'online' : 'offline';
}

/** Format timestamp as relative or absolute depending on recency */
export function formatLastSeen(lastSeenAt: string | null | undefined): string {
  if (!lastSeenAt) return 'Never';
  const date = new Date(lastSeenAt);
  const diff = Date.now() - date.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return date.toLocaleDateString('en-ZA');
}

/** Score badge colour class */
export function scoreColor(score: number): string {
  if (score >= 80) return 'text-green-400 bg-green-400/10';
  if (score >= 60) return 'text-primary-400 bg-primary-400/10';
  if (score >= 40) return 'text-yellow-400 bg-yellow-400/10';
  return 'text-red-400 bg-red-400/10';
}
