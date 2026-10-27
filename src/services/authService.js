import { ref } from 'vue';
import { supabase } from './supabaseClient';
import { setCustomShiftHours } from '../config/shifts';

/**
 * AUTH & TEAM SERVICE (Supabase Auth + public.staff_profiles)
 *
 * - Logins are Supabase Auth users created by database functions
 *   (register_team / create_staff_account in supabase_schema.sql).
 * - A username "nick" signs in as nick@checkingboard.internal (never emailed).
 * - Roles, team membership and active state live in public.staff_profiles and
 *   are enforced by Row Level Security in the database, not by this file.
 */
export const LOGIN_EMAIL_DOMAIN = 'checkingboard.internal';

export const currentStaffUser = ref(null);   // signed-in profile
export const staffProfiles = ref([]);        // team roster
export const currentTeam = ref(null);        // { id, name }

export function usernameToEmail(username) {
  const clean = (username || '').trim().toLowerCase();
  return clean.includes('@') ? clean : `${clean}@${LOGIN_EMAIL_DOMAIN}`;
}

function mapProfile(row) {
  return {
    id: row.id,
    teamId: row.team_id,
    username: row.username,
    email: row.email,
    displayName: row.display_name,
    role: row.role,
    isActive: row.is_active,
    shiftCode: row.shift_code || '',
    createdAt: row.created_at
  };
}

// Turn database / auth errors into messages a dispatcher understands
function friendlyError(error, fallback = 'Something went wrong') {
  const msg = error?.message || '';
  if (/invalid login credentials/i.test(msg)) return new Error('Invalid username or password');
  if (/banned/i.test(msg)) return new Error('Your account has been deactivated. Please contact your manager.');
  if (/fetch|network/i.test(msg)) return new Error('Cannot reach the team database. Check your internet connection.');
  return new Error(msg || fallback);
}

export function getCurrentStaffUser() {
  return currentStaffUser.value;
}

export function isAuthenticated() {
  return !!currentStaffUser.value;
}

export function isCurrentUserManager() {
  return currentStaffUser.value?.role === 'manager';
}

export function getStaffProfiles() {
  return staffProfiles.value;
}

export function getTeams() {
  return currentTeam.value ? [currentTeam.value] : [];
}

/**
 * Load the signed-in user's profile, team and roster. Signs out (and throws)
 * if the login has no active profile.
 */
export async function loadCurrentProfile() {
  const { data: sessionData } = await supabase.auth.getSession();
  const uid = sessionData?.session?.user?.id;
  if (!uid) {
    currentStaffUser.value = null;
    return null;
  }

  const { data, error } = await supabase
    .from('staff_profiles')
    .select('*')
    .eq('id', uid)
    .maybeSingle();

  if (error) throw friendlyError(error, 'Could not load your profile');
  if (!data || !data.is_active) {
    await supabase.auth.signOut();
    currentStaffUser.value = null;
    throw new Error('Your account has been deactivated. Please contact your manager.');
  }

  currentStaffUser.value = mapProfile(data);
  await Promise.all([loadTeam(), loadTeamRoster(), loadShiftHours()]);
  return currentStaffUser.value;
}

/**
 * The team's custom shift hours. If they can't be read (for example the
 * database script hasn't been re-run yet), the default hours apply.
 */
export async function loadShiftHours() {
  const { data, error } = await supabase
    .from('shift_hours')
    .select('shift_code, weekday, start_min, end_min');
  if (error) {
    console.warn('Could not load shift hours, using the defaults:', error.message);
    setCustomShiftHours([]);
    return [];
  }
  setCustomShiftHours(data);
  return data;
}

export async function loadTeam() {
  const { data } = await supabase.from('teams').select('id, name').maybeSingle();
  currentTeam.value = data || null;
  return currentTeam.value;
}

export async function loadTeamRoster() {
  const { data, error } = await supabase
    .from('staff_profiles')
    .select('*')
    .order('created_at', { ascending: true });
  if (error) throw friendlyError(error, 'Could not load team members');
  staffProfiles.value = (data || []).map(mapProfile);
  return staffProfiles.value;
}

