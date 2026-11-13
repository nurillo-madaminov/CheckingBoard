<template>
  <!-- Phone: shift reminders and messages from managers -->
  <div class="alerts">
    <div class="alerts-head">
      <h2 class="cb-title">Alerts</h2>
      <span class="cb-sub">{{ unread ? `${unread} new` : 'All read' }}</span>
      <span class="cb-spacer"></span>
      <button v-if="unread" type="button" class="cb-link mark-all" @click="markAll">Mark all read</button>
    </div>

    <!-- The next reminder this phone gets (from your schedule) -->
    <div v-if="nextReminder" class="cb-panel reminder">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10.268 21a2 2 0 0 0 3.464 0" /><path d="M3.262 15.326A1 1 0 0 0 4 17h16a1 1 0 0 0 .74-1.673C19.41 13.956 18 12.499 18 8A6 6 0 0 0 6 8c0 4.499-1.411 5.956-2.738 7.326" /></svg>
      <div class="reminder-text">
        <span class="strong">Next reminder: {{ nextReminder.what }} at {{ nextReminder.at }}</span>
        <span class="cb-sub">2 minutes before your {{ nextReminder.shift }} shift {{ nextReminder.edge }}. Turn reminders on or off under My shifts.</span>
      </div>
      <button type="button" class="cb-link" @click="$emit('open-checkin')">Check in</button>
    </div>

    <div v-if="errorMessage" class="cb-error">
      {{ errorMessage }}
      <button type="button" class="cb-link" @click="load">Try again</button>
    </div>

    <div class="cb-panel list">
      <div v-if="isLoading && !items.length" class="cb-empty-state">Loading alerts…</div>
      <template v-else>
        <div v-for="n in items" :key="n.id" :class="['item', { 'is-new': !n.read, 'is-open': openId === n.id }]">
          <button type="button" class="item-main" :aria-expanded="openId === n.id ? 'true' : 'false'" @click="toggle(n)">
            <span class="cb-avatar mark">{{ initials(n.sender_name || 'Manager') }}</span>
            <span class="item-text">
              <span class="item-top">
                <span class="item-title">{{ n.title }}</span>
                <span v-if="!n.read" class="new-tag">New</span>
              </span>
              <span :class="['item-body', { clamp: openId !== n.id }]">{{ n.body || '—' }}</span>
              <span class="item-meta">{{ n.sender_name || 'A manager' }} · {{ audienceLabel(n) }} · {{ formatTashkentDateTime(n.created_at) }}</span>
            </span>
          </button>
          <button v-if="isManager" type="button" class="cb-link delete" :aria-label="`Delete ${n.title}`" @click="remove(n)">Delete</button>
        </div>
        <div v-if="!items.length && !errorMessage" class="cb-empty-state">
          <strong>No alerts yet.</strong>
          <span>Messages from your manager show up here. Shift reminders arrive as phone notifications.</span>
        </div>
      </template>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { fetchNotifications, markNotificationsRead, deleteNotification } from '../services/notificationService';
import { currentStaffUser, activeStaffProfiles } from '../services/authService';
import { placeStaffShift, nextStaffShift, getShiftConfig, clockTashkent, formatTashkentDateTime } from '../config/shifts';
import { canManage, checksIn } from '../config/roles';
import { initials } from '../utils/format';

// unread: the new count, so the tab badge follows at once
const emit = defineEmits(['unread', 'open-checkin']);

const items = ref([]);
const isLoading = ref(false);
const errorMessage = ref('');
const openId = ref('');
const now = ref(new Date());
let timer = null;

const me = computed(() => currentStaffUser.value);
const isManager = computed(() => canManage(me.value?.role));
const unread = computed(() => items.value.filter(n => !n.read).length);

