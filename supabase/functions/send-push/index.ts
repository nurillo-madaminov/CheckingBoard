/**
 * send-push: delivers one notification to the phones of the people it is addressed to.
 *
 * Called by the app right after a manager sends a notification:
 *   POST { notification_id }   (Authorization: the manager's session, added by supabase-js)
 *
 * - The caller must be an active manager of the notification's team.
 * - Recipients follow the notification's audience (ALL / SHIFT / STAFF), active
 *   members only, never the sender.
 * - Subscriptions the push service reports as gone (404 / 410) are deleted.
 *
 * Secrets: see ../_shared/push.ts.
 */
import { corsHeaders, reply, pushSetup, pushToStaff } from '../_shared/push.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return reply({ error: 'Use POST' }, 405);

  try {
    let admin;
    try {
      admin = pushSetup('send-push');
    } catch (err) {
      return reply({ error: (err as Error).message }, 500);
    }

    const { notification_id: notificationId } = await req.json().catch(() => ({}));
    if (!notificationId) return reply({ error: 'notification_id is required' }, 400);

    // Who is calling: an active manager of the notification's team
    const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
    if (!token || token.startsWith('sb_')) {
      return reply({ error: 'Not signed in (the request carried an API key, not a user session)' }, 401);
    }
    const { data: userData, error: userError } = await admin.auth.getUser(token);
    if (userError || !userData?.user) {
      // Say why, so a wrong key or an expired session can be told apart
      return reply({ error: `Not signed in (${userError?.message || 'no user for this session'})` }, 401);
    }
    const { data: caller, error: callerError } = await admin
      .from('staff_profiles')
      .select('id, team_id, role, is_active')
      .eq('id', userData.user.id)
      .maybeSingle();
    if (callerError) throw callerError;
    if (!caller || !caller.is_active || caller.role !== 'manager') {
      return reply({ error: 'Only managers send notifications' }, 403);
    }

    const { data: n } = await admin.from('notifications').select('*').eq('id', notificationId).maybeSingle();
    if (!n || n.team_id !== caller.team_id) return reply({ error: 'Notification not found' }, 404);

    // Recipients: active members the notification is addressed to, except the sender
    let people = admin.from('staff_profiles').select('id').eq('team_id', n.team_id).eq('is_active', true);
    if (n.audience === 'SHIFT') people = people.eq('shift_code', n.audience_shift);
    if (n.audience === 'STAFF') people = people.eq('id', n.audience_staff_id);
    const { data: recipients, error: peopleError } = await people;
    if (peopleError) throw peopleError;
    const ids = (recipients || []).map(p => p.id).filter(id => id !== n.sender_id);

    const result = await pushToStaff(admin, n.team_id, ids, {
      title: n.title,
      body: n.body || `From ${n.sender_name || 'your manager'}`,
      tag: n.id,
      url: '/?view=notifications'
    });
    return reply(result);
  } catch (err) {
    return reply({ error: (err as Error)?.message || String(err) }, 500);
  }
});
