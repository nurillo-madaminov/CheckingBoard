<template>
  <div class="cb-page cb-scroll attendance">
    <div class="cb-page-head">
      <div class="title-block">
        <h2 class="cb-title">Attendance</h2>
        <span class="cb-sub">Phone check-ins and check-outs · late = more than {{ lateAfter }} min after the shift starts</span>
      </div>
      <div class="cb-spacer"></div>

      <!-- Month -->
      <div class="stepper">
        <button class="btn btn-ghost btn-icon step" title="Previous month" @click="shiftMonth(-1)">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6" /></svg>
        </button>
        <span class="month">{{ monthLabel }}</span>
        <button class="btn btn-ghost btn-icon step" title="Next month" :disabled="month >= thisMonth" @click="shiftMonth(1)">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6" /></svg>
        </button>
      </div>

      <select v-model="staffFilter" class="input compact staff-select" aria-label="Filter by person">
        <option value="">Everyone</option>
        <option v-for="p in people" :key="p.id" :value="p.id">{{ p.name }}</option>
      </select>

      <!-- Late rule -->
      <form class="rule" @submit.prevent="saveRule">
        <label for="late-after">Late after</label>
        <input id="late-after" v-model.number="lateDraft" type="number" min="0" max="240" step="1" class="input compact rule-input" />
        <span class="cb-sub">min</span>
        <button type="submit" class="btn btn-secondary" :disabled="lateDraft === lateAfter || isSaving">Save</button>
      </form>
    </div>

    <div v-if="errorMessage" class="cb-error">{{ errorMessage }}</div>

    <!-- Per person for the month -->
    <div class="cb-panel summary">
      <div class="sum-row sum-head">
        <div>Person</div><div class="num">Shifts</div><div class="num">Late</div><div class="num">Late total</div><div class="num">No check-out</div>
      </div>
      <div v-for="s in summary" :key="s.id" :class="['sum-row', { 'has-late': s.late }]">
        <div class="who">
          <span class="cb-avatar avatar">{{ initials(s.name) }}</span>
          <span class="cb-ellipsis">{{ s.name }}</span>
        </div>
        <div class="num">{{ s.shifts }}</div>
        <div :class="['num', { 'is-signal': s.late }]">{{ s.late }}</div>
        <div :class="['num', { 'is-signal': s.late }]">{{ s.late ? formatMinutesSpan(s.lateMin) : '—' }}</div>
        <div class="num">{{ s.missing || '—' }}</div>
      </div>
      <div v-if="!summary.length && !isLoading" class="empty">No check-ins in {{ monthLabel }}.</div>
    </div>

    <!-- Every check-in -->
    <div class="cb-panel records">
      <div class="rec-row rec-head">
        <div>Day</div><div>Person</div><div>Shift</div><div>In</div><div>Out</div><div>Late</div><div>From office</div>
      </div>
      <div v-if="isLoading" class="empty">Loading…</div>
      <template v-else>
        <div v-for="r in filtered" :key="r.id" :class="['rec-row', { 'is-late': r.is_late }]">
          <div class="c-day">{{ formatWorkDayShort(r.shift_date) }}</div>
          <div class="c-who cb-ellipsis">{{ r.staff_name_snapshot || 'Unknown' }}</div>
          <div class="c-shift">
            {{ getShiftConfig(r.shift_code).label }}
            <span class="cb-muted small">{{ formatTashkentClock(r.shift_start) }}–{{ formatTashkentClock(r.shift_end) }}</span>
          </div>
          <div class="c-in">
            <span class="t">{{ formatTashkentClock(r.check_in_at) }}</span>
            <span class="cb-muted small">{{ formatEasternClock(r.check_in_at) }} ET</span>
          </div>
          <div class="c-out">
            <template v-if="r.check_out_at">
              <span class="t">{{ formatTashkentClock(r.check_out_at) }}</span>
              <span class="cb-muted small">{{ formatEasternClock(r.check_out_at) }} ET</span>
            </template>
            <span v-else-if="isOpen(r)" class="still-in">Still in</span>
            <span v-else class="cb-muted">No check-out</span>
          </div>
          <div class="c-late">
            <span v-if="r.is_late" class="late-tag">Late {{ formatMinutesSpan(r.late_min) }}</span>
            <span v-else class="cb-muted">On time</span>
          </div>
          <div class="c-dist cb-muted">
            {{ Math.round(r.check_in_distance_m) }} m<template v-if="r.check_out_distance_m !== null"> / {{ Math.round(r.check_out_distance_m) }} m</template>
          </div>
        </div>
        <div v-if="!filtered.length" class="empty">No check-ins for this selection.</div>
      </template>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue';
