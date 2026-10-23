<template>
  <div
    :class="['group', { 'is-dragging': isDragging }]"
    :style="dropStyle"
    @click="$emit('toggle-collapse')"
    @mouseenter="hover = true"
    @mouseleave="hover = false"
    @dragover.prevent="$emit('company-drag-over', { event: $event, company })"
    @drop.prevent="$emit('company-drop', { event: $event, company })"
  >
    <!-- Chevron cell doubles as the company drag handle -->
    <div
      class="chev-cell"
      draggable="true"
      :title="`Drag to reorder company #${companyIndex}`"
      @dragstart="onDragStart"
      @dragend="$emit('company-drag-end')"
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" :class="['chev', { 'is-open': !isCollapsed }]"><path d="m9 18 6-6-6-6" /></svg>
    </div>

    <!-- Each summary sits under the column it describes -->
    <div class="cell head">
      <span class="name" :title="company.name">{{ company.name }}</span>
      <span v-if="company.note" class="tag tag-outline">{{ company.note }}</span>
    </div>
    <div class="cell stat" title="Drivers without a sign">
      <span v-if="unsignedCount" class="unsigned">{{ unsignedCount }} no sign</span>
      <span v-else-if="drivers.length" class="muted-text">All signed</span>
    </div>
    <div class="cell stat">
      <span class="count">{{ drivers.length }} {{ drivers.length === 1 ? 'driver' : 'drivers' }}</span>
    </div>
    <div class="cell stat fresh-cell">
      <span v-if="drivers.length" class="fresh" title="Check freshness">
        <span v-for="seg in freshSegs" :key="seg.level" :style="{ width: `${seg.pct}%`, background: seg.color }"></span>
      </span>
      <span v-if="overdueCount" class="overdue">{{ overdueCount }} overdue</span>
    </div>
    <div class="cell actions-cell">
      <div v-if="showActions && hover" class="actions" @click.stop>
        <button v-if="canManageFleet" class="btn btn-ghost add" @click="$emit('add-driver', company)">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M5 12h14" /><path d="M12 5v14" /></svg>Driver
        </button>
        <button class="btn btn-ghost btn-icon muted" title="Edit company" @click="$emit('edit-company', company)">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z" /><path d="m15 5 4 4" /></svg>
        </button>
        <button v-if="canManageFleet" class="btn btn-ghost btn-icon muted" title="Delete company" @click="$emit('delete-company', company.id)">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18" /><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" /><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" /></svg>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue';
import { getFreshnessInfo, freshnessColor, FRESHNESS_LEVELS } from '../utils/freshness';

const props = defineProps({
  company: { type: Object, required: true },
  companyIndex: { type: Number, required: true },
  // Drivers of this company shown in the current tab
  drivers: { type: Array, default: () => [] },
  isCollapsed: { type: Boolean, default: true },
  showActions: { type: Boolean, default: true },
  // Adding drivers and deleting companies is manager-only
  canManageFleet: { type: Boolean, default: false },
  isDragging: { type: Boolean, default: false },
  dropPosition: { type: String, default: '' }
});

const emit = defineEmits([
  'add-driver', 'edit-company', 'delete-company', 'toggle-collapse',
  'company-drag-start', 'company-drag-end', 'company-drag-over', 'company-drop'
]);

const hover = ref(false);

const levels = computed(() => props.drivers.map(d => getFreshnessInfo(d.lastCheckedAt).level));
const unsignedCount = computed(() => props.drivers.filter(d => d.sign !== 'SIGNED').length);
const overdueCount = computed(() => levels.value.filter(l => l === 'overdue').length);
const freshSegs = computed(() => FRESHNESS_LEVELS.map(level => ({
  level,
  color: freshnessColor(level),
  pct: (levels.value.filter(l => l === level).length / levels.value.length) * 100
})));

const dropStyle = computed(() => {
  if (props.dropPosition === 'before') return { boxShadow: 'inset 0 2px 0 var(--color-accent)' };
  if (props.dropPosition === 'after') return { boxShadow: 'inset 0 -2px 0 var(--color-accent)' };
  return null;
});

function onDragStart(e) {
  emit('company-drag-start', props.company.id);
  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData('text/plain', `company:${props.company.id}`);
}
</script>

<style scoped>
.group {
  display: grid; grid-template-columns: var(--board-cols); align-items: center; min-height: 42px;
  background: var(--color-neutral-200); border-bottom: 1px solid var(--color-divider);
  cursor: pointer; position: sticky; top: 35px; z-index: 4; user-select: none;
}
.group.is-dragging { opacity: 0.35; }
.chev-cell { height: 100%; display: grid; place-items: center; cursor: grab; }
.chev { color: var(--color-neutral-700); transition: transform 120ms; }
.chev.is-open { transform: rotate(90deg); }
.cell { min-width: 0; display: flex; align-items: center; gap: 8px; padding: 0 10px; }
.head { padding-left: 12px; }
.stat { font-size: 12px; white-space: nowrap; overflow: hidden; }
.unsigned { color: var(--color-signal); }
.muted-text { color: var(--color-neutral-600); }
.fresh-cell { flex-direction: column; align-items: flex-start; gap: 4px; }
.actions-cell { justify-content: flex-end; }
.name { font-family: var(--font-heading); font-weight: 600; font-size: 16px; letter-spacing: 0.04em; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.count { font-size: 12px; color: var(--color-neutral-700); white-space: nowrap; }
.fresh { display: flex; width: 72px; height: 4px; gap: 1px; flex-shrink: 0; }
.fresh > span { display: block; height: 100%; }
.overdue { font-size: 12px; color: var(--color-signal); white-space: nowrap; }
.actions { display: flex; gap: 2px; }
.add { font-size: 13px; gap: 4px; padding: 3px 8px; }
.muted { color: var(--color-neutral-700); }
</style>
