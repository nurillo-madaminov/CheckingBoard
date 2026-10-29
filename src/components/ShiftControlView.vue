<template>
  <div class="cb-page cb-scroll">
    <div class="cb-page-head">
      <div class="title-block">
        <h2 class="cb-title">Shifts</h2>
        <span class="cb-sub">Put any number of people on each shift and set its hours. New actions are credited to the shift their author is assigned to.</span>
      </div>
      <div class="cb-spacer"></div>
      <div class="head-actions">
        <span v-if="isDirty" class="unsaved">Unsaved changes</span>
        <button class="btn btn-secondary" :disabled="!isDirty || isSaving" @click="resetDraft">Discard</button>
        <button class="btn btn-primary" :disabled="!isDirty || isSaving" @click="save">{{ isSaving ? 'Saving…' : 'Save schedule' }}</button>
      </div>
    </div>

    <div v-if="errorMessage" class="cb-error">{{ errorMessage }}</div>

    <div class="cards">
      <div v-for="shift in SHIFTS" :key="shift.code" class="cb-panel card">
        <div :class="['card-head', { 'is-on': onDuty.includes(shift.code) }]">
          <div class="card-title-row">
            <span class="card-title">{{ shift.label }}</span>
            <span v-if="onDuty.includes(shift.code)" class="duty">On duty now</span>
          </div>
          <span class="tas">{{ todayHours(shift.code).tashkent }} <span class="tas-unit">TAS · today</span></span>
          <span class="et">{{ todayHours(shift.code).eastern }}</span>
        </div>

        <div class="card-body">
          <!-- Hours: one range for every day, or one per weekday -->
          <div class="section">
            <div class="section-head">
              <span class="cb-label">Hours (Tashkent)</span>
              <button type="button" class="link-btn" @click="togglePerDay(shift.code)">
                {{ hoursDraft[shift.code].perDay ? 'Same every day' : 'Different per day' }}
              </button>
            </div>

            <div v-if="!hoursDraft[shift.code].perDay" class="hours-row">
              <span class="day-label">Every day</span>
              <input v-model="hoursDraft[shift.code].all.start" type="time" class="input time" :aria-label="`${shift.label} start`" />
              <span class="dash">–</span>
              <input v-model="hoursDraft[shift.code].all.end" type="time" class="input time" :aria-label="`${shift.label} end`" />
              <span v-if="endsNextDay(hoursDraft[shift.code].all)" class="next-day" title="Ends the next day">+1</span>
            </div>

            <template v-else>
              <div v-for="day in WEEKDAYS" :key="day.iso" :class="['hours-row', { 'is-today': day.iso === todayIso }]">
                <span class="day-label" :title="day.label">{{ day.short }}</span>
                <input v-model="hoursDraft[shift.code].days[day.iso].start" type="time" class="input time" :aria-label="`${shift.label} ${day.label} start`" />
                <span class="dash">–</span>
                <input v-model="hoursDraft[shift.code].days[day.iso].end" type="time" class="input time" :aria-label="`${shift.label} ${day.label} end`" />
                <span v-if="endsNextDay(hoursDraft[shift.code].days[day.iso])" class="next-day" title="Ends the next day">+1</span>
              </div>
            </template>
          </div>

          <!-- People: any number -->
          <div class="section">
            <div class="section-head">
              <span class="cb-label">People · {{ draft[shift.code].length }}</span>
            </div>
            <div v-for="id in draft[shift.code]" :key="id" class="person">
              <span class="cb-avatar person-avatar">{{ initials(nameOf(id)) }}</span>
              <span class="cb-ellipsis person-name">{{ nameOf(id) }}</span>
              <button type="button" class="btn btn-ghost btn-icon remove" :title="`Remove ${nameOf(id)} from ${shift.label}`" @click="unassign(shift.code, id)">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>
              </button>
            </div>
            <span v-if="!draft[shift.code].length" class="cb-sub small">Nobody on this shift yet.</span>
            <select
              class="input add-person"
              value=""
              :aria-label="`Add a person to ${shift.label}`"
              :disabled="!addableFor(shift.code).length"
              @change="assign(shift.code, $event.target.value); $event.target.value = ''"
            >
              <option value="">{{ addableFor(shift.code).length ? '+ Add a person…' : 'Everyone is on this shift' }}</option>
              <option v-for="member in addableFor(shift.code)" :key="member.id" :value="member.id">
                {{ member.displayName }}{{ otherShiftLabel(member.id) }}
              </option>
            </select>
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
      <span class="cb-sub small">Actions by unassigned staff are placed by the clock; where shifts overlap, the one that started first counts. A shift ending at or before its start time ends the next day (+1).</span>
    </div>

    <!-- Managers only (the database rejects staff too) -->
    <OfficeLocationCard
      v-if="isManager"
      @saved="emit('office-saved', $event)"
      @error="emit('office-error', $event)"
    />
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, onUnmounted, defineAsyncComponent } from 'vue';
import {
  SHIFTS, WEEKDAYS, getShiftConfig, shiftHours, shiftsOnDuty, currentWorkDay,
  isoWeekday, customShiftHours, formatMinutes, parseMinutes
} from '../config/shifts';
import {
  staffProfiles, loadTeamRoster, loadShiftHours, saveShiftSchedule, saveShiftHours, isCurrentUserManager
} from '../services/authService';
import { initials } from '../utils/format';
// Loaded on demand: the map library is only needed here, by managers
const OfficeLocationCard = defineAsyncComponent(() => import('./OfficeLocationCard.vue'));

