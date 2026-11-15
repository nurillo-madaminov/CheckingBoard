<template>
  <div class="cb-page cb-scroll eld-page">
    <!-- Header: title, how fresh the data is -->
    <div class="cb-page-head">
      <div class="title-block">
        <h2 class="cb-title">ELD</h2>
        <span class="cb-sub">Dispatch Brain · the ELD next to what drivers send in Telegram</span>
      </div>
      <div class="cb-spacer"></div>
      <span v-if="status" :class="['light', `is-${status.telegram?.light || 'green'}`]" :title="lightTitle">
        <span class="dot" aria-hidden="true"></span>
        Telegram data: {{ LIGHT_LABELS[status.telegram?.light] || 'Unknown' }}
      </span>
      <span v-if="status?.eld_sync?.at" class="cb-sub" :title="status.eld_sync.status">ELD synced {{ status.eld_sync.at }}</span>
    </div>

    <!-- No access: explain why, nothing else -->
    <div v-if="access.checked && !access.me" class="cb-panel cb-empty-state">
      <strong>Dispatch Brain is not available for your account.</strong>
      <span>{{ access.error }}</span>
      <span>If your team should have access, ask your manager to contact the Dispatch Brain admin.</span>
      <button type="button" class="btn btn-secondary" @click="retry">Try again</button>
    </div>
    <div v-else-if="!access.checked" class="cb-panel cb-empty-state">Connecting to Dispatch Brain…</div>

    <template v-else>
      <div class="cb-tabs" role="tablist" aria-label="ELD sections">
        <button
          v-for="t in TABS"
          :key="t.id"
          type="button"
          role="tab"
          :aria-selected="tab === t.id ? 'true' : 'false'"
          :class="['cb-tab', { 'is-on': tab === t.id }]"
          @click="tab = t.id"
        >
          {{ t.label }}
          <span v-if="t.id === 'check' && checkCount !== null" class="cb-tab-count">{{ checkCount }}</span>
        </button>
      </div>

      <KeepAlive>
        <EldCheckPanel
          v-if="tab === 'check'"
          :canFix="!!access.me.can_fix"
          @count="onCount"
          @saved="$emit('saved', $event)"
          @error="$emit('error', $event)"
        />
        <BrainSearchPanel v-else-if="tab === 'search'" />
        <AssistantPanel v-else-if="tab === 'assistant'" />
      </KeepAlive>
    </template>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import EldCheckPanel from './EldCheckPanel.vue';
import BrainSearchPanel from './BrainSearchPanel.vue';
import AssistantPanel from './AssistantPanel.vue';
import { brainAccess, loadBrainAccess, getBrainStatus, LIGHT_LABELS } from '../services/dispatchBrainService';

const props = defineProps({
  // Last known number of ELD differences (from the app's background check)
  initialCount: { type: Number, default: null }
});
const emit = defineEmits(['saved', 'error', 'count']);

const TABS = [
  { id: 'check', label: 'ELD check' },
  { id: 'search', label: 'Search' },
  { id: 'assistant', label: 'Assistant' }
];

const tab = ref('check');
const status = ref(null);
const checkCount = ref(props.initialCount);
const access = computed(() => brainAccess.value);

const lightTitle = computed(() => {
  const reasons = status.value?.telegram?.reasons || [];
  return reasons.length ? reasons.join('\n') : 'Every group is read up to now';
});

function onCount(n) {
  checkCount.value = n;
  emit('count', n);
}

async function loadStatus() {
  try {
    status.value = await getBrainStatus();
  } catch {
    status.value = null;
  }
}

async function retry() {
  await loadBrainAccess();
  if (brainAccess.value.me) loadStatus();
}

onMounted(async () => {
  if (!brainAccess.value.me) await loadBrainAccess();
  if (brainAccess.value.me) loadStatus();
});
</script>

<style scoped>
.title-block { display: flex; flex-direction: column; gap: 1px; min-width: 0; }
.light { display: inline-flex; align-items: center; gap: 6px; font-size: 13px; padding: 3px 10px; border: 1px solid var(--color-divider); background: var(--color-neutral-100); }
.light .dot { width: 8px; height: 8px; border-radius: 50%; background: #3f8f5a; }
.light.is-yellow .dot { background: #c9962b; }
.light.is-red { color: var(--color-signal); border-color: var(--color-signal); }
.light.is-red .dot { background: var(--color-signal); }
</style>
