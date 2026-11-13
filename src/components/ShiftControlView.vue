<template>
  <div class="cb-page cb-scroll">
    <div class="cb-page-head">
      <div class="title-block">
        <h2 class="cb-title">Shifts</h2>
        <span class="cb-sub">Plan the week day by day: which shifts run, their hours and who works them. A day without a shift is that person's day off.</span>
      </div>
      <div class="cb-spacer"></div>
      <div class="head-actions">
        <span v-if="isDirty" class="unsaved">Unsaved changes</span>
        <button class="btn btn-secondary" :disabled="!isDirty || isSaving" @click="resetDraft">Discard</button>
        <button class="btn btn-primary" :disabled="!isDirty || isSaving" @click="save">{{ isSaving ? 'Saving…' : 'Save schedule' }}</button>
      </div>
    </div>

    <div v-if="errorMessage" class="cb-error">{{ errorMessage }}</div>

    <!-- The seven days: pick one to edit -->
    <div class="days" role="tablist" aria-label="Day of the week">
      <button
        v-for="day in dayTabs"
        :key="day.iso"
        type="button"
        role="tab"
        :aria-selected="day.iso === selectedIso"
        :class="['day-tab', { 'is-on': day.iso === selectedIso, 'is-today': day.iso === todayIso }]"
        @click="selectedIso = day.iso"
      >
        <span class="day-name"><span class="day-long">{{ day.label }}</span><span class="day-short">{{ day.short }}</span></span>
        <span class="day-count">{{ day.working }} on<template v-if="day.off"> · {{ day.off }} off</template></span>
        <span v-if="day.shifts < SHIFTS.length" class="day-count">{{ day.shifts }} shift{{ day.shifts === 1 ? '' : 's' }}</span>
        <span v-if="day.iso === todayIso" class="day-today">Today</span>
      </button>
    </div>

    <div class="day-bar">
      <span class="day-title">{{ selectedDay.label }}</span>
      <span class="cb-sub">{{ formatWorkDayShort(selectedDate) }}{{ selectedIso === todayIso ? ' · today' : '' }}</span>
      <span class="cb-spacer"></span>
      <select
        class="input copy"
        value=""
        :aria-label="`Copy ${selectedDay.label} to other days`"
        @change="copyDay($event.target.value); $event.target.value = ''"
      >
        <option value="">Copy {{ selectedDay.label }} to…</option>
        <option value="all">Every day</option>
        <option value="weekdays">Monday – Friday</option>
        <option value="weekend">Saturday &amp; Sunday</option>
        <option v-for="day in WEEKDAYS.filter(d => d.iso !== selectedIso)" :key="day.iso" :value="day.iso">{{ day.label }}</option>
      </select>
    </div>
    <span v-if="copyNote" class="cb-sub small" role="status">{{ copyNote }}</span>

    <!-- The selected day: each shift's hours and people -->
    <div class="cards">
      <div v-for="shift in SHIFTS" :key="shift.code" :class="['cb-panel', 'card', { 'is-off': isOff(shift.code) }]">
        <div :class="['card-head', { 'is-on': isOnDuty(shift.code) }]">
          <div class="card-title-row">
            <span class="card-title">{{ shift.label }}</span>
            <span v-if="isOnDuty(shift.code)" class="duty">On duty now</span>
            <span class="cb-spacer"></span>
            <!-- Turn the shift off on this day (e.g. two 12-hour shifts at the weekend) -->
            <label class="runs" :title="`${shift.label} shift on ${selectedDay.label}`">
              <input
                type="checkbox"
                :checked="!isOff(shift.code)"
                :disabled="!isOff(shift.code) && runningCount(selectedIso) <= 1"
                :aria-label="`${shift.label} shift runs on ${selectedDay.label}`"
                @change="setOff(shift.code, !$event.target.checked)"
              />
              <span>{{ isOff(shift.code) ? 'Off' : 'On' }}</span>
            </label>
          </div>
          <template v-if="!isOff(shift.code)">
            <span class="tas">{{ dayHours(shift.code).tashkent }} <span class="tas-unit">TAS · {{ selectedDay.short }}</span></span>
            <span class="et">{{ dayHours(shift.code).eastern }}</span>
          </template>
          <template v-else>
            <span class="tas">No shift <span class="tas-unit">· {{ selectedDay.short }}</span></span>
            <span class="et">Turned off on {{ selectedDay.label }}</span>
          </template>
        </div>

        <div v-if="isOff(shift.code)" class="card-body">
          <span class="cb-sub">There is no {{ shift.label }} shift on {{ selectedDay.label }}. Stretch the other shifts' hours to cover the day, or turn it back on.</span>
          <button type="button" class="btn btn-secondary turn-on" @click="setOff(shift.code, false)">Turn on for {{ selectedDay.label }}</button>
        </div>
        <div v-else class="card-body">
          <div class="section">
            <div class="section-head">
              <span class="cb-label">Hours on {{ selectedDay.label }} (Tashkent)</span>
              <button v-if="!isDefaultHours(shift)" type="button" class="link-btn" @click="resetHours(shift)">Reset</button>
            </div>
            <div class="hours-row">
              <input v-model="hoursDraft[shift.code][selectedIso].start" type="time" class="input time" :aria-label="`${shift.label} ${selectedDay.label} start`" />
              <span class="dash">–</span>
              <input v-model="hoursDraft[shift.code][selectedIso].end" type="time" class="input time" :aria-label="`${shift.label} ${selectedDay.label} end`" />
            </div>
            <span class="cb-sub small">{{ durationLabel(shift.code) }}</span>
          </div>

          <div class="section">
            <div class="section-head">
              <span class="cb-label">People · {{ peopleOn(shift.code).length }}</span>
            </div>
            <div v-for="member in peopleOn(shift.code)" :key="member.id" class="person">
              <span class="cb-avatar person-avatar">{{ initials(member.displayName) }}</span>
              <span class="cb-ellipsis person-name">{{ member.displayName }}</span>
              <button type="button" class="btn btn-ghost btn-icon remove" :title="`Take ${member.displayName} off ${shift.label} on ${selectedDay.label}`" @click="setShift(member.id, selectedIso, '')">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>
              </button>
            </div>
            <span v-if="!peopleOn(shift.code).length" class="cb-sub small">Nobody on this shift on {{ selectedDay.label }}.</span>
            <select
              class="input add-person"
              value=""
              :aria-label="`Add a person to ${shift.label} on ${selectedDay.label}`"
              :disabled="!addableFor(shift.code).length"
              @change="setShift($event.target.value, selectedIso, shift.code); $event.target.value = ''"
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
    <span v-if="gapNote" class="cb-sub small gap-note" role="status">{{ gapNote }}</span>

    <div class="cb-panel off-panel">
      <span class="cb-label">Day off on {{ selectedDay.label }} · {{ offOnDay.length }}</span>
      <div class="chips">
        <span v-for="member in offOnDay" :key="member.id" class="chip">
          <span class="cb-avatar chip-avatar">{{ initials(member.displayName) }}</span>{{ member.displayName }}
        </span>
        <span v-if="!offOnDay.length" class="cb-sub">Everyone works on {{ selectedDay.label }}.</span>
      </div>
    </div>

    <!-- The whole week at a glance; every cell can be changed here too -->
    <div class="cb-panel week">
      <div class="week-head">
        <span class="cb-label">Week overview</span>
        <span class="cb-sub small">One shift per person per day. "Off" is a day off. A shift turned off on a day can't be picked for it.</span>
      </div>
      <div class="week-scroll cb-scroll">
        <table class="week-table">
          <thead>
            <tr>
              <th class="col-name">Person</th>
              <th v-for="day in WEEKDAYS" :key="day.iso" :class="{ 'is-selected': day.iso === selectedIso }">
                <button type="button" class="th-btn" :title="`Edit ${day.label}`" @click="selectedIso = day.iso">{{ day.short }}</button>
              </th>
              <th class="col-days">Days</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="member in activeMembers" :key="member.id">
              <td class="col-name">
                <span class="week-person">
                  <span class="cb-avatar person-avatar">{{ initials(member.displayName) }}</span>
                  <span class="cb-ellipsis">{{ member.displayName }}</span>
                </span>
              </td>
              <td v-for="day in WEEKDAYS" :key="day.iso" :class="{ 'is-selected': day.iso === selectedIso }">
                <select
                  :class="['input', 'cell', { 'is-off': !draft[member.id]?.[day.iso] }]"
                  :value="draft[member.id]?.[day.iso] || ''"
                  :aria-label="`${member.displayName} on ${day.label}`"
                  @change="setShift(member.id, day.iso, $event.target.value)"
                >
                  <option value="">Off</option>
                  <option v-for="shift in SHIFTS" :key="shift.code" :value="shift.code" :disabled="hoursDraft[shift.code][day.iso].off">{{ shift.label }}</option>
                </select>
              </td>
              <td class="col-days">{{ workDays(member.id) }}</td>
            </tr>
            <tr v-if="!activeMembers.length"><td :colspan="9" class="cb-sub">No team members yet.</td></tr>
          </tbody>
        </table>
      </div>
      <span class="cb-sub small">Actions are credited to the shift their author is scheduled on that day; on a day off they are placed by the clock (where shifts overlap, the one that started first counts). A shift ending at or before its start time ends the next day.</span>
    </div>

    <!-- Managers only (the database rejects staff too) -->
    <OfficeLocationCard
      v-if="isManager && showOffice"
      @saved="emit('office-saved', $event)"
      @error="emit('office-error', $event)"
    />
    <span v-else-if="isManager" class="cb-sub small">The office location for check-in is set on the computer, on this Shifts page.</span>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, onUnmounted, defineAsyncComponent } from 'vue';