const emit = defineEmits(['saved', 'office-saved', 'office-error']);

const isManager = computed(() => isCurrentUserManager());
const activeMembers = computed(() => staffProfiles.value.filter(p => p.isActive));
const draft = reactive(Object.fromEntries(SHIFTS.map(s => [s.code, []])));
// Per shift: { perDay, all: { start, end }, days: { 1: { start, end }, ... 7 } } as 'HH:MM'
const hoursDraft = reactive(Object.fromEntries(SHIFTS.map(s => [s.code, emptyHours(s)])));
const isSaving = ref(false);
const errorMessage = ref('');
const onDuty = ref(shiftsOnDuty());
const today = ref(currentWorkDay());
const todayIso = computed(() => isoWeekday(today.value));
let clockTimer = null;

function defaultRange(shift) {
  return { start: formatMinutes(shift.startMin), end: formatMinutes(shift.endMin) };
}

function emptyHours(shift) {
  return {
    perDay: false,
    all: defaultRange(shift),
    days: Object.fromEntries(WEEKDAYS.map(d => [d.iso, defaultRange(shift)]))
  };
}

// ---------------- saved state ----------------
// The people schedule as it is saved in the database
function savedSchedule() {
  return Object.fromEntries(SHIFTS.map(s => [
    s.code,
    activeMembers.value.filter(p => p.shiftCode === s.code).map(p => p.id)
  ]));
}

// Saved hours of a shift on a weekday, as 'HH:MM'
function savedRange(code, iso) {
  const custom = customShiftHours.value[`${code}-${iso}`];
  if (!custom) return defaultRange(getShiftConfig(code));
  return { start: formatMinutes(custom.startMin), end: formatMinutes(custom.endMin) };
}

const sameRange = (a, b) => a.start === b.start && a.end === b.end;

function resetDraft() {
  const saved = savedSchedule();
  SHIFTS.forEach(s => {
    draft[s.code] = [...saved[s.code]];
    const days = Object.fromEntries(WEEKDAYS.map(d => [d.iso, savedRange(s.code, d.iso)]));
    const perDay = WEEKDAYS.some(d => !sameRange(days[d.iso], days[1]));
    hoursDraft[s.code] = { perDay, all: { ...days[1] }, days };
  });
  errorMessage.value = '';
}

// ---------------- hours ----------------
// The range that applies on a weekday in the draft
function draftRange(code, iso) {
  const h = hoursDraft[code];
  return h.perDay ? h.days[iso] : h.all;
}

function togglePerDay(code) {
  const h = hoursDraft[code];
  if (h.perDay) {
    // Back to one range: keep today's
    h.all = { ...h.days[todayIso.value] };
  } else {
    WEEKDAYS.forEach(d => { h.days[d.iso] = { ...h.all }; });
  }
  h.perDay = !h.perDay;
}

function endsNextDay(range) {
  const start = parseMinutes(range.start);
  const end = parseMinutes(range.end);
  return start !== null && end !== null && end < start;
}

function todayHours(code) {
  const range = draftRange(code, todayIso.value);
  const startMin = parseMinutes(range.start);
  const endMin = parseMinutes(range.end);
  if (startMin === null || endMin === null || startMin === endMin) {
    return { tashkent: '— : —', eastern: 'Set a start and end time' };
  }
  return shiftHours(code, today.value, { startMin, endMin });
}

const hoursDirty = computed(() => SHIFTS.some(s => WEEKDAYS.some(d =>
  !sameRange(draftRange(s.code, d.iso), savedRange(s.code, d.iso))
)));

// Rows for save_shift_hours; days on the default hours are left out
function hoursRows() {
  const rows = [];
  for (const s of SHIFTS) {
    for (const d of WEEKDAYS) {
      const range = draftRange(s.code, d.iso);
      const startMin = parseMinutes(range.start);
      const endMin = parseMinutes(range.end);
      const where = hoursDraft[s.code].perDay ? `${s.label} on ${d.label}` : s.label;
      if (startMin === null || endMin === null) throw new Error(`Set both a start and an end time for ${where}.`);
      if (startMin === endMin) throw new Error(`${where} starts and ends at the same time.`);
      if (startMin === s.startMin && endMin === s.endMin) continue;
      rows.push({ shift_code: s.code, weekday: d.iso, start_min: startMin, end_min: endMin });
    }
  }
  return rows;
}

// ---------------- people ----------------
const peopleDirty = computed(() => {
  const saved = savedSchedule();
  return SHIFTS.some(s => [...draft[s.code]].sort().join(',') !== [...saved[s.code]].sort().join(','));
});

