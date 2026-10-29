/**
 * Shared by the Edge Functions that send phone alerts (send-push, shift-reminders):
 * the Supabase server client and Web Push delivery to members' saved subscriptions.
 *
 * Secrets (supabase secrets set ...): VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT
 * (e.g. mailto:you@example.com). Supabase provides SUPABASE_URL and the server key: the new
 * SUPABASE_SECRET_KEYS (JSON, projects on the new API keys) or the legacy SUPABASE_SERVICE_ROLE_KEY.
 */
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2.117.3';
import webpush from 'npm:web-push@3.6.7';

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

export function reply(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

// The server key: projects on the new API keys get SUPABASE_SECRET_KEYS ({"default": "sb_secret_..."});
// there the legacy SUPABASE_SERVICE_ROLE_KEY may be switched off, so prefer the new one.
function serverKey(): string | undefined {
  try {
    const keys = JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') || '{}');
    const key = keys.default || Object.values(keys)[0];
    if (typeof key === 'string' && key) return key;
  } catch (_err) {
    // Not set or not JSON: fall back to the legacy key
  }
  return Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || undefined;
}

/**
 * The server-side Supabase client, with Web Push set up. Throws a message that
 * names the missing secret.
 */
export function pushSetup(functionName: string): SupabaseClient {
  const url = Deno.env.get('SUPABASE_URL');
  const key = serverKey();
  const vapidPublic = Deno.env.get('VAPID_PUBLIC_KEY');
  const vapidPrivate = Deno.env.get('VAPID_PRIVATE_KEY');
  const vapidSubject = Deno.env.get('VAPID_SUBJECT') || 'mailto:admin@checkingboard.app';
  if (!url || !key) {
    throw new Error(`${functionName} has no Supabase server key (SUPABASE_SECRET_KEYS / SUPABASE_SERVICE_ROLE_KEY)`);
  }
  if (!vapidPublic || !vapidPrivate) {
    throw new Error(`${functionName} is missing its secrets (VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY)`);
  }
  webpush.setVapidDetails(vapidSubject, vapidPublic, vapidPrivate);
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

export interface PushMessage {
  title: string;
  body: string;
  tag?: string;
  url?: string; // opened when the alert is tapped
}

export interface PushResult {
  sent: number;
  failed: number;
  removed: number;
}

/**
 * Send one alert to every phone of the given members of a team. Subscriptions the
 * push service reports as gone (404 / 410) are deleted.
 */
export async function pushToStaff(admin: SupabaseClient, teamId: string, staffIds: string[], message: PushMessage): Promise<PushResult> {
  if (!staffIds.length) return { sent: 0, failed: 0, removed: 0 };
  const { data: subs, error } = await admin
    .from('push_subscriptions')
    .select('endpoint, p256dh, auth')
    .eq('team_id', teamId)
    .in('staff_id', staffIds);
  if (error) throw error;

  const payload = JSON.stringify(message);
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
  return { sent, failed, removed: gone.length };
}
