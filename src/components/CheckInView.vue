<template>
  <div class="checkin">
    <!-- Clock -->
    <div class="clock-card">
      <span class="kicker">{{ todayLabel }} · Tashkent</span>
      <span class="clock">{{ clockTas }}</span>
      <span class="clock-et">{{ clockEt }} US Eastern</span>
    </div>

    <!-- Shift -->
    <div class="cb-panel shift-card">
      <template v-if="run">
        <div class="shift-top">
          <span class="cb-label">Your shift</span>
          <span :class="['chip', `is-${phase}`]">{{ phaseLabel }}</span>
        </div>
        <div class="shift-main">
          <span class="shift-name">{{ shiftLabel }}</span>
          <span class="shift-hours">{{ hoursLabel }}</span>
        </div>
        <span class="cb-bar shift-bar"><span :style="{ width: `${progressPct}%`, background: 'var(--color-accent)' }"></span></span>
        <span class="shift-sub">{{ dayLabel }} · late after {{ lateAfterClock }}</span>
      </template>
      <div v-else class="no-shift">
        <span class="shift-name">No shift</span>
        <span class="shift-sub">You're not on a shift yet. Ask your manager to add you to one.</span>
      </div>
    </div>

    <!-- The one big action -->
    <button
      type="button"
      :class="['action', `is-${mode}`]"
      :disabled="actionDisabled"
      :aria-busy="busy ? 'true' : 'false'"
      @click="act"
    >
      <span class="action-icon" aria-hidden="true">
        <svg v-if="busy" class="spin" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M21 12a9 9 0 1 1-6.219-8.56" /></svg>
        <svg v-else-if="mode === 'done'" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
        <svg v-else-if="mode === 'out'" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" x2="9" y1="12" y2="12" /></svg>
        <svg v-else width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" /><polyline points="10 17 15 12 10 7" /><line x1="15" x2="3" y1="12" y2="12" /></svg>
      </span>
      <span class="action-text">
        <span class="action-title">{{ actionTitle }}</span>
        <span class="action-sub">{{ actionSub }}</span>
      </span>
    </button>

    <div v-if="result" :class="['result', `is-${result.kind}`]" role="status" aria-live="polite">
      <span class="result-title">{{ result.title }}</span>
      <span v-if="result.text" class="result-text">{{ result.text }}</span>
    </div>

    <div v-if="rules" class="place cb-sub">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0" /><circle cx="12" cy="10" r="3" /></svg>
      <span v-if="rules.officeSet">{{ rules.officeName || 'Office' }} · you need to be within {{ rules.radiusM }} m</span>
      <span v-else>Your manager hasn't set the office location yet, so check-in is off.</span>
    </div>

    <!-- Weekly attendance summary (Monday - Sunday work days) -->
    <section class="week">
      <div class="week-head">
        <button type="button" class="btn btn-ghost btn-icon week-step" aria-label="Previous week" @click="weekOffset -= 1">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6" /></svg>
        </button>
        <div class="week-title">
          <span class="cb-label">{{ weekOffset === 0 ? 'This week' : weekOffset === -1 ? 'Last week' : 'Week' }}</span>
          <span class="week-range">{{ weekRangeLabel }}</span>
        </div>
        <button type="button" class="btn btn-ghost btn-icon week-step" aria-label="Next week" :disabled="weekOffset >= 0" @click="weekOffset += 1">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6" /></svg>
        </button>
      </div>

      <div class="cb-panel week-stats">
        <div class="stat"><span class="stat-num">{{ weekStats.shifts }}</span><span class="stat-label">Shifts</span></div>
        <div class="stat"><span class="stat-num">{{ weekStats.onTime }}</span><span class="stat-label">On time</span></div>
        <div :class="['stat', { 'is-late': weekStats.late }]">
          <span class="stat-num">{{ weekStats.late }}</span>
          <span class="stat-label">Late{{ weekStats.late ? ` · ${formatMinutesSpan(weekStats.lateMin)}` : '' }}</span>
        </div>
        <div class="stat"><span class="stat-num">{{ weekStats.hours }}</span><span class="stat-label">Worked</span></div>
      </div>
      <span v-if="weekStats.missing" class="cb-sub missing">{{ weekStats.missing }} shift{{ weekStats.missing === 1 ? '' : 's' }} without a check-out</span>

      <div class="cb-panel week-days">
        <div v-for="d in weekDays" :key="d.date" :class="['day', { 'is-late': d.late, 'is-today': d.isToday }]">
          <div class="day-left">
            <span class="day-date">{{ formatWorkDayShort(d.date) }}<template v-if="d.isToday"> · Today</template></span>
            <span v-if="d.records.length" class="day-shift">{{ d.records.map(r => getShiftConfig(r.shift_code).label).join(', ') }}</span>
          </div>
          <div class="day-right">
            <template v-if="d.records.length">
              <span v-for="r in d.records" :key="r.id" class="day-times">{{ formatTashkentClock(r.check_in_at) }} – {{ r.check_out_at ? formatTashkentClock(r.check_out_at) : (isOpen(r) ? 'now' : 'no check-out') }}</span>
              <span v-if="d.late" class="late-tag">Late {{ formatMinutesSpan(d.lateMin) }}</span>
              <span v-else class="ok-tag">On time</span>
            </template>
            <span v-else class="day-none">{{ d.future ? '—' : 'No check-in' }}</span>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue';