import {
  SHIFTS, WEEKDAYS, getShiftConfig, shiftHours, placeShift, currentWorkDay, addDays,
  isoWeekday, customShiftHours, shiftSchedule, formatMinutes, parseMinutes, formatWorkDayShort
} from '../config/shifts';
import {
  staffProfiles, loadTeamRoster, loadShiftHours, saveShiftSchedule, saveShiftHours, isCurrentUserManager
} from '../services/authService';
import { formatMinutesSpan } from '../services/attendanceService';
import { initials } from '../utils/format';
// Loaded on demand: the map library is only needed here, by managers
const OfficeLocationCard = defineAsyncComponent(() => import('./OfficeLocationCard.vue'));

defineProps({
  // The office map is for the computer; the phone app leaves it out
  showOffice: { type: Boolean, default: true }
});

const emit = defineEmits(['saved', 'office-saved', 'office-error']);

const isManager = computed(() => isCurrentUserManager());
const activeMembers = computed(() => staffProfiles.value
  .filter(p => p.isActive)
  .sort((a, b) => a.displayName.localeCompare(b.displayName)));
// People: { staffId: { 1: 'MORNING', 2: '', ... 7 } } ('' = day off)
const draft = reactive({});
// Hours: { MORNING: { 1: { start, end, off }, ... 7 }, ... } as 'HH:MM'; off = no such shift that day
const hoursDraft = reactive(Object.fromEntries(SHIFTS.map(s => [
  s.code,
  Object.fromEntries(WEEKDAYS.map(d => [d.iso, defaultRange(s)]))
])));
const isSaving = ref(false);
const errorMessage = ref('');
const copyNote = ref('');
const now = ref(new Date());
const today = computed(() => currentWorkDay(now.value));
const todayIso = computed(() => isoWeekday(today.value));
// The day being edited (ISO weekday); starts on today
const selectedIso = ref(isoWeekday(currentWorkDay()));
const selectedDay = computed(() => WEEKDAYS[selectedIso.value - 1]);
// The next date that falls on the selected weekday (Eastern hours depend on the date)
const selectedDate = computed(() => addDays(today.value, (selectedIso.value - todayIso.value + 7) % 7));
let clockTimer = null;

