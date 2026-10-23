<template>
  <div ref="rootRef" class="picker">
    <button :class="['trigger', { 'is-open': open }]" @click="toggle">
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="4" rx="1" /><path d="M16 2v4" /><path d="M8 2v4" /><path d="M3 10h18" /></svg>
      <span class="trigger-label">{{ label }}</span>
      <span class="trigger-days">{{ dayCount }} {{ dayCount === 1 ? 'day' : 'days' }}</span>
    </button>

    <div v-if="open" class="pop" role="dialog" aria-label="Choose a date range">
      <div class="month-head">
        <button class="btn btn-ghost btn-icon nav" title="Previous month" @click="moveMonth(-1)">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6" /></svg>
        </button>
        <span class="month-name">{{ monthName }}</span>
        <button class="btn btn-ghost btn-icon nav" title="Next month" :disabled="!canGoNext" @click="moveMonth(1)">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6" /></svg>
        </button>
      </div>

      <div class="grid weekdays">
        <span v-for="d in WEEKDAYS" :key="d">{{ d }}</span>
      </div>
      <div class="grid days" @mouseleave="hoverDay = ''">
        <button
          v-for="cell in cells"
          :key="cell.date"
          :class="['day', {
            'is-outside': !cell.inMonth,
            'is-today': cell.date === max,
            'is-edge': cell.isEdge,
            'is-between': cell.isBetween
          }]"
          :disabled="cell.disabled"
          @click="pick(cell.date)"
          @mouseenter="hoverDay = cell.date"
        >
          {{ cell.day }}
        </button>
      </div>

      <div class="foot">
        <span>{{ hint }}</span>
        <button v-if="anchor" class="btn btn-ghost" @click="anchor = ''">Clear</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { addDays, dateRange, formatWorkDayShort } from '../config/shifts';

const props = defineProps({
  from: { type: String, required: true },
  to: { type: String, required: true },
  // Latest pickable day ('YYYY-MM-DD')
  max: { type: String, required: true },
  // Longest range allowed, in days
  maxDays: { type: Number, default: 31 }
});

const emit = defineEmits(['change']);

const WEEKDAYS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];

const rootRef = ref(null);
const open = ref(false);
const viewMonth = ref(props.to.slice(0, 7)); // 'YYYY-MM'
const anchor = ref(''); // first click of a new range
const hoverDay = ref('');

const dayCount = computed(() => dateRange(props.from, props.to).length);
const label = computed(() => {
  const year = props.to.slice(0, 4);
  return props.from === props.to
    ? `${formatWorkDayShort(props.to)}, ${year}`
    : `${formatWorkDayShort(props.from)} – ${formatWorkDayShort(props.to)}, ${year}`;
});

const monthName = computed(() => {
  const [y, m] = viewMonth.value.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString('en-US', { timeZone: 'UTC', month: 'long', year: 'numeric' });
});

const canGoNext = computed(() => viewMonth.value < props.max.slice(0, 7));

function moveMonth(n) {
  const [y, m] = viewMonth.value.split('-').map(Number);
  viewMonth.value = new Date(Date.UTC(y, m - 1 + n, 1)).toISOString().slice(0, 7);
}

// The range on screen: the saved one, or the one being picked (anchor to hovered day)
const shown = computed(() => {
  if (!anchor.value) return { from: props.from, to: props.to };
  const other = hoverDay.value || anchor.value;
  return other < anchor.value ? { from: other, to: anchor.value } : { from: anchor.value, to: other };
});

const cells = computed(() => {
  const first = `${viewMonth.value}-01`;
  const [y, m] = viewMonth.value.split('-').map(Number);
  const offset = (new Date(Date.UTC(y, m - 1, 1)).getUTCDay() + 6) % 7; // Monday first
  const start = addDays(first, -offset);
  const reach = props.maxDays - 1;
  return Array.from({ length: 42 }, (_, i) => {
    const date = addDays(start, i);
    const tooFar = anchor.value && (date > addDays(anchor.value, reach) || date < addDays(anchor.value, -reach));
    return {
      date,
      day: Number(date.slice(8)),
      inMonth: date.slice(0, 7) === viewMonth.value,
      disabled: date > props.max || !!tooFar,
      isEdge: date === shown.value.from || date === shown.value.to,
      isBetween: date > shown.value.from && date < shown.value.to
    };
  });
});

