import { supabase } from './supabaseClient';

/**
 * ATTENDANCE: staff check in and out on their phone (rpc check_in / check_out).
 * The database decides the time, shift, distance to the office and lateness, and
 * refuses a check-in / check-out outside the office radius. Staff read their own
 * records; managers read the whole team. Managers set "late after N minutes".
 */

function friendlyError(error, fallback) {
  const msg = error?.message || '';
  if (/check_in|check_out|attendance|late_after_min|set_attendance_rules|schema cache/i.test(msg)) {
    return new Error('Check-in needs the updated database script. Ask your manager to re-run supabase_schema.sql.');
  }
  if (/fetch|network/i.test(msg)) return new Error('No connection. Check your internet and try again.');
  return new Error(msg || fallback);
}

// One reading from the phone's GPS: { lat, lng, accuracy } or a clear error
export function readLocation() {
  return new Promise((resolve, reject) => {
    if (!window.isSecureContext || !('geolocation' in navigator)) {
      reject(new Error('This browser can\'t share its location (it needs the secure https app).'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      pos => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: Math.round(pos.coords.accuracy) }),
      err => reject(new Error(err.code === 1
        ? 'Location access is off for CheckingBoard. Allow it in your phone settings and try again.'
        : err.code === 3
          ? 'Finding your location took too long. Step near a window and try again.'
          : 'Your location is not available right now. Turn on location and try again.')),
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 }
    );
  });
}

export async function checkIn({ lat, lng, accuracy }) {
  const { data, error } = await supabase.rpc('check_in', { p_lat: lat, p_lng: lng, p_accuracy_m: accuracy ?? null });
  if (error) throw friendlyError(error, 'Check-in failed');
  return data;
}

export async function checkOut({ lat, lng, accuracy }) {
  const { data, error } = await supabase.rpc('check_out', { p_lat: lat, p_lng: lng, p_accuracy_m: accuracy ?? null });
  if (error) throw friendlyError(error, 'Check-out failed');
  return data;
}

// Office + lateness rule for the signed-in member's team
export async function fetchAttendanceRules() {
  const { data, error } = await supabase
    .from('teams')
    .select('late_after_min, office_name, office_lat, office_radius_m')
    .maybeSingle();
  if (error) throw friendlyError(error, 'Could not load the check-in rules');
  return {
    lateAfterMin: data?.late_after_min ?? 15,
    officeName: data?.office_name || '',
    officeSet: data?.office_lat !== null && data?.office_lat !== undefined,
    radiusM: data?.office_radius_m ?? null
  };
}

export async function setLateAfter(minutes) {
  const { error } = await supabase.rpc('set_attendance_rules', { p_late_after_min: minutes });
  if (error) throw friendlyError(error, 'Could not save the late rule');
}

/**
 * Records between two work days (inclusive), newest first. Staff get only their
 * own (Row Level Security); managers get the team, optionally one person.
 */
export async function fetchAttendance({ fromDate, toDate, staffId = '', limit = 1000 } = {}) {
  let q = supabase
    .from('attendance')
    .select('*')
    .order('shift_date', { ascending: false })
    .order('check_in_at', { ascending: false })
    .limit(limit);
  if (fromDate) q = q.gte('shift_date', fromDate);
  if (toDate) q = q.lte('shift_date', toDate);
  if (staffId) q = q.eq('staff_id', staffId);
  const { data, error } = await q;
  if (error) throw friendlyError(error, 'Could not load attendance');
  return data || [];
}

// Check-in / check-out reminders on (true) or off for the team. Its own query, so check-in
// keeps working on a database that hasn't got the column yet.
export async function fetchShiftReminders() {
  const { data, error } = await supabase.from('teams').select('shift_reminders_enabled').maybeSingle();
  if (error) throw friendlyError(error, 'Could not load the reminder setting');
  return data?.shift_reminders_enabled !== false;
}

export async function setShiftReminders(enabled) {
  const { error } = await supabase.rpc('set_shift_reminders', { p_enabled: !!enabled });
  if (error) {
    if (/set_shift_reminders|schema cache/i.test(error.message || '')) {
      throw new Error('Reminders need the updated database script. Re-run supabase_schema.sql in the Supabase SQL Editor.');
    }
    throw friendlyError(error, 'Could not save the reminder setting');
  }
}

// Minutes as '1h 05m' / '22m'
export function formatMinutesSpan(min) {
  const m = Math.max(0, Math.round(min || 0));
  if (m < 60) return `${m}m`;
  return `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, '0')}m`;
}