function defaultRange(shift) {
  return { start: formatMinutes(shift.startMin), end: formatMinutes(shift.endMin), off: false };
}

// ---------------- saved state ----------------
// Saved shift of a person on a weekday ('' = day off)
function savedShift(memberId, iso) {
  return shiftSchedule.value[memberId]?.[iso] || '';
}

// Saved hours of a shift on a weekday, as 'HH:MM'
function savedRange(code, iso) {
  const custom = customShiftHours.value[`${code}-${iso}`];
  if (!custom) return defaultRange(getShiftConfig(code));
  return { start: formatMinutes(custom.startMin), end: formatMinutes(custom.endMin), off: !!custom.off };
}

const sameRange = (a, b) => a.start === b.start && a.end === b.end && !!a.off === !!b.off;

function resetDraft() {
  Object.keys(draft).forEach(id => { delete draft[id]; });
  activeMembers.value.forEach(m => {
    draft[m.id] = Object.fromEntries(WEEKDAYS.map(d => [d.iso, savedShift(m.id, d.iso)]));
  });
  SHIFTS.forEach(s => {
    WEEKDAYS.forEach(d => { hoursDraft[s.code][d.iso] = savedRange(s.code, d.iso); });
  });
  errorMessage.value = '';
  copyNote.value = '';
}

