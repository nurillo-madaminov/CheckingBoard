<template>
  <div class="cb-page cb-scroll driver-page">
    <!-- Way back to where you came from, and on to the neighbours in the company -->
    <nav class="cb-crumbs" aria-label="Breadcrumb">
      <button type="button" class="cb-link" @click="$emit('back')">← {{ from === 'fleet' ? 'Fleet' : 'Board' }}</button>
      <span aria-hidden="true">/</span>
      <button v-if="company && canManageFleet" type="button" class="cb-link" @click="$emit('open-company', company.id)">{{ company.name }}</button>
      <span v-else-if="company">{{ company.name }}</span>
      <span aria-hidden="true">/</span>
      <span>{{ driver ? label : 'Driver' }}</span>
      <span class="cb-spacer"></span>
      <button v-if="prev" type="button" class="cb-link" :title="`Previous in ${company?.name || 'company'}`" @click="$emit('open-driver', prev.id)">↑ {{ driverLabel(prev) }}</button>
      <button v-if="next" type="button" class="cb-link" :title="`Next in ${company?.name || 'company'}`" @click="$emit('open-driver', next.id)">↓ {{ driverLabel(next) }}</button>
    </nav>

    <!-- The driver was deleted (here or by a teammate) -->
    <div v-if="!driver" class="cb-panel cb-empty-state">
      <strong>This driver is no longer on the board.</strong>
      <span>They may have been deleted by a teammate. Past log entries keep their name.</span>
      <button type="button" class="btn btn-secondary" @click="$emit('back')">Back to {{ from === 'fleet' ? 'Fleet' : 'Board' }}</button>
    </div>

    <template v-else>
      <!-- Header: title + the one primary action, same place as every page -->
      <div class="cb-page-head">
        <span class="unit-badge">{{ driver.unit || '—' }}</span>
        <div class="title-block">
          <h2 class="cb-title cb-ellipsis">{{ driver.name }}</h2>
          <span class="cb-sub">{{ company?.name || 'No company' }}{{ company?.note ? ` · ${company.note}` : '' }}</span>
        </div>
        <div class="cb-spacer"></div>
        <button type="button" :class="['btn', 'btn-primary']" @click="markChecked">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5" /></svg>
          Mark checked
          <span class="cb-key key-on-primary">C</span>
        </button>
        <MoreMenu :items="menuItems" label="More driver actions" @select="onMenu" />
      </div>

      <div class="split">
        <!-- Now: the board's controls for this driver, with their labels -->
        <section class="cb-panel now" aria-labelledby="now-title">
          <span id="now-title" class="cb-label">Now</span>

          <div class="last-check">
            <span class="field-label">Last check</span>
            <div class="age-line">
              <span :class="['age-big', { 'is-overdue': fresh.level === 'overdue' }]">{{ fresh.level === 'overdue' && !driver.lastCheckedAt ? 'Never' : `${fresh.short} ago` }}</span>
              <span :class="['fresh-tag', `is-${fresh.level}`]">
                <svg v-if="fresh.level === 'overdue'" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>
                <svg v-else width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5" /></svg>
                {{ FRESH_LABELS[fresh.level] }}
              </span>
            </div>
            <span class="age-bar"><span :style="{ width: `${fresh.pct}%`, background: freshnessColor(fresh.level) }"></span></span>
            <span class="cb-sub small">
              <template v-if="driver.lastCheckedAt">{{ formatTashkentDateTime(driver.lastCheckedAt) }} Tashkent · {{ formatEasternDateTime(driver.lastCheckedAt) }} ET · </template>overdue after 4h
            </span>
          </div>

          <div class="two">
            <div class="field">
              <label for="drv-detail-sign">Sign</label>
              <select
                id="drv-detail-sign"
                :value="driver.sign"
                :class="['input', driver.sign === 'SIGNED' ? 'sign-on' : 'sign-off']"
                @change="update({ sign: $event.target.value, lastCheckedAt: new Date().toISOString() })"
              >
                <option v-for="s in SIGN_STATUSES" :key="s.code" :value="s.code">{{ s.label }}</option>
              </select>
            </div>
            <div class="field">
              <label for="drv-detail-status">Status</label>
              <select
                id="drv-detail-status"
                :value="driver.status"
                class="input status-select"
                :style="statusLook"
                @change="update({ status: $event.target.value, lastCheckedAt: new Date().toISOString() })"
              >
                <option v-for="st in DRIVER_STATUSES" :key="st.code" :value="st.code">{{ st.code }} – {{ st.label }}</option>
              </select>
            </div>
          </div>

          <div class="field">
            <label for="drv-detail-notes">Notes · saved when you leave the box</label>
            <textarea id="drv-detail-notes" v-model="notesDraft" class="input" rows="3" @blur="saveNotes"></textarea>
          </div>

          <label class="flag-line">
            <input type="checkbox" :checked="flagged" @change="toggleFlag" />
            Flag this driver on the board
          </label>

          <div class="related">
            <span class="cb-label">Related</span>
            <button v-if="company && canManageFleet" type="button" class="cb-link" @click="$emit('open-company', company.id)">
              {{ company.name }} · {{ companyStats }}
            </button>
            <span v-else-if="company" class="cb-sub">{{ company.name }} · {{ companyStats }}</span>
            <button type="button" class="cb-link" @click="$emit('open-activity', { search: driver.name })">All of this driver's actions in Reports › Activity</button>
          </div>
        </section>

        <!-- History: this driver's records (was: Logs, searched by hand) -->
        <section class="cb-panel history" aria-labelledby="history-title">
          <div class="history-head">
            <span id="history-title" class="cb-label">Recent actions</span>
            <span class="cb-spacer"></span>
            <div class="seg" role="group" aria-label="Period">
              <button
                v-for="p in PERIODS"
                :key="p.days"
                type="button"
                :class="['seg-btn', { 'is-on': period === p.days }]"
                :aria-pressed="period === p.days ? 'true' : 'false'"
                @click="period = p.days"
              >
                {{ p.label }}
              </button>
            </div>
          </div>
          <div v-if="errorMessage" class="cb-error history-error">
            Could not load this driver's actions. {{ errorMessage }}
            <button type="button" class="cb-link" @click="load">Try again</button>
          </div>
          <div class="history-scroll">
            <div class="hist-row hist-head">
              <div>Time · TAS / ET</div><div>Shift</div><div>Staff</div><div>Action</div><div>Note</div>
            </div>
            <div v-if="isLoading" class="cb-empty-state">Loading actions…</div>
            <template v-else>
              <div v-for="r in records" :key="r.id" class="hist-row">
                <div class="cb-ellipsis">
                  <span class="strong">{{ formatWorkDayShort(r.shift_date) }}</span>
                  {{ formatTashkentClock(r.action_at) }} <span class="cb-muted">/ {{ formatEasternClock(r.action_at) }}</span>
                </div>
                <div class="cb-muted">{{ getShiftConfig(r.shift_code).label }}</div>
                <div class="cb-ellipsis">{{ r.staff_name_snapshot || 'Unknown' }}</div>
                <div><span class="action-tag" :style="getActionTypeConfig(r.action_type).tag">{{ getActionTypeConfig(r.action_type).label }}</span></div>
                <div class="cb-muted cb-ellipsis" :title="r.extra_note || ''">{{ r.extra_note || '—' }}</div>
              </div>
              <div v-if="!records.length && !errorMessage" class="cb-empty-state">
                <strong>No actions in this period.</strong>
                <span>Actions are logged by the Leader ELD extension.</span>
              </div>
            </template>
          </div>
          <div class="history-foot cb-sub">
            {{ records.length }} {{ records.length === 1 ? 'action' : 'actions' }} · {{ periodLabel }}
            <span class="dot">·</span>
            <button type="button" class="cb-link" @click="$emit('open-activity', { search: driver.name })">Open in Reports › Activity</button>
          </div>
        </section>
      </div>

      <div class="foot-keys cb-sub">
        <span><span class="cb-key">C</span> check</span>
        <span><span class="cb-key">E</span> edit</span>
        <span><span class="cb-key">J</span> <span class="cb-key">K</span> next / previous</span>
        <span><span class="cb-key">Esc</span> back</span>
      </div>
    </template>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue';
