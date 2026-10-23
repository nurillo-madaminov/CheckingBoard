<template>
  <div
    ref="rowRef"
    :data-driver-id="driver.id"
    :class="['row', { 'is-selected': isActive, 'is-flagged': flagged, 'is-overdue': fresh.level === 'overdue', 'is-dragging': isDragging, 'menu-open': showActionMenu }]"
    :style="rowStyle"
    @click="$emit('select-row', driver.id)"
    @mouseenter="hover = true"
    @mouseleave="hover = false"
    @dragover.prevent="$emit('row-dragover', { event: $event, driver })"
    @drop.prevent="$emit('row-drop', { event: $event, driver })"
  >
    <!-- # : the only drag handle -->
    <div
      class="num"
      draggable="true"
      title="Drag to reorder"
      @dragstart="onDragStart"
      @dragend="$emit('drag-end')"
    >
      <svg class="grip" width="10" height="14" viewBox="0 0 10 24" fill="currentColor"><circle cx="2" cy="6" r="1.4" /><circle cx="8" cy="6" r="1.4" /><circle cx="2" cy="12" r="1.4" /><circle cx="8" cy="12" r="1.4" /><circle cx="2" cy="18" r="1.4" /><circle cx="8" cy="18" r="1.4" /></svg>
      <span>{{ orderIndex }}</span>
    </div>

    <!-- Driver -->
    <div class="driver">
      <span v-if="driver.unit" class="unit">{{ driver.unit }}</span>
      <span class="name" :title="driver.name">{{ driver.name }}</span>
      <svg v-if="flagged" class="flag" width="13" height="13" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" /><line x1="4" x2="4" y1="22" y2="15" /></svg>
      <span class="cb-spacer"></span>

      <div v-if="hover || showActionMenu" class="row-actions" @click.stop>
        <button class="btn btn-ghost btn-icon" title="Mark checked (C)" @click="markAsChecked">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
        </button>
        <button class="btn btn-ghost btn-icon" title="Log activity (1–5)" @click="toggleActionMenu">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z" /></svg>
        </button>
        <button class="btn btn-ghost btn-icon" :title="flagged ? 'Remove flag' : 'Flag row'" @click="toggleFlag">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" /><line x1="4" x2="4" y1="22" y2="15" /></svg>
        </button>
        <button class="btn btn-ghost btn-icon" title="Edit driver (E)" @click="$emit('edit', driver)">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z" /><path d="m15 5 4 4" /></svg>
        </button>
        <button v-if="canDelete" class="btn btn-ghost btn-icon btn-danger" title="Delete driver" @click="$emit('delete', driver.id)">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18" /><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" /><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" /></svg>
        </button>
      </div>

      <!-- Log activity menu -->
      <div v-if="showActionMenu" class="menu" @click.stop>
        <div class="menu-head">Log activity</div>
        <button v-for="act in ACTION_TYPES" :key="act.code" class="menu-item" @click="triggerAction(act.code)">
          <span>{{ act.label }}</span><span class="cb-key">{{ act.key }}</span>
        </button>
      </div>
    </div>

    <!-- Sign -->
    <div class="cell" @click.stop>
      <select
        :value="driver.sign"
        :class="['pick', driver.sign === 'SIGNED' ? 'sign-on' : 'sign-off']"
        @focus="onSelectLine"
        @change="onSignChange($event.target.value)"
      >
        <option v-for="s in SIGN_STATUSES" :key="s.code" :value="s.code">{{ s.label }}</option>
      </select>
    </div>

    <!-- Status -->
    <div class="cell" @click.stop>
      <select
        :value="driver.status"
        :class="['pick', { 'pick-dark': isDarkStatus }]"
        :style="statusConfig.look"
        :title="`${driver.status} – ${statusConfig.label}`"
        @focus="onSelectLine"
        @change="onStatusChange($event.target.value)"
      >
        <option v-for="st in DRIVER_STATUSES" :key="st.code" :value="st.code">{{ st.code }} – {{ st.label }}</option>
      </select>
    </div>

    <!-- Last check -->
    <div class="age" :title="fresh.long">
      <span :class="['age-text', { 'is-overdue': fresh.level === 'overdue' }]">{{ fresh.short }}</span>
      <span class="age-bar"><span :style="{ width: `${fresh.pct}%`, background: freshnessColor(fresh.level) }"></span></span>
    </div>

    <!-- Notes -->
    <div class="notes" @click.stop>
      <input
        v-model="localNotes"
        class="note-input"
        placeholder="Add note"
        @focus="onSelectLine"
        @blur="saveNotes"
        @keyup.enter="$event.target.blur()"
      />
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue';
import { DRIVER_STATUSES, SIGN_STATUSES, getStatusConfig, FLAG_COLOR, isFlagged } from '../config/statusConfig';
import { ACTION_TYPES } from '../services/activityService';
import { getFreshnessInfo, freshnessColor } from '../utils/freshness';

