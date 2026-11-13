<template>
  <div class="cb-backdrop" @click.self="$emit('close')">
    <form class="cb-dialog" role="dialog" aria-modal="true" aria-labelledby="msg-title" @submit.prevent="send" @keydown.esc="$emit('close')">
      <span id="msg-title" class="cb-dialog-title">Message staff</span>
      <span class="cb-sub">It shows under Alerts in the phone app of everyone it is sent to.</span>

      <div class="field">
        <label for="msg-to">To</label>
        <select id="msg-to" v-model="to" class="input">
          <option value="ALL">Everyone in the team</option>
          <optgroup label="A shift (everyone who works it on any day)">
            <option v-for="s in SHIFTS" :key="s.code" :value="`SHIFT:${s.code}`">{{ s.label }} shift</option>
          </optgroup>
          <optgroup label="One person">
            <option v-for="p in people" :key="p.id" :value="`STAFF:${p.id}`">{{ p.displayName }}</option>
          </optgroup>
        </select>
      </div>
      <div class="field">
        <label for="msg-subject">Title</label>
        <input id="msg-subject" ref="titleRef" v-model="title" class="input" required maxlength="120" placeholder="e.g. Team meeting Friday 16:00" />
      </div>
      <div class="field">
        <label for="msg-body">Message · optional</label>
        <textarea id="msg-body" v-model="body" class="input" rows="4" maxlength="1000"></textarea>
      </div>
      <div v-if="errorMessage" class="cb-error">{{ errorMessage }}</div>
      <div class="cb-dialog-actions">
        <button type="button" class="btn btn-secondary" @click="$emit('close')">Cancel</button>
        <button type="submit" class="btn btn-primary" :disabled="busy || !title.trim()">{{ busy ? 'Sending…' : 'Send' }}</button>
      </div>
    </form>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { SHIFTS } from '../config/shifts';
import { activeStaffProfiles, currentStaffUser } from '../services/authService';
import { sendNotification } from '../services/notificationService';

const emit = defineEmits(['close', 'sent']);

const to = ref('ALL');
const title = ref('');
const body = ref('');
const busy = ref(false);
const errorMessage = ref('');
const titleRef = ref(null);

const people = computed(() => activeStaffProfiles.value
  .filter(p => p.id !== currentStaffUser.value?.id)
  .sort((a, b) => a.displayName.localeCompare(b.displayName)));

function audienceLabel() {
  if (to.value === 'ALL') return 'everyone';
  const [kind, id] = to.value.split(':');
  if (kind === 'SHIFT') return `the ${SHIFTS.find(s => s.code === id)?.label || id} shift`;
  return people.value.find(p => p.id === id)?.displayName || 'one person';
}

async function send() {
  if (!title.value.trim()) return;
  busy.value = true;
  errorMessage.value = '';
  const [kind, id] = to.value.split(':');
  try {
    await sendNotification({
      title: title.value,
      body: body.value,
      audience: kind,
      audienceShift: kind === 'SHIFT' ? id : null,
      audienceStaffId: kind === 'STAFF' ? id : null
    });
    emit('sent', { title: 'Message sent', message: `To ${audienceLabel()}` });
  } catch (err) {
    errorMessage.value = err.message;
  } finally {
    busy.value = false;
  }
}

onMounted(() => titleRef.value?.focus());
</script>

<style scoped>
.field { gap: 4px; }
.field > label { font-size: 12px; color: var(--color-neutral-700); }
</style>