import MoreMenu from './MoreMenu.vue';
import { DRIVER_STATUSES, SIGN_STATUSES, getStatusConfig, FLAG_COLOR, isFlagged } from '../config/statusConfig';
import { getFreshnessInfo, freshnessColor } from '../utils/freshness';
import { fetchActivities, getActionTypeConfig } from '../services/activityService';
import {
  getShiftConfig, currentWorkDay, addDays, formatWorkDayShort, formatTashkentClock, formatEasternClock,
  formatTashkentDateTime, formatEasternDateTime
} from '../config/shifts';
import { driverLabel } from '../utils/format';

const props = defineProps({
  driver: { type: Object, default: null },
  companies: { type: Array, required: true },
  drivers: { type: Array, required: true },
  canManageFleet: { type: Boolean, default: false },
  // Where the page was opened from: 'board' | 'fleet'
  from: { type: String, default: 'board' },
  // Bumped by the app when new actions arrive
  refreshKey: { type: Number, default: 0 },
  // Off while a dialog is open
  keyboardEnabled: { type: Boolean, default: true }
});

const emit = defineEmits(['back', 'open-driver', 'open-company', 'open-activity', 'update-driver', 'edit-driver', 'delete-driver']);

const FRESH_LABELS = { fresh: 'Fresh', aging: 'Aging', warning: 'Due soon', overdue: 'Overdue' };
const PERIODS = [
  { days: 1, label: 'Today' },
  { days: 7, label: '7 days' },
  { days: 30, label: '30 days' }
];

