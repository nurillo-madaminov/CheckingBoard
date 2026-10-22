import { supabase } from './supabaseClient';
import { fetchAllRows, newId } from './supabaseService';
import { SHIFTS, dateRange } from '../config/shifts';

/**
 * The only actions that are logged: the dispatch buttons in a driver row's ⚡ menu.
 * Status changes, quick checks, transfers and add / delete are not logged
 * (the database rejects any other action type).
 */
export const ACTION_TYPES = [
  { code: 'SHIFT', label: 'Open Shift', icon: '🌅', color: 'bg-blue-100 text-blue-800 border-blue-300' },
  { code: 'CYCLE', label: 'Open Cycle', icon: '🔄', color: 'bg-indigo-100 text-indigo-800 border-indigo-300' },
  { code: 'FIX_LOG', label: 'Fix Log', icon: '🛠️', color: 'bg-amber-100 text-amber-800 border-amber-300' },
  { code: 'BREAK', label: 'Take Break', icon: '☕', color: 'bg-emerald-100 text-emerald-800 border-emerald-300' },
  { code: 'DRIVER_CONNECTED', label: 'Connect', icon: '🔗', color: 'bg-teal-100 text-teal-800 border-teal-300' }
];

export const ACTION_CODES = ACTION_TYPES.map(a => a.code);

export function getActionTypeConfig(code) {
  return ACTION_TYPES.find(a => a.code === code) || {
    code,
    label: code,
    icon: '•',
    color: 'bg-slate-100 text-slate-800 border-slate-300'
  };
}

/**
 * Record an action in the shared database.
 * The database stamps the actor (staff id + name snapshot), team, time and shift
 * from the signed-in session, and takes driver / company name snapshots from the
 * live rows, so nothing here can forge who did what.
 */
export async function recordActivity({ driver = null, company = null, actionType, extraNote = '' }) {
  const row = {
    id: newId('act'),
    driver_id: driver ? driver.id : null,
    driver_name_snapshot: driver ? (driver.unit ? `${driver.unit} - ${driver.name}` : driver.name) : '',
    company_id: company ? company.id : (driver ? driver.companyId : null),
    company_name_snapshot: company ? company.name : '',
    action_type: actionType,
    extra_note: extraNote
  };

  const { data, error } = await supabase.from('activities').insert([row]).select().single();
  if (error) {
    console.error('Failed to record activity:', error);
    throw error;
  }
  return data;
}

/**
 * Fetch action records for a range of work days (inclusive, 'YYYY-MM-DD').
 * Row Level Security already limits staff to their own records and managers to
 * their whole team; the filters narrow it further.
 */
export async function fetchActivities({ fromDate, toDate, shiftCode = '', staffUserId = '', actionType = '' } = {}) {
  return fetchAllRows(() => {
    let query = supabase
      .from('activities')
      .select('*')
      .in('action_type', ACTION_CODES)
      .order('action_at', { ascending: false })
      .order('id');
    if (fromDate) query = query.gte('shift_date', fromDate);
    if (toDate) query = query.lte('shift_date', toDate);
    if (shiftCode) query = query.eq('shift_code', shiftCode);
    if (staffUserId) query = query.eq('staff_user_id', staffUserId);
    if (actionType) query = query.eq('action_type', actionType);
    return query;
  });
}

function emptyCounts() {
  const counts = { total: 0 };
  ACTION_CODES.forEach(code => { counts[code] = 0; });
  return counts;
}

function bump(counts, type) {
  counts.total += 1;
  counts[type] = (counts[type] || 0) + 1;
}

/**
 * Totals for the statistics page: whole team, per shift, per staff member and per day.
 * staffProfiles seeds every team member so people with zero actions are listed too;
 * former members keep the name they had when they acted.
 */
export function summarizeActivities(list, { fromDate, toDate, staffProfiles = [] }) {
  const team = emptyCounts();

  const byShift = {};
  SHIFTS.forEach(s => {
    byShift[s.code] = { ...emptyCounts(), staff: {} };
  });

  const byStaff = {};
  staffProfiles.forEach(p => {
    byStaff[p.id] = {
      staffId: p.id,
      displayName: p.displayName,
      role: p.role,
      isActive: p.isActive !== false,
      shiftCode: p.shiftCode || '',
      ...emptyCounts()
    };
  });

  const byDay = {};
  dateRange(fromDate, toDate).forEach(day => {
    byDay[day] = { total: 0 };
    SHIFTS.forEach(s => { byDay[day][s.code] = 0; });
  });

  list.forEach(act => {
    const type = act.action_type;
    bump(team, type);

    const staffId = act.staff_user_id || `former:${act.staff_name_snapshot}`;
    if (!byStaff[staffId]) {
      byStaff[staffId] = {
        staffId,
        displayName: act.staff_name_snapshot || 'Unknown',
        role: 'former',
        isActive: false,
        shiftCode: '',
        ...emptyCounts()
      };
    }
    bump(byStaff[staffId], type);

    const shift = byShift[act.shift_code];
    if (shift) {
      bump(shift, type);
      shift.staff[staffId] = (shift.staff[staffId] || 0) + 1;
    }

    const day = byDay[act.shift_date];
    if (day) {
      day.total += 1;
      if (act.shift_code in day) day[act.shift_code] += 1;
    }
  });

  const nameOf = (id) => byStaff[id]?.displayName || 'Unknown';
  Object.values(byShift).forEach(shift => {
    shift.staff = Object.entries(shift.staff)
      .map(([staffId, total]) => ({ staffId, displayName: nameOf(staffId), total }))
      .sort((a, b) => b.total - a.total);
  });

  return {
    team,
    byShift,
    byStaff: Object.values(byStaff).sort((a, b) => b.total - a.total || a.displayName.localeCompare(b.displayName)),
    byDay: Object.entries(byDay)
      .map(([date, counts]) => ({ date, ...counts }))
      .sort((a, b) => b.date.localeCompare(a.date))
  };
}
