<template>
  <div class="cb-page cb-scroll today">
    <div class="cb-page-head">
      <div class="title-block">
        <h2 class="cb-title">Today</h2>
        <span class="cb-sub">{{ dayLabel }} · {{ clockTas }} Tashkent · check-ins update live</span>
      </div>
    </div>

    <div v-if="errorMessage" class="cb-error">{{ errorMessage }}</div>

    <!-- Shifts on now -->
    <div class="cb-panel totals">
      <div class="total main">
        <span class="total-num">{{ totals.inNow }}<span class="of">/{{ totals.expected }}</span></span>
        <span class="total-label">Checked in · on shift now</span>
      </div>
      <div :class="['total', { 'is-signal': totals.late }]">
        <span class="total-num">{{ totals.late }}</span>
        <span class="total-label">Late</span>
      </div>
      <div :class="['total', { 'is-signal': totals.missing }]">
        <span class="total-num">{{ totals.missing }}</span>
        <span class="total-label">Not in</span>
      </div>
    </div>

    <!-- Each shift: its run nearest to now, and its people -->
    <section v-for="g in groups" :key="g.code" class="group">
      <div class="group-head">
        <span class="group-name">{{ g.label }}</span>
        <span :class="['phase', `is-${g.phase}`]">{{ g.phaseLabel }}</span>
        <span class="cb-spacer"></span>
        <span class="group-hours">{{ g.hours }}</span>
      </div>
      <div class="cb-panel people">
        <div v-for="p in g.people" :key="p.id" :class="['person', `is-${p.state}`]">
          <span class="cb-avatar avatar">{{ initials(p.name) }}</span>
          <div class="person-text">
            <span class="name cb-ellipsis">{{ p.name }}</span>
            <span class="role cb-ellipsis">{{ p.role }}</span>
          </div>
          <div class="status">
            <span class="status-main">{{ p.main }}</span>
            <span v-if="p.tag" :class="['tag-pill', { 'is-late': p.lateTag }]">{{ p.tag }}</span>
          </div>
        </div>
        <div v-if="!g.people.length" class="empty">Nobody on this shift.</div>
      </div>
    </section>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue';
import { fetchAttendance, fetchAttendanceRules, formatMinutesSpan } from '../services/attendanceService';
import { activeStaffProfiles, loadTeamRoster, loadShiftHours } from '../services/authService';
import {
  SHIFTS, placeShift, shiftHours, currentWorkDay, addDays, clockTashkent, formatWorkDay, formatTashkentClock
} from '../config/shifts';
import { checksIn, roleLabel } from '../config/roles';
import { initials } from '../utils/format';

const props = defineProps({
  // Bumped by the app when a check-in / check-out arrives live
  refreshKey: { type: Number, default: 0 }
});

const now = ref(new Date());
const records = ref([]);
const lateAfterMin = ref(15);
const errorMessage = ref('');
let timer = null;

const dayLabel = computed(() => formatWorkDay(currentWorkDay(now.value)));
const clockTas = computed(() => clockTashkent(now.value));

// Everyone who checks in, by shift (managers don't check in)
const roster = computed(() => activeStaffProfiles.value.filter(p => p.shiftCode && checksIn(p.role)));

function personState(person, run, phase) {
  const rec = records.value.find(r => r.staff_id === person.id && r.shift_date === run.day && r.shift_code === run.code);
  const lateTag = rec?.is_late ? `Late ${formatMinutesSpan(rec.late_min)}` : '';
  if (rec?.check_out_at) {
    return { state: 'out', main: `${formatTashkentClock(rec.check_in_at)} – ${formatTashkentClock(rec.check_out_at)}`, tag: lateTag || 'Done', lateTag: !!lateTag, late: !!lateTag, in: true };
  }
  if (rec) {
    return { state: 'in', main: `In since ${formatTashkentClock(rec.check_in_at)}`, tag: lateTag || 'On time', lateTag: !!lateTag, late: !!lateTag, in: true };
  }
  if (phase === 'soon') return { state: 'soon', main: `Starts ${formatTashkentClock(run.start)}`, tag: '' };
  const deadline = run.start.getTime() + lateAfterMin.value * 60000;
  if (phase === 'on' && now.value.getTime() <= deadline) {
    return { state: 'due', main: `Due by ${formatTashkentClock(new Date(deadline))}`, tag: '' };
  }
  return { state: 'missing', main: phase === 'ended' ? 'No check-in' : 'Not checked in', tag: 'Missing', lateTag: true, missing: true };
}