const company = computed(() => props.companies.find(c => c.id === props.driver?.companyId) || null);
const label = computed(() => driverLabel(props.driver));
const fresh = computed(() => getFreshnessInfo(props.driver?.lastCheckedAt));
const flagged = computed(() => !!props.driver && isFlagged(props.driver));
const statusLook = computed(() => getStatusConfig(props.driver?.status).look);

// Neighbours in the same company, in board order
const siblings = computed(() => props.drivers.filter(d => d.companyId === props.driver?.companyId));
const index = computed(() => siblings.value.findIndex(d => d.id === props.driver?.id));
const prev = computed(() => (index.value > 0 ? siblings.value[index.value - 1] : null));
const next = computed(() => (index.value >= 0 && index.value < siblings.value.length - 1 ? siblings.value[index.value + 1] : null));

const companyStats = computed(() => {
  const list = siblings.value.filter(d => d.status !== 'INACTIVE');
  const overdue = list.filter(d => getFreshnessInfo(d.lastCheckedAt).level === 'overdue').length;
  return `${list.length} ${list.length === 1 ? 'driver' : 'drivers'}${overdue ? `, ${overdue} overdue` : ''}`;
});

// ---------------- edits (the same changes the board row makes) ----------------
function update(changes) {
  if (!props.driver) return;
  emit('update-driver', { ...props.driver, ...changes });
}

function markChecked() {
  update({ lastCheckedAt: new Date().toISOString() });
}

function toggleFlag() {
  update({ highlightColor: flagged.value ? '' : FLAG_COLOR });
}

const notesDraft = ref(props.driver?.notes || '');
watch(() => [props.driver?.id, props.driver?.notes], () => { notesDraft.value = props.driver?.notes || ''; });

function saveNotes() {
  if (props.driver && notesDraft.value !== (props.driver.notes || '')) update({ notes: notesDraft.value });
}

const menuItems = computed(() => [
  { id: 'edit', label: 'Edit driver', hint: 'E' },
  { id: 'flag', label: flagged.value ? 'Remove flag' : 'Flag driver' },
  { id: 'inactive', label: props.driver?.status === 'INACTIVE' ? 'Make active (Ready)' : 'Make inactive' },
  ...(props.canManageFleet ? [{ id: 'div', divider: true }, { id: 'delete', label: 'Delete driver…', danger: true }] : [])
]);

function onMenu(id) {
  if (!props.driver) return;
  if (id === 'edit') emit('edit-driver', props.driver);
  else if (id === 'flag') toggleFlag();
  else if (id === 'inactive') update({ status: props.driver.status === 'INACTIVE' ? 'READY' : 'INACTIVE', lastCheckedAt: new Date().toISOString() });
  else if (id === 'delete') emit('delete-driver', props.driver.id);
}

// ---------------- history ----------------
const period = ref(7);
const records = ref([]);
const isLoading = ref(false);
const errorMessage = ref('');
const periodLabel = computed(() => PERIODS.find(p => p.days === period.value)?.label.toLowerCase().replace(/^(\d)/, 'last $1') || '');
let seq = 0;

async function load() {
  if (!props.driver) return;
  const mine = ++seq;
  isLoading.value = true;
  errorMessage.value = '';
  try {
    const today = currentWorkDay();
    const list = await fetchActivities({ fromDate: addDays(today, 1 - period.value), toDate: today, driverId: props.driver.id });
    if (mine === seq) records.value = list;
  } catch (err) {
    if (mine === seq) {
      records.value = [];
      errorMessage.value = err.message || '';
    }
  } finally {
    if (mine === seq) isLoading.value = false;
  }
}

watch(() => [props.driver?.id, period.value, props.refreshKey], load);

