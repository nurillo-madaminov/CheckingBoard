import { supabase } from './supabaseClient';

/**
 * EVENTS: inspections and accidents (public.events).
 *   kind: 'INSPECTION' | 'ACCIDENT', outcome: 'VIOLATION' | 'NO_VIOLATION', level: 1 | 2 | 3
 * The database stamps the team, who logged it and the driver / company names.
 * Anyone in the team logs, edits and pins; managers delete.
 */

export const EVENT_KINDS = [
  { code: 'INSPECTION', label: 'Inspection' },
  { code: 'ACCIDENT', label: 'Accident' }
];

export const EVENT_OUTCOMES = [
  { code: 'VIOLATION', label: 'Violation' },
  { code: 'NO_VIOLATION', label: 'No violation' }
];

export const EVENT_LEVELS = [1, 2, 3];

export function eventKindLabel(code) {
  return EVENT_KINDS.find(k => k.code === code)?.label || code;
}

export function eventOutcomeLabel(code) {
  return EVENT_OUTCOMES.find(o => o.code === code)?.label || code;
}

function friendlyError(error, fallback) {
  const msg = error?.message || '';
  if (/relation .*events|events_|schema cache/i.test(msg)) {
    return new Error('Events need the updated database script. Run supabase_schema.sql in the Supabase SQL Editor, then try again.');
  }
  if (/fetch|network/i.test(msg)) return new Error('No connection. Check your internet and try again.');
  return new Error(msg || fallback);
}

export async function fetchEvents({ limit = 1000 } = {}) {
  const { data, error } = await supabase
    .from('events')
    .select('*')
    .order('occurred_at', { ascending: false })
    .limit(limit);
  if (error) throw friendlyError(error, 'Could not load events');
  return data || [];
}

function toRow(e) {
  return {
    kind: e.kind,
    occurred_at: e.occurredAt,
    driver_id: e.driverId,
    outcome: e.outcome,
    level: Number(e.level),
    notes: (e.notes || '').trim()
  };
}

export async function createEvent(e) {
  const { data, error } = await supabase.from('events').insert(toRow(e)).select().single();
  if (error) throw friendlyError(error, 'Event not saved');
  return data;
}

export async function updateEvent(id, e) {
  const { data, error } = await supabase.from('events').update(toRow(e)).eq('id', id).select().single();
  if (error) throw friendlyError(error, 'Event not saved');
  return data;
}

export async function setEventPinned(id, pinned) {
  const { error } = await supabase.from('events').update({ pinned }).eq('id', id);
  if (error) throw friendlyError(error, pinned ? 'Not pinned' : 'Not unpinned');
}

export async function deleteEvent(id) {
  const { error } = await supabase.from('events').delete().eq('id', id);
  if (error) throw friendlyError(error, 'Event not deleted');
}
