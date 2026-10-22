<template>
  <div class="h-full overflow-auto bg-slate-100 p-4 md:p-6 space-y-5 select-text">
    <!-- Header -->
    <header class="flex items-center justify-between flex-wrap gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
      <div>
        <h2 class="text-lg font-black text-slate-900 tracking-tight flex items-center gap-2">
          <span>🗓️ Shift Control Panel</span>
          <span class="text-xs font-bold px-2.5 py-0.5 rounded-full bg-purple-100 text-purple-800 border border-purple-300">
            Manager Access
          </span>
        </h2>
        <p class="text-xs text-slate-500 mt-0.5">
          {{ STAFF_PER_SHIFT }} staff per shift. Hours are Tashkent time (UTC+5); US Eastern shown for today.
          Every action is credited to the shift its author is assigned to when they click it.
        </p>
      </div>

      <div class="flex items-center gap-2">
        <span v-if="isDirty" class="text-xs font-semibold text-amber-700">Unsaved changes</span>
        <button
          v-if="isDirty"
          @click="resetDraft"
          :disabled="isSaving"
          class="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 text-xs font-bold transition-colors"
        >
          Discard
        </button>
        <button
          @click="save"
          :disabled="!isDirty || isSaving"
          class="px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 disabled:hover:bg-indigo-600 text-white text-xs font-bold shadow-2xs transition-all active:scale-95"
        >
          {{ isSaving ? 'Saving...' : 'Save Schedule' }}
        </button>
      </div>
    </header>

    <div
      v-if="errorMessage"
      class="p-3 rounded-lg text-xs font-semibold bg-rose-50 text-rose-800 border border-rose-200 flex items-center justify-between"
    >
      <span>{{ errorMessage }}</span>
      <button @click="errorMessage = ''" class="font-bold opacity-70 hover:opacity-100">✕</button>
    </div>

    <!-- Shift cards -->
    <section class="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <div
        v-for="shift in SHIFTS"
        :key="shift.code"
        class="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden flex flex-col"
      >
        <div class="px-4 py-3 border-b border-slate-100 flex items-start justify-between gap-2" :style="{ borderTop: `4px solid ${shift.accent}` }">
          <div>
            <div class="flex items-center gap-2">
              <span class="text-xl">{{ shift.icon }}</span>
              <h3 class="font-black text-slate-900 text-sm">{{ shift.label }} Shift</h3>
              <span
                v-if="onDuty.includes(shift.code)"
                class="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center gap-1"
              >
                <span class="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                On duty now
              </span>
            </div>
            <div class="mt-1 text-xs font-mono font-bold text-slate-800">{{ hoursOf(shift.code).tashkent }} <span class="font-sans font-semibold text-slate-400">Tashkent</span></div>
            <div class="text-[11px] font-mono text-slate-500">{{ hoursOf(shift.code).eastern }}</div>
          </div>
          <span class="text-[11px] font-bold text-slate-500 shrink-0">
            {{ filledCount(shift.code) }}/{{ STAFF_PER_SHIFT }}
          </span>
        </div>

        <div class="p-4 space-y-2.5 flex-1">
          <div v-for="slot in STAFF_PER_SHIFT" :key="slot" class="flex flex-col gap-1">
            <label class="text-[10px] font-bold uppercase tracking-wider text-slate-500">Staff {{ slot }}</label>
            <select
              :value="draft[shift.code][slot - 1]"
              @change="assign(shift.code, slot - 1, $event.target.value)"
              :class="[
                'px-2.5 py-2 rounded-lg border text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500',
                draft[shift.code][slot - 1] ? 'border-slate-300 bg-white text-slate-900' : 'border-dashed border-slate-300 bg-slate-50 text-slate-400'
              ]"
            >
              <option value="">— Empty —</option>
              <option v-for="member in activeMembers" :key="member.id" :value="member.id">
                {{ member.displayName }}{{ member.role === 'manager' ? ' (manager)' : '' }}{{ otherShiftLabel(member.id, shift.code) }}
              </option>
            </select>
          </div>
        </div>
      </div>
    </section>

    <!-- Unassigned -->
    <section class="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
      <h3 class="text-sm font-extrabold text-slate-900 mb-1">Not on any shift</h3>
      <p class="text-[11px] text-slate-500 mb-3">
        Actions by someone with no shift are placed by the clock (Tashkent 07:00–15:00 Morning, 15:00–23:00 Afternoon, 23:00–07:00 Night).
      </p>
      <div v-if="unassigned.length" class="flex flex-wrap gap-2">
        <span
          v-for="member in unassigned"
          :key="member.id"
          class="px-2.5 py-1 rounded-lg bg-slate-100 border border-slate-200 text-xs font-semibold text-slate-700"
        >
          {{ member.role === 'manager' ? '👑' : '👤' }} {{ member.displayName }}
        </span>
      </div>
      <p v-else class="text-xs text-slate-400">Everyone is scheduled.</p>
    </section>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, onUnmounted } from 'vue';