const groups = computed(() => {
  const list = SHIFTS.map(s => {
    const run = placeShift(now.value, s.code);
    const phase = now.value < run.start ? 'soon' : now.value < run.end ? 'on' : 'ended';
    const minsTo = Math.max(0, Math.round((run.start - now.value) / 60000));
    const minsLeft = Math.max(0, Math.round((run.end - now.value) / 60000));
    const people = roster.value
      .filter(p => p.shiftCode === s.code)
      .map(p => ({ id: p.id, name: p.displayName, role: roleLabel(p.role), ...personState(p, run, phase) }));
    return {
      code: s.code,
      label: s.label,
      run,
      phase,
      phaseLabel: phase === 'on' ? `On now · ${formatMinutesSpan(minsLeft)} left` : phase === 'soon' ? `Starts in ${formatMinutesSpan(minsTo)}` : 'Ended',
      hours: shiftHours(s.code, run.day).tashkent,
      people
    };
  });
  const rank = { on: 0, soon: 1, ended: 2 };
  return list.sort((a, b) => (rank[a.phase] - rank[b.phase]) || (a.run.start - b.run.start));
});

// Counts for the shifts on duty right now
const totals = computed(() => {
  const onNow = groups.value.filter(g => g.phase === 'on').flatMap(g => g.people);
  return {
    expected: onNow.length,
    inNow: onNow.filter(p => p.in).length,
    late: onNow.filter(p => p.late).length,
    missing: onNow.filter(p => p.missing).length
  };
});

async function load() {
  errorMessage.value = '';
  try {
    const today = currentWorkDay(now.value);
    const [list, rules] = await Promise.all([
      fetchAttendance({ fromDate: addDays(today, -1), toDate: addDays(today, 1) }),
      fetchAttendanceRules()
    ]);
    records.value = list;
    lateAfterMin.value = rules.lateAfterMin;
  } catch (err) {
    errorMessage.value = err.message || 'Could not load today\'s check-ins';
  }
}

watch(() => props.refreshKey, load);

onMounted(() => {
  load();
  Promise.all([loadTeamRoster(), loadShiftHours()]).catch(() => {});
  timer = setInterval(() => { now.value = new Date(); }, 30000);
});
onUnmounted(() => clearInterval(timer));
</script>

<style scoped>
.today { user-select: text; }
.title-block { display: flex; flex-direction: column; gap: 1px; min-width: 0; }

.totals { display: grid; grid-template-columns: 1.6fr 1fr 1fr; }
.total { display: flex; flex-direction: column; gap: 4px; padding: 14px 16px; border-left: 1px solid var(--color-divider); }
.total:first-child { border-left: 0; }
.total.main { background: var(--color-accent-900); color: var(--color-bg); }
.total-num { font-family: var(--font-heading); font-weight: 600; font-size: 34px; line-height: 1; }
.of { font-size: 20px; opacity: 0.7; }
.total-label { font-size: 11px; letter-spacing: 0.06em; text-transform: uppercase; color: var(--color-neutral-700); }
.total.main .total-label { color: var(--color-accent-300); }
.total.is-signal .total-num, .total.is-signal .total-label { color: var(--color-signal); }

.group { display: flex; flex-direction: column; gap: 8px; }
.group-head { display: flex; align-items: baseline; gap: 8px; flex-wrap: wrap; }
.group-name { font-family: var(--font-heading); font-weight: 600; font-size: 20px; text-transform: uppercase; }
.group-hours { font-family: var(--font-heading); font-size: 15px; color: var(--color-neutral-700); }
.phase { font-size: 10px; letter-spacing: 0.08em; text-transform: uppercase; padding: 2px 7px; background: var(--color-neutral-200); color: var(--color-neutral-800); }
.phase.is-on { background: var(--color-accent); color: var(--color-bg); }
.phase.is-soon { background: var(--color-accent-100); color: var(--color-accent-800); }

.people { display: flex; flex-direction: column; }
.person { display: flex; align-items: center; gap: 12px; padding: 10px 14px; border-top: 1px solid var(--color-hairline); min-height: 56px; }
.person:first-child { border-top: 0; }
.person.is-missing { box-shadow: inset 3px 0 0 var(--color-signal); background: color-mix(in srgb, var(--color-signal) 5%, transparent); }
.avatar { width: 34px; height: 34px; font-size: 13px; }
.person-text { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 1px; }
.name { font-size: 15px; font-weight: 500; }
.role { font-size: 12px; color: var(--color-neutral-700); }
.status { display: flex; flex-direction: column; align-items: flex-end; gap: 3px; flex-shrink: 0; }
.status-main { font-family: var(--font-heading); font-size: 15px; white-space: nowrap; }
.person.is-soon .status-main, .person.is-due .status-main { color: var(--color-neutral-700); }
.person.is-missing .status-main { color: var(--color-signal); }
.tag-pill { font-size: 10px; letter-spacing: 0.08em; text-transform: uppercase; padding: 1px 6px; background: var(--color-accent-100); color: var(--color-accent-800); white-space: nowrap; }
.tag-pill.is-late { background: var(--color-signal); color: var(--color-bg); }
.empty { padding: 16px 14px; font-size: 13px; color: var(--color-neutral-700); }
</style>
