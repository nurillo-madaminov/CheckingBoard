<template>
  <!-- Phone: the week ahead and what was done, plus this phone's reminder switch -->
  <div class="my-shifts">
    <h2 class="cb-title">My shifts</h2>

    <!-- Reminders: next to the shifts they are about (was in Profile) -->
    <PushAlertsToggle />

    <!-- The shift on now, or the next one -->
    <div class="cb-panel next-card">
      <template v-if="shown">
        <div class="next-top">
          <span class="cb-label">{{ run ? 'Your shift' : 'Next shift' }}</span>
          <span class="next-when">{{ whenLabel }}</span>
        </div>
        <div class="next-main">
          <span class="next-name">{{ getShiftConfig(shown.code).label }}</span>
          <span class="next-hours">{{ shiftHours(shown.code, shown.day).tashkent }}</span>
        </div>
        <span class="cb-sub">{{ formatWorkDayShort(shown.day) }} · check-in opens {{ clockTashkent(new Date(shown.start.getTime() - 2 * 3600e3)) }}</span>
        <span v-if="mates.length" class="mates"><b>With you:</b> {{ mates.join(', ') }}</span>
        <span v-else class="mates cb-sub">You're the only one on this shift.</span>
      </template>
      <template v-else>
        <span class="next-name">No shift yet</span>
        <span class="cb-sub">Ask your manager to add you to a shift.</span>
      </template>
      <span v-if="managers.length" class="mates cb-sub">Managers &amp; supervisors: {{ managers.join(', ') }}</span>
    </div>

    <div v-if="errorMessage" class="cb-error">{{ errorMessage }}</div>

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
            <span v-else class="day-none">{{ d.off ? 'Day off' : d.future ? d.planned : 'No check-in' }}</span>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue';
import PushAlertsToggle from './PushAlertsToggle.vue';
import { fetchAttendance, formatMinutesSpan } from '../services/attendanceService';
import { currentStaffUser, activeStaffProfiles, loadTeamRoster, loadShiftHours } from '../services/authService';
import {
  placeStaffShift, nextStaffShift, hasSchedule, shiftOn, shiftHours, getShiftConfig, addDays, currentWorkDay, isoWeekday,
  clockTashkent, formatTashkentClock, formatWorkDayShort
} from '../config/shifts';
import { canManage } from '../config/roles';

const props = defineProps({
  // Bumped by the app when attendance changes live
  refreshKey: { type: Number, default: 0 }
});

const now = ref(new Date());
const myId = computed(() => currentStaffUser.value?.id || '');
const scheduled = computed(() => hasSchedule(myId.value));
// 0 = this week, -1 = last week, ...
const weekOffset = ref(0);
const weekRecords = ref([]);
const errorMessage = ref('');
let timer = null;

const run = computed(() => placeStaffShift(now.value, myId.value));
const shown = computed(() => run.value || nextStaffShift(now.value, myId.value));
const whenLabel = computed(() => {
  const r = shown.value;
  if (!r) return '';
  const span = ms => formatMinutesSpan(ms / 60000);
  if (now.value < r.start) return `Starts in ${span(r.start - now.value)}`;
  if (now.value < r.end) return `On now · ${span(r.end - now.value)} left`;
  return 'Ended';
});

// Who works the same shift that day (was the phone's Team tab)
const mates = computed(() => {
  const r = shown.value;
  if (!r) return [];
  return activeStaffProfiles.value
    .filter(p => p.id !== myId.value && shiftOn(p.id, r.day) === r.code)
    .map(p => p.displayName);
});
const managers = computed(() => activeStaffProfiles.value
  .filter(p => p.id !== myId.value && canManage(p.role))
  .map(p => p.displayName));

const isOpen = r => !r.check_out_at && Date.parse(r.shift_end) + 8 * 3600e3 > now.value.getTime();

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
      // By the schedule as it is now (shown for days without a check-in, this week onwards)
      off: weekOffset.value >= 0 && scheduled.value && !shiftOn(myId.value, date),
      planned: shiftOn(myId.value, date) ? `${getShiftConfig(shiftOn(myId.value, date)).label} · ${shiftHours(shiftOn(myId.value, date), date).tashkent}` : '—',
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
    if (seq === weekSeq) errorMessage.value = `Could not load your week. ${err.message}`;
  }
}

watch(() => props.refreshKey, loadWeek);
watch(weekStart, loadWeek);

onMounted(() => {
  timer = setInterval(() => { now.value = new Date(); }, 30000);
  Promise.all([loadTeamRoster(), loadShiftHours()]).catch(() => {});
  loadWeek();
});
onUnmounted(() => clearInterval(timer));
</script>

<style scoped>
.my-shifts { display: flex; flex-direction: column; gap: 14px; }
.next-card { padding: 14px; display: flex; flex-direction: column; gap: 6px; }
.next-top { display: flex; justify-content: space-between; align-items: center; gap: 8px; }
.next-when { font-size: 12px; padding: 2px 8px; background: var(--color-accent-100); color: var(--color-accent-800); }
.next-main { display: flex; justify-content: space-between; align-items: baseline; gap: 8px; }
.next-name { font-family: var(--font-heading); font-weight: 600; font-size: 28px; text-transform: uppercase; line-height: 1.1; }
.next-hours { font-family: var(--font-heading); font-size: 20px; color: var(--color-neutral-800); }
.mates { font-size: 13px; }
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
