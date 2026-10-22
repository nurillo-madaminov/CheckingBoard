<template>
  <div class="h-full flex flex-col bg-white overflow-hidden select-text">
    <!-- Filters -->
    <header class="bg-slate-50 border-b border-slate-200 px-4 py-3 shrink-0 flex flex-col gap-3">
      <div class="flex items-center justify-between flex-wrap gap-2">
        <div class="flex items-center gap-3">
          <div class="w-7 h-7 rounded-lg bg-indigo-600 text-white flex items-center justify-center font-bold text-xs shadow-xs">
            📜
          </div>
          <div>
            <h2 class="text-sm font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
              <span>Action Logs</span>
              <span
                :class="[
                  'text-[10px] font-bold px-2 py-0.5 rounded-full border',
                  isManager
                    ? 'bg-purple-100 text-purple-800 border-purple-300'
                    : 'bg-emerald-100 text-emerald-800 border-emerald-300'
                ]"
              >
                {{ isManager ? 'Manager View (All Staff)' : 'Staff View (Your Records Only)' }}
              </span>
            </h2>
            <p class="text-[11px] text-slate-500">
              Recorded only when someone clicks an action button (Shift, Cycle, Fix Log, Break, Connect). Records cannot be edited or deleted.
            </p>
          </div>
        </div>

        <div class="flex items-center gap-2 text-xs">
          <span class="text-slate-500 font-medium">Records:</span>
          <span class="px-2.5 py-0.5 font-bold rounded-full bg-slate-200 text-slate-800 border border-slate-300">
            {{ isLoading ? '…' : visibleActivities.length }}
          </span>
          <button
            @click="load"
            class="px-2 py-1 rounded-md bg-white hover:bg-slate-100 border border-slate-300 font-semibold text-slate-700"
            title="Reload from the database"
          >
            ↻ Refresh
          </button>
        </div>
      </div>

      <div class="flex flex-wrap items-end gap-3 text-xs">
        <!-- Work day -->
        <div class="flex flex-col gap-1">
          <label class="text-[10px] font-bold uppercase tracking-wider text-slate-500">Work Day</label>
          <div class="flex items-center gap-1">
            <button @click="shiftDay(-1)" class="px-2 py-1.5 rounded-md border border-slate-300 bg-white hover:bg-slate-100 font-bold" title="Previous day">◀</button>
            <input
              v-model="filters.day"
              type="date"
              :max="today"
              class="px-2.5 py-1.5 rounded-md border border-slate-300 bg-white text-slate-800 font-medium focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
            <button @click="shiftDay(1)" :disabled="filters.day >= today" class="px-2 py-1.5 rounded-md border border-slate-300 bg-white hover:bg-slate-100 font-bold disabled:opacity-40" title="Next day">▶</button>
            <button
              v-if="filters.day !== today"
              @click="filters.day = today"
              class="px-2 py-1.5 text-indigo-600 hover:text-indigo-800 font-semibold"
            >
              Today
            </button>
          </div>
        </div>

        <!-- Shift (manager only: staff see just the actions they recorded) -->
        <div v-if="isManager" class="flex flex-col gap-1">
          <label class="text-[10px] font-bold uppercase tracking-wider text-slate-500">Shift</label>
          <div class="flex items-center gap-0.5 bg-slate-200/70 p-0.5 rounded-lg font-semibold">
            <button
              v-for="opt in shiftOptions"
              :key="opt.code"
              @click="filters.shift = opt.code"
              :class="[
                'px-2.5 py-1 rounded-md transition-colors',
                filters.shift === opt.code ? 'bg-white text-slate-900 shadow-2xs font-bold' : 'text-slate-600 hover:text-slate-900'
              ]"
            >
              {{ opt.icon }} {{ opt.label }}
            </button>
          </div>
        </div>

        <!-- Staff (manager only) -->
        <div v-if="isManager" class="flex flex-col gap-1">
          <label class="text-[10px] font-bold uppercase tracking-wider text-slate-500">Staff Member</label>
          <select
            v-model="filters.staffUserId"
            class="px-2.5 py-1.5 rounded-md border border-slate-300 bg-white text-slate-800 font-medium focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            <option value="">All staff</option>
            <option v-for="staff in staffProfiles" :key="staff.id" :value="staff.id">
              {{ staff.displayName }}
            </option>
          </select>
        </div>

        <!-- Action -->
        <div class="flex flex-col gap-1">
          <label class="text-[10px] font-bold uppercase tracking-wider text-slate-500">Action</label>
          <select
            v-model="filters.actionType"
            class="px-2.5 py-1.5 rounded-md border border-slate-300 bg-white text-slate-800 font-medium focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            <option value="">All actions</option>
            <option v-for="act in ACTION_TYPES" :key="act.code" :value="act.code">
              {{ act.icon }} {{ act.label }}
            </option>
          </select>
        </div>

        <!-- Driver search -->
        <div class="flex flex-col gap-1 min-w-[180px] flex-1 max-w-xs">
          <label class="text-[10px] font-bold uppercase tracking-wider text-slate-500">Driver / Company</label>
          <input
            v-model="filters.search"
            type="text"
            placeholder="Search driver, unit or company..."
            class="px-2.5 py-1.5 rounded-md border border-slate-300 bg-white text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>
      </div>

      <!-- What is being shown -->
      <div class="flex items-center flex-wrap gap-x-3 gap-y-1 text-[11px] text-slate-600">
        <span class="font-bold text-slate-800">{{ formatWorkDay(filters.day) }}</span>
        <template v-if="!isManager">
          <span>·</span>
          <span>Actions you recorded</span>
        </template>
        <template v-else-if="filters.shift">
          <span>·</span>
          <span>{{ selectedShift.icon }} {{ selectedShift.label }} shift</span>
          <span class="font-mono">{{ selectedShiftHours.tashkent }} Tashkent</span>
          <span class="font-mono text-slate-400">({{ selectedShiftHours.eastern }})</span>
        </template>
        <template v-else>
          <span>·</span>
          <span>All 3 shifts (Tashkent 07:00 to 07:00 next day)</span>
        </template>
        <span class="ml-auto flex items-center gap-1.5">
          <span
            v-for="act in ACTION_TYPES"
            :key="act.code"
            :class="['px-1.5 py-0.5 rounded border font-bold', act.color]"
            :title="act.label"
          >
            {{ act.icon }} {{ actionCounts[act.code] || 0 }}
          </span>
        </span>
      </div>
    </header>

    <div v-if="errorMessage" class="px-4 py-2 text-xs font-semibold bg-rose-50 text-rose-800 border-b border-rose-200">
      {{ errorMessage }}
    </div>

    <!-- Table -->
    <div class="flex-1 overflow-auto">
      <table class="w-full text-left table-grid border-separate table-fixed">
        <colgroup>
          <col style="width: 52px;" />
          <col style="width: 150px;" />
          <col style="width: 120px;" />
          <col style="width: 170px;" />
          <col style="width: 240px;" />
          <col style="width: 140px;" />
          <col />
        </colgroup>

        <thead class="sticky top-0 z-20 bg-slate-100 text-slate-700 text-xs font-bold uppercase tracking-wider shadow-xs">
          <tr>
            <th class="px-2 py-2.5 border-b border-r border-slate-300 text-center bg-slate-200/90">#</th>
            <th class="px-3 py-2.5 border-b border-r border-slate-300">Time</th>
            <th class="px-3 py-2.5 border-b border-r border-slate-300">Shift</th>
            <th class="px-3 py-2.5 border-b border-r border-slate-300">Staff Member</th>
            <th class="px-3 py-2.5 border-b border-r border-slate-300">Driver</th>
            <th class="px-3 py-2.5 border-b border-r border-slate-300 text-center">Action</th>
            <th class="px-4 py-2.5 border-b border-slate-300">Note</th>
          </tr>
        </thead>

        <tbody>
          <tr v-if="isLoading">
            <td colspan="7" class="text-center py-16 text-slate-400 text-xs font-semibold">Loading records…</td>
          </tr>

          <tr v-else-if="visibleActivities.length === 0">
            <td colspan="7" class="text-center py-16 text-slate-400">
              <div class="text-3xl mb-2">📋</div>
              <p class="font-bold text-slate-600">No actions recorded</p>
              <p class="text-xs text-slate-400 mt-1">Try another day, shift or filter.</p>
            </td>
          </tr>

          <template v-else>
          <tr
            v-for="(activity, index) in visibleActivities"
            :key="activity.id"
            class="hover:bg-slate-50 text-xs text-slate-800 transition-colors"
          >
            <td class="px-2 py-2.5 text-center font-mono font-bold border-b border-r border-slate-200 text-slate-500 bg-slate-50 select-none">
              {{ index + 1 }}
            </td>

            <td class="px-3 py-2.5 border-b border-r border-slate-200 font-mono">
              <div class="text-xs font-bold text-slate-900" title="Tashkent time">{{ formatTashkentTime(activity.action_at) }}</div>
              <div class="text-[10px] text-slate-400" title="US Eastern time">{{ formatEasternDateTime(activity.action_at) }} ET</div>
            </td>

            <td class="px-3 py-2.5 border-b border-r border-slate-200">
              <span :class="['px-2 py-0.5 rounded border text-[10px] font-bold uppercase', getShiftConfig(activity.shift_code).color]">
                {{ getShiftConfig(activity.shift_code).icon }} {{ getShiftConfig(activity.shift_code).label }}
              </span>
            </td>

            <td class="px-3 py-2.5 border-b border-r border-slate-200 font-bold text-slate-900 truncate" :title="activity.staff_name_snapshot">
              👤 {{ activity.staff_name_snapshot || 'Unknown' }}
            </td>

            <td class="px-3 py-2.5 border-b border-r border-slate-200 truncate">
              <div class="flex items-center gap-1.5 truncate">
                <span class="truncate font-semibold text-slate-900" :title="activity.driver_name_snapshot">
                  {{ activity.driver_name_snapshot || '—' }}
                </span>
                <span
                  v-if="isDriverDeleted(activity)"
                  class="px-1.5 rounded text-[9px] font-bold bg-amber-100 text-amber-800 border border-amber-300 shrink-0"
                  title="This driver was removed from the fleet; the record is kept"
                >
                  Deleted
                </span>
              </div>
              <div v-if="activity.company_name_snapshot" class="text-[10px] text-slate-400 font-medium truncate">
                {{ activity.company_name_snapshot }}
              </div>
            </td>

            <td class="px-3 py-2.5 border-b border-r border-slate-200 text-center">
              <span :class="['px-2 py-1 rounded text-[11px] font-bold uppercase border inline-block truncate max-w-full', getActionTypeConfig(activity.action_type).color]">
                {{ getActionTypeConfig(activity.action_type).icon }} {{ getActionTypeConfig(activity.action_type).label }}
              </span>
            </td>

            <td class="px-4 py-2.5 border-b border-slate-200 text-slate-700 truncate" :title="activity.extra_note || ''">
              {{ activity.extra_note || '—' }}
            </td>
          </tr>
          </template>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, watch, onMounted } from 'vue';
