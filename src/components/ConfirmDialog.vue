<template>
  <div class="cb-backdrop" @click.self="$emit('cancel')">
    <div class="cb-dialog confirm" role="alertdialog" aria-modal="true">
      <span class="cb-dialog-title">{{ title }}</span>
      <p class="body">{{ body }}</p>
      <div class="cb-dialog-actions">
        <button class="btn btn-secondary" @click="$emit('cancel')">Cancel</button>
        <button ref="okRef" class="btn btn-primary" @click="$emit('confirm')">{{ okLabel }}</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue';

defineProps({
  title: { type: String, required: true },
  body: { type: String, default: '' },
  okLabel: { type: String, default: 'Confirm' }
});

const emit = defineEmits(['confirm', 'cancel']);
const okRef = ref(null);

function onKeydown(e) {
  if (e.key === 'Escape') emit('cancel');
}

onMounted(() => {
  okRef.value?.focus();
  window.addEventListener('keydown', onKeydown);
});
onUnmounted(() => window.removeEventListener('keydown', onKeydown));
</script>

<style scoped>
.confirm { width: min(440px, 100%); gap: 12px; }
.body { margin: 0; font-size: 14px; color: var(--color-neutral-800); text-wrap: pretty; }
.cb-dialog-actions { margin-top: 8px; }
</style>
