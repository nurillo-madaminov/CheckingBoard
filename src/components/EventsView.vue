<template>
  <div class="cb-page cb-scroll events">
    <!-- Header: title + the one primary action -->
    <div class="cb-page-head">
      <div class="title-block">
        <h2 class="cb-title">Events</h2>
        <span class="cb-sub">Inspections and accidents · {{ events.length }} logged{{ pinnedCount ? ` · ${pinnedCount} pinned` : '' }}</span>
      </div>
      <div class="cb-spacer"></div>
      <button type="button" class="btn btn-primary" @click="openNew">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" aria-hidden="true"><path d="M5 12h14" /><path d="M12 5v14" /></svg>
        Log event
      </button>
    </div>

    <!-- Filters, right above the table -->
    <div class="filters">
      <div class="seg" role="group" aria-label="Type">
        <button v-for="o in KIND_FILTERS" :key="o.code" type="button" :class="['seg-btn', { 'is-on': kindFilter === o.code }]" :aria-pressed="kindFilter === o.code ? 'true' : 'false'" @click="kindFilter = o.code">
          {{ o.label }} <span class="seg-count">{{ countKind(o.code) }}</span>
        </button>
      </div>
      <div class="seg" role="group" aria-label="Result">
        <button v-for="o in OUTCOME_FILTERS" :key="o.code" type="button" :class="['seg-btn', { 'is-on': outcomeFilter === o.code }]" :aria-pressed="outcomeFilter === o.code ? 'true' : 'false'" @click="outcomeFilter = o.code">
          {{ o.label }}
        </button>
      </div>
      <div class="search">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="search-icon" aria-hidden="true"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></svg>
        <input v-model="search" class="input search-input" placeholder="Search driver, company or notes" aria-label="Search driver, company or notes" />
      </div>
      <span class="cb-spacer"></span>
      <span class="cb-sub">{{ rows.length }} of {{ events.length }} shown</span>
    </div>

    <div v-if="errorMessage" class="cb-error">
      {{ errorMessage }}
      <button type="button" class="cb-link" @click="load">Try again</button>
    </div>

    <div class="cb-panel table">
      <div class="table-scroll">
        <div class="row head">
          <div class="c-pin" aria-label="Pinned"></div>
          <div>Date · TAS / ET</div><div>Type</div><div>Driver</div><div>Result</div><div>Level</div><div>Notes</div><div>Logged by</div><div></div>
        </div>
        <div v-if="isLoading && !events.length" class="cb-empty-state">Loading events…</div>
        <template v-else>
          <div v-for="e in rows" :key="e.id" :class="['row', { 'is-pinned': e.pinned }]">
            <div class="c-pin">
              <button
                type="button"
                :class="['pin-btn', { 'is-on': e.pinned }]"
                :aria-pressed="e.pinned ? 'true' : 'false'"
                :title="e.pinned ? 'Unpin' : 'Pin to the top'"
                :aria-label="`${e.pinned ? 'Unpin' : 'Pin'} ${e.driver_name_snapshot} ${eventKindLabel(e.kind)}`"
                @click="togglePin(e)"
              >
                <svg width="15" height="15" viewBox="0 0 24 24" :fill="e.pinned ? 'currentColor' : 'none'" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 17v5" /><path d="M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V7a1 1 0 0 1 1-1 2 2 0 0 0 0-4H8a2 2 0 0 0 0 4 1 1 0 0 1 1 1z" /></svg>
              </button>
            </div>
            <div class="c-date">
              <span class="strong">{{ formatTashkentDateTime(e.occurred_at) }}</span>
              <span class="cb-muted small">{{ formatEasternDateTime(e.occurred_at) }} ET</span>
            </div>
            <div><span :class="['kind-tag', `is-${e.kind.toLowerCase()}`]">{{ eventKindLabel(e.kind) }}</span></div>
            <div class="c-driver">
              <span class="strong cb-ellipsis">{{ e.driver_name_snapshot || '—' }}</span>
              <span class="cb-muted small cb-ellipsis">{{ e.company_name_snapshot }}<template v-if="!e.driver_id"> · driver deleted</template></span>
            </div>
            <div>
              <span :class="['outcome-tag', e.outcome === 'VIOLATION' ? 'is-violation' : 'is-clean']">
                <svg v-if="e.outcome === 'VIOLATION'" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 9v4" /><path d="M12 17h.01" /><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /></svg>
                <svg v-else width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5" /></svg>
                {{ eventOutcomeLabel(e.outcome) }}
              </span>
            </div>
            <div class="c-level">Level {{ e.level }}</div>
            <div class="c-notes" :title="e.notes">{{ e.notes || '—' }}</div>
            <div class="cb-muted cb-ellipsis">{{ e.created_by_name || '—' }}</div>
            <div class="c-menu">
              <MoreMenu compact vertical :items="rowMenu" :label="`Actions for this ${eventKindLabel(e.kind).toLowerCase()}`" @select="onRowMenu(e, $event)" />
            </div>
          </div>
          <div v-if="!rows.length && !errorMessage" class="cb-empty-state">
            <strong>{{ events.length ? 'No events match these filters.' : 'No events yet.' }}</strong>
            <span>{{ events.length ? 'Change the filters above.' : 'When an inspection or accident happens, log it with the button at the top right.' }}</span>
          </div>
        </template>
      </div>
    </div>

    <EventDialog
      v-if="dialogOpen"
      :companies="companies"
      :drivers="drivers"
      :editing="editing"
      @close="closeDialog"
      @saved="onSaved"
    />
    <ConfirmDialog
      v-if="deleteTarget"
      :title="`Delete this ${eventKindLabel(deleteTarget.kind).toLowerCase()}?`"
      :body="`${deleteTarget.driver_name_snapshot} · ${formatTashkentDateTime(deleteTarget.occurred_at)}. This cannot be undone.`"
      okLabel="Delete event"
      @confirm="confirmDelete"
      @cancel="deleteTarget = null"
    />
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import MoreMenu from './MoreMenu.vue';
import EventDialog from './EventDialog.vue';
import ConfirmDialog from './ConfirmDialog.vue';
import {
  fetchEvents, setEventPinned, deleteEvent, eventKindLabel, eventOutcomeLabel
} from '../services/eventService';
import { formatTashkentDateTime, formatEasternDateTime } from '../config/shifts';

