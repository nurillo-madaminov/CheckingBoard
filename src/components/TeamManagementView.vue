<template>
  <div class="cb-page cb-scroll team">
    <div class="cb-page-head">
      <div class="title-block">
        <h2 class="cb-title">Team</h2>
        <span class="cb-sub">{{ activeCount }} active {{ activeCount === 1 ? 'member' : 'members' }} · accounts, roles and attendance</span>
      </div>
      <div class="cb-spacer"></div>
      <div class="seg tabs" role="tablist" aria-label="Team sections">
        <button
          v-for="t in TABS"
          :key="t.id"
          type="button"
          role="tab"
          :aria-selected="tab === t.id"
          :class="['seg-btn', { 'is-on': tab === t.id }]"
          @click="setTab(t.id)"
        >
          {{ t.label }}
        </button>
      </div>
    </div>

    <TeamMembers v-if="tab === 'members'" />
    <AttendanceView
      v-else
      :refreshKey="refreshKey"
      @saved="emit('saved', $event)"
      @error="emit('error', $event)"
    />
  </div>
</template>

<script setup>
import { ref, computed } from 'vue';
import TeamMembers from './TeamMembers.vue';
import AttendanceView from './AttendanceView.vue';
import { activeStaffProfiles } from '../services/authService';

defineProps({
  // Bumped by the app when a check-in / check-out arrives live
  refreshKey: { type: Number, default: 0 }
});
const emit = defineEmits(['saved', 'error']);

const TABS = [
  { id: 'members', label: 'Members' },
  { id: 'attendance', label: 'Attendance' }
];

// The last section opened is remembered in this browser
const TAB_KEY = 'checkingboard_team_tab';
function savedTab() {
  try {
    const t = localStorage.getItem(TAB_KEY);
    return TABS.some(x => x.id === t) ? t : 'members';
  } catch (e) {
    return 'members';
  }
}
const tab = ref(savedTab());

function setTab(id) {
  tab.value = id;
  try {
    localStorage.setItem(TAB_KEY, id);
  } catch (e) {
    // Not remembered; the choice still applies now
  }
}

const activeCount = computed(() => activeStaffProfiles.value.length);
</script>

<style scoped>
.title-block { display: flex; flex-direction: column; gap: 1px; min-width: 0; }
.tabs { display: flex; }
.tabs .seg-btn { min-width: 110px; }
@media (max-width: 640px) {
  .tabs { width: 100%; }
  .tabs .seg-btn { flex: 1; min-width: 0; min-height: 40px; }
}
</style>
