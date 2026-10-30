<template>
  <div class="cb-page cb-scroll logs">
    <div class="cb-page-head">
      <div class="title-block">
        <h2 class="cb-title">Logs</h2>
        <span class="cb-sub">
          {{ scopeLabel }} for the work day (shifts that started that day, Tashkent time)
        </span>
      </div>
      <div class="cb-spacer"></div>

      <!-- Work day -->
      <div class="stepper">
        <button class="btn btn-ghost btn-icon step" title="Previous day" @click="shiftDay(-1)">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6" /></svg>
        </button>
        <label class="day" :title="'Pick a day'">
          <span>{{ dayLabel }}</span>
          <input v-model="filters.day" type="date" :max="today" class="day-input" />
        </label>
        <button class="btn btn-ghost btn-icon step" title="Next day" :disabled="filters.day >= today" @click="shiftDay(1)">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6" /></svg>
        </button>
      </div>

      <!-- Shift (manager only: staff see just the actions they recorded) -->
      <div v-if="isManager" class="seg">
        <button
          v-for="opt in shiftOptions"
          :key="opt.code"
          :class="['seg-btn', { 'is-on': filters.shift === opt.code }]"
          @click="filters.shift = opt.code"
        >
          {{ opt.label }}
        </button>
      </div>

      <!-- Managers pick anyone; staff on a shift pick among their shift-mates -->
      <select v-if="staffOptions.length > 1" v-model="filters.staffUserId" class="input compact staff-select">
        <option value="">{{ isManager ? 'All staff' : 'Whole shift' }}</option>
        <option v-for="staff in staffOptions" :key="staff.id" :value="staff.id">{{ staff.displayName }}</option>
      </select>

      <input v-model="filters.search" class="input compact search" placeholder="Search driver or company" />
    </div>

    <!-- Counts (click to filter by action) -->
    <div class="cb-panel counts">
      <button
        v-for="k in countTiles"
        :key="k.code"
        :class="['count', { 'is-on': filters.actionType === k.code }]"
        @click="filters.actionType = k.code"
      >
        <span class="cb-num count-num">{{ k.count }}</span>
        <span class="cb-label">{{ k.label }}</span>
      </button>
    </div>

    <div v-if="errorMessage" class="cb-error">{{ errorMessage }}</div>

    <!-- Records (scrolls sideways on narrow screens) -->
    <div class="cb-panel records">
      <div class="cb-grid-head grid head">
        <div class="center">#</div><div>Time · TAS / ET</div><div>Shift</div><div>Staff</div><div>Driver</div><div>Action</div><div>Note</div>
      </div>
      <div v-if="isLoading" class="empty">Loading records…</div>
      <template v-else>
        <div v-for="(r, i) in rows" :key="r.id" class="cb-grid-row grid">
          <div class="center idx">{{ rows.length - i }}</div>
          <div class="cb-ellipsis">
            <span class="tas">{{ formatTashkentClock(r.action_at) }}</span>
            <span class="cb-muted"> / {{ formatEasternClock(r.action_at) }}</span>
          </div>
          <div class="cb-muted">{{ getShiftConfig(r.shift_code).label }}</div>
          <div class="person">
            <span class="cb-avatar avatar">{{ initials(r.staff_name_snapshot) }}</span>
            <span class="cb-ellipsis">{{ r.staff_name_snapshot || 'Unknown' }}</span>
          </div>
          <div class="person">
            <span class="cb-ellipsis strong" :title="r.company_name_snapshot">{{ r.driver_name_snapshot || '—' }}</span>
            <span v-if="isDriverDeleted(r)" class="tag tag-neutral">Deleted</span>
          </div>
          <div><span class="action-tag" :style="getActionTypeConfig(r.action_type).tag">{{ getActionTypeConfig(r.action_type).label }}</span></div>
          <div class="cb-muted cb-ellipsis" :title="r.extra_note || ''">{{ r.extra_note || '—' }}</div>
        </div>
        <div v-if="rows.length === 0" class="empty">No actions for this selection.</div>
      </template>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, watch, onMounted } from 'vue';
import { ACTION_TYPES, getActionTypeConfig, fetchActivities } from '../services/activityService';
import { isCurrentUserManager, currentStaffUser, activeStaffProfiles } from '../services/authService';
import {
  SHIFTS,
  getShiftConfig,
  currentWorkDay,
  addDays,
  formatWorkDayShort,
  formatTashkentClock,
  formatEasternClock
} from '../config/shifts';
import { initials } from '../utils/format';

const props = defineProps({
  activeDrivers: { type: Array, default: () => [] },
  // Bumped by the app after this user records an action
  refreshKey: { type: Number, default: 0 }
});

const isManager = computed(() => isCurrentUserManager());
// Deactivated members are not offered as a filter (their past records still show)
const staffProfiles = computed(() => activeStaffProfiles.value);
const today = currentWorkDay();

// Staff see their own records plus their shift-mates' on that shift (the database enforces this)
const myShiftCode = computed(() => currentStaffUser.value?.shiftCode || '');
const shiftMates = computed(() => (myShiftCode.value
  ? staffProfiles.value.filter(p => p.shiftCode === myShiftCode.value)
  : []));
const staffOptions = computed(() => (isManager.value ? staffProfiles.value : shiftMates.value));
const scopeLabel = computed(() => {
  if (isManager.value) return 'All team actions';
  if (shiftMates.value.length > 1) return `Your and your ${getShiftConfig(myShiftCode.value).label} shift-mates' actions`;
  return 'Your own actions';
});

const shiftOptions = [{ code: '', label: 'All' }, ...SHIFTS.map(s => ({ code: s.code, label: s.label }))];