const props = defineProps({
  companies: { type: Array, required: true },
  drivers: { type: Array, required: true },
  isManager: { type: Boolean, default: false }
});
const emit = defineEmits(['saved', 'error']);

const KIND_FILTERS = [
  { code: '', label: 'All' },
  { code: 'INSPECTION', label: 'Inspections' },
  { code: 'ACCIDENT', label: 'Accidents' }
];
const OUTCOME_FILTERS = [
  { code: '', label: 'Any result' },
  { code: 'VIOLATION', label: 'Violation' },
  { code: 'NO_VIOLATION', label: 'No violation' }
];

const events = ref([]);
const isLoading = ref(false);
const errorMessage = ref('');
const kindFilter = ref('');
const outcomeFilter = ref('');
const search = ref('');
const dialogOpen = ref(false);
const editing = ref(null);
const deleteTarget = ref(null);

const pinnedCount = computed(() => events.value.filter(e => e.pinned).length);

function countKind(code) {
  return code ? events.value.filter(e => e.kind === code).length : events.value.length;
}

// Pinned rows first, then newest first
const rows = computed(() => {
  const q = search.value.trim().toLowerCase();
  return events.value
    .filter(e => !kindFilter.value || e.kind === kindFilter.value)
    .filter(e => !outcomeFilter.value || e.outcome === outcomeFilter.value)
    .filter(e => !q || `${e.driver_name_snapshot} ${e.company_name_snapshot} ${e.notes}`.toLowerCase().includes(q))
    .sort((a, b) => (Number(b.pinned) - Number(a.pinned)) || (Date.parse(b.occurred_at) - Date.parse(a.occurred_at)));
});

async function load() {
  isLoading.value = true;
  errorMessage.value = '';
  try {
    events.value = await fetchEvents();
  } catch (err) {
    errorMessage.value = err.message;
  } finally {
    isLoading.value = false;
  }
}

async function togglePin(e) {
  const next = !e.pinned;
  events.value = events.value.map(x => (x.id === e.id ? { ...x, pinned: next } : x));
  try {
    await setEventPinned(e.id, next);
  } catch (err) {
    events.value = events.value.map(x => (x.id === e.id ? { ...x, pinned: !next } : x));
    emit('error', { title: next ? 'Not pinned' : 'Not unpinned', message: err.message });
  }
}

const rowMenu = computed(() => [
  { id: 'edit', label: 'Edit event' },
  ...(props.isManager ? [{ id: 'div', divider: true }, { id: 'delete', label: 'Delete event…', danger: true }] : [])
]);