import { SHIFTS, STAFF_PER_SHIFT, getShiftConfig, shiftHours, shiftsOnDuty, currentWorkDay } from '../config/shifts';
import { staffProfiles, loadTeamRoster, saveShiftSchedule } from '../services/authService';

const emit = defineEmits(['saved']);

const activeMembers = computed(() => staffProfiles.value.filter(p => p.isActive));
const draft = reactive(Object.fromEntries(SHIFTS.map(s => [s.code, Array(STAFF_PER_SHIFT).fill('')])));
const isSaving = ref(false);
const errorMessage = ref('');
const onDuty = ref(shiftsOnDuty());
const today = ref(currentWorkDay());
let clockTimer = null;

// The schedule as it is saved in the database
function savedSchedule() {
  const schedule = {};
  SHIFTS.forEach(s => {
    const ids = activeMembers.value.filter(p => p.shiftCode === s.code).map(p => p.id);
    schedule[s.code] = Array.from({ length: STAFF_PER_SHIFT }, (_, i) => ids[i] || '');
  });
  return schedule;
}

function resetDraft() {
  const saved = savedSchedule();
  SHIFTS.forEach(s => { draft[s.code] = [...saved[s.code]]; });
  errorMessage.value = '';
}

const isDirty = computed(() => {
  const saved = savedSchedule();
  return SHIFTS.some(s => {
    const a = [...draft[s.code]].filter(Boolean).sort().join(',');
    const b = [...saved[s.code]].filter(Boolean).sort().join(',');
    return a !== b;
  });
});

// Picking someone already on another shift moves them here
function assign(shiftCode, slotIdx, memberId) {
  if (memberId) {
    SHIFTS.forEach(s => {
      draft[s.code] = draft[s.code].map(id => (id === memberId ? '' : id));
    });
  }
  draft[shiftCode][slotIdx] = memberId;
}

function shiftOf(memberId) {
  return SHIFTS.find(s => draft[s.code].includes(memberId))?.code || '';
}

function otherShiftLabel(memberId, shiftCode) {
  const code = shiftOf(memberId);
  return code && code !== shiftCode ? ` — on ${getShiftConfig(code).label}` : '';
}

function filledCount(shiftCode) {
  return draft[shiftCode].filter(Boolean).length;
}

function hoursOf(shiftCode) {
  return shiftHours(shiftCode, today.value);
}

const unassigned = computed(() => activeMembers.value.filter(m => !shiftOf(m.id)));

async function save() {
  isSaving.value = true;
  errorMessage.value = '';
  try {
    const schedule = Object.fromEntries(SHIFTS.map(s => [s.code, draft[s.code].filter(Boolean)]));
    await saveShiftSchedule(schedule);
    resetDraft();
    emit('saved');
  } catch (err) {
    errorMessage.value = err.message || 'Could not save the schedule';
  } finally {
    isSaving.value = false;
  }
}

onMounted(() => {
  resetDraft();
  loadTeamRoster().then(resetDraft).catch(err => { errorMessage.value = err.message; });
  clockTimer = setInterval(() => {
    onDuty.value = shiftsOnDuty();
    today.value = currentWorkDay();
  }, 60000);
});

onUnmounted(() => clearInterval(clockTimer));
</script>