// ---------------- hours ----------------
// { startMin, endMin } of a shift on a weekday in the draft; null while incomplete or empty
function draftMinutes(code, iso) {
  const range = hoursDraft[code][iso];
  const startMin = parseMinutes(range.start);
  const endMin = parseMinutes(range.end);
  return startMin === null || endMin === null || startMin === endMin ? null : { startMin, endMin };
}

function dayHours(code) {
  const hours = draftMinutes(code, selectedIso.value);
  if (!hours) return { tashkent: '— : —', eastern: 'Set a start and end time' };
  return shiftHours(code, selectedDate.value, hours);
}

// '8h long' / '10h long · ends the next day'
function durationLabel(code) {
  const hours = draftMinutes(code, selectedIso.value);
  if (!hours) return 'Set a start and an end time.';
  const overnight = hours.endMin <= hours.startMin;
  const length = (hours.endMin - hours.startMin + 1440) % 1440;
  return `${formatMinutesSpan(length)} long${overnight ? ' · ends the next day' : ''}`;
}

function isDefaultHours(shift) {
  return sameRange(hoursDraft[shift.code][selectedIso.value], defaultRange(shift));
}

function resetHours(shift) {
  hoursDraft[shift.code][selectedIso.value] = defaultRange(shift);
}

// ---------------- which shifts run on a day ----------------
function isOff(code, iso = selectedIso.value) {
  return !!hoursDraft[code][iso].off;
}

function runningCount(iso) {
  return SHIFTS.filter(s => !isOff(s.code, iso)).length;
}

// Turn a shift off (or back on) on the selected day; its people get the day off
function setOff(code, off) {
  const iso = selectedIso.value;
  if (off && runningCount(iso) <= 1) return;
  hoursDraft[code][iso].off = off;
  copyNote.value = '';
  if (!off) return;
  const moved = activeMembers.value.filter(m => draft[m.id]?.[iso] === code);
  moved.forEach(m => { draft[m.id][iso] = ''; });
  if (moved.length) {
    copyNote.value = `${moved.map(m => m.displayName).join(', ')} ${moved.length === 1 ? 'was' : 'were'} on ${getShiftConfig(code).label} and now ${moved.length === 1 ? 'has' : 'have'} ${selectedDay.value.label} off. Add them to another shift if they work that day.`;
  }
}

// Hours of the selected day nobody's shift covers, e.g. 'Not covered on Saturday: 15:00 – 19:00'
const gapNote = computed(() => {
  const iso = selectedIso.value;
  const covered = new Array(1440).fill(false);
  for (const s of SHIFTS) {
    const hours = isOff(s.code, iso) ? null : draftMinutes(s.code, iso);
    if (!hours) continue;
    const length = (hours.endMin - hours.startMin + 1440) % 1440;
    for (let i = 0; i < length; i += 1) covered[(hours.startMin + i) % 1440] = true;
  }
  // Start from the earliest shift start, so a night shift's morning hours count as its own day
  const starts = SHIFTS.filter(s => !isOff(s.code, iso) && draftMinutes(s.code, iso)).map(s => draftMinutes(s.code, iso).startMin);
  if (!starts.length) return '';
  const from = Math.min(...starts);
  const gaps = [];
  for (let i = 0; i < 1440; i += 1) {
    const minute = (from + i) % 1440;
    if (covered[minute]) continue;
    const last = gaps[gaps.length - 1];
    if (last && last.end === i) last.end = i + 1;
    else gaps.push({ start: i, end: i + 1 });
  }
  if (!gaps.length) return '';
  const text = gaps.map(g => `${formatMinutes((from + g.start) % 1440)} – ${formatMinutes((from + g.end) % 1440)}`).join(', ');
  return `No shift covers ${text} on ${selectedDay.value.label} (Tashkent).`;
});