function onRowMenu(e, id) {
  if (id === 'edit') {
    editing.value = e;
    setDialog(true);
  } else if (id === 'delete') {
    deleteTarget.value = e;
  }
}

function openNew() {
  if (!props.drivers.length) {
    emit('error', { title: 'No drivers yet', message: 'Add drivers on the Fleet page first.' });
    return;
  }
  editing.value = null;
  setDialog(true);
}

function setDialog(open) {
  dialogOpen.value = open;
}

function closeDialog() {
  setDialog(false);
  editing.value = null;
}

function onSaved(row) {
  const wasEditing = !!editing.value;
  events.value = wasEditing ? events.value.map(x => (x.id === row.id ? row : x)) : [row, ...events.value];
  closeDialog();
  emit('saved', { title: wasEditing ? 'Event saved' : 'Event logged', message: `${eventKindLabel(row.kind)} · ${row.driver_name_snapshot}` });
}

async function confirmDelete() {
  const e = deleteTarget.value;
  deleteTarget.value = null;
  try {
    await deleteEvent(e.id);
    events.value = events.value.filter(x => x.id !== e.id);
    emit('saved', { title: 'Event deleted', message: `${eventKindLabel(e.kind)} · ${e.driver_name_snapshot}` });
  } catch (err) {
    emit('error', { title: 'Event not deleted', message: err.message });
  }
}

onMounted(load);
</script>

<style scoped>
.title-block { display: flex; flex-direction: column; gap: 1px; min-width: 0; }
.filters { display: flex; align-items: center; gap: 8px 12px; flex-wrap: wrap; }
.seg-count { font-size: 11px; opacity: 0.75; margin-left: 2px; }
.search { position: relative; width: 260px; min-width: 160px; }
.search-icon { position: absolute; left: 10px; top: 50%; transform: translateY(-50%); color: var(--color-neutral-600); }
.search-input { padding-left: 32px; min-height: 34px; font-size: 13px; background: var(--color-neutral-100); }

.table { display: flex; flex-direction: column; }
.table-scroll { overflow-x: auto; }
.row {
  display: grid; align-items: center; min-height: 52px; min-width: 1080px; font-size: 14px;
  grid-template-columns: 44px 170px 110px minmax(170px, 1.2fr) 140px 76px minmax(200px, 2fr) 140px 48px;
  border-bottom: 1px solid var(--color-hairline);
}
.row > * { padding: 0 10px; min-width: 0; }
.row:hover:not(.head) { background: var(--color-bg); }
.row.is-pinned { background: var(--color-accent-100); box-shadow: inset 3px 0 0 var(--color-accent); }
.head { min-height: 0; font-size: 11px; letter-spacing: 0.08em; text-transform: uppercase; color: var(--color-neutral-700); border-bottom-color: var(--color-divider); }
.head > * { padding-top: 10px; padding-bottom: 10px; }
.c-pin { display: grid; place-items: center; padding: 0; }
.pin-btn {
  width: 30px; height: 30px; display: grid; place-items: center; cursor: pointer;
  border: 1px solid transparent; background: transparent; color: var(--color-neutral-500);
}
.pin-btn:hover { color: var(--color-accent-700); border-color: var(--color-divider); }
.pin-btn.is-on { color: var(--color-accent-700); }
.c-date, .c-driver { display: flex; flex-direction: column; gap: 1px; }
.strong { font-weight: 500; }
.small { font-size: 12px; }
.kind-tag {
  display: inline-block; padding: 3px 8px; font-family: var(--font-heading); font-weight: 600; font-size: 12px; letter-spacing: 0.06em; text-transform: uppercase;
  border: 1px solid var(--color-accent-400); color: var(--color-accent-800);
}
.kind-tag.is-accident { background: var(--color-accent-800); border-color: var(--color-accent-800); color: var(--color-bg); }
.outcome-tag { display: inline-flex; align-items: center; gap: 5px; padding: 3px 8px; font-size: 12px; font-weight: 600; white-space: nowrap; }
.outcome-tag.is-violation { color: var(--color-signal); border: 1px solid var(--color-signal); }
.outcome-tag.is-clean { color: var(--color-accent-800); border: 1px solid var(--color-accent-400); }
.c-level { font-family: var(--font-heading); font-size: 15px; white-space: nowrap; }
.c-notes { font-size: 13px; color: var(--color-neutral-800); display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.c-menu { display: grid; place-items: center; padding: 0; }
</style>
