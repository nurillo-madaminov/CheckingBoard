<template>
  <!-- Team rules for check-in (were in the Attendance filter bar) -->
  <div class="rules">
    <form class="cb-panel section" @submit.prevent="saveLate">
      <span class="section-title">Late after</span>
      <span class="cb-sub">Minutes after a shift starts before a check-in counts as late. Past check-ins keep the rule they were made under.</span>
      <div class="line">
        <label for="late-after" class="sr-label">Late after (minutes)</label>
        <input id="late-after" v-model.number="lateDraft" type="number" min="0" max="240" step="1" class="input late-input" />
        <span class="cb-sub">minutes</span>
        <span class="cb-spacer"></span>
        <button type="submit" class="btn btn-primary" :disabled="lateDraft === lateAfter || isSaving">{{ isSaving ? 'Saving…' : 'Save' }}</button>
      </div>
      <div v-if="lateNote" :class="lateNote.ok ? 'cb-success' : 'cb-error'">{{ lateNote.text }}</div>
    </form>

    <div class="cb-panel section">
      <span class="section-title">Check-in / check-out reminders</span>
      <span class="cb-sub">A phone alert to each person 2 minutes before their shift starts and ends. Each person can still turn alerts off on their own phone, under My shifts.</span>
      <label v-if="reminders !== null" class="line switch">
        <input type="checkbox" :checked="reminders" :disabled="isSavingReminders" @change="saveReminders($event.target.checked)" />
        <span>{{ reminders ? 'On for the whole team' : 'Off for the whole team' }}</span>
      </label>
      <span v-else class="cb-sub">The reminder setting could not be loaded. The database script may need to be re-run.</span>
      <div v-if="reminderNote" :class="reminderNote.ok ? 'cb-success' : 'cb-error'">{{ reminderNote.text }}</div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { fetchAttendanceRules, setLateAfter, fetchShiftReminders, setShiftReminders } from '../services/attendanceService';

const emit = defineEmits(['saved', 'error']);

const lateAfter = ref(15);
const lateDraft = ref(15);
const isSaving = ref(false);
const lateNote = ref(null);
// null until loaded (or when the database script hasn't been re-run)
const reminders = ref(null);
const isSavingReminders = ref(false);
const reminderNote = ref(null);

async function loadLate() {
  try {
    const rules = await fetchAttendanceRules();
    lateAfter.value = rules.lateAfterMin;
    lateDraft.value = rules.lateAfterMin;
  } catch (err) {
    lateNote.value = { ok: false, text: err.message };
  }
}

async function saveLate() {
  const n = Math.round(Number(lateDraft.value));
  if (!Number.isFinite(n) || n < 0 || n > 240) {
    lateNote.value = { ok: false, text: 'Late after must be between 0 and 240 minutes.' };
    return;
  }
  isSaving.value = true;
  lateNote.value = null;
  try {
    await setLateAfter(n);
    lateNote.value = { ok: true, text: `Saved. Check-ins more than ${n} min after the start are late.` };
    emit('saved', { title: 'Late rule saved', message: `Check-ins more than ${n} min after the start are late` });
  } catch (err) {
    lateNote.value = { ok: false, text: err.message };
  } finally {
    isSaving.value = false;
    await loadLate();
  }
}

async function loadReminders() {
  try {
    reminders.value = await fetchShiftReminders();
  } catch (err) {
    reminders.value = null;
    console.warn('Could not load the reminder setting:', err);
  }
}

async function saveReminders(on) {
  isSavingReminders.value = true;
  reminderNote.value = null;
  try {
    await setShiftReminders(on);
    reminderNote.value = { ok: true, text: on ? 'Reminders are on.' : 'Reminders are off.' };
    emit('saved', on
      ? { title: 'Reminders on', message: 'Phone alert 2 min before each shift starts and ends' }
      : { title: 'Reminders off', message: 'No check-in / check-out reminders' });
  } catch (err) {
    reminderNote.value = { ok: false, text: err.message };
  } finally {
    isSavingReminders.value = false;
    await loadReminders();
  }
}

onMounted(() => {
  loadLate();
  loadReminders();
});
</script>

<style scoped>
.rules { display: flex; flex-direction: column; gap: 14px; max-width: 760px; }
.section { padding: 16px; display: flex; flex-direction: column; gap: 10px; }
.section-title { font-family: var(--font-heading); font-weight: 600; font-size: 20px; text-transform: uppercase; }
.line { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.late-input { width: 96px; }
.switch { cursor: pointer; font-size: 14px; }
.switch input { width: 18px; height: 18px; accent-color: var(--color-accent); cursor: pointer; }
.sr-label { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
</style>
