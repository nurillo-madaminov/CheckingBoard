<template>
  <div class="cb-page cb-scroll staff">
    <!-- Header: title + the primary action of the open tab (Schedule puts Save there itself) -->
    <div class="cb-page-head">
      <div class="title-block">
        <h2 class="cb-title">Staff</h2>
        <span class="cb-sub">{{ activeCount }} active {{ activeCount === 1 ? 'member' : 'members' }} · who is in, who works when, attendance and accounts</span>
      </div>
      <div class="cb-spacer"></div>
      <div id="page-actions" class="cb-head-actions">
        <button v-if="tab === 'today'" type="button" class="btn btn-primary" @click="showMessage = true">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M22 2 11 13" /><path d="M22 2 15 22l-4-9-9-4z" /></svg>
          Message staff
        </button>
        <button v-else-if="tab === 'members'" type="button" class="btn btn-primary" @click="goToNewMember">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" aria-hidden="true"><path d="M5 12h14" /><path d="M12 5v14" /></svg>
          Add member
        </button>
      </div>
    </div>

    <div class="cb-tabs" role="tablist" aria-label="Staff sections">
      <button
        v-for="t in TABS"
        :key="t.id"
        type="button"
        role="tab"
        :aria-selected="tab === t.id"
        :class="['cb-tab', { 'is-on': tab === t.id }]"
        @click="setTab(t.id)"
      >
        {{ t.label }}
      </button>
    </div>

    <TodayView v-if="tab === 'today'" embedded :refreshKey="refreshKey" />
    <ShiftControlView v-else-if="tab === 'schedule'" @saved="emit('saved', { title: 'Shift schedule saved', message: 'New actions use the updated shifts' })" />
    <AttendanceView v-else-if="tab === 'attendance'" :refreshKey="refreshKey" />
    <TeamMembers v-else />

    <MessageStaffDialog v-if="showMessage" @close="showMessage = false" @sent="onSent" />
  </div>
</template>

<script setup>
import { ref, computed, nextTick } from 'vue';
import TodayView from './TodayView.vue';
import ShiftControlView from './ShiftControlView.vue';
import AttendanceView from './AttendanceView.vue';
import TeamMembers from './TeamMembers.vue';
import MessageStaffDialog from './MessageStaffDialog.vue';
import { activeStaffProfiles } from '../services/authService';

defineProps({
  // Bumped by the app when a check-in / check-out arrives live
  refreshKey: { type: Number, default: 0 }
});
const emit = defineEmits(['saved', 'error']);

// Today first: it is what you look at during a shift
const TABS = [
  { id: 'today', label: 'Today' },
  { id: 'schedule', label: 'Schedule' },
  { id: 'attendance', label: 'Attendance' },
  { id: 'members', label: 'Members' }
];

// The last section opened is remembered in this browser
const TAB_KEY = 'checkingboard_staff_tab';
function savedTab() {
  try {
    const t = localStorage.getItem(TAB_KEY);
    return TABS.some(x => x.id === t) ? t : 'today';
  } catch (e) {
    return 'today';
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
const showMessage = ref(false);

function onSent(toast) {
  showMessage.value = false;
  emit('saved', toast);
}

// The new-account form sits under the member list
async function goToNewMember() {
  await nextTick();
  const field = document.getElementById('new-name');
  field?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  field?.focus({ preventScroll: true });
}
</script>

<style scoped>
.title-block { display: flex; flex-direction: column; gap: 1px; min-width: 0; }
.cb-head-actions :deep(.unsaved) { font-size: 13px; color: var(--color-accent-700); }
</style>