// ---------------- keyboard ----------------
function onKey(e) {
  if (!props.keyboardEnabled || e.ctrlKey || e.metaKey || e.altKey) return;
  const tag = (e.target.tagName || '').toLowerCase();
  if (tag === 'input' || tag === 'textarea' || tag === 'select') return;
  if (e.key === 'Escape') {
    emit('back');
    return;
  }
  if (!props.driver) return;
  const key = e.key.toLowerCase();
  if (key === 'c') markChecked();
  else if (key === 'e') emit('edit-driver', props.driver);
  else if (key === 'j' && next.value) emit('open-driver', next.value.id);
  else if (key === 'k' && prev.value) emit('open-driver', prev.value.id);
}

onMounted(() => {
  load();
  window.addEventListener('keydown', onKey);
});
onUnmounted(() => window.removeEventListener('keydown', onKey));
</script>

<style scoped>
.unit-badge {
  font-family: var(--font-heading); font-weight: 600; font-size: 22px; line-height: 1.3; padding: 2px 10px; flex-shrink: 0;
  color: var(--color-accent-800); background: var(--color-accent-100); border: 1px solid var(--color-accent-200);
}
.title-block { display: flex; flex-direction: column; gap: 1px; min-width: 0; }
.key-on-primary { color: var(--color-bg); border-color: var(--color-accent-300); font-family: var(--font-body); font-size: 11px; }

.split { display: flex; flex-wrap: wrap; gap: 14px; align-items: flex-start; }
.now { flex: 1 1 340px; max-width: 440px; padding: 16px; display: flex; flex-direction: column; gap: 16px; }
.history { flex: 999 1 520px; min-width: 0; display: flex; flex-direction: column; }

.field-label { font-size: 12px; color: var(--color-neutral-700); }
.last-check { display: flex; flex-direction: column; gap: 6px; }
.age-line { display: flex; align-items: baseline; gap: 10px; flex-wrap: wrap; }
.age-big { font-family: var(--font-heading); font-weight: 600; font-size: 36px; line-height: 1; }
.age-big.is-overdue { color: var(--color-signal); }
.fresh-tag {
  display: inline-flex; align-items: center; gap: 5px; padding: 2px 8px; font-size: 12px; font-weight: 500;
  border: 1px solid var(--color-accent-400); color: var(--color-accent-800);
}
.fresh-tag.is-warning { border-color: var(--color-accent-800); }
.fresh-tag.is-overdue { border-color: var(--color-signal); color: var(--color-signal); }
.age-bar { display: block; height: 4px; background: var(--color-neutral-200); }
.age-bar > span { display: block; height: 100%; }
.small { font-size: 12px; }

.two { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1.8fr); gap: 10px; }
.field { gap: 4px; }
.field > label { font-size: 12px; color: var(--color-neutral-700); }
.sign-on { color: var(--color-accent-800); border-color: var(--color-accent-400); font-weight: 600; }
.sign-off { color: var(--color-signal); border: 1px dashed var(--color-signal); font-weight: 600; }
.status-select { font-weight: 600; }
.flag-line { display: flex; align-items: center; gap: 8px; font-size: 14px; cursor: pointer; }
.flag-line input { width: 16px; height: 16px; accent-color: var(--color-accent); }
.related { display: flex; flex-direction: column; align-items: flex-start; gap: 6px; padding-top: 12px; border-top: 1px solid var(--color-hairline); font-size: 13px; }

.history-head { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; padding: 12px 16px; border-bottom: 1px solid var(--color-divider); }
.history-error { margin: 12px 16px 0; }
.history-scroll { overflow-x: auto; }
.hist-row {
  display: grid; grid-template-columns: 190px 100px minmax(130px, 1fr) 120px minmax(140px, 1.4fr);
  align-items: center; min-height: 44px; min-width: 640px; font-size: 13px; border-bottom: 1px solid var(--color-hairline);
}
.hist-row > div { padding: 0 10px; min-width: 0; }
.hist-row > div:first-child { padding-left: 16px; }
.hist-head { min-height: 0; font-size: 11px; letter-spacing: 0.08em; text-transform: uppercase; color: var(--color-neutral-700); border-bottom-color: var(--color-divider); }
.hist-head > div { padding-top: 10px; padding-bottom: 10px; }
.strong { font-weight: 600; }
.action-tag { display: inline-block; padding: 2px 8px; font-size: 12px; white-space: nowrap; }
.history-foot { padding: 10px 16px; display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
.dot { color: var(--color-neutral-500); }
.foot-keys { display: flex; gap: 6px 16px; flex-wrap: wrap; font-size: 12px; }
.foot-keys .cb-key { font-family: var(--font-body); font-size: 11px; }

@media (max-width: 600px) {
  .two { grid-template-columns: 1fr; }
}
</style>