import {
  fetchAttendance, fetchAttendanceRules, setLateAfter, formatMinutesSpan
} from '../services/attendanceService';
import {
  getShiftConfig, currentWorkDay, formatWorkDayShort, formatTashkentClock, formatEasternClock
} from '../config/shifts';
import { initials } from '../utils/format';

const props = defineProps({
  // Bumped by the app when a check-in / check-out arrives live
  refreshKey: { type: Number, default: 0 }
});
const emit = defineEmits(['saved', 'error']);

const thisMonth = currentWorkDay().slice(0, 7);
const month = ref(thisMonth); // 'YYYY-MM'
const staffFilter = ref('');
const rows = ref([]);
const lateAfter = ref(15);
const lateDraft = ref(15);
const isLoading = ref(false);
const isSaving = ref(false);
const errorMessage = ref('');
let loadSeq = 0;

const monthLabel = computed(() => {
  const [y, m] = month.value.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString('en-US', { timeZone: 'UTC', month: 'long', year: 'numeric' });
});

function monthRange(ym) {
  const [y, m] = ym.split('-').map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return { fromDate: `${ym}-01`, toDate: `${ym}-${String(last).padStart(2, '0')}` };
}

function shiftMonth(n) {
  const [y, m] = month.value.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1 + n, 1));
  const next = d.toISOString().slice(0, 7);
  if (next <= thisMonth) month.value = next;
}

const isOpen = r => !r.check_out_at && Date.parse(r.shift_end) + 8 * 3600e3 > Date.now();

const people = computed(() => {
  const map = new Map();
  rows.value.forEach(r => { if (r.staff_id && !map.has(r.staff_id)) map.set(r.staff_id, r.staff_name_snapshot); });
  return [...map].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
});

const filtered = computed(() => (staffFilter.value ? rows.value.filter(r => r.staff_id === staffFilter.value) : rows.value));

// Per person for the month: shifts, late count and minutes, missing check-outs
const summary = computed(() => {
  const by = new Map();
  filtered.value.forEach(r => {
    const key = r.staff_id || r.staff_name_snapshot;
    const s = by.get(key) || { id: key, name: r.staff_name_snapshot || 'Unknown', shifts: 0, late: 0, lateMin: 0, missing: 0 };
    s.shifts += 1;
    if (r.is_late) { s.late += 1; s.lateMin += r.late_min; }
    if (!r.check_out_at && !isOpen(r)) s.missing += 1;
    by.set(key, s);
  });
  return [...by.values()].sort((a, b) => (b.late - a.late) || a.name.localeCompare(b.name));
});

async function load() {
  const seq = ++loadSeq;
  isLoading.value = true;
  errorMessage.value = '';
  try {
    const [list, rules] = await Promise.all([fetchAttendance(monthRange(month.value)), fetchAttendanceRules()]);
    if (seq !== loadSeq) return;
    rows.value = list;
    lateAfter.value = rules.lateAfterMin;
    if (!isSaving.value) lateDraft.value = rules.lateAfterMin;
  } catch (err) {
    if (seq === loadSeq) errorMessage.value = err.message;
  } finally {
    if (seq === loadSeq) isLoading.value = false;
  }
}

async function saveRule() {
  const n = Math.round(Number(lateDraft.value));
  if (!Number.isFinite(n) || n < 0 || n > 240) {
    errorMessage.value = 'Late after must be between 0 and 240 minutes.';
    return;
  }
  isSaving.value = true;
  try {
    await setLateAfter(n);
    emit('saved', { title: 'Late rule saved', message: `Check-ins more than ${n} min after the start are late` });
  } catch (err) {
    emit('error', { title: 'Late rule not saved', message: err.message });
  } finally {
    isSaving.value = false;
    await load();
  }
}

watch(() => [month.value, props.refreshKey], load);
onMounted(load);
</script>