import {
  readLocation, checkIn, checkOut, fetchAttendanceRules, fetchAttendance, formatMinutesSpan
} from '../services/attendanceService';
import { currentStaffUser, staffProfiles, loadTeamRoster, loadShiftHours } from '../services/authService';
import {
  placeShift, shiftHours, getShiftConfig, addDays, currentWorkDay, isoWeekday, clockTashkent, clockEastern,
  formatTashkentClock, formatWorkDayShort
} from '../config/shifts';

const props = defineProps({
  // Bumped by the app when attendance changes live
  refreshKey: { type: Number, default: 0 }
});

const now = ref(new Date());
// null until loaded from the database (check-in stays off until then)
const rules = ref(null);
const lateAfterMin = computed(() => rules.value?.lateAfterMin ?? 15);
const officeName = computed(() => rules.value?.officeName || 'the office');
const records = ref([]);
// 0 = this week, -1 = last week, ...
const weekOffset = ref(0);
const weekRecords = ref([]);
const busy = ref(false);
const result = ref(null); // { kind: 'ok' | 'warn' | 'error' | 'working', title, text }
let timer = null;

// My shift as the roster says now (the manager may have changed it since sign-in)
const myShiftCode = computed(() => {
  const me = staffProfiles.value.find(p => p.id === currentStaffUser.value?.id);
  return (me || currentStaffUser.value)?.shiftCode || '';
});

// The run of my shift that "now" belongs to (same rule as the database)
const run = computed(() => (myShiftCode.value ? placeShift(now.value, myShiftCode.value) : null));
const shiftLabel = computed(() => (run.value ? getShiftConfig(run.value.code).label : ''));
const hoursLabel = computed(() => (run.value ? shiftHours(run.value.code, run.value.day).tashkent : ''));
const dayLabel = computed(() => (run.value ? formatWorkDayShort(run.value.day) : ''));
const lateAfterClock = computed(() => (run.value
  ? clockTashkent(new Date(run.value.start.getTime() + lateAfterMin.value * 60000))
  : ''));

const opensAt = computed(() => (run.value ? new Date(run.value.start.getTime() - 2 * 3600e3) : null));
const phase = computed(() => {
  if (!run.value) return 'none';
  if (now.value < run.value.start) return 'soon';
  if (now.value < run.value.end) return 'on';
  return 'ended';
});
const phaseLabel = computed(() => {
  const span = ms => formatMinutesSpan(ms / 60000);
  if (phase.value === 'soon') return `Starts in ${span(run.value.start - now.value)}`;
  if (phase.value === 'on') return `${span(run.value.end - now.value)} left`;
  return 'Ended';
});
const progressPct = computed(() => {
  if (!run.value) return 0;
  const pct = ((now.value - run.value.start) / (run.value.end - run.value.start)) * 100;
  return Math.max(0, Math.min(100, pct));
});

const isOpen = r => !r.check_out_at && Date.parse(r.shift_end) + 8 * 3600e3 > now.value.getTime();
const openRecord = computed(() => records.value.find(isOpen) || null);
const runRecord = computed(() => (run.value
  ? records.value.find(r => r.shift_date === run.value.day && r.shift_code === run.value.code) || null
  : null));