const filters = reactive({
  day: today,
  shift: '',
  staffUserId: '',
  actionType: '',
  search: ''
});

const activities = ref([]);
const isLoading = ref(false);
const errorMessage = ref('');
let loadSeq = 0;

const dayLabel = computed(() => (filters.day === today ? `Today · ${formatWorkDayShort(today)}` : formatWorkDayShort(filters.day)));

async function load() {
  if (!filters.day) return;
  const seq = ++loadSeq;
  isLoading.value = true;
  errorMessage.value = '';
  try {
    const rows = await fetchActivities({
      fromDate: filters.day,
      toDate: filters.day,
      shiftCode: isManager.value ? filters.shift : '',
      staffUserId: filters.staffUserId
    });
    if (seq === loadSeq) activities.value = rows;
  } catch (err) {
    if (seq === loadSeq) {
      activities.value = [];
      errorMessage.value = `Could not load records: ${err.message || err}`;
    }
  } finally {
    if (seq === loadSeq) isLoading.value = false;
  }
}

function shiftDay(n) {
  const next = addDays(filters.day || today, n);
  if (next <= today) filters.day = next;
}

// Search applies before the action tiles, so the tiles count what matches
const matching = computed(() => {
  const q = filters.search.trim().toLowerCase();
  if (!q) return activities.value;
  return activities.value.filter(a =>
    `${a.driver_name_snapshot || ''} ${a.company_name_snapshot || ''}`.toLowerCase().includes(q)
  );
});

const countTiles = computed(() => [
  { code: '', label: 'All actions', count: matching.value.length },
  ...ACTION_TYPES.map(a => ({ code: a.code, label: a.label, count: matching.value.filter(r => r.action_type === a.code).length }))
]);

const rows = computed(() => (filters.actionType
  ? matching.value.filter(r => r.action_type === filters.actionType)
  : matching.value));

function isDriverDeleted(activity) {
  if (!activity.driver_name_snapshot) return false;
  if (!activity.driver_id) return true;
  return !props.activeDrivers.some(d => d.id === activity.driver_id);
}

watch(() => [filters.day, filters.shift, filters.staffUserId, props.refreshKey], load);
onMounted(load);
</script>

<style scoped>
.logs { user-select: text; }
.title-block { display: flex; flex-direction: column; gap: 1px; }
.stepper { display: flex; align-items: center; border: 1px solid var(--color-divider); background: var(--color-neutral-100); }
.step { width: 34px; height: 34px; color: var(--color-text); }
.day { position: relative; font-family: var(--font-heading); font-size: 16px; padding: 0 12px; min-width: 150px; text-align: center; cursor: pointer; }
/* The native date picker sits invisibly over the label: click the day to pick another */
.day-input { position: absolute; inset: 0; opacity: 0; cursor: pointer; width: 100%; }
.day-input::-webkit-calendar-picker-indicator { position: absolute; inset: 0; width: 100%; height: 100%; cursor: pointer; }
.compact { min-height: 34px; font-size: 13px; background-color: var(--color-neutral-100); }
.staff-select { width: 170px; }
.search { width: 190px; }

.counts { display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); }
.count {
  display: flex; flex-direction: column; gap: 6px; align-items: flex-start; padding: 14px 16px;
  border: 0; border-left: 1px solid var(--color-divider); cursor: pointer; font: inherit; text-align: left;
  color: var(--color-text); background: transparent;
}
.count:first-child { border-left: 0; }
.count:hover:not(.is-on) { background: var(--color-bg); }
.count.is-on { background: var(--color-accent-100); box-shadow: inset 0 -2px 0 var(--color-accent); }
.count-num { font-size: 30px; line-height: 1; }

.grid { grid-template-columns: 48px 150px 100px minmax(0, 1.1fr) minmax(0, 1.3fr) 130px minmax(0, 1.4fr); }
.head { position: sticky; top: -18px; background: var(--color-neutral-100); z-index: 2; }
.center { text-align: center; }
.idx { font-family: var(--font-heading); color: var(--color-neutral-600); }
.tas { font-family: var(--font-heading); font-weight: 600; font-size: 15px; }
.person { display: flex; align-items: center; gap: 8px; }
.avatar { width: 24px; height: 24px; font-size: 10px; }
.strong { font-weight: 500; }
.action-tag { display: inline-block; font-size: 12px; font-weight: 500; padding: 2px 8px; white-space: nowrap; }
.empty { padding: 40px; text-align: center; font-size: 14px; color: var(--color-neutral-700); }

@media (max-width: 1240px) {
  .counts { grid-template-columns: repeat(3, minmax(0, 1fr)); }
  .count:nth-child(4) { border-left: 0; }
  .count:nth-child(n + 4) { border-top: 1px solid var(--color-divider); }
}
@media (max-width: 900px) {
  .staff-select, .search { flex: 1 1 160px; width: auto; }
  /* Columns keep a readable width; the table scrolls sideways (the header stops sticking) */
  .records { overflow-x: auto; }
  .grid { min-width: 820px; }
  .head { position: static; }
}
@media (max-width: 600px) {
  /* Day picker and shift buttons fill the width */
  .stepper { flex: 1 1 100%; justify-content: space-between; }
  .day { flex: 1; min-width: 0; }
  .seg { display: flex; width: 100%; }
  .counts { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .count { padding: 10px 12px; }
  .count-num { font-size: 24px; }
  .count:nth-child(n) { border-left: 1px solid var(--color-divider); }
  .count:nth-child(odd) { border-left: 0; }
  .count:nth-child(n + 3) { border-top: 1px solid var(--color-divider); }
}
</style>
