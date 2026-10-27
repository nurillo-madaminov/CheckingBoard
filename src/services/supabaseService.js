import { supabase } from './supabaseClient';

/**
 * FLEET DATA SERVICE (companies & drivers in the shared Supabase database)
 *
 * Row Level Security scopes every query to the signed-in dispatcher's team, and
 * team_id defaults to that team on insert, so no team id is passed from here.
 */

const PAGE_SIZE = 1000; // Supabase returns at most 1000 rows per request

// Fetch every row of a query, page by page
export async function fetchAllRows(buildQuery) {
  const rows = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await buildQuery().range(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    rows.push(...(data || []));
    if (!data || data.length < PAGE_SIZE) break;
  }
  return rows;
}

export function newId(prefix) {
  const rand = typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID().replace(/-/g, '').slice(0, 16)
    : Math.random().toString(36).slice(2, 14);
  return `${prefix}-${Date.now()}-${rand}`;
}

// ---------- row mappers ----------
export function mapCompanyRow(row) {
  return {
    id: row.id,
    teamId: row.team_id,
    name: row.name,
    note: row.note || '',
    order: row.order_index || 1
  };
}

export function mapDriverRow(row) {
  return {
    id: row.id,
    teamId: row.team_id,
    companyId: row.company_id,
    unit: row.unit || '',
    name: row.name,
    sign: row.sign || 'SIGNED',
    status: row.status || 'READY',
    notes: row.notes || '',
    highlightColor: row.highlight_color || '',
    orderIndex: row.order_index || 1,
    lastCheckedAt: row.last_checked_at || null
  };
}

function driverToRow(d) {
  return {
    id: d.id,
    company_id: d.companyId,
    unit: d.unit || '',
    name: d.name,
    sign: d.sign || 'SIGNED',
    status: d.status || 'READY',
    notes: d.notes || '',
    highlight_color: d.highlightColor || '',
    order_index: d.orderIndex || 1,
    last_checked_at: d.lastCheckedAt || null
  };
}

function companyToRow(c) {
  return {
    id: c.id,
    name: c.name,
    note: c.note || '',
    order_index: c.order || 1
  };
}

// ---------- reads ----------
export async function fetchCompanies() {
  const rows = await fetchAllRows(() =>
    supabase.from('companies').select('*').order('order_index', { ascending: true }).order('id')
  );
  return rows.map(mapCompanyRow);
}

export async function fetchDrivers() {
  const rows = await fetchAllRows(() =>
    supabase.from('drivers').select('*').order('order_index', { ascending: true }).order('id')
  );
  return rows.map(mapDriverRow);
}

async function check(promise) {
  const { error } = await promise;
  if (error) throw error;
}

// ---------- companies ----------
export function insertCompany(company) {
  return check(supabase.from('companies').insert([companyToRow(company)]));
}

export function updateCompany(company) {
  const { id, ...fields } = companyToRow(company);
  return check(supabase.from('companies').update({ ...fields, updated_at: new Date().toISOString() }).eq('id', id));
}

export function deleteCompany(id) {
  return check(supabase.from('companies').delete().eq('id', id));
}

// Save the order of only the companies whose position changed
// (an update, not an upsert: staff may reorder but not add companies)
export function saveCompanyOrder(changedCompanies) {
  if (!changedCompanies.length) return Promise.resolve();
  return check(supabase.rpc('save_company_order', {
    p_rows: changedCompanies.map(c => ({ id: c.id, order_index: c.order || 1 }))
  }));
}

// ---------- drivers ----------
export function insertDriver(driver) {
  return check(supabase.from('drivers').insert([driverToRow(driver)]));
}

export function updateDriver(driver) {
  const { id, ...fields } = driverToRow(driver);
  return check(supabase.from('drivers').update({ ...fields, updated_at: new Date().toISOString() }).eq('id', id));
}

export function deleteDriver(id) {
  return check(supabase.from('drivers').delete().eq('id', id));
}

// Save order / company of only the drivers that moved
export function saveDriverOrder(changedDrivers) {
  if (!changedDrivers.length) return Promise.resolve();
  return check(supabase.rpc('save_driver_order', {
    p_rows: changedDrivers.map(d => ({ id: d.id, order_index: d.orderIndex || 1, company_id: d.companyId }))
  }));
}

/**
 * Fleet reset: every non-INACTIVE driver in the team -> READY, never checked (red)
 */
export function resetActiveDrivers() {
  return check(
    supabase
      .from('drivers')
      .update({ status: 'READY', last_checked_at: null, updated_at: new Date().toISOString() })
      .neq('status', 'INACTIVE')
  );
}

/**
 * Daily US Eastern sign reset, decided by the database (once per team per day).
 * Returns true when this call performed the reset.
 */
export async function runDailySignReset() {
  const { data, error } = await supabase.rpc('run_daily_sign_reset');
  if (error) throw error;
  return data === true;
}

// ---------- realtime ----------
let activeChannel = null;
let attendanceChannel = null;

export function broadcastFleetReset() {
  if (!activeChannel) return;
  activeChannel.send({
    type: 'broadcast',
    event: 'fleet_reset',
    payload: { timestamp: Date.now() }
  });
}

/**
 * Live sync between dispatchers of the same team. postgres_changes events are
 * already limited by RLS; the team check below is an extra guard.
 */
export function subscribeToFleetChanges({ teamId, onCompanyChange, onDriverChange, onFleetReset, onStatus, onActivityInsert, onNotificationChange, onAttendanceChange }) {
  if (!supabase || !teamId) return null;
  unsubscribeFromRealtime();

  const isOwnTeam = (payload) => {
    const rowTeam = payload?.new?.team_id || payload?.old?.team_id;
    return !rowTeam || rowTeam === teamId;
  };

  activeChannel = supabase
    .channel(`checkingboard-${teamId}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'companies' }, payload => {
      if (onCompanyChange && isOwnTeam(payload)) onCompanyChange(payload);
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'drivers' }, payload => {
      if (onDriverChange && isOwnTeam(payload)) onDriverChange(payload);
    })
    // Actions logged by the extension (or a teammate) and new notifications
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'activities' }, payload => {
      if (onActivityInsert && isOwnTeam(payload)) onActivityInsert(payload);
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications' }, payload => {
      if (onNotificationChange && isOwnTeam(payload)) onNotificationChange(payload);
    })
    .on('broadcast', { event: 'fleet_reset' }, payload => {
      if (onFleetReset) onFleetReset(payload);
    })
    .subscribe(status => {
      if (onStatus) onStatus(status);
    });

  // Phone check-ins / check-outs on their own channel: if the attendance table is
  // missing (database script not re-run yet), only this channel fails, not the board
  if (onAttendanceChange) {
    attendanceChannel = supabase
      .channel(`checkingboard-attendance-${teamId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'attendance' }, payload => {
        if (isOwnTeam(payload)) onAttendanceChange(payload);
      })
      .subscribe();
  }

  return activeChannel;
}

export function unsubscribeFromRealtime() {
  for (const channel of [activeChannel, attendanceChannel]) {
    if (!channel) continue;
    try {
      supabase.removeChannel(channel);
    } catch (e) {
      console.warn('Realtime unsubscribe error:', e);
    }
  }
  activeChannel = null;
  attendanceChannel = null;
}
