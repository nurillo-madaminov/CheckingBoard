import { supabase } from './supabaseClient';

/**
 * OFFICE LOCATION: one office per team, pinned by a manager, with the radius a
 * future check-in must be within. Stored on public.teams; every member can read
 * it, only managers change it, and only through the database functions
 * set_office_location / clear_office_location (who and when come from the session).
 */

export const OFFICE_RADIUS_MIN = 30;
export const OFFICE_RADIUS_MAX = 1000;
export const OFFICE_RADIUS_DEFAULT = 150;

// Before supabase_schema.sql is re-run, the columns and functions are missing
function friendlyError(error, fallback) {
  const msg = error?.message || '';
  if (/office_|set_office_location|clear_office_location|schema cache/i.test(msg)) {
    return new Error('The office location needs the updated database script. Run supabase_schema.sql in the Supabase SQL Editor, then try again.');
  }
  return new Error(msg || fallback);
}

// The signed-in member's team office, or null when none is configured
export async function fetchOfficeLocation() {
  const { data, error } = await supabase
    .from('teams')
    .select('office_name, office_lat, office_lng, office_radius_m, office_updated_at, office_updated_by')
    .maybeSingle();
  if (error) throw friendlyError(error, 'Could not load the office location');
  if (!data || data.office_lat === null) return null;
  return {
    name: data.office_name || '',
    lat: data.office_lat,
    lng: data.office_lng,
    radiusM: data.office_radius_m,
    updatedAt: data.office_updated_at,
    updatedBy: data.office_updated_by
  };
}

export async function setOfficeLocation({ name, lat, lng, radiusM }) {
  const { error } = await supabase.rpc('set_office_location', {
    p_name: (name || '').trim(),
    p_lat: lat,
    p_lng: lng,
    p_radius_m: radiusM
  });
  if (error) throw friendlyError(error, 'Failed to save the office location');
}

export async function clearOfficeLocation() {
  const { error } = await supabase.rpc('clear_office_location');
  if (error) throw friendlyError(error, 'Failed to remove the office location');
}