const props = defineProps({
  driver: { type: Object, required: true },
  orderIndex: { type: Number, required: true },
  isActive: { type: Boolean, default: false },
  isDragging: { type: Boolean, default: false },
  // 'before' | 'after' while another row is dragged over this one
  dropPosition: { type: String, default: '' },
  canDelete: { type: Boolean, default: false }
});

const emit = defineEmits(['update', 'delete', 'edit', 'select-row', 'drag-start', 'drag-end', 'row-dragover', 'row-drop', 'log-action']);

const rowRef = ref(null);
const hover = ref(false);
const localNotes = ref(props.driver.notes || '');
const showActionMenu = ref(false);

watch(() => props.driver.notes, (val) => {
  localNotes.value = val || '';
});

const statusConfig = computed(() => getStatusConfig(props.driver.status));
const isDarkStatus = computed(() => ['AT PU', 'AT DEL'].includes(props.driver.status));
const fresh = computed(() => getFreshnessInfo(props.driver.lastCheckedAt));
const flagged = computed(() => isFlagged(props.driver));

const rowStyle = computed(() => {
  if (props.dropPosition === 'before') return { boxShadow: 'inset 0 2px 0 var(--color-accent)' };
  if (props.dropPosition === 'after') return { boxShadow: 'inset 0 -2px 0 var(--color-accent)' };
  return null;
});

function onSelectLine() {
  emit('select-row', props.driver.id);
}

function markAsChecked() {
  onSelectLine();
  emit('update', { ...props.driver, lastCheckedAt: new Date().toISOString() });
}

function toggleFlag() {
  emit('update', { ...props.driver, highlightColor: flagged.value ? '' : FLAG_COLOR });
}

function onSignChange(sign) {
  onSelectLine();
  emit('update', { ...props.driver, sign, lastCheckedAt: new Date().toISOString() });
}

function onStatusChange(status) {
  onSelectLine();
  emit('update', { ...props.driver, status, lastCheckedAt: new Date().toISOString() });
}

function saveNotes() {
  if (localNotes.value !== (props.driver.notes || '')) {
    emit('update', { ...props.driver, notes: localNotes.value });
  }
}

function toggleActionMenu() {
  onSelectLine();
  showActionMenu.value = !showActionMenu.value;
}

function triggerAction(actionType) {
  showActionMenu.value = false;
  onSelectLine();
  emit('log-action', { actionType, driver: props.driver });
}

function onDragStart(e) {
  emit('drag-start', props.driver.id);
  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData('text/plain', `driver:${props.driver.id}`);
}

// Close the menu on an outside click or Esc
function handleDocumentClick(e) {
  if (showActionMenu.value && rowRef.value && !rowRef.value.contains(e.target)) {
    showActionMenu.value = false;
  }
}
function handleKeydown(e) {
  if (e.key === 'Escape') showActionMenu.value = false;
}

onMounted(() => {
  document.addEventListener('click', handleDocumentClick);
  window.addEventListener('keydown', handleKeydown);
});
onUnmounted(() => {
  document.removeEventListener('click', handleDocumentClick);
  window.removeEventListener('keydown', handleKeydown);
});
</script>

