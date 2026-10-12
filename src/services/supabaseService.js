import { getSupabaseClient } from './supabaseClient';

export function isSupabaseReady() {
  return getSupabaseClient() !== null;
}

/**
 * Fetch all companies from Supabase
 */
export async function fetchCompaniesFromSupabase() {
  const supabase = getSupabaseClient();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from('companies')
    .select('*')
    .order('order_index', { ascending: true });

  if (error) {
    console.error('Error fetching companies from Supabase:', error);
    throw error;
  }

  return (data || []).map(row => ({
    id: row.id,
    name: row.name,
    note: row.note || '',
    order: row.order_index || 1
  }));
}

/**
 * Fetch all drivers from Supabase
 */
export async function fetchDriversFromSupabase() {
  const supabase = getSupabaseClient();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from('drivers')
    .select('*')
    .order('order_index', { ascending: true });

  if (error) {
    console.error('Error fetching drivers from Supabase:', error);
    throw error;
  }

  return (data || []).map(row => ({
    id: row.id,
    companyId: row.company_id,
    unit: row.unit || '',
    name: row.name,
    sign: row.sign || 'SIGNED',
    status: row.status || 'READY',
    notes: row.notes || '',
    highlightColor: row.highlight_color || '',
    orderIndex: row.order_index || 1,
    lastCheckedAt: row.last_checked_at || null
  }));
}

/**
 * Company CRUD
 */
export async function insertCompanyToSupabase(company) {
  const supabase = getSupabaseClient();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from('companies')
    .insert([{
      id: company.id,
      name: company.name,
      note: company.note || '',
      order_index: company.order || 1
    }])
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateCompanyInSupabase(id, company) {
  const supabase = getSupabaseClient();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from('companies')
    .update({
      name: company.name,
      note: company.note || '',
      order_index: company.order || 1,
      updated_at: new Date().toISOString()
    })
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteCompanyFromSupabase(id) {
  const supabase = getSupabaseClient();
  if (!supabase) return null;

  const { error } = await supabase
    .from('companies')
    .delete()
    .eq('id', id);

  if (error) throw error;
  return true;
}

/**
 * Driver CRUD
 */
export async function insertDriverToSupabase(driver) {
  const supabase = getSupabaseClient();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from('drivers')
    .insert([{
      id: driver.id,
      company_id: driver.companyId,
      unit: driver.unit || '',
      name: driver.name,
      sign: driver.sign || 'SIGNED',
      status: driver.status || 'READY',
      notes: driver.notes || '',
      highlight_color: driver.highlightColor || '',
      order_index: driver.orderIndex || 1,
      last_checked_at: driver.lastCheckedAt || null
    }])
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateDriverInSupabase(id, driver) {
  const supabase = getSupabaseClient();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from('drivers')
    .update({
      company_id: driver.companyId,
      unit: driver.unit || '',
      name: driver.name,
      sign: driver.sign || 'SIGNED',
      status: driver.status || 'READY',
      notes: driver.notes || '',
      highlight_color: driver.highlightColor || '',
      order_index: driver.orderIndex || 1,
      last_checked_at: driver.lastCheckedAt || null,
      updated_at: new Date().toISOString()
    })
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteDriverFromSupabase(id) {
  const supabase = getSupabaseClient();
  if (!supabase) return null;

  const { error } = await supabase
    .from('drivers')
    .delete()
    .eq('id', id);

  if (error) throw error;
  return true;
}

/**
 * Batch update driver ordering
 */
export async function syncDriversOrderToSupabase(drivers) {
  const supabase = getSupabaseClient();
  if (!supabase) return null;

  const updates = drivers.map((d, index) => ({
    id: d.id,
    company_id: d.companyId,
    unit: d.unit || '',
    name: d.name,
    sign: d.sign || 'SIGNED',
    status: d.status || 'READY',
    notes: d.notes || '',
    highlight_color: d.highlightColor || '',
    order_index: index + 1,
    last_checked_at: d.lastCheckedAt || null
  }));

  const { error } = await supabase
    .from('drivers')
    .upsert(updates);

  if (error) console.error('Error updating driver order in Supabase:', error);
}

/**
 * Batch update company ordering
 */
export async function syncCompaniesOrderToSupabase(companies) {
  const supabase = getSupabaseClient();
  if (!supabase) return null;

  const updates = companies.map((c, index) => ({
    id: c.id,
    name: c.name,
    note: c.note || '',
    order_index: index + 1
  }));

  const { error } = await supabase
    .from('companies')
    .upsert(updates);

  if (error) console.error('Error updating company order in Supabase:', error);
}

/**
 * Setup Realtime Subscription across dispatchers
 */
export function subscribeToRealtimeChanges({ onCompanyChange, onDriverChange }) {
  const supabase = getSupabaseClient();
  if (!supabase) return null;

  const channel = supabase
    .channel('checkingboard-channel')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'companies' },
      payload => {
        if (onCompanyChange) onCompanyChange(payload);
      }
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'drivers' },
      payload => {
        if (onDriverChange) onDriverChange(payload);
      }
    )
    .subscribe((status) => {
      console.log('Supabase Realtime status:', status);
    });

  return channel;
}
