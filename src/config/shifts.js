import { ref } from 'vue';

/**
 * WORK SHIFTS (Tashkent time, UTC+5, no daylight saving)
 *
 * Must match public.cb_shift_of in supabase_schema.sql, which stamps every
 * activity with its shift_code and shift_date (the work day the shift started on).
 * Hours are minutes after Tashkent midnight; a manager can change them per
 * shift and per weekday (public.shift_hours), anything not set uses the defaults.
 * People are put on a shift day by day (public.shift_assignments); a weekday
 * without a shift is that person's day off.
 */
export const SHIFT_TIMEZONE = 'Asia/Tashkent';
export const REPORT_TIMEZONE = 'America/New_York';

export const SHIFTS = [
  {
    code: 'MORNING',
    label: 'Morning',
    icon: '🌅',
    startMin: 7 * 60,
    endMin: 15 * 60,
    color: 'bg-amber-100 text-amber-800 border-amber-300',
    accent: '#d97706'
  },
  {
    code: 'AFTERNOON',
    label: 'Afternoon',
    icon: '🌇',
    startMin: 13 * 60,
    endMin: 23 * 60,
    color: 'bg-sky-100 text-sky-800 border-sky-300',
    accent: '#0284c7'
  },
  {
    code: 'NIGHT',
    label: 'Night',
    icon: '🌙',
    startMin: 23 * 60,
    endMin: 7 * 60,
    color: 'bg-indigo-100 text-indigo-800 border-indigo-300',
    accent: '#4f46e5'
  }
];

// ISO weekdays of the day a shift starts on: 1 = Monday ... 7 = Sunday
export const WEEKDAYS = [
  { iso: 1, label: 'Monday', short: 'Mon' },
  { iso: 2, label: 'Tuesday', short: 'Tue' },
  { iso: 3, label: 'Wednesday', short: 'Wed' },
  { iso: 4, label: 'Thursday', short: 'Thu' },
  { iso: 5, label: 'Friday', short: 'Fri' },
  { iso: 6, label: 'Saturday', short: 'Sat' },
  { iso: 7, label: 'Sunday', short: 'Sun' }
];

// The team's custom hours: { 'MORNING-1': { startMin, endMin }, ... }
export const customShiftHours = ref({});

export function setCustomShiftHours(rows) {
  customShiftHours.value = Object.fromEntries((rows || []).map(r => [
    `${r.shift_code}-${r.weekday}`,
    { startMin: r.start_min, endMin: r.end_min }
  ]));
}

// The team's weekly schedule: { staffId: { 1: 'MORNING', ... 7: 'NIGHT' } }, weekday
// 1 = Monday ... 7 = Sunday (the day the shift starts); a missing day is a day off
export const shiftSchedule = ref({});

export function setShiftSchedule(rows) {
  const schedule = {};
  (rows || []).forEach(r => {
    (schedule[r.staff_id] ||= {})[r.weekday] = r.shift_code;
  });
  shiftSchedule.value = schedule;
}

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

// Tashkent calendar date of a moment
function tashkentDate(date) {
  return new Date(date.getTime() + TASHKENT_UTC_OFFSET_HOURS * 3600 * 1000).toISOString().substring(0, 10);
}

// ISO weekday (1 = Monday ... 7 = Sunday) of a 'YYYY-MM-DD'
export function isoWeekday(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const day = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return day === 0 ? 7 : day;
}

// '07:30' <-> 450 (minutes after midnight)
export function formatMinutes(minutes) {
  return `${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`;
}

export function parseMinutes(hhmm) {
  const [h, m] = String(hhmm || '').split(':').map(Number);
  return Number.isInteger(h) && Number.isInteger(m) ? h * 60 + m : null;
}

// { startMin, endMin } of a shift on a work day: the team's custom hours, else the default
export function hoursOn(shiftCode, workDay) {
  const custom = customShiftHours.value[`${shiftCode}-${isoWeekday(workDay)}`];
  if (custom) return custom;
  const s = getShiftConfig(shiftCode);
  return { startMin: s.startMin, endMin: s.endMin };
}

// UTC instant of a Tashkent wall-clock time (minutes after midnight) on a given date
function tashkentInstant(dateStr, minutes) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d, -TASHKENT_UTC_OFFSET_HOURS, minutes));
}