// 'in' (can check in), 'out' (checked in), 'done' (this shift finished)
const mode = computed(() => {
  if (openRecord.value) return 'out';
  if (runRecord.value) return 'done';
  return 'in';
});

const actionDisabled = computed(() => {
  if (busy.value) return true;
  if (mode.value === 'out') return false;
  if (mode.value === 'done' || !run.value || !rules.value?.officeSet) return true;
  return now.value < opensAt.value || now.value >= run.value.end;
});

const actionTitle = computed(() => {
  if (busy.value) return 'Checking your location…';
  if (mode.value === 'out') return 'Check out';
  if (mode.value === 'done') return 'Shift done';
  return 'Check in';
});

const actionSub = computed(() => {
  const r = openRecord.value || runRecord.value;
  if (mode.value === 'out') return `In since ${formatTashkentClock(r.check_in_at)}${r.is_late ? ` · late ${formatMinutesSpan(r.late_min)}` : ''}`;
  if (mode.value === 'done') return `${formatTashkentClock(r.check_in_at)} – ${formatTashkentClock(r.check_out_at)}`;
  if (!run.value) return 'No shift assigned';
  if (!rules.value) return 'Check-in is not available right now';
  if (!rules.value.officeSet) return 'Office not set';
  if (now.value < opensAt.value) return `Opens at ${clockTashkent(opensAt.value)}`;
  if (now.value >= run.value.end) return 'This shift is over';
  const lateBy = Math.floor((now.value - run.value.start) / 60000);
  if (lateBy > lateAfterMin.value) return `You'll be marked late (${formatMinutesSpan(lateBy)})`;
  return 'Tap when you arrive at the office';
});

async function act() {
  if (actionDisabled.value) return;
  const checkingOut = mode.value === 'out';
  busy.value = true;
  result.value = { kind: 'working', title: 'Finding your location…', text: 'Keep the app open for a few seconds.' };
  try {
    const where = await readLocation();
    result.value = { kind: 'working', title: checkingOut ? 'Checking out…' : 'Checking in…', text: `Location found (±${where.accuracy} m).` };
    const row = checkingOut ? await checkOut(where) : await checkIn(where);
    const meters = Math.round(checkingOut ? row.check_out_distance_m : row.check_in_distance_m);
    if (checkingOut) {
      result.value = { kind: 'ok', title: `Checked out at ${formatTashkentClock(row.check_out_at)}`, text: `${meters} m from ${officeName.value}. Have a good rest!` };
    } else if (row.is_late) {
      result.value = { kind: 'warn', title: `Checked in at ${formatTashkentClock(row.check_in_at)} · ${formatMinutesSpan(row.late_min)} late`, text: `${meters} m from ${officeName.value}. Your manager can see this.` };
    } else {
      result.value = { kind: 'ok', title: `Checked in at ${formatTashkentClock(row.check_in_at)} · on time`, text: `${meters} m from ${officeName.value}.` };
    }
    await Promise.all([loadRecords(), loadWeek()]);
  } catch (err) {
    result.value = { kind: 'error', title: checkingOut ? 'Not checked out' : 'Not checked in', text: err.message };
    await Promise.all([loadRecords(), loadWeek()]);
  } finally {
    busy.value = false;
  }
}

async function loadRecords() {
  try {
    const today = currentWorkDay(now.value);
    // Own records only (the database enforces it); a little past "tomorrow" covers an early night check-in
    records.value = await fetchAttendance({ fromDate: addDays(today, -30), toDate: addDays(today, 1), staffId: currentStaffUser.value?.id, limit: 60 });
  } catch (err) {
    result.value = { kind: 'error', title: 'Could not load your check-ins', text: err.message };
  }
}

// ---------------- weekly summary ----------------
const weekStart = computed(() => {
  const today = currentWorkDay(now.value);
  return addDays(today, 1 - isoWeekday(today) + 7 * weekOffset.value);
});
const weekEnd = computed(() => addDays(weekStart.value, 6));
const weekRangeLabel = computed(() => `${formatWorkDayShort(weekStart.value)} – ${formatWorkDayShort(weekEnd.value)}`);

