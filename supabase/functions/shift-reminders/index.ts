/**
 * shift-reminders: phone alerts 2 minutes before a shift starts ("check in") and
 * ends ("check out"), addressed to each person by name.
 *
 * Called every minute by pg_cron (see setup_shift_reminders in supabase_schema.sql):
 *   POST {}   with header x-cron-secret = public.cb_cron_config.secret
 * Deploy with --no-verify-jwt: the caller is the database, not a signed-in user,
 * and the secret above is what authorizes it.
 *
 * claim_shift_reminders() decides who is due (teams with reminders on, active
 * members on a shift, not checked in yet / still checked in) and marks each
 * reminder as sent, so a reminder goes out once even if a call is repeated.
 *
 * Secrets: see ../_shared/push.ts.
 */
import { corsHeaders, reply, pushSetup, pushToStaff } from '../_shared/push.ts';

const LEAD_MIN = 2;

interface Due {
  staff_id: string;
  team_id: string;
  kind: 'CHECK_IN' | 'CHECK_OUT';
  shift_code: string;
  shift_date: string;
  event_at: string;
}

// Compare secrets without leaking how much of them matched
function sameSecret(a: string, b: string) {
  const x = new TextEncoder().encode(a);
  const y = new TextEncoder().encode(b);
  let diff = x.length ^ y.length;
  for (let i = 0; i < Math.max(x.length, y.length); i++) diff |= (x[i] ?? 0) ^ (y[i] ?? 0);
  return diff === 0;
}

// "Hey Nick, your shift is about to start. It's time to check in."
function messageFor(d: Due, name: string) {
  const hey = name ? `Hey ${name}, your` : 'Hey, your';
  return {
    title: 'CheckingBoard',
    body: d.kind === 'CHECK_IN'
      ? `${hey} shift is about to start. It's time to check in.`
      : `${hey} shift is about to end. It's time to check out.`
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return reply({ error: 'Use POST' }, 405);

  try {
    let admin;
    try {
      admin = pushSetup('shift-reminders');
    } catch (err) {
      return reply({ error: (err as Error).message }, 500);
    }

    const { data: config, error: configError } = await admin.from('cb_cron_config').select('secret').eq('id', 1).maybeSingle();
    if (configError) throw configError;
    const given = req.headers.get('x-cron-secret') || '';
    if (!config?.secret || !given || !sameSecret(given, config.secret)) {
      return reply({ error: 'Not allowed' }, 401);
    }

    const { data, error } = await admin.rpc('claim_shift_reminders', { p_lead_min: LEAD_MIN });
    if (error) throw error;
    const due = (data || []) as Due[];

    const total = { reminders: due.length, sent: 0, failed: 0, removed: 0 };
    if (!due.length) return reply(total);

    // Each alert greets its person by their display name
    const { data: people, error: peopleError } = await admin
      .from('staff_profiles')
      .select('id, display_name')
      .in('id', due.map(d => d.staff_id));
    if (peopleError) throw peopleError;
    const names = new Map((people || []).map(p => [p.id, (p.display_name || '').trim()]));

    for (const d of due) {
      const r = await pushToStaff(admin, d.team_id, [d.staff_id], {
        ...messageFor(d, names.get(d.staff_id) || ''),
        tag: `${d.kind}-${d.shift_code}-${d.event_at}`,
        url: '/?view=checkin'
      });
      total.sent += r.sent;
      total.failed += r.failed;
      total.removed += r.removed;
    }
    return reply(total);
  } catch (err) {
    return reply({ error: (err as Error)?.message || String(err) }, 500);
  }
});
