import { supabase } from './supabaseClient';

/**
 * NOTIFICATIONS: messages from managers to staff (public.notifications).
 * Row Level Security decides who reads what: managers read everything in the team,
 * staff read what is addressed to everyone, to them, or to a shift they work.
 * Read marks are per person (public.notification_reads).
 *   audience: 'ALL' | 'SHIFT' (audienceShift) | 'STAFF' (audienceStaffId)
 */

function friendlyError(error, fallback) {
  const msg = error?.message || '';
  if (/notification|schema cache/i.test(msg)) {
    return new Error('Messages need the updated database script. Ask your manager to re-run supabase_schema.sql.');
  }
  if (/fetch|network/i.test(msg)) return new Error('No connection. Check your internet and try again.');
  return new Error(msg || fallback);
}

// Newest first, with `read` for the signed-in person
export async function fetchNotifications({ limit = 50 } = {}) {
  const [list, reads] = await Promise.all([
    supabase.from('notifications').select('*').order('created_at', { ascending: false }).limit(limit),
    supabase.from('notification_reads').select('notification_id')
  ]);
  if (list.error) throw friendlyError(list.error, 'Could not load messages');
  if (reads.error) throw friendlyError(reads.error, 'Could not load messages');
  const readIds = new Set((reads.data || []).map(r => r.notification_id));
  return (list.data || []).map(n => ({ ...n, read: readIds.has(n.id) }));
}

export async function markNotificationsRead(ids, staffId) {
  if (!ids.length || !staffId) return;
  const { error } = await supabase
    .from('notification_reads')
    .upsert(ids.map(id => ({ notification_id: id, staff_id: staffId })), { onConflict: 'notification_id,staff_id', ignoreDuplicates: true });
  if (error) throw friendlyError(error, 'Could not mark as read');
}

// Managers only (the database refuses staff)
export async function sendNotification({ title, body = '', audience = 'ALL', audienceShift = null, audienceStaffId = null }) {
  const { error } = await supabase.from('notifications').insert({
    title: title.trim(),
    body: body.trim(),
    audience,
    audience_shift: audience === 'SHIFT' ? audienceShift : null,
    audience_staff_id: audience === 'STAFF' ? audienceStaffId : null
  });
  if (error) throw friendlyError(error, 'Message not sent');
}

export async function deleteNotification(id) {
  const { error } = await supabase.from('notifications').delete().eq('id', id);
  if (error) throw friendlyError(error, 'Message not deleted');
}