<style scoped>
.row {
  display: grid; grid-template-columns: var(--board-cols); align-items: center; min-height: 46px;
  border-bottom: 1px solid var(--color-hairline); position: relative; cursor: default; user-select: none;
}
.row:hover { background: color-mix(in srgb, var(--color-text) 4%, transparent); }
.row.is-overdue { background: color-mix(in srgb, var(--color-signal) 6%, transparent); }
.row.is-flagged { background: color-mix(in srgb, var(--color-accent) 9%, transparent); }
.row.is-selected { background: var(--color-accent-100); box-shadow: inset 0 0 0 1px var(--color-accent); }
.row.is-dragging { opacity: 0.35; }
.row.menu-open { z-index: 20; }

.num {
  height: 100%; display: flex; align-items: center; justify-content: center; gap: 5px;
  font-family: var(--font-heading); font-size: 13px; color: var(--color-neutral-600);
  border-right: 1px solid var(--color-divider); cursor: grab;
}
.num:active { cursor: grabbing; }
.row.is-overdue .num { box-shadow: inset 3px 0 0 var(--color-signal); }
.grip { opacity: 0; flex-shrink: 0; }
.row:hover .grip { opacity: 0.8; }

.driver { display: flex; align-items: center; gap: 10px; padding: 0 8px 0 12px; min-width: 0; position: relative; }
.unit {
  font-family: var(--font-heading); font-weight: 600; font-size: 14px; line-height: 1.4;
  color: var(--color-accent-800); background: var(--color-accent-100); border: 1px solid var(--color-accent-200);
  padding: 1px 6px; min-width: 40px; text-align: center; flex-shrink: 0;
}
.name { font-size: 14px; font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; user-select: text; }
.flag { color: var(--color-accent-700); flex-shrink: 0; }
.row-actions { display: flex; gap: 1px; flex-shrink: 0; }
.row-actions .btn-icon { width: 26px; height: 26px; }

.menu {
  position: absolute; right: 8px; top: 38px; z-index: 30; width: 210px; padding: 6px 0;
  background: var(--color-neutral-100); border: 1px solid var(--color-divider); box-shadow: var(--shadow-lg);
}
.menu-head { padding: 4px 12px 6px; font-size: 10px; letter-spacing: 0.1em; text-transform: uppercase; color: var(--color-neutral-600); }
.menu-item {
  display: flex; width: 100%; align-items: center; justify-content: space-between; padding: 7px 12px;
  border: 0; background: transparent; font: inherit; font-size: 13px; color: var(--color-text); cursor: pointer; text-align: left;
}
.menu-item:hover { background: var(--color-accent-100); }

.cell { padding: 0 10px; min-width: 0; }
.pick {
  appearance: none; -webkit-appearance: none; display: block; width: 100%; min-width: 0;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap; border-radius: 0;
  padding: 5px 24px 5px 8px; cursor: pointer; outline: none;
  font-family: var(--font-heading); font-weight: 600; font-size: 13px; letter-spacing: 0.06em;
  background-repeat: no-repeat; background-position: right 8px center;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 24 24' fill='none' stroke='%232c455d' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E");
}
.pick:focus-visible { outline: 2px solid var(--color-accent); outline-offset: 1px; }
.pick-dark {
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 24 24' fill='none' stroke='%23f2f2f3' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E");
}
.sign-on { background-color: transparent; color: var(--color-accent-800); border: 1px solid var(--color-accent-400); }
.sign-off {
  background-color: transparent; color: var(--color-signal); border: 1px dashed var(--color-signal);
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 24 24' fill='none' stroke='%23a3412f' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E");
}

.age { padding: 0 10px; display: flex; flex-direction: column; gap: 5px; }
.age-text { font-family: var(--font-heading); font-size: 14px; line-height: 1; }
.age-text.is-overdue { color: var(--color-signal); }
.age-bar { display: block; height: 3px; width: 64px; max-width: 100%; background: var(--color-neutral-200); }
.age-bar > span { display: block; height: 100%; }

.notes { padding: 0 12px 0 8px; min-width: 0; }
.note-input {
  width: 100%; border: 1px solid transparent; background: transparent; font: inherit; font-size: 13px;
  color: var(--color-text); padding: 5px 7px;
}
.note-input:hover { border-color: var(--color-divider); }
.note-input:focus { border-color: var(--color-accent); background: var(--color-bg); outline: none; }
</style>