const weekDays = computed(() => {
  const today = currentWorkDay(now.value);
  return Array.from({ length: 7 }, (_, i) => {
    const date = addDays(weekStart.value, i);
    const dayRecords = weekRecords.value.filter(r => r.shift_date === date);
    return {
      date,
      records: dayRecords,
      isToday: date === today,
      future: date > today,
      late: dayRecords.some(r => r.is_late),
      lateMin: dayRecords.reduce((m, r) => m + (r.is_late ? r.late_min : 0), 0)
    };
  });
});

const weekStats = computed(() => {
  const list = weekRecords.value;
  const late = list.filter(r => r.is_late);
  const workedMin = list.reduce((m, r) => (r.check_out_at
    ? m + Math.max(0, (Date.parse(r.check_out_at) - Date.parse(r.check_in_at)) / 60000)
    : m), 0);
  return {
    shifts: list.length,
    onTime: list.length - late.length,
    late: late.length,
    lateMin: late.reduce((m, r) => m + r.late_min, 0),
    hours: formatMinutesSpan(workedMin),
    missing: list.filter(r => !r.check_out_at && !isOpen(r)).length
  };
});

let weekSeq = 0;
async function loadWeek() {
  const seq = ++weekSeq;
  try {
    const list = await fetchAttendance({ fromDate: weekStart.value, toDate: weekEnd.value, staffId: currentStaffUser.value?.id, limit: 50 });
    if (seq === weekSeq) weekRecords.value = list;
  } catch (err) {
    if (seq === weekSeq) result.value = { kind: 'error', title: 'Could not load your week', text: err.message };
  }
}

async function loadAll() {
  try {
    rules.value = await fetchAttendanceRules();
  } catch (err) {
    result.value = { kind: 'error', title: 'Could not load check-in', text: err.message };
  }
  await Promise.all([loadRecords(), loadWeek()]);
}

const todayLabel = computed(() => now.value.toLocaleDateString('en-US', { timeZone: 'Asia/Tashkent', weekday: 'short', month: 'short', day: 'numeric' }));
const clockTas = computed(() => clockTashkent(now.value));
const clockEt = computed(() => clockEastern(now.value));

watch(() => props.refreshKey, () => Promise.all([loadRecords(), loadWeek()]));
watch(weekStart, loadWeek);

onMounted(() => {
  timer = setInterval(() => { now.value = new Date(); }, 10000);
  Promise.all([loadTeamRoster(), loadShiftHours()]).catch(() => {});
  loadAll();
});
onUnmounted(() => clearInterval(timer));
</script>

<style scoped>
.checkin { display: flex; flex-direction: column; gap: 14px; }

.clock-card {
  display: flex; flex-direction: column; align-items: center; gap: 2px; padding: 18px 16px 16px;
  background: var(--color-accent-900); color: var(--color-bg);
}
.kicker { font-size: 11px; letter-spacing: 0.1em; text-transform: uppercase; color: var(--color-accent-300); }
.clock { font-family: var(--font-heading); font-weight: 600; font-size: 64px; line-height: 1; letter-spacing: 0.01em; }
.clock-et { font-size: 13px; color: var(--color-accent-200); }

