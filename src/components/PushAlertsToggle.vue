<template>
  <div v-if="state && state !== 'unconfigured'" :class="['push', { 'is-on': state === 'on' }]">
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="push-icon"><rect width="14" height="20" x="5" y="2" rx="2" /><path d="M12 18h.01" /></svg>
    <div class="push-text">
      <span class="push-title">Phone alerts {{ state === 'on' ? 'on' : 'off' }}</span>
      <span class="push-sub">{{ message || stateText }}</span>
    </div>
    <button v-if="state === 'off'" type="button" class="btn btn-primary" :disabled="busy" @click="turnOn">{{ busy ? 'Turning on…' : 'Turn on' }}</button>
    <button v-else-if="state === 'on'" type="button" class="btn btn-secondary" :disabled="busy" @click="turnOff">Turn off</button>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { getPushState, enablePush, disablePush } from '../services/pushService';

const state = ref('');
const busy = ref(false);
const message = ref('');

const stateText = computed(() => ({
  on: 'New notifications pop up on this device, even when the app is closed.',
  off: 'Get a pop-up on this device when a notification arrives.',
  'needs-install': 'On iPhone, first tap Share → Add to Home Screen, then open CheckingBoard from the home screen.',
  unsupported: 'This browser can\'t show alerts. Notifications still appear here.',
  denied: 'Alerts are blocked for this site. Allow notifications in your browser or phone settings.'
}[state.value] || ''));

async function refresh() {
  state.value = await getPushState();
}

async function turnOn() {
  busy.value = true;
  message.value = '';
  try {
    await enablePush();
  } catch (err) {
    message.value = err.message || 'Could not turn on alerts';
  } finally {
    busy.value = false;
    await refresh();
  }
}

async function turnOff() {
  busy.value = true;
  message.value = '';
  try {
    await disablePush();
  } catch (err) {
    message.value = err.message || 'Could not turn off alerts';
  } finally {
    busy.value = false;
    await refresh();
  }
}

onMounted(refresh);
</script>

<style scoped>
.push {
  display: flex; align-items: center; gap: 12px; padding: 12px 14px;
  border: 1px solid var(--color-divider); background: var(--color-bg);
}
.push.is-on { border-color: var(--color-accent-400); background: var(--color-accent-100); }
.push-icon { flex-shrink: 0; color: var(--color-accent-700); }
.push-text { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
.push-title { font-size: 14px; font-weight: 600; }
.push-sub { font-size: 12px; line-height: 1.4; color: var(--color-neutral-700); }
.push .btn { flex-shrink: 0; }
</style>
