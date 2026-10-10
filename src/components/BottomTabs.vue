<template>
  <nav aria-label="Checking Board Tabs" class="bg-slate-200 border-t border-slate-300 px-3 py-1 flex items-center justify-between text-xs select-none shadow-inner shrink-0">
    <div class="flex items-center gap-1 overflow-x-auto no-scrollbar py-0.5">
      <button
        v-for="tab in tabs"
        :key="tab.id"
        @click="$emit('select-tab', tab.id)"
        :class="[
          'group flex items-center gap-2 px-3.5 py-1.5 rounded-t-md font-semibold text-xs tracking-wide transition-all border-t-2',
          activeTabId === tab.id
            ? 'bg-white text-slate-900 border-emerald-600 shadow-sm relative -mb-1 pb-2.5 z-10 font-bold'
            : 'bg-slate-300/80 hover:bg-slate-100/90 text-slate-600 border-transparent hover:text-slate-900'
        ]"
      >
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
    </div>

    <!-- Quick Status / Legend Summary on Right -->
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
import { computed } from 'vue';

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

defineEmits(['select-tab']);

const currentTabObj = computed(() => {
  return props.tabs.find(t => t.id === props.activeTabId);
});
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