import { ACTION_TYPES, getActionTypeConfig, fetchActivities } from '../services/activityService';
import { isCurrentUserManager, staffProfiles as roster } from '../services/authService';
import {
  SHIFTS,
  getShiftConfig,
  shiftHours,
  currentWorkDay,
  addDays,
  formatWorkDay,
  formatTashkentTime,
  formatEasternDateTime
} from '../config/shifts';

const props = defineProps({
  activeDrivers: {
    type: Array,
    default: () => []
  },
  // Bumped by the app after this user records an action
  refreshKey: {
    type: Number,
    default: 0
  }
});

const isManager = computed(() => isCurrentUserManager());
const staffProfiles = computed(() => roster.value);
const today = currentWorkDay();

const shiftOptions = [
  { code: '', label: 'All', icon: '🕒' },
  ...SHIFTS.map(s => ({ code: s.code, label: s.label, icon: s.icon }))
];

const filters = reactive({
  day: today,
  shift: '',
  staffUserId: '',
  actionType: '',
  search: ''
});

const activities = ref([]);
const isLoading = ref(false);
const errorMessage = ref('');
let loadSeq = 0;

const selectedShift = computed(() => getShiftConfig(filters.shift));
const selectedShiftHours = computed(() => shiftHours(filters.shift, filters.day));