/**
 * Restore an existing session on page load. Returns the profile or null.
 */
export async function initAuth() {
  if (!supabase) return null;
  try {
    return await loadCurrentProfile();
  } catch (err) {
    console.warn('Session restore failed:', err.message);
    return null;
  }
}

/**
 * Sign in with username (or full login email) and password
 */
export async function loginUser(username, password) {
  if (!username?.trim() || !password) {
    throw new Error('Username and password are required');
  }
  const { error } = await supabase.auth.signInWithPassword({
    email: usernameToEmail(username),
    password
  });
  if (error) throw friendlyError(error, 'Sign in failed');

  const user = await loadCurrentProfile();
  return { user };
}

/**
 * Create a new team. The creator becomes its manager and is signed in.
 */
export async function createTeam({ teamName, managerName, username, password }) {
  const { error } = await supabase.rpc('register_team', {
    p_team_name: (teamName || '').trim(),
    p_manager_name: (managerName || '').trim(),
    p_username: (username || '').trim().toLowerCase(),
    p_password: password || ''
  });
  if (error) throw friendlyError(error, 'Failed to register team');
  return loginUser(username, password);
}

/**
 * Manager creates a staff (or manager) login for their own team
 */
export async function createStaffAccount({ displayName, username, password, role = 'staff' }) {
  const { data, error } = await supabase.rpc('create_staff_account', {
    p_display_name: (displayName || '').trim(),
    p_username: (username || '').trim().toLowerCase(),
    p_password: password || '',
    p_role: role === 'manager' ? 'manager' : 'staff'
  });
  if (error) throw friendlyError(error, 'Failed to create staff account');
  await loadTeamRoster();
  return { id: data.id, username: data.username, displayName: data.display_name, role: data.role };
}

export async function setStaffRole(staffId, newRole) {
  const { error } = await supabase.rpc('set_staff_role', { p_staff_id: staffId, p_role: newRole });
  if (error) throw friendlyError(error, 'Failed to change role');
  await loadTeamRoster();
}

export async function resetStaffPassword(staffId, newPassword) {
  const { error } = await supabase.rpc('reset_staff_password', {
    p_staff_id: staffId,
    p_new_password: newPassword || ''
  });
  if (error) throw friendlyError(error, 'Failed to reset password');
}

export async function setStaffActive(staffId, isActive) {
  const { error } = await supabase.rpc('set_staff_active', { p_staff_id: staffId, p_active: !!isActive });
  if (error) throw friendlyError(error, 'Failed to update account status');
  await loadTeamRoster();
}

/**
 * Manager saves the whole shift schedule: { MORNING: [ids], AFTERNOON: [ids], NIGHT: [ids] }
 */
export async function saveShiftSchedule(schedule) {
  const { error } = await supabase.rpc('save_shift_schedule', { p_schedule: schedule });
  if (error) throw friendlyError(error, 'Failed to save the shift schedule');
  await loadTeamRoster();
}

/**
 * Manager replaces the shift hours: [{ shift_code, weekday (1 = Monday), start_min, end_min }]
 */
export async function saveShiftHours(rows) {
  const { error } = await supabase.rpc('save_shift_hours', { p_hours: rows });
  if (error) {
    if (/save_shift_hours/.test(error.message || '')) {
      throw new Error('Custom shift hours need the updated database script. Run supabase_schema.sql in the Supabase SQL Editor, then try again.');
    }
    throw friendlyError(error, 'Failed to save the shift hours');
  }
  await loadShiftHours();
}

export async function updateMyDisplayName(displayName) {
  const { error } = await supabase.rpc('update_my_display_name', { p_display_name: (displayName || '').trim() });
  if (error) throw friendlyError(error, 'Failed to update name');
  await loadCurrentProfile();
  return currentStaffUser.value;
}

export async function logoutUser() {
  currentStaffUser.value = null;
  staffProfiles.value = [];
  currentTeam.value = null;
  setCustomShiftHours([]);
  if (supabase) {
    try {
      await supabase.auth.signOut();
    } catch (e) {
      console.warn('Sign out error:', e);
    }
  }
}
