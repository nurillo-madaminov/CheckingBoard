<template>
  <nav aria-label="Checking Board Tabs" class="bg-slate-200 border-t border-slate-300 px-3 py-1 flex items-center justify-between text-xs select-none shadow-inner shrink-0">
    <div class="flex items-center gap-1 overflow-x-auto no-scrollbar py-0.5 relative">
      <template v-for="(tab, index) in tabs" :key="tab.id">
        <!-- TAB INSERTION GUIDE LINE: BEFORE (Only for draggable tabs, index >= 1) -->
        <div
          v-if="dropTargetTab && dropTargetTab.tabId === tab.id && dropTargetTab.position === 'before' && index > 0"
          class="w-1.5 h-7 bg-blue-600 rounded-full mx-0.5 shadow-sm relative flex items-center justify-center shrink-0 animate-pulse pointer-events-none"
        >
          <span class="absolute -top-1 w-2 h-2 bg-blue-600 rotate-45"></span>
          <span class="absolute -bottom-1 w-2 h-2 bg-blue-600 rotate-45"></span>
        </div>

        <!-- TAB BUTTON -->
        <button
          :draggable="index > 0"
          @dragstart="onDragStart(tab, index, $event)"
          @dragend="onDragEnd"
          @dragover.prevent="onDragOver(tab, index, $event)"
          @drop.prevent="onDrop(tab, index, $event)"
          @click="$emit('select-tab', tab.id)"
          :class="[
            'group flex items-center gap-2 px-3.5 py-1.5 rounded-t-md font-semibold text-xs tracking-wide transition-all border-t-2 select-none shrink-0 relative',
            index > 0 ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer',
            draggedTabId === tab.id ? 'opacity-40 bg-slate-300' : '',
            activeTabId === tab.id
              ? 'bg-white text-slate-900 border-emerald-600 shadow-sm -mb-1 pb-2.5 z-10 font-bold'
              : 'bg-slate-300/80 hover:bg-slate-100/90 text-slate-600 border-transparent hover:text-slate-900'
          ]"
          :title="index === 0 ? 'Main Checking Board Tab (Fixed)' : 'Drag to reorder tab'"
        >
          <!-- Grip icon for draggable tabs -->
          <span
            v-if="index > 0"
            class="text-[10px] text-slate-400 group-hover:text-slate-600 opacity-60 group-hover:opacity-100"
          >
            ⠿
          </span>

          <span>{{ tab.label }}</span>
          
          <!-- Live Count Badge -->
          <span
            :class="[
              'px-1.5 py-0.5 text-[10px] font-bold rounded-full transition-colors',
              activeTabId === tab.id
                ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                : 'bg-slate-400/40 text-slate-700'
            ]"
          >
            {{ counts[tab.id] || 0 }}
          </span>
        </button>

        <!-- TAB INSERTION GUIDE LINE: AFTER (Only for draggable tabs, index >= 1) -->
        <div
          v-if="dropTargetTab && dropTargetTab.tabId === tab.id && dropTargetTab.position === 'after' && index > 0"
          class="w-1.5 h-7 bg-blue-600 rounded-full mx-0.5 shadow-sm relative flex items-center justify-center shrink-0 animate-pulse pointer-events-none"
        >
          <span class="absolute -top-1 w-2 h-2 bg-blue-600 rotate-45"></span>
          <span class="absolute -bottom-1 w-2 h-2 bg-blue-600 rotate-45"></span>
        </div>
      </template>
    </div>

    <!-- Active View Legend on Right -->
    <div class="hidden lg:flex items-center gap-3 text-[11px] text-slate-600 pl-4 border-l border-slate-300 shrink-0">
      <span class="font-medium text-slate-500">Active View:</span>
      <span class="font-semibold text-slate-800 bg-white px-2 py-0.5 rounded border border-slate-300 shadow-2xs">
        {{ currentTabObj?.subtitle || currentTabObj?.label }}
      </span>
      <span class="text-slate-400">|</span>
      <span>Total: <strong>{{ counts.all || 0 }}</strong> drivers</span>
    </div>
  </nav>
</template>

<script setup>
import { ref, computed } from 'vue';

const props = defineProps({
  tabs: {
    type: Array,
    required: true
  },
  activeTabId: {
    type: String,
    required: true
  },
  counts: {
    type: Object,
    required: true
  }
});

const emit = defineEmits(['select-tab', 'reorder-tabs']);

const currentTabObj = computed(() => {
  return props.tabs.find(t => t.id === props.activeTabId);
});

const draggedTabId = ref(null);
const dropTargetTab = ref(null); // { tabId, position: 'before' | 'after' }

function onDragStart(tab, index, event) {
  if (index === 0) {
    event.preventDefault();
    return;
  }
  draggedTabId.value = tab.id;
  dropTargetTab.value = null;
  event.dataTransfer.effectAllowed = 'move';
  event.dataTransfer.setData('text/plain', `tab:${tab.id}`);
}

function onDragEnd() {
  draggedTabId.value = null;
  dropTargetTab.value = null;
}

function onDragOver(tab, index, event) {
  if (!draggedTabId.value || draggedTabId.value === tab.id || index === 0) {
    dropTargetTab.value = null;
    return;
  }
  event.preventDefault();
  event.dataTransfer.dropEffect = 'move';

  const rect = event.currentTarget.getBoundingClientRect();
  const offset = event.clientX - rect.left;
  const position = offset < (rect.width / 2) ? 'before' : 'after';

  // Do not allow placing before tab 0
  if (index === 1 && position === 'before') {
    dropTargetTab.value = {
      tabId: tab.id,
      position: 'before'
    };
    return;
  }

  dropTargetTab.value = {
    tabId: tab.id,
    position
  };
}

function onDrop(tab, index, event) {
  event.preventDefault();
  if (!draggedTabId.value || !dropTargetTab.value || index === 0) {
    onDragEnd();
    return;
  }

  const { tabId, position } = dropTargetTab.value;
  if (draggedTabId.value !== tabId) {
    emit('reorder-tabs', {
      draggedId: draggedTabId.value,
      targetId: tabId,
      position
    });
  }

  onDragEnd();
}
</script>

<style scoped>
.no-scrollbar::-webkit-scrollbar {
  display: none;
}
.no-scrollbar {
  -ms-overflow-style: none;
  scrollbar-width: none;
}
</style>
