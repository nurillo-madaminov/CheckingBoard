<template>
  <!-- "More" button: the rare and destructive actions of a page or row -->
  <div ref="rootRef" class="more">
    <button
      ref="buttonRef"
      type="button"
      :class="['btn', compact ? 'btn-ghost' : 'btn-secondary', 'btn-icon', 'more-btn', { compact }]"
      :aria-label="label"
      :title="label"
      aria-haspopup="menu"
      :aria-expanded="open ? 'true' : 'false'"
      @click.stop="toggle"
      @keydown.down.prevent="openAndFocus(0)"
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <circle v-if="vertical" cx="12" cy="5" r="1.6" /><circle v-if="vertical" cx="12" cy="12" r="1.6" /><circle v-if="vertical" cx="12" cy="19" r="1.6" />
        <circle v-if="!vertical" cx="5" cy="12" r="1.6" /><circle v-if="!vertical" cx="12" cy="12" r="1.6" /><circle v-if="!vertical" cx="19" cy="12" r="1.6" />
      </svg>
    </button>
    <div v-if="open" class="menu" role="menu" :aria-label="label" @keydown="onMenuKey" @click.stop>
      <template v-for="item in items" :key="item.id">
        <div v-if="item.divider" class="divider" role="separator"></div>
        <button
          v-else
          type="button"
          role="menuitem"
          :class="['item', { danger: item.danger }]"
          :disabled="item.disabled"
          @click="choose(item)"
        >
          <span class="item-label">{{ item.label }}</span>
          <span v-if="item.hint" class="cb-key item-key">{{ item.hint }}</span>
        </button>
      </template>
    </div>
  </div>
</template>

<script setup>
import { ref, nextTick, onUnmounted } from 'vue';

defineProps({
  // [{ id, label, hint?, danger?, disabled? } | { id, divider: true }]
  items: { type: Array, required: true },
  label: { type: String, default: 'More actions' },
  // Smaller, borderless button for table rows
  compact: { type: Boolean, default: false },
  vertical: { type: Boolean, default: false }
});
const emit = defineEmits(['select']);

const open = ref(false);
const rootRef = ref(null);
const buttonRef = ref(null);

function onOutside(e) {
  if (!rootRef.value?.contains(e.target)) close(false);
}

function close(refocus = true) {
  if (!open.value) return;
  open.value = false;
  document.removeEventListener('mousedown', onOutside);
  if (refocus) buttonRef.value?.focus();
}

function menuItems() {
  return [...(rootRef.value?.querySelectorAll('.item:not(:disabled)') || [])];
}

async function openAndFocus(index) {
  if (!open.value) {
    open.value = true;
    document.addEventListener('mousedown', onOutside);
  }
  await nextTick();
  const list = menuItems();
  list[Math.max(0, Math.min(index, list.length - 1))]?.focus();
}

function toggle() {
  if (open.value) close();
  else openAndFocus(0);
}

function onMenuKey(e) {
  const list = menuItems();
  const i = list.indexOf(document.activeElement);
  if (e.key === 'Escape') {
    e.preventDefault();
    e.stopPropagation();
    close();
  } else if (e.key === 'ArrowDown') {
    e.preventDefault();
    list[(i + 1) % list.length]?.focus();
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    list[(i - 1 + list.length) % list.length]?.focus();
  } else if (e.key === 'Tab') {
    close(false);
  }
}

function choose(item) {
  close();
  emit('select', item.id);
}

onUnmounted(() => document.removeEventListener('mousedown', onOutside));
</script>

<style scoped>
.more { position: relative; flex-shrink: 0; }
.more-btn { width: 34px; height: 34px; }
.more-btn.compact { width: 28px; height: 28px; color: var(--color-neutral-700); }
.menu {
  position: absolute; right: 0; top: calc(100% + 4px); z-index: 40; min-width: 220px; padding: 4px 0;
  display: flex; flex-direction: column;
  background: var(--color-neutral-100); border: 1px solid var(--color-divider); box-shadow: var(--shadow-md);
}
.item {
  display: flex; align-items: center; gap: 10px; width: 100%; padding: 8px 12px; text-align: left; cursor: pointer;
  font: inherit; font-size: 14px; border: 0; background: transparent; color: var(--color-text); white-space: nowrap;
}
.item:hover:not(:disabled), .item:focus-visible { background: var(--color-accent-100); outline: none; }
.item:disabled { opacity: 0.45; cursor: not-allowed; }
.item.danger { color: var(--color-signal); }
.item-label { flex: 1; }
.item-key { font-family: var(--font-body); font-size: 11px; }
.divider { height: 1px; margin: 4px 0; background: var(--color-divider); }
</style>