<style scoped>
.attendance { user-select: text; }
.title-block { display: flex; flex-direction: column; gap: 1px; min-width: 0; }
.stepper { display: flex; align-items: center; border: 1px solid var(--color-divider); background: var(--color-neutral-100); }
.step { width: 34px; height: 34px; color: var(--color-text); }
.month { font-family: var(--font-heading); font-size: 16px; padding: 0 10px; min-width: 130px; text-align: center; }
.compact { min-height: 34px; font-size: 13px; background-color: var(--color-neutral-100); }
.staff-select { width: 170px; }
.rule { display: flex; align-items: center; gap: 6px; font-size: 13px; }
.rule label { color: var(--color-neutral-800); white-space: nowrap; }
.rule-input { width: 70px; }

.summary, .records { display: flex; flex-direction: column; }
.sum-row { display: grid; grid-template-columns: minmax(0, 1.6fr) repeat(4, minmax(0, 1fr)); align-items: center; min-height: 44px; padding: 0 14px; gap: 10px; font-size: 13px; border-top: 1px solid var(--color-hairline); }
.sum-head, .rec-head { min-height: 36px; font-size: 11px; letter-spacing: 0.08em; text-transform: uppercase; color: var(--color-neutral-700); border-top: 0; border-bottom: 1px solid var(--color-divider); }
.sum-head + .sum-row, .rec-head + .rec-row { border-top: 0; }
.sum-row.has-late { box-shadow: inset 3px 0 0 var(--color-signal); }
.num { text-align: right; font-family: var(--font-heading); font-size: 16px; }
.sum-head .num { font-family: inherit; font-size: inherit; }
.is-signal { color: var(--color-signal); }
.who { display: flex; align-items: center; gap: 10px; min-width: 0; font-weight: 500; }
.avatar { width: 26px; height: 26px; font-size: 10px; }

.rec-row {
  display: grid; grid-template-columns: 110px minmax(0, 1.2fr) minmax(0, 1.1fr) 110px 110px 100px 110px;
  align-items: center; gap: 10px; min-height: 48px; padding: 6px 14px; font-size: 13px; border-top: 1px solid var(--color-hairline);
}
.rec-row.is-late { background: color-mix(in srgb, var(--color-signal) 6%, transparent); box-shadow: inset 3px 0 0 var(--color-signal); }
.rec-row > div { min-width: 0; display: flex; flex-direction: column; gap: 1px; }
.c-who { display: block !important; font-weight: 500; }
.t { font-family: var(--font-heading); font-size: 16px; }
.small { font-size: 11px; }
.still-in { font-size: 12px; font-weight: 600; color: var(--color-accent-700); }
.late-tag { align-self: flex-start; font-size: 10px; letter-spacing: 0.08em; text-transform: uppercase; padding: 1px 6px; background: var(--color-signal); color: var(--color-bg); white-space: nowrap; }
.empty { padding: 28px; text-align: center; font-size: 14px; color: var(--color-neutral-700); }

@media (max-width: 900px) {
  .staff-select { flex: 1 1 150px; width: auto; }
  .records { overflow-x: auto; }
  .rec-row { min-width: 760px; }
}
/* Phones: each check-in becomes a small card */
@media (max-width: 640px) {
  .sum-row { grid-template-columns: minmax(0, 1fr) 40px 34px 56px 52px; padding: 0 10px; gap: 6px; }
  .who { gap: 8px; }
  .avatar { width: 24px; height: 24px; }
  .sum-head { font-size: 9px; letter-spacing: 0.04em; }
  .records { overflow-x: visible; }
  .rec-head { display: none; }
  .rec-row {
    min-width: 0; grid-template-columns: 1fr auto; grid-template-areas: "who late" "day dist" "shift shift" "in out";
    gap: 4px 10px; padding: 10px 12px;
  }
  .c-who { grid-area: who; font-size: 15px; }
  .c-late { grid-area: late; align-items: flex-end; }
  .c-day { grid-area: day; color: var(--color-neutral-700); }
  .c-dist { grid-area: dist; align-items: flex-end; }
  .c-shift { grid-area: shift; flex-direction: row !important; gap: 6px !important; align-items: baseline; }
  .c-in { grid-area: in; }
  .c-out { grid-area: out; align-items: flex-end; }
  .c-in::before { content: 'In'; font-size: 10px; letter-spacing: 0.08em; text-transform: uppercase; color: var(--color-neutral-600); }
  .c-out::before { content: 'Out'; font-size: 10px; letter-spacing: 0.08em; text-transform: uppercase; color: var(--color-neutral-600); }
}
</style>