function audienceLabel(n) {
  if (n.audience === 'SHIFT') return `to ${getShiftConfig(n.audience_shift).label} shift`;
  if (n.audience === 'STAFF') {
    if (n.audience_staff_id === me.value?.id) return 'to you';
    return `to ${activeStaffProfiles.value.find(p => p.id === n.audience_staff_id)?.displayName || 'one person'}`;
  }
  return 'to everyone';
}

// Reminders go 2 minutes before a shift starts (check in) and ends (check out)
const nextReminder = computed(() => {
  if (!me.value || !checksIn(me.value.role)) return null;
  const run = placeStaffShift(now.value, me.value.id) || nextStaffShift(now.value, me.value.id);
  if (!run) return null;
  const startAlert = new Date(run.start.getTime() - 120000);
  const endAlert = new Date(run.end.getTime() - 120000);
  const shift = getShiftConfig(run.code).label;
  if (now.value < startAlert) return { what: 'check in', at: clockTashkent(startAlert), shift, edge: 'starts' };
  if (now.value < endAlert) return { what: 'check out', at: clockTashkent(endAlert), shift, edge: 'ends' };
  return null;
});

async function load() {
  isLoading.value = true;
  errorMessage.value = '';
  try {
    items.value = await fetchNotifications();
    emit('unread', unread.value);
  } catch (err) {
    errorMessage.value = err.message;
  } finally {
    isLoading.value = false;
  }
}

async function markRead(list) {
  const ids = list.filter(n => !n.read).map(n => n.id);
  if (!ids.length) return;
  items.value = items.value.map(n => (ids.includes(n.id) ? { ...n, read: true } : n));
  emit('unread', unread.value);
  try {
    await markNotificationsRead(ids, me.value?.id);
  } catch (err) {
    errorMessage.value = err.message;
  }
}

// Opening a message shows it in full and marks it read
function toggle(n) {
  openId.value = openId.value === n.id ? '' : n.id;
  if (!n.read) markRead([n]);
}

function markAll() {
  markRead(items.value);
}

async function remove(n) {
  try {
    await deleteNotification(n.id);
    items.value = items.value.filter(x => x.id !== n.id);
    emit('unread', unread.value);
  } catch (err) {
    errorMessage.value = err.message;
  }
}

onMounted(() => {
  load();
  timer = setInterval(() => { now.value = new Date(); }, 30000);
});
onUnmounted(() => clearInterval(timer));
</script>

<style scoped>
.alerts { display: flex; flex-direction: column; gap: 12px; }
.alerts-head { display: flex; align-items: baseline; gap: 10px; }
.mark-all { min-height: 44px; font-size: 13px; }
.reminder { display: flex; align-items: center; gap: 10px; padding: 12px 14px; background: var(--color-accent-100); border-color: var(--color-accent-400); color: var(--color-accent-900); }
.reminder-text { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
.strong { font-weight: 600; }
.list { display: flex; flex-direction: column; }
.item { display: flex; align-items: flex-start; border-top: 1px solid var(--color-hairline); }
.item:first-child { border-top: 0; }
.item.is-new { background: var(--color-accent-100); }
.item-main {
  flex: 1; min-width: 0; display: flex; gap: 10px; padding: 12px 14px; text-align: left; cursor: pointer;
  font: inherit; color: inherit; border: 0; background: transparent;
}
.mark { width: 32px; height: 32px; font-size: 12px; background: var(--color-accent); color: var(--color-bg); }
.item-text { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
.item-top { display: flex; align-items: baseline; gap: 8px; }
.item-title { flex: 1; min-width: 0; font-weight: 500; }
.item.is-new .item-title { font-weight: 600; }
.new-tag { font-size: 10px; letter-spacing: 0.08em; text-transform: uppercase; color: var(--color-accent-700); }
.item-body { font-size: 13px; color: var(--color-neutral-800); white-space: pre-line; }
.item-body.clamp { display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.item-meta { font-size: 12px; color: var(--color-neutral-700); }
.delete { padding: 14px; font-size: 12px; color: var(--color-signal); }
</style>
