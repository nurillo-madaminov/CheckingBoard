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
 * Secrets (supabase secrets set ...): VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT
 * (e.g. mailto:you@example.com). SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provided by Supabase.
 */
import { createClient } from 'npm:@supabase/supabase-js@2.117.3';
import webpush from 'npm:web-push@3.6.7';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

function reply(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return reply({ error: 'Use POST' }, 405);

  try {
    const url = Deno.env.get('SUPABASE_URL');
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const vapidPublic = Deno.env.get('VAPID_PUBLIC_KEY');
    const vapidPrivate = Deno.env.get('VAPID_PRIVATE_KEY');
    const vapidSubject = Deno.env.get('VAPID_SUBJECT') || 'mailto:admin@checkingboard.app';
    if (!url || !serviceKey || !vapidPublic || !vapidPrivate) {
      return reply({ error: 'send-push is missing its secrets (VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY)' }, 500);
    }

    const { notification_id: notificationId } = await req.json().catch(() => ({}));
    if (!notificationId) return reply({ error: 'notification_id is required' }, 400);

    const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

    // Who is calling: an active manager of the notification's team
    const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
    const { data: userData, error: userError } = await admin.auth.getUser(token);
    if (userError || !userData?.user) return reply({ error: 'Not signed in' }, 401);
    const { data: caller } = await admin
      .from('staff_profiles')
      .select('id, team_id, role, is_active')
      .eq('id', userData.user.id)
      .maybeSingle();
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
    if (!ids.length) return reply({ sent: 0, failed: 0, removed: 0 });

    const { data: subs, error: subsError } = await admin
      .from('push_subscriptions')
      .select('endpoint, p256dh, auth')
      .eq('team_id', n.team_id)
      .in('staff_id', ids);
    if (subsError) throw subsError;

    webpush.setVapidDetails(vapidSubject, vapidPublic, vapidPrivate);
    const payload = JSON.stringify({
      title: n.title,
      body: n.body || `From ${n.sender_name || 'your manager'}`,
      tag: n.id,
      url: '/?view=notifications'
    });

    let sent = 0;
    let failed = 0;
    const gone: string[] = [];
    await Promise.all((subs || []).map(async (s) => {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, { TTL: 60 * 60 * 24 });
        sent += 1;
      } catch (err) {
        failed += 1;
        const status = (err as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) gone.push(s.endpoint);
      }
    }));
    if (gone.length) await admin.from('push_subscriptions').delete().in('endpoint', gone);

    return reply({ sent, failed, removed: gone.length });
  } catch (err) {
    return reply({ error: (err as Error)?.message || String(err) }, 500);
  }
});
