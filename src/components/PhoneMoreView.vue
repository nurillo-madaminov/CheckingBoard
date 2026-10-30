<template>
  <!-- One of the pages, with a way back to the list -->
  <div v-if="page" class="more-page">
    <button type="button" class="back" @click="page = ''">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6" /></svg>
      More
    </button>
    <ShiftControlView
      v-if="page === 'shifts'"
      :showOffice="false"
      @saved="emit('toast', { title: 'Shift schedule saved', message: 'New actions use the updated shifts' })"
    />
    <ActivityLogView v-else-if="page === 'logs'" :activeDrivers="activeDrivers" :refreshKey="refreshKey" />
    <DailyStatisticsView v-else-if="page === 'stats'" :refreshKey="refreshKey" />
  </div>

  <!-- The list -->
  <div v-else class="cb-page cb-scroll more">
    <div class="cb-page-head">
      <div class="title-block">
        <h2 class="cb-title">More</h2>
        <span class="cb-sub">The rest of the manager pages. The board, extensions and the office location are on the computer.</span>
      </div>
    </div>
    <div class="cb-panel list">
      <button v-for="p in PAGES" :key="p.id" type="button" class="item" @click="page = p.id">
        <span class="item-icon">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" v-html="p.icon"></svg>
        </span>
        <span class="item-text">
          <span class="item-title">{{ p.label }}</span>
          <span class="item-sub">{{ p.sub }}</span>
        </span>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="chev"><path d="m9 18 6-6-6-6" /></svg>
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import ShiftControlView from './ShiftControlView.vue';
import ActivityLogView from './ActivityLogView.vue';
import DailyStatisticsView from './DailyStatisticsView.vue';

defineProps({
  activeDrivers: { type: Array, default: () => [] },
  // Bumped by the app when new actions arrive
  refreshKey: { type: Number, default: 0 }
});
// toast: { title, message }; error: { title, message }
const emit = defineEmits(['toast', 'error']);

const PAGES = [
  {
    id: 'shifts',
    label: 'Shifts',
    sub: 'Who is on which shift, and the hours',
    icon: '<path d="M21 7.5V6a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h3.5" /><path d="M16 2v4" /><path d="M8 2v4" /><path d="M3 10h5" /><path d="M17.5 17.5 16 16.3V14" /><circle cx="16" cy="16" r="6" />'
  },
  {
    id: 'logs',
    label: 'Logs',
    sub: 'Every action, by day and shift',
    icon: '<path d="M15 12h-5" /><path d="M15 8h-5" /><path d="M19 17V5a2 2 0 0 0-2-2H4" /><path d="M8 21h12a2 2 0 0 0 2-2v-1a1 1 0 0 0-1-1H11a1 1 0 0 0-1 1v1a2 2 0 1 1-4 0V5a2 2 0 1 0-4 0v2a1 1 0 0 0 1 1h3" />'
  },
  {
    id: 'stats',
    label: 'Statistics',
    sub: 'Totals per action, shift and person',
    icon: '<path d="M3 3v16a2 2 0 0 0 2 2h16" /><path d="M18 17V9" /><path d="M13 17V5" /><path d="M8 17v-3" />'
  }
];

const page = ref('');
</script>

<style scoped>
.more-page { flex: 1; min-height: 0; display: flex; flex-direction: column; }
.back {
  display: flex; align-items: center; gap: 4px; flex-shrink: 0; align-self: stretch;
  min-height: 44px; padding: 0 12px; border: 0; border-bottom: 1px solid var(--color-divider);
  background: var(--color-neutral-100); color: var(--color-accent-700); font: inherit; font-size: 15px; font-weight: 500; cursor: pointer; text-align: left;
}
.title-block { display: flex; flex-direction: column; gap: 1px; min-width: 0; }
.list { display: flex; flex-direction: column; }
.item {
  display: flex; align-items: center; gap: 14px; min-height: 64px; padding: 10px 14px;
  border: 0; border-top: 1px solid var(--color-hairline); background: transparent; color: var(--color-text);
  font: inherit; text-align: left; cursor: pointer;
}
.item:first-child { border-top: 0; }
.item:active { background: var(--color-accent-100); }
.item-icon { width: 38px; height: 38px; display: grid; place-items: center; flex-shrink: 0; background: var(--color-accent-100); color: var(--color-accent-800); }
.item-text { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
.item-title { font-size: 16px; font-weight: 500; }
.item-sub { font-size: 12px; color: var(--color-neutral-700); }
.chev { color: var(--color-neutral-600); flex-shrink: 0; }
</style>
