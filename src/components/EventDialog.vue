<template>
  <div class="cb-backdrop" @click.self="$emit('close')">
    <form class="cb-dialog event-dialog" role="dialog" aria-modal="true" aria-labelledby="event-title" @submit.prevent="save" @keydown.esc="$emit('close')">
      <span id="event-title" class="cb-dialog-title">{{ editing ? 'Edit event' : 'Log an event' }}</span>

      <div class="field">
        <span class="field-label" id="event-kind-label">What happened</span>
        <div class="seg" role="radiogroup" aria-labelledby="event-kind-label">
          <button
            v-for="k in EVENT_KINDS"
            :key="k.code"
            type="button"
            role="radio"
            :aria-checked="form.kind === k.code ? 'true' : 'false'"
            :class="['seg-btn', { 'is-on': form.kind === k.code }]"
            @click="form.kind = k.code"
          >
            {{ k.label }}
          </button>
        </div>
      </div>

      <div class="two">
        <div class="field">
          <label for="event-driver">Driver</label>
          <select id="event-driver" ref="driverRef" v-model="form.driverId" class="input" required>
            <option value="" disabled>Pick a driver…</option>
            <optgroup v-for="g in driverGroups" :key="g.company.id" :label="g.company.name">
              <option v-for="d in g.drivers" :key="d.id" :value="d.id">{{ driverLabel(d) }}{{ d.status === 'INACTIVE' ? ' (inactive)' : '' }}</option>
            </optgroup>
          </select>
        </div>
        <div class="field">
          <label for="event-when">Date and time (this computer's clock)</label>
          <input id="event-when" v-model="form.when" class="input" type="datetime-local" required :max="maxWhen" />
        </div>
      </div>

      <div class="two">
        <div class="field">
          <span class="field-label" id="event-outcome-label">Result</span>
          <div class="seg" role="radiogroup" aria-labelledby="event-outcome-label">
            <button
              v-for="o in EVENT_OUTCOMES"
              :key="o.code"
              type="button"
              role="radio"
              :aria-checked="form.outcome === o.code ? 'true' : 'false'"
              :class="['seg-btn', { 'is-on': form.outcome === o.code, 'is-violation': o.code === 'VIOLATION' }]"
              @click="form.outcome = o.code"
            >
              {{ o.label }}
            </button>
          </div>
        </div>
        <div class="field">
          <span class="field-label" id="event-level-label">Level</span>
          <div class="seg" role="radiogroup" aria-labelledby="event-level-label">
            <button
              v-for="l in EVENT_LEVELS"
              :key="l"
              type="button"
              role="radio"
              :aria-checked="form.level === l ? 'true' : 'false'"
              :class="['seg-btn', { 'is-on': form.level === l }]"
              @click="form.level = l"
            >
              Level {{ l }}
            </button>
          </div>
        </div>
      </div>

      <div class="field">
        <label for="event-notes">Notes · optional</label>
        <textarea id="event-notes" v-model="form.notes" class="input" rows="4" maxlength="2000" placeholder="e.g. Brake light out, written warning, location, report number"></textarea>
      </div>

      <div v-if="errorMessage" class="cb-error">{{ errorMessage }}</div>
      <div class="cb-dialog-actions">
        <button type="button" class="btn btn-secondary" @click="$emit('close')">Cancel</button>
        <button type="submit" class="btn btn-primary" :disabled="busy || !canSave">{{ busy ? 'Saving…' : editing ? 'Save changes' : 'Save event' }}</button>
      </div>
    </form>
  </div>
</template>

<script setup>
import { reactive, ref, computed, onMounted } from 'vue';
import { EVENT_KINDS, EVENT_OUTCOMES, EVENT_LEVELS, createEvent, updateEvent } from '../services/eventService';
import { driverLabel } from '../utils/format';

const props = defineProps({
  companies: { type: Array, required: true },
  drivers: { type: Array, required: true },
  // An event row to edit, or null to log a new one
  editing: { type: Object, default: null }
});
const emit = defineEmits(['close', 'saved']);

const pad = (n) => String(n).padStart(2, '0');
// 'YYYY-MM-DDTHH:mm' in this computer's time zone, for <input type="datetime-local">
function localInput(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

const form = reactive({
  kind: props.editing?.kind || 'INSPECTION',
  driverId: props.editing?.driver_id || '',
  when: localInput(props.editing ? new Date(props.editing.occurred_at) : new Date()),
  outcome: props.editing?.outcome || 'NO_VIOLATION',
  level: props.editing?.level || 1,
  notes: props.editing?.notes || ''
});
const busy = ref(false);
const errorMessage = ref('');
const driverRef = ref(null);
const maxWhen = localInput(new Date(Date.now() + 60 * 60000));

// Drivers by company, in board order
const driverGroups = computed(() => props.companies
  .map(company => ({ company, drivers: props.drivers.filter(d => d.companyId === company.id) }))
  .filter(g => g.drivers.length));

// An event whose driver was deleted keeps its saved name; it can still be edited
const canSave = computed(() => !!(form.driverId || props.editing) && !!form.when);

async function save() {
  if (!canSave.value) return;
  busy.value = true;
  errorMessage.value = '';
  try {
    const payload = {
      kind: form.kind,
      occurredAt: new Date(form.when).toISOString(),
      driverId: form.driverId || null,
      outcome: form.outcome,
      level: form.level,
      notes: form.notes
    };
    const row = props.editing ? await updateEvent(props.editing.id, payload) : await createEvent(payload);
    emit('saved', row);
  } catch (err) {
    errorMessage.value = err.message;
  } finally {
    busy.value = false;
  }
}

onMounted(() => driverRef.value?.focus());
</script>

<style scoped>
.event-dialog { width: min(620px, 100%); }
.field { gap: 6px; min-width: 0; }
.field > label, .field-label { font-size: 12px; color: var(--color-neutral-700); }
.two { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
.seg { width: 100%; }
.seg-btn.is-violation.is-on { background: var(--color-signal); color: var(--color-bg); }
@media (max-width: 600px) {
  .two { grid-template-columns: 1fr; }
}
</style>
