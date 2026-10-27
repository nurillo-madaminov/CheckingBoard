import { supabase } from './supabaseClient';

/**
 * PHONE PUSH ALERTS
 * - A member turns alerts on (asks the browser for permission, then saves this
 *   browser's push subscription with rpc save_push_subscription).
 * - After a manager sends a notification, the app asks the send-push Edge
 *   Function to deliver it to the right phones (the function checks the caller
 *   is a manager and reads the subscriptions with the service role).
 * Needs VITE_VAPID_PUBLIC_KEY (build env) and the deployed send-push function.
 */
const VAPID_PUBLIC_KEY = (import.meta.env.VITE_VAPID_PUBLIC_KEY || '').trim();

export const pushConfigured = Boolean(VAPID_PUBLIC_KEY);

const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent)
  || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
export const isStandalone = () => window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;

function supported() {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

async function currentSubscription() {
  const reg = await navigator.serviceWorker.ready;
  return reg.pushManager.getSubscription();
}

/**
 * 'unconfigured' | 'needs-install' (iPhone in the browser) | 'unsupported' | 'denied' | 'off' | 'on'
 */
export async function getPushState() {
  if (!pushConfigured) return 'unconfigured';
  if (isIOS() && !isStandalone()) return 'needs-install';
  if (!supported()) return 'unsupported';
  if (Notification.permission === 'denied') return 'denied';
  try {
    return (await currentSubscription()) ? 'on' : 'off';
  } catch (err) {
    return 'off';
  }
}

function base64UrlToBytes(base64Url) {
  const padded = (base64Url + '='.repeat((4 - (base64Url.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/');
  return Uint8Array.from(atob(padded), c => c.charCodeAt(0));
}

async function saveSubscription(sub) {
  const json = sub.toJSON();
  const { error } = await supabase.rpc('save_push_subscription', {
    p_endpoint: json.endpoint,
    p_p256dh: json.keys?.p256dh || '',
    p_auth: json.keys?.auth || '',
    p_user_agent: navigator.userAgent.slice(0, 300)
  });
  if (error) {
    if (/save_push_subscription/.test(error.message || '')) {
      throw new Error('Phone alerts need the updated database script. Ask your manager to re-run supabase_schema.sql.');
    }
    throw new Error(error.message || 'Could not turn on alerts');
  }
}

// Must run from a tap: the browser only shows the permission prompt for a user action
export async function enablePush() {
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    throw new Error(permission === 'denied'
      ? 'Alerts are blocked for this site. Allow notifications in your phone settings, then try again.'
      : 'Alerts were not allowed.');
  }
  const reg = await navigator.serviceWorker.ready;
  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: base64UrlToBytes(VAPID_PUBLIC_KEY) });
  }
  await saveSubscription(sub);
}

export async function disablePush() {
  const sub = await currentSubscription();
  if (!sub) return;
  await supabase.rpc('delete_push_subscription', { p_endpoint: sub.endpoint });
  await sub.unsubscribe();
}

// After sign-in: a phone that already allowed alerts is saved for whoever is signed in now
export async function syncPushSubscription() {
  if ((await getPushState()) !== 'on') return;
  try {
    await saveSubscription(await currentSubscription());
  } catch (err) {
    console.warn('Could not refresh the push subscription:', err);
  }
}

// Before sign-out: stop sending this person's alerts to this phone (the browser keeps its permission)
export async function forgetThisDevice() {
  if (!pushConfigured || !supported()) return;
  try {
    const sub = await currentSubscription();
    if (sub) await supabase.rpc('delete_push_subscription', { p_endpoint: sub.endpoint });
  } catch (err) {
    console.warn('Could not remove the push subscription:', err);
  }
}

/**
 * Ask the send-push Edge Function to deliver a notification to phones.
 * Returns { sent, failed } or throws a message that says what is missing.
 */
export async function sendPushFor(notificationId) {
  if (!pushConfigured) return { sent: 0, failed: 0, skipped: true };
  const { data, error } = await supabase.functions.invoke('send-push', { body: { notification_id: notificationId } });
  if (error) {
    let detail = error.message || '';
    try {
      // The function answers { error }; Supabase's gateway answers { msg } or { message }
      const body = await error.context?.json();
      detail = body?.error || body?.msg || body?.message || detail;
    } catch (e) {
      // Not a JSON error body (for example the function is not deployed)
    }
    throw new Error(/not found|404|Failed to send a request/i.test(detail)
      ? 'the send-push function is not deployed yet'
      : detail);
  }
  return data || { sent: 0, failed: 0 };
}
