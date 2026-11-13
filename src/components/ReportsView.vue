<template>
  <div class="cb-page cb-scroll reports">
    <div class="cb-page-head">
      <div class="title-block">
        <h2 class="cb-title">Reports</h2>
        <span class="cb-sub">What was done: every action record, and its totals</span>
      </div>
    </div>

    <div v-if="isManager" class="cb-tabs" role="tablist" aria-label="Report views">
      <button type="button" role="tab" :aria-selected="tab === 'activity'" :class="['cb-tab', { 'is-on': tab === 'activity' }]" @click="tab = 'activity'">Activity</button>
      <button type="button" role="tab" :aria-selected="tab === 'statistics'" :class="['cb-tab', { 'is-on': tab === 'statistics' }]" @click="tab = 'statistics'">Statistics</button>
    </div>

    <ActivityLogView v-if="tab === 'activity' || !isManager" embedded :activeDrivers="activeDrivers" :refreshKey="refreshKey" :preset="activePreset" />
    <DailyStatisticsView v-else embedded :refreshKey="refreshKey" @open-day="openDay" />
  </div>
</template>

<script setup>
import { ref, watch } from 'vue';
import ActivityLogView from './ActivityLogView.vue';
import DailyStatisticsView from './DailyStatisticsView.vue';

const props = defineProps({
  activeDrivers: { type: Array, default: () => [] },
  refreshKey: { type: Number, default: 0 },
  isManager: { type: Boolean, default: false },
  // Opened from a driver page: { search }
  preset: { type: Object, default: null }
});

const tab = ref('activity');
const activePreset = ref(props.preset);

watch(() => props.preset, (p) => {
  if (!p) return;
  activePreset.value = p;
  tab.value = 'activity';
});

// A day in Statistics opens its records
function openDay(day) {
  activePreset.value = { day };
  tab.value = 'activity';
}
</script>

<style scoped>
.title-block { display: flex; flex-direction: column; gap: 1px; min-width: 0; }
</style>
