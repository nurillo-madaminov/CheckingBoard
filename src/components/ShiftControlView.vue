<template>
  <div class="cb-page cb-scroll">
    <div class="cb-page-head">
      <div class="title-block">
        <h2 class="cb-title">Shifts</h2>
        <span class="cb-sub">{{ STAFF_PER_SHIFT }} staff per shift. New actions are credited to the shift their author is assigned to.</span>
      </div>
      <div class="cb-spacer"></div>
      <span v-if="isDirty" class="unsaved">Unsaved changes</span>
      <button class="btn btn-secondary" :disabled="!isDirty || isSaving" @click="resetDraft">Discard</button>
      <button class="btn btn-primary" :disabled="!isDirty || isSaving" @click="save">{{ isSaving ? 'Saving…' : 'Save schedule' }}</button>
    </div>

    <div v-if="errorMessage" class="cb-error">{{ errorMessage }}</div>

    <div class="cards">
      <div v-for="shift in SHIFTS" :key="shift.code" class="cb-panel card">
        <div :class="['card-head', { 'is-on': onDuty.includes(shift.code) }]">
          <div class="card-title-row">
            <span class="card-title">{{ shift.label }}</span>
            <span v-if="onDuty.includes(shift.code)" class="duty">On duty now</span>
          </div>
          <span class="tas">{{ hoursOf(shift.code).tashkent }} <span class="tas-unit">TAS</span></span>
          <span class="et">{{ hoursOf(shift.code).eastern }}</span>
        </div>
        <div class="card-body">
          <div v-for="slot in STAFF_PER_SHIFT" :key="slot" class="field">
            <label :for="`slot-${shift.code}-${slot}`">Slot {{ slot }}</label>
            <select
              :id="`slot-${shift.code}-${slot}`"
              :value="draft[shift.code][slot - 1]"
              class="input slot"
              @change="assign(shift.code, slot - 1, $event.target.value)"
            >
              <option value="">— Empty slot —</option>
              <option v-for="member in activeMembers" :key="member.id" :value="member.id">
                {{ member.displayName }}{{ otherShiftLabel(member.id, shift.code) }}
              </option>
            </select>
          </div>
          <div class="week">
            <span>Actions last 7 days</span>
            <span class="week-num">{{ weekCounts[shift.code] ?? '…' }}</span>
          </div>
        </div>
      </div>
    </div>

    <div class="cb-panel unassigned">
      <span class="cb-label">Unassigned · {{ unassigned.length }}</span>
      <div class="chips">
        <span v-for="member in unassigned" :key="member.id" class="chip">
          <span class="cb-avatar chip-avatar">{{ initials(member.displayName) }}</span>{{ member.displayName }}
        </span>
        <span v-if="!unassigned.length" class="cb-sub">Every staff member is on a shift.</span>
      </div>
      <span class="cb-sub small">Actions by unassigned staff are placed by the clock. The 13:00–15:00 overlap counts as Morning.</span>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, watch, onMounted, onUnmounted } from 'vue';
import { SHIFTS, STAFF_PER_SHIFT, getShiftConfig, shiftHours, shiftsOnDuty, currentWorkDay, addDays } from '../config/shifts';
import { staffProfiles, loadTeamRoster, saveShiftSchedule } from '../services/authService';
import { fetchActivities } from '../services/activityService';
import { initials } from '../utils/format';

const props = defineProps({
  // Bumped by the app after this user records an action
  refreshKey: { type: Number, default: 0 }
});

const emit = defineEmits(['saved']);

const activeMembers = computed(() => staffProfiles.value.filter(p => p.isActive));
const draft = reactive(Object.fromEntries(SHIFTS.map(s => [s.code, Array(STAFF_PER_SHIFT).fill('')])));
const isSaving = ref(false);
const errorMessage = ref('');
const onDuty = ref(shiftsOnDuty());
const today = ref(currentWorkDay());
const weekCounts = ref({});
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

function hoursOf(shiftCode) {
  return shiftHours(shiftCode, today.value);
}

// Managers usually don't work a dispatch shift, so they are not listed as unassigned
const unassigned = computed(() => activeMembers.value.filter(m => m.role !== 'manager' && !shiftOf(m.id)));

async function loadWeekCounts() {
  try {
    const rows = await fetchActivities({ fromDate: addDays(today.value, -6), toDate: today.value });
    weekCounts.value = Object.fromEntries(SHIFTS.map(s => [s.code, rows.filter(r => r.shift_code === s.code).length]));
  } catch (err) {
    console.warn('Could not load weekly shift counts:', err);
  }
}

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

watch(() => props.refreshKey, loadWeekCounts);

onMounted(() => {
  resetDraft();
  loadTeamRoster().then(resetDraft).catch(err => { errorMessage.value = err.message; });
  loadWeekCounts();
  clockTimer = setInterval(() => {
    onDuty.value = shiftsOnDuty();
    today.value = currentWorkDay();
  }, 60000);
});

onUnmounted(() => clearInterval(clockTimer));
</script>

<style scoped>
.title-block { display: flex; flex-direction: column; gap: 1px; }
.unsaved { font-size: 13px; color: var(--color-accent-700); }

.cards { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 14px; }
.card { display: flex; flex-direction: column; }
.card-head {
  padding: 16px; display: flex; flex-direction: column; gap: 2px;
  background: var(--color-neutral-200); color: var(--color-text); border-bottom: 1px solid var(--color-divider);
}
.card-head.is-on { background: var(--color-accent-900); color: var(--color-bg); }
.card-title-row { display: flex; justify-content: space-between; align-items: center; gap: 8px; }
.card-title { font-family: var(--font-heading); font-weight: 600; font-size: 24px; text-transform: uppercase; }
.duty { font-size: 10px; letter-spacing: 0.1em; text-transform: uppercase; background: var(--color-accent); color: var(--color-bg); padding: 3px 7px; }
.tas { font-family: var(--font-heading); font-size: 18px; }
.tas-unit { font-size: 13px; opacity: 0.7; }
.et { font-size: 12px; opacity: 0.75; }
.card-body { padding: 16px; display: flex; flex-direction: column; gap: 12px; }
.slot { font-size: 14px; background-color: var(--color-bg); }
.week { display: flex; justify-content: space-between; font-size: 12px; color: var(--color-neutral-700); padding-top: 4px; }
.week-num { font-family: var(--font-heading); font-size: 15px; color: var(--color-text); }

.unassigned { padding: 16px; display: flex; flex-direction: column; gap: 10px; }
.chips { display: flex; flex-wrap: wrap; gap: 8px; }
.chip {
  display: flex; align-items: center; gap: 8px; font-size: 13px; padding: 3px 10px 3px 3px;
  border: 1px solid var(--color-divider); background: var(--color-bg);
}
.chip-avatar { width: 22px; height: 22px; font-size: 9px; }
.small { font-size: 12px; }

@media (max-width: 1100px) { .cards { grid-template-columns: 1fr; } }
</style>
