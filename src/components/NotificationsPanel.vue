<template>
  <aside ref="panelRef" :class="['drawer', 'cb-scroll', { 'beside-rail': sidebarCollapsed }]" role="dialog" aria-label="Notifications">
    <div class="head">
      <div class="head-text">
        <span class="kicker">{{ isManager ? 'Send to your team' : 'From your manager' }}</span>
        <span class="title">Notifications</span>
      </div>
      <button class="btn btn-ghost btn-icon close" title="Close (Esc)" @click="$emit('close')">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>
      </button>
    </div>

    <!-- Compose (managers) -->
    <form v-if="isManager" class="compose" @submit.prevent="send">
      <div class="field">
        <label for="ntf-title">Title</label>
        <input id="ntf-title" v-model="form.title" class="input" required maxlength="120" placeholder="e.g. Check all AT PU drivers" />
      </div>
      <div class="field">
        <label for="ntf-body">Message</label>
        <textarea id="ntf-body" v-model="form.body" class="input" maxlength="1000" placeholder="Details (optional)"></textarea>
      </div>
      <div class="field">
        <label>Send to</label>
        <div class="seg audience">
          <button
            v-for="a in AUDIENCES"
            :key="a.code"
            type="button"
            :class="['seg-btn', { 'is-on': form.audience === a.code }]"
            @click="form.audience = a.code"
          >
            {{ a.label }}
          </button>
        </div>
      </div>
      <select v-if="form.audience === 'SHIFT'" v-model="form.shift" class="input" required>
        <option v-for="s in SHIFTS" :key="s.code" :value="s.code">{{ s.label }} shift ({{ shiftHours(s.code).tashkent }})</option>
      </select>
      <select v-if="form.audience === 'STAFF'" v-model="form.staffId" class="input" required>
        <option value="" disabled>Choose a person</option>
        <option v-for="p in recipients" :key="p.id" :value="p.id">{{ p.displayName }}</option>
      </select>
      <div v-if="errorMessage" class="cb-error">{{ errorMessage }}</div>
      <button type="submit" class="btn btn-primary send" :disabled="isSending || !form.title.trim()">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M14.536 21.686a.5.5 0 0 0 .937-.024l6.5-19a.496.496 0 0 0-.635-.635l-19 6.5a.5.5 0 0 0-.024.937l7.93 3.18a2 2 0 0 1 1.112 1.11z" /><path d="m21.854 2.147-10.94 10.939" /></svg>
        {{ isSending ? 'Sending…' : 'Send notification' }}
      </button>
    </form>

    <!-- List -->
    <div class="list-head cb-label">{{ isManager ? 'Sent and received' : 'Inbox' }} · {{ notifications.length }}</div>
    <div class="list">
      <div v-for="n in notifications" :key="n.id" :class="['item', { 'is-new': unreadIds.has(n.id) }]">
        <span class="cb-avatar avatar">{{ initials(n.sender_name) }}</span>
        <div class="item-body">
          <div class="item-top">
            <span class="item-title">{{ n.title }}</span>
            <span v-if="unreadIds.has(n.id)" class="new">New</span>
          </div>
          <p v-if="n.body" class="item-text">{{ n.body }}</p>
          <div class="item-meta">
            <span>{{ n.sender_name || 'Manager' }}</span>
            <span>·</span>
            <span :title="new Date(n.created_at).toLocaleString()">{{ timeAgo(n.created_at) }}</span>
            <template v-if="isManager">
              <span>·</span>
              <span>{{ audienceLabel(n) }}</span>
            </template>
          </div>
        </div>
        <button
          v-if="isManager && n.sender_id === myId"
          class="btn btn-ghost btn-icon unsend"
          title="Unsend"
          @click="remove(n)"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18" /><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" /><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" /></svg>
        </button>
      </div>
      <div v-if="!notifications.length" class="empty">
        {{ isManager ? 'Nothing sent yet. Notifications you send appear here.' : 'No notifications yet.' }}
      </div>
    </div>
  </aside>
</template>

<script setup>
import { ref, reactive, computed, onMounted, onUnmounted } from 'vue';
import { AUDIENCES, sendNotification, deleteNotification } from '../services/notificationService';
import { currentStaffUser } from '../services/authService';
import { SHIFTS, getShiftConfig, shiftHours } from '../config/shifts';
import { initials } from '../utils/format';

const props = defineProps({
  notifications: { type: Array, default: () => [] },
  // Unread when the drawer opened (marked "New")
  unreadIds: { type: Object, default: () => new Set() },
  isManager: { type: Boolean, default: false },
  roster: { type: Array, default: () => [] },
  sidebarCollapsed: { type: Boolean, default: false }
});

const emit = defineEmits(['close', 'changed', 'sent']);

