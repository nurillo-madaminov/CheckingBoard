/**
 * shift-reminders: phone alerts 2 minutes before a shift starts ("check in") and
 * ends ("check out").
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
const SHIFT_LABELS: Record<string, string> = { MORNING: 'Morning', AFTERNOON: 'Afternoon', NIGHT: 'Night' };

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

function tashkentClock(iso: string) {
  return new Date(iso).toLocaleTimeString('en-GB', { timeZone: 'Asia/Tashkent', hour: '2-digit', minute: '2-digit' });
}

function messageFor(d: Due) {
  const shift = SHIFT_LABELS[d.shift_code] || d.shift_code;
  const at = tashkentClock(d.event_at);
  return d.kind === 'CHECK_IN'
    ? { title: 'Check in now', body: `Your ${shift} shift starts at ${at} (Tashkent). Open CheckingBoard and check in.` }
    : { title: 'Check out before you leave', body: `Your ${shift} shift ends at ${at} (Tashkent). Open CheckingBoard and check out.` };
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

    // Everyone with the same reminder gets the same alert: one send per group
    const groups = new Map<string, Due[]>();
    for (const d of due) {
      const key = `${d.team_id}|${d.kind}|${d.shift_code}|${d.event_at}`;
      groups.set(key, [...(groups.get(key) || []), d]);
    }

    const total = { reminders: due.length, sent: 0, failed: 0, removed: 0 };
    for (const list of groups.values()) {
      const first = list[0];
      const r = await pushToStaff(admin, first.team_id, list.map(d => d.staff_id), {
        ...messageFor(first),
        tag: `${first.kind}-${first.shift_code}-${first.event_at}`,
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