.shift-card { padding: 14px 16px; display: flex; flex-direction: column; gap: 8px; }
.shift-top { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.chip { font-size: 11px; letter-spacing: 0.06em; text-transform: uppercase; padding: 2px 8px; background: var(--color-neutral-200); color: var(--color-neutral-800); }
.chip.is-on { background: var(--color-accent); color: var(--color-bg); }
.chip.is-soon { background: var(--color-accent-100); color: var(--color-accent-800); }
.shift-main { display: flex; align-items: baseline; justify-content: space-between; gap: 10px; flex-wrap: wrap; }
.shift-name { font-family: var(--font-heading); font-weight: 600; font-size: 28px; line-height: 1; text-transform: uppercase; }
.shift-hours { font-family: var(--font-heading); font-size: 22px; color: var(--color-neutral-800); }
.shift-bar { height: 4px; }
.shift-sub { font-size: 13px; color: var(--color-neutral-700); }
.no-shift { display: flex; flex-direction: column; gap: 6px; }

.action {
  display: flex; align-items: center; gap: 16px; width: 100%; min-height: 96px; padding: 16px 20px;
  border: 0; cursor: pointer; text-align: left; font: inherit; color: var(--color-bg);
  background: var(--color-accent); box-shadow: var(--shadow-md);
  -webkit-tap-highlight-color: transparent; touch-action: manipulation;
}
.action:active:not(:disabled) { transform: translateY(1px); box-shadow: var(--shadow-sm); }
.action.is-in:not(:disabled):hover { background: var(--color-accent-600); }
.action.is-out { background: var(--color-accent-900); }
.action.is-out:not(:disabled):hover { background: var(--color-accent-800); }
.action.is-done { background: var(--color-neutral-200); color: var(--color-neutral-800); box-shadow: none; }
.action:disabled { cursor: default; }
.action.is-in:disabled { background: var(--color-neutral-300); color: var(--color-neutral-800); box-shadow: none; }
.action:focus-visible { outline: 3px solid var(--color-accent-900); outline-offset: 3px; }
.action-icon {
  width: 56px; height: 56px; flex-shrink: 0; display: grid; place-items: center;
  border: 2px solid currentColor; opacity: 0.95;
}
.action-text { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.action-title { font-family: var(--font-heading); font-weight: 600; font-size: 30px; line-height: 1; text-transform: uppercase; letter-spacing: 0.02em; }
.action-sub { font-size: 14px; opacity: 0.85; }
.spin { animation: spin 0.9s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
@media (prefers-reduced-motion: reduce) { .spin { animation: none; } }

.result { display: flex; flex-direction: column; gap: 3px; padding: 12px 14px; border: 1px solid var(--color-divider); background: var(--color-neutral-100); }
.result-title { font-size: 15px; font-weight: 600; }
.result-text { font-size: 13px; line-height: 1.45; color: var(--color-neutral-800); }
.result.is-ok { border-color: var(--color-accent-400); background: var(--color-accent-100); box-shadow: inset 3px 0 0 var(--color-accent); }
.result.is-warn, .result.is-error {
  border-color: color-mix(in srgb, var(--color-signal) 40%, transparent);
  background: color-mix(in srgb, var(--color-signal) 6%, var(--color-neutral-100));
  box-shadow: inset 3px 0 0 var(--color-signal);
}
.result.is-warn .result-title, .result.is-error .result-title { color: var(--color-signal); }

.place { display: flex; align-items: center; gap: 6px; justify-content: center; text-align: center; }
.place svg { flex-shrink: 0; color: var(--color-accent-700); }

.week { display: flex; flex-direction: column; gap: 8px; padding-top: 4px; }
.week-head { display: flex; align-items: center; gap: 6px; }
.week-step { width: 40px; height: 40px; color: var(--color-text); flex-shrink: 0; }
.week-title { flex: 1; min-width: 0; display: flex; flex-direction: column; align-items: center; gap: 1px; }
.week-range { font-family: var(--font-heading); font-size: 17px; }
.week-stats { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); }
.stat { display: flex; flex-direction: column; align-items: center; gap: 2px; padding: 12px 4px; border-left: 1px solid var(--color-divider); }
.stat:first-child { border-left: 0; }
.stat-num { font-family: var(--font-heading); font-weight: 600; font-size: 24px; line-height: 1; }
.stat-label { font-size: 11px; letter-spacing: 0.04em; text-transform: uppercase; color: var(--color-neutral-700); text-align: center; }
.stat.is-late .stat-num, .stat.is-late .stat-label { color: var(--color-signal); }
.missing { text-align: center; font-size: 12px; }
.week-days { display: flex; flex-direction: column; }
.day.is-today { background: var(--color-accent-100); }
.day-none { font-size: 13px; color: var(--color-neutral-600); }
.day { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 10px 14px; border-top: 1px solid var(--color-hairline); }
.day:first-child { border-top: 0; }
.day.is-late { box-shadow: inset 3px 0 0 var(--color-signal); background: color-mix(in srgb, var(--color-signal) 5%, transparent); }
.day-left, .day-right { display: flex; flex-direction: column; gap: 1px; min-width: 0; }
.day-right { align-items: flex-end; }
.day-date { font-size: 14px; font-weight: 600; }
.day-shift { font-size: 12px; color: var(--color-neutral-700); }
.day-times { font-family: var(--font-heading); font-size: 17px; }
.late-tag, .ok-tag { font-size: 10px; letter-spacing: 0.08em; text-transform: uppercase; padding: 1px 6px; }
.late-tag { background: var(--color-signal); color: var(--color-bg); }
.ok-tag { background: var(--color-accent-100); color: var(--color-accent-800); }
</style>