// One run of a shift that starts on a work day; it ends the next day if it passes midnight
function shiftRun(code, day, hours = hoursOn(code, day)) {
  return {
    code,
    day,
    start: tashkentInstant(day, hours.startMin),
    end: tashkentInstant(hours.endMin <= hours.startMin ? addDays(day, 1) : day, hours.endMin)
  };
}

// How far a moment is from a run, in ms: 0 inside [start, end); the end itself
// already belongs to the next shift
function runDistance(run, now) {
  return now >= run.end ? now - run.end + 1 : Math.max(run.start - now, 0);
}

// The run that covers a moment (the earlier-starting one in an overlap), else the nearest
function nearestRun(runs, now) {
  return [...runs].sort((a, b) => (runDistance(a, now) - runDistance(b, now)) || (a.start - b.start))[0] || null;
}

/**
 * The shift run a moment belongs to, by the same rule as public.cb_shift_of:
 * the run (started yesterday or today) that covers it, the earlier-starting one
 * in an overlap; between runs, the nearest one. { code, day, start, end }
 */
export function placeShift(now = new Date(), assignedCode = '') {
  const today = tashkentDate(now);
  const runs = SHIFTS
    .filter(s => !assignedCode || s.code === assignedCode)
    .flatMap(s => [shiftRun(s.code, addDays(today, -1)), shiftRun(s.code, today)]);
  return nearestRun(runs, now);
}

// ---------------- the weekly schedule (who works which shift on which day) ----------------
// Is this person on the schedule at all?
export function hasSchedule(staffId) {
  return Object.keys(shiftSchedule.value[staffId] || {}).length > 0;
}

// The shift a person works on a work day ('YYYY-MM-DD'); '' on their day off
export function shiftOn(staffId, workDay) {
  return shiftSchedule.value[staffId]?.[isoWeekday(workDay)] || '';
}

const STAFF_RUN_REACH_MS = 12 * 3600e3;
const CHECK_IN_OPENS_MS = 2 * 3600e3;

/**
 * The run of a person's own schedule a moment belongs to, by the same rule as
 * public.cb_staff_shift_of: of the runs they are scheduled for (started yesterday
 * or today, or tomorrow's once check-in for it is open), the one that covers it,
 * else the nearest one less than 12 hours away. null on a day off.
 */
export function placeStaffShift(now = new Date(), staffId = '') {
  const today = tashkentDate(now);
  const runs = [-1, 0, 1].flatMap(offset => {
    const day = addDays(today, offset);
    const code = shiftOn(staffId, day);
    if (!code) return [];
    const run = shiftRun(code, day);
    return offset === 1 && run.start - now > CHECK_IN_OPENS_MS ? [] : [run];
  });
  const run = nearestRun(runs, now);
  return run && runDistance(run, now) < STAFF_RUN_REACH_MS ? run : null;
}

// A person's next run that has not started yet (within a week); null with no schedule
export function nextStaffShift(now = new Date(), staffId = '') {
  const today = tashkentDate(now);
  for (let offset = 0; offset <= 7; offset += 1) {
    const day = addDays(today, offset);
    const code = shiftOn(staffId, day);
    if (!code) continue;
    const run = shiftRun(code, day);
    if (run.start > now) return run;
  }
  return null;
}

// Do two people work the same shift on at least one day of the week?
export function sharesShift(staffIdA, staffIdB) {
  const a = shiftSchedule.value[staffIdA] || {};
  const b = shiftSchedule.value[staffIdB] || {};
  return WEEKDAYS.some(d => a[d.iso] && a[d.iso] === b[d.iso]);
}

// 'Mon–Fri', 'Mon, Wed, Sat–Sun' for a list of ISO weekdays
export function formatWeekdays(isoDays) {
  const days = [...isoDays].sort((x, y) => x - y);
  const parts = [];
  for (let i = 0; i < days.length; i += 1) {
    let j = i;
    while (days[j + 1] === days[j] + 1) j += 1;
    const from = WEEKDAYS[days[i] - 1].short;
    const to = WEEKDAYS[days[j] - 1].short;
    parts.push(j === i ? from : j === i + 1 ? `${from}, ${to}` : `${from}–${to}`);
    i = j;
  }
  return parts.join(', ');
}

