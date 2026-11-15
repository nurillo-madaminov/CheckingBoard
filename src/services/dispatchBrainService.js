import { ref } from 'vue';
import { supabase } from './supabaseClient';

/**
 * DISPATCH BRAIN (ELD check, search across the driver Telegram groups, assistant)
 *
 * A separate service that reads the driver groups in Telegram and the ELD. It signs
 * dispatchers in with their CheckingBoard sign-in: every request sends the Supabase
 * access token, and Dispatch Brain lets in active members of the teams it allows.
 * Managers and supervisors may change the ELD (fix, dismiss); staff only read.
 *
 * Build-time setting (optional; this is the default):
 *   VITE_DISPATCH_BRAIN_URL=https://eld.bombaclat.uz/api/v1
 * Set it to "off" to hide the ELD page.
 *
 * Local development only: VITE_DISPATCH_BRAIN_DEV_KEY sends an API key instead of the
 * sign-in token. It is ignored in production builds.
 */
const DEFAULT_URL = 'https://eld.bombaclat.uz/api/v1';
const setting = (import.meta.env.VITE_DISPATCH_BRAIN_URL ?? '').trim();
const BASE = (setting || DEFAULT_URL).replace(/\/+$/, '');
const DEV_KEY = import.meta.env.DEV ? (import.meta.env.VITE_DISPATCH_BRAIN_DEV_KEY || '').trim() : '';

export const isBrainConfigured = setting.toLowerCase() !== 'off';

// Who Dispatch Brain says the signed-in dispatcher is: { name, role, team, can_fix }.
// null until checked; brainAccess.error says why it is not available.
export const brainAccess = ref({ checked: false, me: null, error: '' });

export class BrainError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

async function token() {
  if (DEV_KEY) return DEV_KEY;
  const { data } = (await supabase?.auth.getSession()) || {};
  return data?.session?.access_token || '';
}

async function brain(path, { method = 'GET', body, signal } = {}) {
  if (!isBrainConfigured) throw new BrainError('Dispatch Brain is turned off on this site.', 0);
  let res;
  try {
    res = await fetch(BASE + path, {
      method,
      signal,
      headers: {
        Authorization: `Bearer ${await token()}`,
        ...(body ? { 'Content-Type': 'application/json' } : {})
      },
      body: body ? JSON.stringify(body) : undefined
    });
  } catch (e) {
    if (e.name === 'AbortError') throw e;
    throw new BrainError('Cannot reach Dispatch Brain. Check your internet connection.', 0);
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = data.error || `Dispatch Brain answered HTTP ${res.status}`;
    if (res.status === 401) brainAccess.value = { checked: true, me: null, error: msg };
    throw new BrainError(msg, res.status);
  }
  return data;
}

const qs = (params) => {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== '') q.set(k, v);
  const s = q.toString();
  return s ? `?${s}` : '';
};

// ---------- who am I ----------
export async function loadBrainAccess() {
  if (!isBrainConfigured) {
    brainAccess.value = { checked: true, me: null, error: 'Dispatch Brain is turned off on this site.' };
    return brainAccess.value;
  }
  try {
    const me = await brain('/me');
    brainAccess.value = { checked: true, me, error: '' };
  } catch (e) {
    brainAccess.value = { checked: true, me: null, error: e.message };
  }
  return brainAccess.value;
}

export function resetBrainAccess() {
  brainAccess.value = { checked: false, me: null, error: '' };
}

// ---------- status ----------
// { telegram: { light: 'green'|'yellow'|'red', reasons: [] }, eld_sync: { at, status }, counts: {...} }
export const getBrainStatus = () => brain('/status');

// ---------- ELD check ----------
export const FIELD_LABELS = { trailer: 'Trailer', shipping_docs: 'Shipping docs' };
export const fieldLabel = (f) => FIELD_LABELS[f] || f;

export async function getEldCheck() {
  return (await brain('/eld-check')).items || [];
}

/**
 * Write trailer + shipping docs to the ELD. expect = the ELD values the dispatcher saw;
 * if the ELD changed since, nothing is written ('changed_meanwhile').
 * -> { status: 'ok'|'failed'|'changed_meanwhile'|'rejected'|'error', eld, error? }
 */
export const fixInEld = ({ driverId, trailer, shippingDocs, expect }) =>
  brain('/eld-check/fix', {
    method: 'POST',
    body: { driver_id: driverId, trailer, shipping_docs: shippingDocs, expect }
  });

export const refreshFromEld = (driverId) =>
  brain('/eld-check/refresh', { method: 'POST', body: { driver_id: driverId } });

// Hide one difference until the ELD or the Telegram value changes
export const dismissDifference = (item) =>
  brain('/eld-check/dismiss', {
    method: 'POST',
    body: { driver_id: item.driver_id, field: item.field, eld_value: item.eld_value || '', our_value: item.telegram_value || '' }
  });

// ---------- drivers ----------
export async function findEldDrivers({ unit, name } = {}) {
  return (await brain(`/drivers${qs({ unit, name })}`)).drivers || [];
}

export const getEldDriver = (driverId) => brain(`/drivers/${encodeURIComponent(driverId)}`);

/**
 * The ELD driver of a board driver: by unit number first, then by name.
 * -> { driver, candidates } (driver null when nothing or more than one matches)
 */
export async function matchEldDriver(boardDriver) {
  const unit = (boardDriver?.unit || '').trim();
  const name = (boardDriver?.name || '').trim();
  let candidates = unit ? await findEldDrivers({ unit }) : [];
  if (candidates.length > 1 && name) {
    const words = name.toUpperCase().split(/\s+/).filter(Boolean);
    const byName = candidates.filter(c => words.every(w => (c.name || '').toUpperCase().includes(w)));
    if (byName.length) candidates = byName;
  }
  if (!candidates.length && name) candidates = await findEldDrivers({ name });
  return { driver: candidates.length === 1 ? candidates[0] : null, candidates };
}

// ---------- search ----------
export const searchBrain = (q, { since, until } = {}, signal) =>
  brain(`/search${qs({ q, since, until })}`, { signal });

// ---------- assistant ----------
export const askAssistant = (question, conversationId) =>
  brain('/assistant/ask', {
    method: 'POST',
    body: conversationId ? { question, conversation_id: conversationId } : { question }
  });

export async function listConversations() {
  return (await brain('/assistant/conversations')).conversations || [];
}

export const getConversation = (id) => brain(`/assistant/conversations/${encodeURIComponent(id)}`);

// ---------- small helpers for the views ----------
export const LIGHT_LABELS = { green: 'Up to date', yellow: 'May be behind', red: 'Out of date' };

// Telegram links open the dispatch Telegram account's app; only tg:// and https:// are followed
export function safeLink(url) {
  return typeof url === 'string' && /^(tg:\/\/|https:\/\/)/i.test(url) ? url : null;
}
