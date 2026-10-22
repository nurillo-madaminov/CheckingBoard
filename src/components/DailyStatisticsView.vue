<template>
  <div class="h-full overflow-auto bg-slate-100 p-4 md:p-6 space-y-5 select-text">
    <!-- Header & period controls -->
    <header class="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex items-center justify-between flex-wrap gap-4">
      <div>
        <h2 class="text-lg font-black text-slate-900 tracking-tight flex items-center gap-2">
          <span>📊 Statistics</span>
          <span class="text-xs font-bold px-2.5 py-0.5 rounded-full bg-purple-100 text-purple-800 border border-purple-300">
            Manager Access
          </span>
        </h2>
        <p class="text-xs text-slate-500 mt-0.5">
          Action-button records only (Shift, Cycle, Fix Log, Break, Connect).
          <span class="font-semibold text-slate-700">{{ rangeLabel }}</span>
        </p>
      </div>

      <div class="flex items-center gap-3 flex-wrap text-xs">
        <div class="flex items-center gap-0.5 bg-slate-100 p-0.5 rounded-lg border border-slate-200 font-semibold">
          <button
            v-for="p in PERIODS"
            :key="p.id"
            @click="periodId = p.id"
            :class="[
              'px-2.5 py-1 rounded-md transition-colors',
              periodId === p.id ? 'bg-white text-slate-900 shadow-2xs font-bold border border-slate-200' : 'text-slate-600 hover:text-slate-900'
            ]"
          >
            {{ p.label }}
          </button>
        </div>

        <div class="flex items-center gap-1.5">
          <span class="text-slate-500 font-semibold">Ending</span>
          <input
            v-model="endDay"
            type="date"
            :max="today"
            class="px-2 py-1 rounded-md border border-slate-300 text-xs text-slate-800 bg-white"
          />
          <button v-if="endDay !== today" @click="endDay = today" class="text-indigo-600 hover:text-indigo-800 font-semibold">
            Today
          </button>
          <button
            @click="load"
            class="ml-1 px-2 py-1 rounded-md bg-white hover:bg-slate-100 border border-slate-300 font-semibold text-slate-700"
            title="Reload from the database"
          >
            ↻
          </button>
        </div>
      </div>
    </header>

    <div v-if="errorMessage" class="p-3 rounded-lg text-xs font-semibold bg-rose-50 text-rose-800 border border-rose-200">
      {{ errorMessage }}
    </div>

    <div :class="['space-y-5 transition-opacity', isLoading ? 'opacity-50' : '']">
      <!-- Whole team (all 3 shifts) -->
      <section class="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3">
        <div class="bg-slate-900 text-white p-4 rounded-xl shadow-2xs flex flex-col justify-between col-span-2 sm:col-span-1">
          <span class="text-[11px] font-bold uppercase tracking-wider text-slate-300">All 3 shifts</span>
          <div class="text-3xl font-black mt-2">{{ stats.team.total }}</div>
          <span class="text-[10px] text-slate-400 mt-1">
            {{ dayCount > 1 ? `≈ ${perDay(stats.team.total)} per day` : 'actions' }}
          </span>
        </div>
        <div
          v-for="act in ACTION_TYPES"
          :key="act.code"
          class="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex flex-col justify-between"
        >
          <span class="text-[11px] font-bold uppercase tracking-wider text-slate-500">{{ act.icon }} {{ act.label }}</span>
          <div class="text-2xl font-black text-slate-900 mt-2">{{ stats.team[act.code] || 0 }}</div>
          <span class="text-[10px] text-slate-400 mt-1">{{ shareOf(stats.team[act.code], stats.team.total) }} of all</span>
        </div>
      </section>

      <!-- Per shift -->
      <section class="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div
          v-for="shift in SHIFTS"
          :key="shift.code"
          class="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden flex flex-col"
          :style="{ borderTop: `4px solid ${shift.accent}` }"
        >
          <div class="px-4 pt-3 pb-2 flex items-start justify-between gap-2">
            <div>
              <h3 class="font-black text-slate-900 text-sm">{{ shift.icon }} {{ shift.label }} Shift</h3>
              <div class="text-[11px] font-mono text-slate-500">
                {{ shiftHours(shift.code, endDay).tashkent }} Tashkent · {{ shiftHours(shift.code, endDay).eastern }}
              </div>
            </div>
            <div class="text-right">
              <div class="text-2xl font-black text-slate-900 leading-none">{{ stats.byShift[shift.code].total }}</div>
              <div class="text-[10px] text-slate-400 mt-1">{{ shareOf(stats.byShift[shift.code].total, stats.team.total) }} of all</div>
            </div>
          </div>

          <div class="px-4 pb-3 grid grid-cols-5 gap-1 text-center">
            <div v-for="act in ACTION_TYPES" :key="act.code" class="rounded-md bg-slate-50 border border-slate-100 py-1.5" :title="act.label">
              <div class="text-xs">{{ act.icon }}</div>
              <div class="text-sm font-black text-slate-900">{{ stats.byShift[shift.code][act.code] || 0 }}</div>
            </div>
          </div>

          <div class="px-4 py-3 border-t border-slate-100 flex-1">
            <div class="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">Who did them</div>
            <div v-if="stats.byShift[shift.code].staff.length" class="space-y-1">
              <div
                v-for="s in stats.byShift[shift.code].staff"
                :key="s.staffId"
                class="flex items-center justify-between text-xs"
              >
                <span class="font-semibold text-slate-800 truncate">👤 {{ s.displayName }}</span>
                <span class="font-mono font-bold text-slate-900">{{ s.total }}</span>
              </div>
            </div>
            <p v-else class="text-xs text-slate-400">No actions in this period.</p>
            <p class="text-[10px] text-slate-400 mt-2">
              Scheduled now: {{ scheduledNames(shift.code) || 'nobody' }}
            </p>
          </div>
        </div>
      </section>

      <!-- Per staff -->
      <section class="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs">
        <div class="flex items-center justify-between mb-3">
          <h3 class="text-sm font-extrabold text-slate-900">👤 Per Staff Member</h3>
          <span class="text-xs text-slate-500">{{ stats.byStaff.length }} people</span>
        </div>
        <div class="overflow-x-auto">
          <table class="w-full text-left text-xs">
            <thead class="bg-slate-50 text-slate-600 border-b border-slate-200">
              <tr>
                <th class="py-2 px-3 font-bold">Staff Member</th>
                <th class="py-2 px-3 font-bold">Current Shift</th>
                <th v-for="act in ACTION_TYPES" :key="act.code" class="py-2 px-3 font-bold text-center">
                  {{ act.icon }} {{ act.label }}
                </th>
                <th class="py-2 px-3 font-bold text-right">Total</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100">
              <tr v-for="staff in stats.byStaff" :key="staff.staffId" class="hover:bg-slate-50">
                <td class="py-2.5 px-3 font-bold text-slate-900">
                  <div class="flex items-center gap-1.5">
                    <span>{{ staff.role === 'manager' ? '👑' : '👤' }} {{ staff.displayName }}</span>
                    <span v-if="staff.role === 'former'" class="text-[9px] px-1 rounded bg-amber-100 text-amber-800">Former</span>
                    <span v-else-if="!staff.isActive" class="text-[9px] px-1 rounded bg-slate-200 text-slate-600">Deactivated</span>
                  </div>
                </td>
                <td class="py-2.5 px-3">
                  <span
                    v-if="staff.shiftCode"
                    :class="['px-2 py-0.5 rounded border text-[10px] font-bold uppercase', getShiftConfig(staff.shiftCode).color]"
                  >
                    {{ getShiftConfig(staff.shiftCode).icon }} {{ getShiftConfig(staff.shiftCode).label }}
                  </span>
                  <span v-else class="text-slate-400">—</span>
                </td>
                <td v-for="act in ACTION_TYPES" :key="act.code" class="py-2.5 px-3 text-center font-mono font-semibold">
                  {{ staff[act.code] || 0 }}
                </td>
                <td class="py-2.5 px-3 text-right font-mono font-black text-slate-900">{{ staff.total }}</td>
              </tr>
              <tr v-if="stats.byStaff.length === 0">
                <td :colspan="ACTION_TYPES.length + 3" class="py-6 text-center text-slate-400">No team members yet.</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <!-- Day by day (multi-day periods) -->
      <section v-if="dayCount > 1" class="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs">
        <div class="flex items-center justify-between mb-3 flex-wrap gap-2">
          <h3 class="text-sm font-extrabold text-slate-900">📅 Day by Day</h3>
          <!-- Legend -->
          <div class="flex items-center gap-3 text-[11px] text-slate-600 font-semibold">
            <span v-for="shift in SHIFTS" :key="shift.code" class="flex items-center gap-1.5">
              <span class="w-2.5 h-2.5 rounded-sm" :style="{ backgroundColor: shift.accent }"></span>
              {{ shift.label }}
            </span>
          </div>
        </div>
        <div class="overflow-x-auto">
          <table class="w-full text-left text-xs">
            <thead class="bg-slate-50 text-slate-600 border-b border-slate-200">
              <tr>
                <th class="py-2 px-3 font-bold w-40">Work Day</th>
                <th class="py-2 px-3 font-bold">Actions by shift</th>
                <th v-for="shift in SHIFTS" :key="shift.code" class="py-2 px-3 font-bold text-right w-24">{{ shift.label }}</th>
                <th class="py-2 px-3 font-bold text-right w-20">Total</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100">
              <tr v-for="day in stats.byDay" :key="day.date" class="hover:bg-slate-50">
                <td class="py-2 px-3 font-semibold text-slate-800 whitespace-nowrap">{{ formatWorkDay(day.date) }}</td>
                <td class="py-2 px-3">
                  <div class="flex items-center h-3 gap-[2px]" :style="{ width: `${barWidth(day.total)}%` }">
                    <template v-for="shift in SHIFTS" :key="shift.code">
                      <span
                        v-if="day[shift.code]"
                        class="h-full first:rounded-l last:rounded-r"
                        :style="{ flexGrow: day[shift.code], backgroundColor: shift.accent }"
                        :title="`${formatWorkDay(day.date)} · ${shift.label}: ${day[shift.code]} action(s)`"
                      ></span>
                    </template>
                  </div>
                </td>
                <td v-for="shift in SHIFTS" :key="shift.code" class="py-2 px-3 text-right font-mono">{{ day[shift.code] }}</td>
                <td class="py-2 px-3 text-right font-mono font-black text-slate-900">{{ day.total }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue';
import { ACTION_TYPES, fetchActivities, summarizeActivities } from '../services/activityService';
import { staffProfiles, loadTeamRoster } from '../services/authService';
import {
  SHIFTS,
  getShiftConfig,
  shiftHours,
  currentWorkDay,
  addDays,
  monthWindowStart,
  formatWorkDay
} from '../config/shifts';

const props = defineProps({
  // Bumped by the app after this user records an action
  refreshKey: {
    type: Number,
    default: 0
  }
});

// The longest period is one month
const PERIODS = [
  { id: '1d', label: '1 Day', days: 1 },
  { id: '1w', label: '1 Week', days: 7 },
  { id: '2w', label: '2 Weeks', days: 14 },
  { id: '3w', label: '3 Weeks', days: 21 },
  { id: '4w', label: '4 Weeks', days: 28 },
  { id: '1m', label: '1 Month' }
];

const today = currentWorkDay();
const periodId = ref('1d');
const endDay = ref(today);
const activities = ref([]);
const isLoading = ref(false);
const errorMessage = ref('');
let loadSeq = 0;

const fromDay = computed(() => {
  const period = PERIODS.find(p => p.id === periodId.value);
  return period.days ? addDays(endDay.value, -(period.days - 1)) : monthWindowStart(endDay.value);
});

const dayCount = computed(() => {
  const ms = Date.parse(endDay.value) - Date.parse(fromDay.value);
  return Math.round(ms / 86400000) + 1;
});

const rangeLabel = computed(() => (dayCount.value === 1
  ? formatWorkDay(endDay.value)
  : `${formatWorkDay(fromDay.value)} – ${formatWorkDay(endDay.value)} (${dayCount.value} days)`));

const stats = computed(() => summarizeActivities(activities.value, {
  fromDate: fromDay.value,
  toDate: endDay.value,
  staffProfiles: staffProfiles.value
}));

const maxDayTotal = computed(() => Math.max(1, ...stats.value.byDay.map(d => d.total)));

function barWidth(total) {
  return (total / maxDayTotal.value) * 100;
}

function shareOf(count, total) {
  return total ? `${Math.round(((count || 0) / total) * 100)}%` : '0%';
}

function perDay(total) {
  return Math.round((total / dayCount.value) * 10) / 10;
}

function scheduledNames(shiftCode) {
  return staffProfiles.value
    .filter(p => p.isActive && p.shiftCode === shiftCode)
    .map(p => p.displayName)
    .join(', ');
}

async function load() {
  if (!endDay.value) return;
  const seq = ++loadSeq;
  isLoading.value = true;
  errorMessage.value = '';
  try {
    const rows = await fetchActivities({ fromDate: fromDay.value, toDate: endDay.value });
    if (seq === loadSeq) activities.value = rows;
  } catch (err) {
    if (seq === loadSeq) errorMessage.value = `Could not load statistics: ${err.message || err}`;
  } finally {
    if (seq === loadSeq) isLoading.value = false;
  }
}

watch(() => [fromDay.value, endDay.value, props.refreshKey], load);
onMounted(() => {
  load();
  loadTeamRoster().catch(() => {});
});
</script>
