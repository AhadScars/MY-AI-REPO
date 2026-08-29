import type { OddsFormat } from '../types';

export const currency = (n: number, code = 'INR') =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: code,
    maximumFractionDigits: Number.isInteger(n) ? 0 : 2,
    minimumFractionDigits: Number.isInteger(n) ? 0 : 2,
  }).format(n);

export const compact = (n: number) =>
  new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(n);

export const pct = (n: number, digits = 1) => `${n.toFixed(digits)}%`;

export function decimalToAmerican(d: number): string {
  if (d >= 2) return `+${Math.round((d - 1) * 100)}`;
  return `${Math.round(-100 / (d - 1))}`;
}

export function decimalToFractional(d: number): string {
  const value = d - 1;
  const denoms = [1, 2, 3, 4, 5, 8, 10, 16, 20, 25];
  let bestN = 1;
  let bestD = 1;
  let bestErr = Infinity;
  for (const den of denoms) {
    const num = Math.round(value * den);
    const err = Math.abs(value - num / den);
    if (err < bestErr && num > 0) {
      bestErr = err;
      bestN = num;
      bestD = den;
    }
  }
  return `${bestN}/${bestD}`;
}

export function formatOdds(decimal: number, format: OddsFormat = 'decimal'): string {
  if (!Number.isFinite(decimal) || decimal <= 1) return '—';
  if (format === 'american') return decimalToAmerican(decimal);
  if (format === 'fractional') return decimalToFractional(decimal);
  return decimal.toFixed(2);
}

export function formatKickoff(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function formatRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diff / 60000);
  if (Math.abs(mins) < 1) return 'just now';
  if (Math.abs(mins) < 60) return `${Math.abs(mins)}m ${mins > 0 ? 'ago' : 'from now'}`;
  const hrs = Math.round(mins / 60);
  if (Math.abs(hrs) < 24) return `${Math.abs(hrs)}h ${hrs > 0 ? 'ago' : 'from now'}`;
  const days = Math.round(hrs / 24);
  return `${Math.abs(days)}d ${days > 0 ? 'ago' : 'from now'}`;
}

export function clockLabel(minute?: number, period?: string): string {
  if (period) return period;
  if (minute == null) return '—';
  return `${minute}'`;
}

export function initials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0])
    .join('')
    .toUpperCase();
}

export function uid(prefix = 'id'): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 8)}${Date.now().toString(36).slice(-4)}`;
}

export function hoursFromNow(hours: number): string {
  return new Date(Date.now() + hours * 3600_000).toISOString();
}

export function minutesFromNow(mins: number): string {
  return new Date(Date.now() + mins * 60_000).toISOString();
}

export function sameDay(a: string | Date, b = new Date()): boolean {
  const da = new Date(a);
  return da.getFullYear() === b.getFullYear() && da.getMonth() === b.getMonth() && da.getDate() === b.getDate();
}

export function dayOffset(days: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + days);
  d.setHours(0, 0, 0, 0);
  return d;
}