const panelRef = ref(null);
const myId = computed(() => currentStaffUser.value?.id);
const recipients = computed(() => props.roster.filter(p => p.isActive && p.id !== myId.value));
const isSending = ref(false);
const errorMessage = ref('');
const form = reactive({ title: '', body: '', audience: 'ALL', shift: 'MORNING', staffId: '' });

function audienceLabel(n) {
  if (n.audience === 'SHIFT') return `To ${getShiftConfig(n.audience_shift).label} shift`;
  if (n.audience === 'STAFF') {
    const person = props.roster.find(p => p.id === n.audience_staff_id);
    return `To ${person ? person.displayName : 'one person'}`;
  }
  return 'To everyone';
}

function timeAgo(iso) {
  const min = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 60000));
  if (min < 1) return 'just now';
  if (min < 60) return `${min}m ago`;
  const h = Math.round(min / 60);
  if (h < 24) return `${h}h ago`;
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

async function send() {
  if (!form.title.trim()) return;
  if (form.audience === 'STAFF' && !form.staffId) {
    errorMessage.value = 'Choose who to send it to';
    return;
  }
  isSending.value = true;
  errorMessage.value = '';
  try {
    await sendNotification({
      title: form.title,
      body: form.body,
      audience: form.audience,
      audienceShift: form.shift,
      audienceStaffId: form.staffId
    });
    const to = audienceLabel({ audience: form.audience, audience_shift: form.shift, audience_staff_id: form.staffId });
    Object.assign(form, { title: '', body: '' });
    emit('sent', to);
    emit('changed');
  } catch (err) {
    errorMessage.value = err.message || 'Could not send the notification';
  } finally {
    isSending.value = false;
  }
}

async function remove(n) {
  try {
    await deleteNotification(n.id);
    emit('changed');
  } catch (err) {
    errorMessage.value = err.message || 'Could not unsend the notification';
  }
}

// Close on Esc or a click outside (clicks in the sidebar toggle it themselves)
function onKeydown(e) {
  if (e.key === 'Escape') emit('close');
}
function onDocumentClick(e) {
  if (panelRef.value && !panelRef.value.contains(e.target) && !e.target.closest('.side')) emit('close');
}

onMounted(() => {
  window.addEventListener('keydown', onKeydown);
  setTimeout(() => document.addEventListener('click', onDocumentClick));
});
onUnmounted(() => {
  window.removeEventListener('keydown', onKeydown);
  document.removeEventListener('click', onDocumentClick);
});
</script>

<style scoped>
.drawer {
  position: fixed; top: 0; bottom: 0; left: 236px; z-index: 50; width: 380px; max-width: calc(100vw - 60px);
  overflow-y: auto; display: flex; flex-direction: column; gap: 14px; padding: 18px;
  background: var(--color-neutral-100); border-right: 1px solid var(--color-divider); box-shadow: var(--shadow-lg);
  user-select: text;
}
@media (max-width: 1240px) { .drawer { left: 200px; } }
.drawer.beside-rail { left: 60px; }

.head { display: flex; align-items: flex-start; justify-content: space-between; }
.head-text { display: flex; flex-direction: column; gap: 2px; }
.kicker { font-size: 10px; letter-spacing: 0.1em; text-transform: uppercase; color: var(--color-accent-700); }
.title { font-family: var(--font-heading); font-weight: 600; font-size: 24px; line-height: 1.1; }
.close { width: 32px; height: 32px; color: var(--color-text); }

.compose { display: flex; flex-direction: column; gap: 10px; padding: 14px; border: 1px solid var(--color-divider); background: var(--color-bg); }
.compose .input { background-color: var(--color-neutral-100); }
.audience { display: flex; }
.send { align-self: flex-end; }

.list-head { padding-top: 4px; }
.list { display: flex; flex-direction: column; border: 1px solid var(--color-divider); background: var(--color-bg); }
.item { display: flex; gap: 10px; padding: 12px; border-top: 1px solid var(--color-hairline); }
.item:first-child { border-top: 0; }
.item.is-new { background: var(--color-accent-100); box-shadow: inset 3px 0 0 var(--color-accent); }
.avatar { width: 28px; height: 28px; font-size: 11px; }
.item-body { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 3px; }
.item-top { display: flex; align-items: center; gap: 8px; }
.item-title { font-size: 14px; font-weight: 600; }
.new { font-size: 10px; letter-spacing: 0.08em; text-transform: uppercase; padding: 0 6px; background: var(--color-accent); color: var(--color-bg); }
.item-text { margin: 0; font-size: 13px; color: var(--color-neutral-800); white-space: pre-wrap; overflow-wrap: anywhere; }
.item-meta { display: flex; flex-wrap: wrap; gap: 4px; font-size: 12px; color: var(--color-neutral-700); }
.unsend { color: var(--color-neutral-700); flex-shrink: 0; }
.empty { padding: 28px 16px; text-align: center; font-size: 13px; color: var(--color-neutral-700); }
</style>