const isDirty = computed(() => peopleDirty.value || hoursDirty.value);

// Adding someone who is on another shift moves them here
function assign(shiftCode, memberId) {
  if (!memberId) return;
  SHIFTS.forEach(s => {
    draft[s.code] = draft[s.code].filter(id => id !== memberId);
  });
  draft[shiftCode] = [...draft[shiftCode], memberId];
}

function unassign(shiftCode, memberId) {
  draft[shiftCode] = draft[shiftCode].filter(id => id !== memberId);
}

function shiftOf(memberId) {
  return SHIFTS.find(s => draft[s.code].includes(memberId))?.code || '';
}

function addableFor(shiftCode) {
  return activeMembers.value.filter(m => !draft[shiftCode].includes(m.id));
}

function otherShiftLabel(memberId) {
  const code = shiftOf(memberId);
  return code ? ` — on ${getShiftConfig(code).label}` : '';
}

function nameOf(memberId) {
  return staffProfiles.value.find(p => p.id === memberId)?.displayName || 'Unknown';
}

// Managers usually don't work a dispatch shift, so they are not listed as unassigned
const unassigned = computed(() => activeMembers.value.filter(m => m.role !== 'manager' && !shiftOf(m.id)));

// ---------------- load & save ----------------
async function save() {
  isSaving.value = true;
  errorMessage.value = '';
  try {
    if (hoursDirty.value) await saveShiftHours(hoursRows());
    if (peopleDirty.value) {
      await saveShiftSchedule(Object.fromEntries(SHIFTS.map(s => [s.code, draft[s.code]])));
    }
    onDuty.value = shiftsOnDuty();
    today.value = currentWorkDay();
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
  Promise.all([loadTeamRoster(), loadShiftHours()])
    .then(() => {
      onDuty.value = shiftsOnDuty();
      today.value = currentWorkDay();
      resetDraft();
    })
    .catch(err => { errorMessage.value = err.message; });
  clockTimer = setInterval(() => {
    onDuty.value = shiftsOnDuty();
    today.value = currentWorkDay();
  }, 60000);
});

onUnmounted(() => clearInterval(clockTimer));
</script>

<style scoped>
.title-block { display: flex; flex-direction: column; gap: 1px; min-width: 0; }
.head-actions { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.unsaved { font-size: 13px; color: var(--color-accent-700); }

.cards { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 14px; align-items: start; }
.card { display: flex; flex-direction: column; min-width: 0; }
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
.card-body { padding: 16px; display: flex; flex-direction: column; gap: 18px; }

.section { display: flex; flex-direction: column; gap: 8px; }
.section-head { display: flex; justify-content: space-between; align-items: baseline; gap: 8px; }
.link-btn {
  border: 0; background: transparent; padding: 0; cursor: pointer; font: inherit; font-size: 12px;
  color: var(--color-accent-700); text-decoration: underline; text-underline-offset: 2px;
}
.link-btn:hover { color: var(--color-accent-900); }

.hours-row { display: grid; grid-template-columns: 64px minmax(0, 1fr) auto minmax(0, 1fr) 22px; align-items: center; gap: 6px; }
.hours-row.is-today .day-label { color: var(--color-accent-700); font-weight: 600; }
.day-label { font-size: 13px; color: var(--color-neutral-800); white-space: nowrap; }
.time { font-size: 14px; min-width: 0; padding-inline: 6px; background-color: var(--color-bg); }
.dash { color: var(--color-neutral-600); }
.next-day { font-size: 11px; font-weight: 600; color: var(--color-accent-700); }

.person { display: flex; align-items: center; gap: 8px; min-width: 0; padding: 2px 0; }
.person-avatar { width: 26px; height: 26px; font-size: 10px; flex-shrink: 0; }
.person-name { flex: 1; min-width: 0; font-size: 14px; }
.remove { color: var(--color-neutral-700); flex-shrink: 0; }
.add-person { font-size: 14px; background-color: var(--color-bg); }


.unassigned { padding: 16px; display: flex; flex-direction: column; gap: 10px; }
.chips { display: flex; flex-wrap: wrap; gap: 8px; }
.chip {
  display: flex; align-items: center; gap: 8px; font-size: 13px; padding: 3px 10px 3px 3px;
  border: 1px solid var(--color-divider); background: var(--color-bg);
}
.chip-avatar { width: 22px; height: 22px; font-size: 9px; }
.small { font-size: 12px; }

@media (max-width: 1400px) { .cards { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
@media (max-width: 900px) { .cards { grid-template-columns: 1fr; } }
/* Phones: give the time boxes the room (12-hour clocks show AM / PM too) */
@media (max-width: 640px) {
  .hours-row { grid-template-columns: 56px minmax(0, 1fr) auto minmax(0, 1fr) 16px; gap: 4px; }
  .day-label { font-size: 12px; }
  .time { font-size: 13px; padding-inline: 4px; }
}
</style>
