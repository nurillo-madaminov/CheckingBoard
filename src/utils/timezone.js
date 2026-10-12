/**
 * US Eastern Timezone Utilities
 * Automatically handles date change rollover (EST/EDT) to reset driver signs to NO SIGN.
 */

export function getUSEasternDateString(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(date); // Output format: 'YYYY-MM-DD'
}

export function checkAndResetSignStatusIfNeeded(drivers, saveDriversFn, syncSupabaseFn) {
  const currentEasternDate = getUSEasternDateString();
  const STORAGE_KEY_LAST_SIGN_DATE = 'checkingboard_last_eastern_sign_date';
  const storedDate = localStorage.getItem(STORAGE_KEY_LAST_SIGN_DATE);

  if (storedDate && storedDate !== currentEasternDate) {
    console.log(`[Date Rollover - US Eastern] Resetting all driver signs to NO SIGN. (Previous: ${storedDate}, Current: ${currentEasternDate})`);
    const updated = drivers.map(d => ({
      ...d,
      sign: 'NO SIGN'
    }));

    localStorage.setItem(STORAGE_KEY_LAST_SIGN_DATE, currentEasternDate);
    saveDriversFn(updated);
    if (syncSupabaseFn) {
      syncSupabaseFn(updated);
    }
    return updated;
  }

  if (!storedDate) {
    localStorage.setItem(STORAGE_KEY_LAST_SIGN_DATE, currentEasternDate);
  }

  return null;
}