const hoursDirty = computed(() => SHIFTS.some(s => WEEKDAYS.some(d =>
  !sameRange(hoursDraft[s.code][d.iso], savedRange(s.code, d.iso))
)));

// Rows for save_shift_hours; days on the default hours are left out
function hoursRows() {
  const rows = [];
  for (const s of SHIFTS) {
    for (const d of WEEKDAYS) {
      const range = hoursDraft[s.code][d.iso];
      let startMin = parseMinutes(range.start);
      let endMin = parseMinutes(range.end);
      const where = `${s.label} on ${d.label}`;
      if (range.off) {
        // Its hours are only kept for when it is turned back on
        if (startMin === null || endMin === null || startMin === endMin) [startMin, endMin] = [s.startMin, s.endMin];
        rows.push({ shift_code: s.code, weekday: d.iso, start_min: startMin, end_min: endMin, is_off: true });
        continue;
      }
      if (startMin === null || endMin === null) throw new Error(`Set both a start and an end time for ${where}.`);
      if (startMin === endMin) throw new Error(`${where} starts and ends at the same time.`);
      if (startMin === s.startMin && endMin === s.endMin) continue;
      rows.push({ shift_code: s.code, weekday: d.iso, start_min: startMin, end_min: endMin, is_off: false });
    }
  }
  return rows;
}

// ---------------- people ----------------
const peopleDirty = computed(() => activeMembers.value.some(m => WEEKDAYS.some(d =>
  (draft[m.id]?.[d.iso] || '') !== savedShift(m.id, d.iso)
)));

const isDirty = computed(() => peopleDirty.value || hoursDirty.value);

// One shift per person per day: choosing another shift moves them, '' is a day off
function setShift(memberId, iso, code) {
  if (!memberId || !draft[memberId] || (code && isOff(code, iso))) return;
  draft[memberId][iso] = code;
  copyNote.value = '';
}

function peopleOn(code, iso = selectedIso.value) {
  return activeMembers.value.filter(m => draft[m.id]?.[iso] === code);
}

function addableFor(code) {
  return activeMembers.value.filter(m => draft[m.id] && draft[m.id][selectedIso.value] !== code);
}

function otherShiftLabel(memberId) {
  const code = draft[memberId]?.[selectedIso.value];
  return code ? ` — on ${getShiftConfig(code).label}` : '';
}

// Days a week a person works in the draft
function workDays(memberId) {
  return WEEKDAYS.filter(d => draft[memberId]?.[d.iso]).length;
}

// Managers usually don't work a dispatch shift: they only count once they are scheduled somewhere
function countsForDaysOff(member) {
  return member.role !== 'manager' || workDays(member.id) > 0;
}

const offOnDay = computed(() => activeMembers.value.filter(m =>
  countsForDaysOff(m) && !draft[m.id]?.[selectedIso.value]
));

const dayTabs = computed(() => WEEKDAYS.map(d => ({
  ...d,
  working: activeMembers.value.filter(m => draft[m.id]?.[d.iso]).length,
  off: activeMembers.value.filter(m => countsForDaysOff(m) && !draft[m.id]?.[d.iso]).length,
  shifts: runningCount(d.iso)
})));

// Is this shift's run of the selected day on the clock right now?
function isOnDuty(code) {
  const run = placeShift(now.value, code);
  return !!run && now.value >= run.start && now.value < run.end && isoWeekday(run.day) === selectedIso.value;
}

// Copy the selected day's shifts (on / off), people and hours onto other days
function copyDay(target) {
  if (!target) return;
  const from = selectedIso.value;
  const groups = { all: [1, 2, 3, 4, 5, 6, 7], weekdays: [1, 2, 3, 4, 5], weekend: [6, 7] };
  const days = (groups[target] || [Number(target)]).filter(iso => iso !== from);
  days.forEach(iso => {
    activeMembers.value.forEach(m => { draft[m.id][iso] = draft[m.id][from]; });
    SHIFTS.forEach(s => { hoursDraft[s.code][iso] = { ...hoursDraft[s.code][from] }; });
  });
  const names = days.map(iso => WEEKDAYS[iso - 1].short).join(', ');
  copyNote.value = days.length ? `Copied ${selectedDay.value.label}'s shifts, people and hours to ${names}. Save to keep it.` : '';
}

