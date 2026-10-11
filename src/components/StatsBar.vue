<template>
  <header class="bg-white border-b border-slate-200 px-4 py-2.5 flex items-center justify-between gap-4 select-none shrink-0 shadow-2xs">
    <!-- Left: App Branding & Add Company Button -->
    <div class="flex items-center gap-4">
      <div class="flex items-center gap-2">
        <div class="w-8 h-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center font-bold text-lg shadow-sm">
          CB
        </div>
        <div>
          <h1 class="font-extrabold text-base tracking-tight text-slate-900 leading-tight">
            CheckingBoard
          </h1>
          <p class="text-[10px] text-slate-500 font-medium">
            Dynamic Fleet & Driver Dispatch Tracker
          </p>
        </div>
      </div>

      <!-- Add Company Button -->
      <button
        @click="$emit('open-add-company')"
        class="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-xs hover:shadow transition-all active:scale-95"
        title="Add a new company/carrier group"
      >
        <span class="text-base leading-none font-black">+</span>
        <span>Add Company</span>
      </button>
    </div>

    <!-- Center: Search Input -->
    <div class="flex-1 max-w-md mx-2">
      <div class="relative">
        <input
          :value="searchQuery"
          @input="$emit('update:searchQuery', $event.target.value)"
          type="text"
          placeholder="Search by driver, unit #, company, status, note..."
          class="w-full pl-8 pr-7 py-1.5 text-xs rounded-lg border border-slate-300 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-800 placeholder-slate-400"
        />
        <span class="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-400">🔍</span>
        <button
          v-if="searchQuery"
          @click="$emit('update:searchQuery', '')"
          class="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-700"
        >
          ✕
        </button>
      </div>
    </div>

    <!-- Right: Tools (Supabase, Config, Reset) -->
    <div class="flex items-center gap-2">
      <!-- Supabase Database Status / Connect Button -->
      <button
        @click="$emit('open-supabase')"
        :class="[
          'flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold border transition-colors',
          isSupabaseConnected
            ? 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border-emerald-300'
            : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-300'
        ]"
        :title="isSupabaseConnected ? 'Supabase Connected (Live Realtime Active)' : 'Connect Supabase Database'"
      >
        <span v-if="isSupabaseConnected" class="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0"></span>
        <span v-else>⚡</span>
        <span class="hidden sm:inline">
          {{ isSupabaseConnected ? 'Supabase Live' : 'Connect DB' }}
        </span>
      </button>

      <!-- Status Config & Colors Button -->
      <button
        @click="$emit('open-config')"
        class="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold border border-slate-200 transition-colors"
        title="Configure status colors & codes"
      >
        <span>🎨</span>
        <span class="hidden sm:inline">Status Colors</span>
      </button>

      <!-- Reset to Default Data -->
      <button
        @click="$emit('reset-data')"
        class="px-2 py-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 text-xs transition-colors"
        title="Reset to default fleet roster"
      >
        ↺
      </button>
    </div>
  </header>
</template>

<script setup>
defineProps({
  searchQuery: {
    type: String,
    default: ''
  },
  isSupabaseConnected: {
    type: Boolean,
    default: false
  }
});

defineEmits([
  'open-add-company',
  'update:searchQuery',
  'open-config',
  'open-supabase',
  'reset-data'
]);
</script>