const hint = computed(() => (anchor.value
  ? `Now pick the end day · up to ${props.maxDays} days`
  : 'Pick a start day, then an end day'));

function pick(date) {
  if (!anchor.value) {
    anchor.value = date;
    return;
  }
  const range = date < anchor.value ? { from: date, to: anchor.value } : { from: anchor.value, to: date };
  anchor.value = '';
  open.value = false;
  emit('change', range);
}

function toggle() {
  open.value = !open.value;
  anchor.value = '';
  hoverDay.value = '';
  if (open.value) viewMonth.value = props.to.slice(0, 7);
}

function onDocumentClick(e) {
  if (open.value && rootRef.value && !rootRef.value.contains(e.target)) open.value = false;
}
function onKeydown(e) {
  if (e.key === 'Escape') open.value = false;
}

onMounted(() => {
  document.addEventListener('click', onDocumentClick);
  window.addEventListener('keydown', onKeydown);
});
onUnmounted(() => {
  document.removeEventListener('click', onDocumentClick);
  window.removeEventListener('keydown', onKeydown);
});
</script>

<style scoped>
.picker { position: relative; }
.trigger {
  display: flex; align-items: center; gap: 10px; min-height: 34px; padding: 0 12px; cursor: pointer;
  font: inherit; color: var(--color-text); background: var(--color-neutral-100);
  border: 1px solid var(--color-divider);
}
.trigger:hover, .trigger.is-open { border-color: color-mix(in srgb, var(--color-text) 45%, transparent); }
.trigger svg { color: var(--color-neutral-700); flex-shrink: 0; }
.trigger-label { font-family: var(--font-heading); font-weight: 600; font-size: 15px; white-space: nowrap; }
.trigger-days { font-size: 12px; color: var(--color-neutral-700); padding-left: 10px; border-left: 1px solid var(--color-divider); white-space: nowrap; }

.pop {
  position: absolute; top: calc(100% + 6px); right: 0; z-index: 40; width: 300px; padding: 12px;
  background: var(--color-neutral-100); border: 1px solid var(--color-divider); box-shadow: var(--shadow-lg);
  display: flex; flex-direction: column; gap: 8px; user-select: none;
}
.month-head { display: flex; align-items: center; justify-content: space-between; }
.nav { width: 30px; height: 30px; color: var(--color-text); }
.month-name { font-family: var(--font-heading); font-weight: 600; font-size: 17px; text-transform: uppercase; letter-spacing: 0.02em; }

.grid { display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); }
.weekdays > span { text-align: center; font-size: 10px; letter-spacing: 0.08em; text-transform: uppercase; color: var(--color-neutral-600); padding: 4px 0; }
.days { gap: 2px 0; }
.day {
  height: 36px; border: 0; background: transparent; cursor: pointer; font-family: var(--font-heading); font-size: 15px;
  color: var(--color-text);
}
.day:hover:not(:disabled):not(.is-edge) { background: var(--color-neutral-200); }
.day.is-outside { color: var(--color-neutral-500); }
.day.is-between { background: var(--color-accent-100); color: var(--color-accent-900); }
.day.is-edge { background: var(--color-accent); color: var(--color-bg); font-weight: 600; }
.day.is-today:not(.is-edge) { box-shadow: inset 0 0 0 1px var(--color-accent); }
.day:disabled { opacity: 0.3; cursor: not-allowed; }

.foot {
  display: flex; align-items: center; justify-content: space-between; gap: 8px; min-height: 28px;
  padding-top: 8px; border-top: 1px solid var(--color-divider); font-size: 12px; color: var(--color-neutral-700);
}
.foot .btn { font-size: 13px; padding-block: 2px; }
</style>
