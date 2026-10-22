/**
 * US Eastern Timezone Utilities
 * The daily NO SIGN reset itself runs in the database (run_daily_sign_reset),
 * once per team per US Eastern day, so every dispatcher sees the same result.
 */

export function getUSEasternDateString(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(date); // Output format: 'YYYY-MM-DD'
}
