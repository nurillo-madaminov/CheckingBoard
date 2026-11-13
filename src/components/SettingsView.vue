<template>
  <div class="cb-page cb-scroll settings">
    <div class="cb-page-head">
      <div class="title-block">
        <h2 class="cb-title">Settings</h2>
        <span class="cb-sub">Things you set once. Each section saves on its own.</span>
      </div>
    </div>

    <div class="cb-tabs" role="tablist" aria-label="Settings sections">
      <button
        v-for="t in tabs"
        :key="t.id"
        type="button"
        role="tab"
        :aria-selected="tab === t.id"
        :class="['cb-tab', { 'is-on': tab === t.id }]"
        @click="tab = t.id"
      >
        {{ t.label }}
      </button>
    </div>

    <ProfileView v-if="tab === 'account'" embedded @logout="$emit('logout')" />
    <AttendanceRulesCard v-else-if="tab === 'rules'" @saved="$emit('saved', $event)" @error="$emit('error', $event)" />
    <OfficeLocationCard v-else-if="tab === 'office'" @saved="$emit('saved', $event)" @error="$emit('error', $event)" />
    <ExtensionsView v-else embedded :isManager="isManager" :teamId="teamId" @published="$emit('saved', { title: 'Extension published', message: $event })" />
  </div>
</template>

<script setup>
import { ref, computed, watch, defineAsyncComponent } from 'vue';
import ProfileView from './ProfileView.vue';
import AttendanceRulesCard from './AttendanceRulesCard.vue';
import ExtensionsView from './ExtensionsView.vue';
// Loaded on demand: the map library is only needed here, by managers
const OfficeLocationCard = defineAsyncComponent(() => import('./OfficeLocationCard.vue'));

const props = defineProps({
  isManager: { type: Boolean, default: false },
  teamId: { type: String, default: '' },
  // Which section to open: 'account' | 'rules' | 'office' | 'extensions'
  section: { type: String, default: 'account' }
});
defineEmits(['logout', 'saved', 'error']);

const tabs = computed(() => [
  { id: 'account', label: 'My account' },
  ...(props.isManager ? [{ id: 'rules', label: 'Attendance rules' }, { id: 'office', label: 'Office location' }] : []),
  { id: 'extensions', label: 'Extensions' }
]);

const tab = ref(props.section);
watch(() => props.section, (s) => { tab.value = s; });
watch(tabs, (list) => {
  if (!list.some(t => t.id === tab.value)) tab.value = 'account';
}, { immediate: true });
</script>

<style scoped>
.title-block { display: flex; flex-direction: column; gap: 1px; min-width: 0; }
</style>
