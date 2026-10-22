<template>
  <header class="bg-white border-b border-slate-200 px-4 py-2 flex items-center justify-between gap-3 select-none shrink-0 shadow-2xs flex-wrap md:flex-nowrap">
    <!-- Left: App Branding, Add Company, & View Switcher -->
    <div class="flex items-center gap-3 shrink-0">
      <div class="flex items-center gap-2">
        <div class="w-8 h-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center font-bold text-lg shadow-sm">
          CB
        </div>
        <div>
          <h1 class="font-extrabold text-sm tracking-tight text-slate-900 leading-tight">
            CheckingBoard
          </h1>
          <p class="text-[9px] text-slate-500 font-medium">
            Fleet & Activity Audit System
          </p>
        </div>
      </div>

      <!-- Add Company Button (Fleet view, managers only) -->
      <button
        v-if="activeView === 'fleet' && canManageFleet"
        @click="$emit('open-add-company')"
        class="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-xs hover:shadow transition-all active:scale-95"
        title="Add a new company/carrier group"
      >
        <span class="text-sm leading-none font-black">+</span>
        <span class="hidden sm:inline">Add Company</span>
      </button>

      <!-- View Switcher Pills: Fleet Board | Logs | Shifts | Statistics -->
      <div class="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg border border-slate-200 text-xs font-semibold">
        <button
          @click="$emit('update:activeView', 'fleet')"
          :class="[
            'flex items-center gap-1 px-2.5 py-1 rounded-md transition-all',
            activeView === 'fleet'
              ? 'bg-white text-slate-900 shadow-2xs font-bold border border-slate-200'
              : 'text-slate-600 hover:text-slate-900'
          ]"
        >
          <span>📋</span>
          <span class="hidden sm:inline">Fleet Board</span>
        </button>

        <button
          @click="$emit('update:activeView', 'activity_log')"
          :class="[
            'flex items-center gap-1 px-2.5 py-1 rounded-md transition-all',
            activeView === 'activity_log'
              ? 'bg-white text-slate-900 shadow-2xs font-bold border border-slate-200'
              : 'text-slate-600 hover:text-slate-900'
          ]"
        >
          <span>📜</span>
          <span>Logs</span>
        </button>

        <template v-if="currentUser?.role === 'manager'">
          <button
            @click="$emit('update:activeView', 'shifts')"
            :class="[
              'flex items-center gap-1 px-2.5 py-1 rounded-md transition-all',
              activeView === 'shifts'
                ? 'bg-white text-purple-900 shadow-2xs font-bold border border-purple-200'
                : 'text-slate-600 hover:text-purple-900'
            ]"
          >
            <span>🗓️</span>
            <span>Shifts</span>
          </button>

          <button
            @click="$emit('update:activeView', 'statistics')"
            :class="[
              'flex items-center gap-1 px-2.5 py-1 rounded-md transition-all',
              activeView === 'statistics'
                ? 'bg-white text-purple-900 shadow-2xs font-bold border border-purple-200'
                : 'text-slate-600 hover:text-purple-900'
            ]"
          >
            <span>📊</span>
            <span>Statistics</span>
          </button>
        </template>
      </div>
    </div>

    <!-- Center: Search Input (when on fleet or activity_log) -->
    <div v-if="activeView === 'fleet'" class="flex-1 max-w-xs md:max-w-md mx-1">
      <div class="relative">
        <input
          :value="searchQuery"
          @input="$emit('update:searchQuery', $event.target.value)"
          type="text"
          placeholder="Search fleet (driver, unit #, company)..."
          class="w-full pl-7 pr-7 py-1 text-xs rounded-lg border border-slate-300 bg-slate-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500 text-slate-800 placeholder-slate-400"
        />
        <span class="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-slate-400">🔍</span>
        <button
          v-if="searchQuery"
          @click="$emit('update:searchQuery', '')"
          class="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-700"
        >
          ✕
        </button>
      </div>
    </div>

    <!-- Right: Staff Member Pill & Tools -->
    <div class="flex items-center gap-1.5 shrink-0">
      <!-- Staff Account & Role Pill -->
      <button
        @click="$emit('open-staff-switch')"
        :class="[
          'flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold border transition-all active:scale-95 shadow-2xs',
          currentUser?.role === 'manager'
            ? 'bg-purple-50 hover:bg-purple-100 text-purple-900 border-purple-300'
            : 'bg-indigo-50 hover:bg-indigo-100 text-indigo-900 border-indigo-300'
        ]"
        :title="`Logged in as ${currentUser?.displayName} (${currentUser?.role}). Click to open Team & Staff Management.`"
      >
        <span>{{ currentUser?.role === 'manager' ? '👑' : '👤' }}</span>
        <span class="truncate max-w-[120px]">{{ currentUser?.displayName || 'Staff' }}</span>
        <span
          :class="[
            'text-[9px] px-1 py-0.2 rounded uppercase font-black tracking-wide',
            currentUser?.role === 'manager' ? 'bg-purple-200 text-purple-800' : 'bg-indigo-200 text-indigo-800'
          ]"
        >
          {{ currentUser?.role }}
        </span>
      </button>

      <!-- Team name + live sync indicator (single shared database) -->
      <div
        :class="[
          'flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-xs font-bold border',
          isLive
            ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
            : 'bg-amber-50 text-amber-800 border-amber-300'
        ]"
        :title="isLive ? 'Live: changes from your team appear instantly' : 'Reconnecting to live updates...'"
      >
        <span
          :class="[
            'w-1.5 h-1.5 rounded-full shrink-0',
            isLive ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'
          ]"
        ></span>
        <span class="hidden md:inline text-[11px] truncate max-w-[160px]">{{ teamName || 'Team' }}</span>
      </div>

      <!-- Status Colors Button (Fleet view only) -->
      <button
        v-if="activeView === 'fleet'"
        @click="$emit('open-config')"
        class="flex items-center gap-1 px-2 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold border border-slate-200 transition-colors"
        title="Configure status colors & codes"
      >
        <span>🎨</span>
        <span class="hidden lg:inline text-[11px]">Colors</span>
      </button>

      <!-- Reset to Ready Button (Fleet view only) -->
      <button
        v-if="activeView === 'fleet'"
        @click="$emit('reset-data')"
        class="flex items-center gap-1 px-2 py-1.5 rounded-lg text-rose-700 hover:text-rose-800 bg-rose-50 hover:bg-rose-100 border border-rose-200 text-xs font-bold transition-all shadow-2xs active:scale-95"
        title="Reset all drivers to READY and mark all rows RED (needs check ASAP)"
      >
        <span>↺</span>
        <span class="hidden xl:inline text-[11px]">Reset Ready</span>
      </button>

      <!-- Log Out Button -->
      <button
        @click="$emit('logout')"
        class="flex items-center gap-1 px-2 py-1.5 rounded-lg bg-slate-100 hover:bg-rose-50 text-slate-600 hover:text-rose-700 border border-slate-200 hover:border-rose-300 text-xs font-bold transition-all shadow-2xs"
        title="Sign Out"
      >
        <span>🚪</span>
        <span class="hidden xl:inline text-[11px]">Sign Out</span>
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
  teamName: {
    type: String,
    default: ''
  },
  isLive: {
    type: Boolean,
    default: false
  },
  activeView: {
    type: String,
    default: 'fleet'
  },
  currentUser: {
    type: Object,
    default: null
  },
  canManageFleet: {
    type: Boolean,
    default: false
  }
});

defineEmits([
  'open-add-company',
  'update:searchQuery',
  'open-config',
  'reset-data',
  'update:activeView',
  'open-staff-switch',
  'logout'
]);
</script>