// Rows for save_week_schedule: one per person per working day
function scheduleRows() {
  return activeMembers.value.flatMap(m => WEEKDAYS
    .filter(d => draft[m.id]?.[d.iso])
    .map(d => ({ staff_id: m.id, weekday: d.iso, shift_code: draft[m.id][d.iso] })));
}

// ---------------- load & save ----------------
async function save() {
  isSaving.value = true;
  errorMessage.value = '';
  try {
    const hours = hoursDirty.value ? hoursRows() : null;
    if (hours) await saveShiftHours(hours);
    if (peopleDirty.value) await saveShiftSchedule(scheduleRows());
    // Turning a shift off also takes its people off that day in the database
    else if (hours) await loadTeamRoster();
    now.value = new Date();
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
      now.value = new Date();
      resetDraft();
    })
    .catch(err => { errorMessage.value = err.message; });
  clockTimer = setInterval(() => { now.value = new Date(); }, 60000);
});

onUnmounted(() => clearInterval(clockTimer));
</script>

<style scoped>
.title-block { display: flex; flex-direction: column; gap: 1px; min-width: 0; }
.head-actions { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.unsaved { font-size: 13px; color: var(--color-accent-700); }
.small { font-size: 12px; }

/* ---- day tabs ---- */
.days { display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); border: 1px solid var(--color-divider); background: var(--color-neutral-100); }
.day-tab {
  display: flex; flex-direction: column; align-items: flex-start; gap: 1px; min-width: 0; min-height: 64px;
  padding: 9px 12px; font: inherit; text-align: left; cursor: pointer; color: var(--color-text);
  border: 0; border-left: 1px solid var(--color-divider); background: transparent;
}
.day-tab:first-child { border-left: 0; }
.day-tab:not(.is-on):hover { background: color-mix(in srgb, var(--color-text) 7%, transparent); }
.day-tab.is-on { background: var(--color-accent-900); color: var(--color-bg); }
.day-name { font-family: var(--font-heading); font-weight: 600; font-size: 20px; line-height: 1.1; text-transform: uppercase; }
.day-short { display: none; }
.day-count { font-size: 12px; opacity: 0.75; white-space: nowrap; }
.day-today { font-size: 10px; letter-spacing: 0.1em; text-transform: uppercase; color: var(--color-accent-700); }
.day-tab.is-on .day-today { color: var(--color-accent-300); }

.day-bar { display: flex; align-items: baseline; gap: 10px; flex-wrap: wrap; }
.day-title { font-family: var(--font-heading); font-weight: 600; font-size: 24px; line-height: 1.1; text-transform: uppercase; }
.copy { width: auto; min-width: 210px; align-self: center; background-color: var(--color-neutral-100); }

/* ---- shift cards ---- */
.cards { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 14px; align-items: start; }
.card { display: flex; flex-direction: column; min-width: 0; }
.card-head {
  padding: 16px; display: flex; flex-direction: column; gap: 2px;
  background: var(--color-neutral-200); color: var(--color-text); border-bottom: 1px solid var(--color-divider);
}
.card-head.is-on { background: var(--color-accent-900); color: var(--color-bg); }
.card-title-row { display: flex; align-items: center; gap: 8px; }
.card-title { font-family: var(--font-heading); font-weight: 600; font-size: 24px; text-transform: uppercase; }
.duty { font-size: 10px; letter-spacing: 0.1em; text-transform: uppercase; background: var(--color-accent); color: var(--color-bg); padding: 3px 7px; }
.tas { font-family: var(--font-heading); font-size: 18px; }
.tas-unit { font-size: 13px; opacity: 0.7; }
.et { font-size: 12px; opacity: 0.75; }
.card-body { padding: 16px; display: flex; flex-direction: column; gap: 18px; }
.card.is-off .card-head { background: transparent; color: var(--color-neutral-700); border-bottom-style: dashed; }
.card.is-off { border-style: dashed; box-shadow: none; }
.runs { display: flex; align-items: center; gap: 6px; font-size: 12px; letter-spacing: 0.06em; text-transform: uppercase; cursor: pointer; }
.runs input { width: 16px; height: 16px; margin: 0; accent-color: var(--color-accent); cursor: pointer; }
.runs input:disabled { cursor: not-allowed; }
.turn-on { align-self: flex-start; }
.gap-note { color: var(--color-signal); }

