import { supabase } from './supabaseClient';

/**
 * NOTIFICATIONS: managers send, staff receive.
 * Row Level Security decides who sees what: managers see everything they sent,
 * staff see notifications for the whole team, their shift, or them personally.
 * The database stamps the sender, team and time.
 */

export const AUDIENCES = [
  { code: 'ALL', label: 'Everyone' },
  { code: 'SHIFT', label: 'A shift' },
  { code: 'STAFF', label: 'One person' }
];

export async function fetchNotifications(limit = 100) {
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data || [];
}

// Ids (of the given notifications) the signed-in member has already seen
export async function fetchReadIds(notificationIds) {
  if (!notificationIds.length) return new Set();
  const { data, error } = await supabase
    .from('notification_reads')
    .select('notification_id')
    .in('notification_id', notificationIds);
  if (error) throw error;
  return new Set((data || []).map(r => r.notification_id));
}

export async function markRead(notificationIds, staffId) {
  if (!notificationIds.length) return;
  const { error } = await supabase
    .from('notification_reads')
    .upsert(notificationIds.map(id => ({ notification_id: id, staff_id: staffId })), { ignoreDuplicates: true });
  if (error) throw error;
}

export async function sendNotification({ title, body = '', audience = 'ALL', audienceShift = null, audienceStaffId = null }) {
  const { data, error } = await supabase
    .from('notifications')
    .insert([{
      title: title.trim(),
      body: body.trim(),
      audience,
      audience_shift: audience === 'SHIFT' ? audienceShift : null,
      audience_staff_id: audience === 'STAFF' ? audienceStaffId : null
    }])
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteNotification(id) {
  const { error } = await supabase.from('notifications').delete().eq('id', id);
  if (error) throw error;
}