async function load() {
  if (!filters.day) return;
  const seq = ++loadSeq;
  isLoading.value = true;
  errorMessage.value = '';
  try {
    const rows = await fetchActivities({
      fromDate: filters.day,
      toDate: filters.day,
      shiftCode: isManager.value ? filters.shift : '',
      staffUserId: isManager.value ? filters.staffUserId : '',
      actionType: filters.actionType
    });
    if (seq === loadSeq) activities.value = rows;
  } catch (err) {
    if (seq === loadSeq) {
      activities.value = [];
      errorMessage.value = `Could not load records: ${err.message || err}`;
    }
  } finally {
    if (seq === loadSeq) isLoading.value = false;
  }
}

function shiftDay(n) {
  const next = addDays(filters.day || today, n);
  if (next <= today) filters.day = next;
}

// Driver / company search runs on the loaded day
const visibleActivities = computed(() => {
  const q = filters.search.trim().toLowerCase();
  if (!q) return activities.value;
  return activities.value.filter(a =>
    (a.driver_name_snapshot || '').toLowerCase().includes(q) ||
    (a.company_name_snapshot || '').toLowerCase().includes(q)
  );
});

const actionCounts = computed(() => {
  const counts = {};
  visibleActivities.value.forEach(a => { counts[a.action_type] = (counts[a.action_type] || 0) + 1; });
  return counts;
});

function isDriverDeleted(activity) {
  if (!activity.driver_name_snapshot) return false;
  if (!activity.driver_id) return true;
  return !props.activeDrivers.some(d => d.id === activity.driver_id);
}

watch(() => [filters.day, filters.shift, filters.staffUserId, filters.actionType, props.refreshKey], load);
onMounted(load);
</script>
