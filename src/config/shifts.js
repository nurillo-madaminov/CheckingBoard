/**
 * WORK SHIFTS (Tashkent time, UTC+5, no daylight saving)
 *
 * Must match public.cb_shift_of in supabase_schema.sql, which stamps every
 * activity with its shift_code and shift_date (the work day the shift started on).
 */
export const SHIFT_TIMEZONE = 'Asia/Tashkent';
export const REPORT_TIMEZONE = 'America/New_York';
export const STAFF_PER_SHIFT = 2;

export const SHIFTS = [
  {
    code: 'MORNING',
    label: 'Morning',
    icon: '🌅',
    start: 7,
    end: 15,
    color: 'bg-amber-100 text-amber-800 border-amber-300',
    accent: '#d97706'
  },
  {
    code: 'AFTERNOON',
    label: 'Afternoon',
    icon: '🌇',
    start: 13,
    end: 23,
    color: 'bg-sky-100 text-sky-800 border-sky-300',
    accent: '#0284c7'
  },
  {
    code: 'NIGHT',
    label: 'Night',
    icon: '🌙',
    start: 23,
    end: 7,
    color: 'bg-indigo-100 text-indigo-800 border-indigo-300',
    accent: '#4f46e5'
  }
];

const TASHKENT_UTC_OFFSET_HOURS = 5;

export function getShiftConfig(code) {
  return SHIFTS.find(s => s.code === code) || {
    code,
    label: code || 'Unknown',
    icon: '•',
    color: 'bg-slate-100 text-slate-700 border-slate-300',
    accent: '#64748b'
  };
}

const pad = (n) => String(n).padStart(2, '0');

// 'YYYY-MM-DD' +/- n days
export function addDays(dateStr, n) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + n));
  return dt.toISOString().substring(0, 10);
}

// Every 'YYYY-MM-DD' from start to end, inclusive
export function dateRange(startDate, endDate) {
  const days = [];
  for (let d = startDate; d <= endDate; d = addDays(d, 1)) days.push(d);
  return days;
}

// 'YYYY-MM-DD' minus one calendar month, plus one day (an inclusive 1-month window ending on dateStr)
export function monthWindowStart(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  // Clamp to the previous month's length (Mar 31 -> window starts Mar 1, not Mar 4)
  const prevMonthDays = new Date(Date.UTC(y, m - 1, 0)).getUTCDate();
  const dt = new Date(Date.UTC(y, m - 2, Math.min(d, prevMonthDays) + 1));
  return dt.toISOString().substring(0, 10);
}

function tashkentParts(date) {
  const shifted = new Date(date.getTime() + TASHKENT_UTC_OFFSET_HOURS * 3600 * 1000);
  return {
    dateStr: shifted.toISOString().substring(0, 10),
    hour: shifted.getUTCHours()
  };
}

/**
 * The work day happening right now: before 07:00 Tashkent it is still the
 * previous day's night shift.
 */
export function currentWorkDay(now = new Date()) {
  const { dateStr, hour } = tashkentParts(now);
  return hour < 7 ? addDays(dateStr, -1) : dateStr;
}

// Shift that is on the clock right now (overlap 13:00-15:00 shows MORNING, like the database)
export function currentShiftCode(now = new Date()) {
  const { hour } = tashkentParts(now);
  if (hour >= 7 && hour < 15) return 'MORNING';
  if (hour >= 15 && hour < 23) return 'AFTERNOON';
  return 'NIGHT';
}

// Every shift whose hours include this moment (two during the 13:00-15:00 overlap)
export function shiftsOnDuty(now = new Date()) {
  const { hour } = tashkentParts(now);
  return SHIFTS.filter(s => (s.start < s.end
    ? hour >= s.start && hour < s.end
    : hour >= s.start || hour < s.end)).map(s => s.code);
}

// UTC instant of a Tashkent wall-clock hour on a given date
function tashkentInstant(dateStr, hour) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d, hour - TASHKENT_UTC_OFFSET_HOURS));
}

function formatEastern(date) {
  return date.toLocaleTimeString('en-US', { timeZone: REPORT_TIMEZONE, hour: 'numeric', minute: '2-digit' });
}

/**
 * Shift hours in both timezones for a work day, e.g.
 * { tashkent: '07:00 – 15:00', eastern: '10:00 PM – 6:00 AM ET' }
 * Eastern hours move with US daylight saving, so they depend on the date.
 */
export function shiftHours(shiftCode, workDay = currentWorkDay()) {
  const s = getShiftConfig(shiftCode);
  const start = tashkentInstant(workDay, s.start);
  const end = tashkentInstant(s.end <= s.start ? addDays(workDay, 1) : workDay, s.end);
  return {
    tashkent: `${pad(s.start)}:00 – ${pad(s.end)}:00`,
    eastern: `${formatEastern(start)} – ${formatEastern(end)} ET`
  };
}

export function formatTashkentTime(iso) {
  return new Date(iso).toLocaleTimeString('en-GB', {
    timeZone: SHIFT_TIMEZONE, hour: '2-digit', minute: '2-digit', second: '2-digit'
  });
}

export function formatEasternDateTime(iso) {
  return new Date(iso).toLocaleString('en-US', {
    timeZone: REPORT_TIMEZONE, month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit'
  });
}

export function formatWorkDay(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-US', {
    timeZone: 'UTC', weekday: 'short', month: 'short', day: 'numeric', year: 'numeric'
  });
}
