<template>
  <div class="cb-page cb-scroll stats">
    <div class="cb-page-head">
      <div class="title-block">
        <h2 class="cb-title">Statistics</h2>
        <span class="cb-sub">Action-button records only · {{ rangeLabel }}</span>
      </div>
      <div class="cb-spacer"></div>
      <DateRangePicker :from="fromDay" :to="toDay" :max="today" :maxDays="MAX_DAYS" @change="setRange" />
    </div>

    <div v-if="errorMessage" class="cb-error">{{ errorMessage }}</div>

    <div :class="['body', { 'is-loading': isLoading }]">
      <!-- Totals -->
      <div class="cb-panel totals">
        <div class="total-tile">
          <span class="kicker">All 3 shifts</span>
          <span class="cb-num total-num">{{ stats.team.total }}</span>
          <span class="total-sub">{{ dayCount > 1 ? `≈ ${perDay(stats.team.total)} per day` : 'actions this day' }}</span>
        </div>
        <div v-for="act in ACTION_TYPES" :key="act.code" class="act-tile">
          <span class="cb-label">{{ act.label }}</span>
          <span class="cb-num act-num">{{ stats.team[act.code] || 0 }}</span>
          <span class="cb-bar"><span :style="{ width: `${barPct(stats.team[act.code], actionMax)}%`, background: 'var(--color-accent)' }"></span></span>
          <span class="cb-sub small">{{ shareOf(stats.team[act.code], stats.team.total) }} of all</span>
        </div>
      </div>

      <div class="split">
        <!-- Day by day -->
        <div class="cb-panel chart">
          <div class="chart-head">
            <span class="section-title">Day by day</span>
            <span class="cb-spacer"></span>
            <span v-for="s in SHIFTS" :key="s.code" class="legend">
              <span class="swatch" :style="{ background: SHIFT_COLORS[s.code] }"></span>{{ s.label }}
            </span>
          </div>
          <div class="columns">
            <div v-for="col in chartCols" :key="col.date" class="column" :title="col.title">
              <span v-for="s in SHIFTS_TOP_DOWN" :key="s.code" class="seg-bar" :style="{ height: `${col.pct[s.code]}%`, background: SHIFT_COLORS[s.code] }"></span>
            </div>
          </div>
          <div class="col-labels">
            <span v-for="col in chartCols" :key="col.date" :class="{ 'in-range': col.inRange }">{{ col.short }}</span>
          </div>
        </div>

        <!-- Per shift -->
        <div class="shift-cards">
          <div v-for="s in SHIFTS" :key="s.code" class="cb-panel shift-card">
            <div class="shift-top">
              <span class="shift-name">{{ s.label }} <span class="shift-hours">{{ shiftHours(s.code).tashkent }} Tashkent</span></span>
              <span><span class="cb-num shift-total">{{ stats.byShift[s.code].total }}</span> <span class="cb-sub small">{{ shareOf(stats.byShift[s.code].total, stats.team.total) }} of all</span></span>
            </div>
            <div class="shift-acts">
              <div v-for="act in ACTION_TYPES" :key="act.code" class="shift-act">
                <span class="cb-num shift-act-num">{{ stats.byShift[s.code][act.code] || 0 }}</span>
                <span class="shift-act-label">{{ act.short }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Per staff -->
      <div class="cb-panel">
        <div class="cb-grid-head staff-grid">
          <div class="pad">Per staff member</div><div>Shift</div>
          <div v-for="act in ACTION_TYPES" :key="act.code" class="right">{{ act.short }}</div>
          <div class="pad">Total</div>
        </div>
        <div v-for="p in stats.byStaff" :key="p.staffId" class="cb-grid-row staff-grid">
          <div class="pad person">
            <span class="cb-avatar avatar">{{ initials(p.displayName) }}</span>
            <span class="cb-ellipsis strong">{{ p.displayName }}</span>
            <span v-if="p.role === 'former'" class="tag tag-neutral">Former</span>
            <span v-else-if="!p.isActive" class="tag tag-neutral">Deactivated</span>
          </div>
          <div class="cb-muted">{{ p.shiftCode ? getShiftConfig(p.shiftCode).label : '—' }}</div>
          <div v-for="act in ACTION_TYPES" :key="act.code" class="right num">{{ p[act.code] || 0 }}</div>
          <div class="pad total-cell">
            <span class="cb-num staff-total">{{ p.total }}</span>
            <span class="cb-bar staff-bar"><span :style="{ width: `${barPct(p.total, staffMax)}%`, background: 'var(--color-accent-500)' }"></span></span>
          </div>
        </div>
        <div v-if="!stats.byStaff.length" class="empty">No team members yet.</div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue';
import DateRangePicker from './DateRangePicker.vue';
import { ACTION_TYPES, fetchActivities, summarizeActivities } from '../services/activityService';
import { staffProfiles, loadTeamRoster } from '../services/authService';
import {
  SHIFTS,
  getShiftConfig,
  shiftHours,
  currentWorkDay,
  addDays,
  dateRange,
  formatWorkDayShort
} from '../config/shifts';
import { initials } from '../utils/format';

const props = defineProps({
  // Bumped by the app after this user records an action
  refreshKey: { type: Number, default: 0 }
});

// The longest range is one month
const MAX_DAYS = 31;

// One steel hue, light to dark through the day (the design system is single-accent)
const SHIFT_COLORS = { MORNING: 'var(--color-accent-300)', AFTERNOON: 'var(--color-accent-500)', NIGHT: 'var(--color-accent-800)' };
const SHIFTS_TOP_DOWN = [...SHIFTS].reverse();

const today = currentWorkDay();
// Chosen on the calendar; starts as the last 7 work days
const fromDay = ref(addDays(today, -6));
const toDay = ref(today);
const activities = ref([]);
const isLoading = ref(false);
const errorMessage = ref('');
let loadSeq = 0;

function setRange({ from, to }) {
  fromDay.value = from;
  toDay.value = to;
}

const dayCount = computed(() => dateRange(fromDay.value, toDay.value).length);
// The chart always shows at least a week (ending on the last chosen day) for context
const chartFrom = computed(() => (dayCount.value < 7 ? addDays(toDay.value, -6) : fromDay.value));

const rangeLabel = computed(() => (dayCount.value === 1
  ? formatWorkDayShort(toDay.value)
  : `${formatWorkDayShort(fromDay.value)} – ${formatWorkDayShort(toDay.value)} (${dayCount.value} days)`));

const inPeriod = computed(() => activities.value.filter(a => a.shift_date >= fromDay.value));

const stats = computed(() => summarizeActivities(inPeriod.value, {
  fromDate: fromDay.value,
  toDate: toDay.value,
  staffProfiles: staffProfiles.value
}));

const actionMax = computed(() => Math.max(1, ...ACTION_TYPES.map(a => stats.value.team[a.code] || 0)));
const staffMax = computed(() => Math.max(1, ...stats.value.byStaff.map(p => p.total)));

const chartCols = computed(() => {
  const days = dateRange(chartFrom.value, toDay.value).map(date => {
    const counts = { MORNING: 0, AFTERNOON: 0, NIGHT: 0 };
    activities.value.forEach(a => {
      if (a.shift_date === date && a.shift_code in counts) counts[a.shift_code] += 1;
    });
    return { date, counts, total: counts.MORNING + counts.AFTERNOON + counts.NIGHT };
  });
  const max = Math.max(1, ...days.map(d => d.total));
  const many = days.length > 14;
  return days.map(d => ({
    date: d.date,
    inRange: d.date >= fromDay.value,
    short: d.date === today ? 'Today' : (many ? String(Number(d.date.slice(8))) : formatWorkDayShort(d.date).split(',')[0]),
    title: `${formatWorkDayShort(d.date)} · ${d.total} total · Morning ${d.counts.MORNING} · Afternoon ${d.counts.AFTERNOON} · Night ${d.counts.NIGHT}`,
    pct: Object.fromEntries(SHIFTS.map(s => [s.code, (d.counts[s.code] / max) * 100]))
  }));
});

function barPct(count, max) {
  return ((count || 0) / max) * 100;
}

function shareOf(count, total) {
  return total ? `${Math.round(((count || 0) / total) * 100)}%` : '0%';
}

function perDay(total) {
  return Math.round(total / dayCount.value);
}

async function load() {
  const seq = ++loadSeq;
  isLoading.value = true;
  errorMessage.value = '';
  try {
    const rows = await fetchActivities({ fromDate: chartFrom.value, toDate: toDay.value });
    if (seq === loadSeq) activities.value = rows;
  } catch (err) {
    if (seq === loadSeq) errorMessage.value = `Could not load statistics: ${err.message || err}`;
  } finally {
    if (seq === loadSeq) isLoading.value = false;
  }
}

watch(() => [chartFrom.value, toDay.value, props.refreshKey], load);
onMounted(() => {
  load();
  loadTeamRoster().catch(() => {});
});
</script>

<style scoped>
.stats { user-select: text; }
.title-block { display: flex; flex-direction: column; gap: 1px; }
.body { display: flex; flex-direction: column; gap: 16px; transition: opacity 150ms; }
.body.is-loading { opacity: 0.55; }
.small { font-size: 12px; }

.totals { display: grid; grid-template-columns: 1.4fr repeat(5, minmax(0, 1fr)); }
.total-tile { padding: 18px; display: flex; flex-direction: column; gap: 6px; background: var(--color-accent-900); color: var(--color-bg); }
.kicker { font-size: 11px; letter-spacing: 0.1em; text-transform: uppercase; color: var(--color-accent-300); }
.total-num { font-size: 52px; }
.total-sub { font-size: 12px; color: var(--color-accent-200); }
.act-tile { padding: 18px; display: flex; flex-direction: column; gap: 8px; border-left: 1px solid var(--color-divider); min-width: 0; }
.act-num { font-size: 38px; }

.split { display: grid; grid-template-columns: minmax(0, 1.6fr) minmax(0, 1fr); gap: 14px; }
.chart { padding: 16px 18px; display: flex; flex-direction: column; gap: 14px; }
.chart-head { display: flex; align-items: center; gap: 14px; }
.section-title { font-family: var(--font-heading); font-weight: 600; font-size: 20px; text-transform: uppercase; }
.legend { display: flex; align-items: center; gap: 6px; font-size: 12px; color: var(--color-neutral-700); }
.swatch { width: 10px; height: 10px; }
.columns { display: flex; align-items: flex-end; gap: 4px; height: 200px; border-bottom: 1px solid var(--color-divider); }
.column { flex: 1; min-width: 0; height: 100%; display: flex; flex-direction: column; justify-content: flex-end; gap: 1px; }
.column:hover { background: color-mix(in srgb, var(--color-text) 4%, transparent); }
.seg-bar { display: block; flex-shrink: 0; }
.col-labels { display: flex; gap: 4px; }
.col-labels > span { flex: 1; min-width: 0; text-align: center; font-size: 11px; color: var(--color-neutral-500); white-space: nowrap; overflow: hidden; }
.col-labels > span.in-range { color: var(--color-neutral-700); }

.shift-cards { display: flex; flex-direction: column; gap: 14px; }
.shift-card { padding: 14px 16px; display: flex; flex-direction: column; gap: 10px; }
.shift-top { display: flex; justify-content: space-between; align-items: baseline; gap: 8px; }
.shift-name { font-family: var(--font-heading); font-weight: 600; font-size: 18px; text-transform: uppercase; }
.shift-hours { font-family: var(--font-body); font-weight: 400; font-size: 12px; color: var(--color-neutral-700); text-transform: none; }
.shift-total { font-size: 26px; }
.shift-acts { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); border: 1px solid var(--color-divider); background: var(--color-bg); }
.shift-act { display: flex; flex-direction: column; align-items: center; padding: 6px 2px; border-left: 1px solid var(--color-divider); }
.shift-act:first-child { border-left: 0; }
.shift-act-num { font-size: 17px; line-height: 1.2; }
.shift-act-label { font-size: 10px; letter-spacing: 0.04em; text-transform: uppercase; color: var(--color-neutral-700); white-space: nowrap; }

.staff-grid { grid-template-columns: minmax(0, 1.6fr) 110px repeat(5, minmax(0, 1fr)) minmax(0, 1.4fr); }
.cb-grid-head.staff-grid > .pad, .staff-grid > .pad { padding-inline: 14px; }
.right { text-align: right; }
.num { font-family: var(--font-heading); font-size: 15px; }
.person { display: flex; align-items: center; gap: 10px; }
.avatar { width: 26px; height: 26px; font-size: 11px; }
.strong { font-weight: 500; }
.total-cell { display: flex; align-items: center; gap: 10px; }
.staff-total { font-size: 17px; min-width: 32px; line-height: 1.2; }
.staff-bar { flex: 1; height: 6px; }
.empty { padding: 32px; text-align: center; font-size: 14px; color: var(--color-neutral-700); }

@media (max-width: 1240px) {
  .totals { grid-template-columns: repeat(3, minmax(0, 1fr)); }
  .act-tile:nth-child(4) { border-left: 0; }
  .act-tile:nth-child(n + 4) { border-top: 1px solid var(--color-divider); }
  .split { grid-template-columns: 1fr; }
}
</style>