// A person's week in a line: 'Morning', 'Morning Mon–Fri', 'Morning Mon–Wed · Night Fri–Sat'; '' with no schedule
export function scheduleSummary(staffId) {
  const week = shiftSchedule.value[staffId] || {};
  return SHIFTS
    .map(s => ({ shift: s, days: WEEKDAYS.filter(d => week[d.iso] === s.code).map(d => d.iso) }))
    .filter(g => g.days.length)
    .map(g => (g.days.length === 7 ? g.shift.label : `${g.shift.label} ${formatWeekdays(g.days)}`))
    .join(' · ');
}

// The work day happening right now (a shift past midnight still belongs to the day it began)
export function currentWorkDay(now = new Date()) {
  return placeShift(now).day;
}

// Shift that is on the clock right now (in an overlap, the earlier one, like the database)
export function currentShiftCode(now = new Date()) {
  return placeShift(now).code;
}

// Every shift whose hours include this moment (more than one during an overlap)
export function shiftsOnDuty(now = new Date()) {
  const today = tashkentDate(now);
  return SHIFTS.filter(s => [addDays(today, -1), today].some(day => {
    const run = shiftRun(s.code, day);
    return now >= run.start && now < run.end;
  })).map(s => s.code);
}

function formatEastern(date) {
  return date.toLocaleTimeString('en-US', { timeZone: REPORT_TIMEZONE, hour: 'numeric', minute: '2-digit' });
}

/**
 * Shift hours in both timezones for a work day, e.g.
 * { tashkent: '07:00 – 15:00', eastern: '10:00 PM – 6:00 AM ET' }
 * Eastern hours move with US daylight saving, so they depend on the date.
 * Pass hours to format unsaved ones.
 */
export function shiftHours(shiftCode, workDay = currentWorkDay(), hours = hoursOn(shiftCode, workDay)) {
  const run = shiftRun(shiftCode, workDay, hours);
  return {
    tashkent: `${formatMinutes(hours.startMin)} – ${formatMinutes(hours.endMin)}`,
    eastern: `${formatEastern(run.start)} – ${formatEastern(run.end)} ET`
  };
}

/**
 * How far the shift on the clock has run: { code, day, start, end, pct, left: '7h 18m left' }
 */
export function shiftProgress(now = new Date()) {
  const { code, day, start, end } = placeShift(now);
  const total = end - start;
  const before = now < start;
  const leftMin = Math.max(0, Math.round(((before ? start : end) - now) / 60000));
  const span = `${Math.floor(leftMin / 60)}h ${pad(leftMin % 60)}m`;
  return {
    code,
    day,
    start,
    end,
    pct: Math.max(0, Math.min(100, ((now - start) / total) * 100)),
    left: before ? `starts in ${span}` : `${span} left`
  };
}

// Wall clocks for the sidebar: '07:42' in Tashkent, '10:42 PM' in US Eastern
export function clockTashkent(now = new Date()) {
  return now.toLocaleTimeString('en-GB', { timeZone: SHIFT_TIMEZONE, hour: '2-digit', minute: '2-digit' });
}

export function clockEastern(now = new Date()) {
  return now.toLocaleTimeString('en-US', { timeZone: REPORT_TIMEZONE, hour: 'numeric', minute: '2-digit' });
}

// '14:05' Tashkent and '5:05 AM' Eastern for one timestamp (log rows)
export function formatTashkentClock(iso) {
  return clockTashkent(new Date(iso));
}

export function formatEasternClock(iso) {
  return clockEastern(new Date(iso));
}

// 'Thu, Oct 22' (short work-day label)
export function formatWorkDayShort(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-US', {
    timeZone: 'UTC', weekday: 'short', month: 'short', day: 'numeric'
  });
}

export function formatTashkentTime(iso) {
  return new Date(iso).toLocaleTimeString('en-GB', {
    timeZone: SHIFT_TIMEZONE, hour: '2-digit', minute: '2-digit', second: '2-digit'
  });
}

// 'Oct 27, 14:05' in Tashkent (pair with formatEasternDateTime)
export function formatTashkentDateTime(iso) {
  return new Date(iso).toLocaleString('en-US', {
    timeZone: SHIFT_TIMEZONE, month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
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