.section { display: flex; flex-direction: column; gap: 8px; }
.section-head { display: flex; justify-content: space-between; align-items: baseline; gap: 8px; }
.link-btn {
  border: 0; background: transparent; padding: 0; cursor: pointer; font: inherit; font-size: 12px;
  color: var(--color-accent-700); text-decoration: underline; text-underline-offset: 2px;
}
.link-btn:hover { color: var(--color-accent-900); }

.hours-row { display: grid; grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr); align-items: center; gap: 6px; }
.time { font-size: 14px; min-width: 0; padding-inline: 6px; background-color: var(--color-bg); }
.dash { color: var(--color-neutral-600); }

.person { display: flex; align-items: center; gap: 8px; min-width: 0; padding: 2px 0; }
.person-avatar { width: 26px; height: 26px; font-size: 10px; flex-shrink: 0; }
.person-name { flex: 1; min-width: 0; font-size: 14px; }
.remove { color: var(--color-neutral-700); flex-shrink: 0; }
.add-person { font-size: 14px; background-color: var(--color-bg); }

.off-panel { padding: 16px; display: flex; flex-direction: column; gap: 10px; }
.chips { display: flex; flex-wrap: wrap; gap: 8px; }
.chip {
  display: flex; align-items: center; gap: 8px; font-size: 13px; padding: 3px 10px 3px 3px;
  border: 1px solid var(--color-divider); background: var(--color-bg);
}
.chip-avatar { width: 22px; height: 22px; font-size: 9px; }

/* ---- week overview ---- */
.week { padding: 16px; display: flex; flex-direction: column; gap: 10px; min-width: 0; }
.week-head { display: flex; align-items: baseline; gap: 10px; flex-wrap: wrap; }
.week-scroll { overflow-x: auto; }
.week-table { width: 100%; min-width: 860px; border-collapse: collapse; font-size: 13px; }
.week-table th, .week-table td { padding: 4px; border-bottom: 1px solid var(--color-hairline); text-align: left; }
.week-table th { font-size: 11px; font-weight: 500; letter-spacing: 0.08em; text-transform: uppercase; color: var(--color-neutral-700); border-bottom-color: var(--color-divider); }
.week-table tbody tr:last-child td { border-bottom: 0; }
.week-table .is-selected { background: var(--color-accent-100); }
.th-btn { border: 0; background: transparent; padding: 4px 6px; cursor: pointer; font: inherit; letter-spacing: inherit; text-transform: inherit; color: inherit; }
.th-btn:hover { color: var(--color-accent-700); }
.col-name { width: 200px; max-width: 200px; position: sticky; left: 0; z-index: 1; background: var(--color-neutral-100); }
.week-person { display: flex; align-items: center; gap: 8px; min-width: 0; font-size: 14px; }
.col-days { width: 48px; text-align: right !important; font-family: var(--font-heading); font-size: 16px; padding-right: 8px !important; }
th.col-days { font-family: inherit; font-size: 11px; }
.cell { min-height: 32px; min-width: 84px; padding: 4px 24px 4px 8px; font-size: 13px; background-color: var(--color-bg); background-position: right 7px center; }
.cell.is-off { background-color: transparent; color: var(--color-neutral-600); border-style: dashed; }

@media (max-width: 1400px) { .cards { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
@media (max-width: 1100px) {
  .day-long { display: none; }
  .day-short { display: inline; }
}
@media (max-width: 900px) { .cards { grid-template-columns: 1fr; } }
/* Phones: the tabs shrink to the day and its head count */
@media (max-width: 640px) {
  .day-tab { align-items: center; padding: 8px 2px; min-height: 56px; }
  .day-name { font-size: 17px; }
  .day-count { font-size: 10px; }
  .day-today { font-size: 8px; letter-spacing: 0.04em; }
  .copy { width: 100%; }
  .col-name { width: 132px; max-width: 132px; }
  .week-person .person-avatar { display: none; }
}
</style>
