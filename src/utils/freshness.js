import { ref } from 'vue';

/**
 * Check freshness: how long since a driver was last checked.
 *   fresh    under 1h
 *   aging    1 – 2.5h
 *   warning  2.5 – 4h
 *   overdue  4h+ or never checked
 */

// Global reactive ticker so open tabs age rows in real time (every 30 seconds)
export const currentFreshnessTimestamp = ref(Date.now());

if (typeof window !== 'undefined') {
  setInterval(() => {
    currentFreshnessTimestamp.value = Date.now();
  }, 30000);
}

export const FRESHNESS_LEVELS = ['fresh', 'aging', 'warning', 'overdue'];

export function freshnessColor(level) {
  return {
    fresh: 'var(--color-accent-400)',
    aging: 'var(--color-accent-600)',
    warning: 'var(--color-accent-800)',
    overdue: 'var(--color-signal)'
  }[level];
}

export function getFreshnessInfo(lastCheckedAt) {
  // Reading the ref registers a reactive dependency in computed properties
  const now = currentFreshnessTimestamp.value;

  if (!lastCheckedAt) {
    return { level: 'overdue', hours: Infinity, short: 'Never', long: 'Never checked', pct: 100 };
  }

  const hours = Math.max(0, (now - new Date(lastCheckedAt).getTime()) / 3.6e6);
  const short = hours < 1 ? `${Math.round(hours * 60)}m` : `${hours.toFixed(1)}h`;
  const level = hours >= 4 ? 'overdue' : hours >= 2.5 ? 'warning' : hours >= 1 ? 'aging' : 'fresh';
  return {
    level,
    hours,
    short,
    long: hours < 1 / 60 ? 'Just checked' : `Checked ${short} ago`,
    pct: Math.min(100, (hours / 4) * 100)
  };
}
