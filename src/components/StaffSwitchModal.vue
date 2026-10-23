<template>
  <div class="cb-backdrop" @click.self="$emit('close')">
    <div class="cb-dialog staff" role="dialog" aria-modal="true">
      <div class="head">
        <div class="head-text">
          <span class="kicker">{{ activeTeam?.name || 'Team' }}</span>
          <span class="cb-dialog-title">Team &amp; staff</span>
        </div>
        <button class="btn btn-ghost btn-icon close" title="Close" @click="$emit('close')">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>
        </button>
      </div>

      <div v-if="feedbackMessage" :class="feedbackType === 'success' ? 'cb-success' : 'cb-error'" class="feedback">
        <span>{{ feedbackMessage }}</span>
        <button class="btn btn-ghost btn-icon" title="Dismiss" @click="feedbackMessage = ''">✕</button>
      </div>

      <!-- Own display name -->
      <form class="name-row" @submit.prevent="saveDisplayName">
        <div class="field grow">
          <label for="my-name">Your display name · past log entries keep the old name</label>
          <input id="my-name" v-model="editName" class="input" />
        </div>
        <button type="submit" class="btn btn-secondary tall" :disabled="isSaving">Save name</button>
      </form>

      <!-- Roster -->
      <div class="roster">
        <div v-for="profile in profiles" :key="profile.id" :class="['member', { 'is-off': !profile.isActive }]">
          <div class="who">
            <span class="cb-avatar avatar">{{ initials(profile.displayName) }}</span>
            <div class="who-text">
              <span class="who-name cb-ellipsis">{{ profile.displayName }}</span>
              <span class="who-meta cb-ellipsis">@{{ profile.username || profile.email }} · {{ shiftName(profile.shiftCode) }}</span>
            </div>
          </div>
          <span :class="['role', { 'is-manager': profile.role === 'manager' }]">{{ profile.role }}</span>
          <span class="state">{{ profile.isActive ? 'Active' : 'Deactivated' }}</span>
          <div class="member-actions">
            <template v-if="isManager && profile.id !== currentUser?.id">
              <button v-if="profile.isActive" class="btn btn-ghost" :disabled="isSaving" @click="toggleRole(profile)">
                {{ profile.role === 'manager' ? 'Demote to staff' : 'Promote to manager' }}
              </button>
              <button class="btn btn-ghost" @click="togglePasswordReset(profile)">Reset password</button>
              <button class="btn btn-ghost" :disabled="isSaving" @click="askToggleActive(profile)">
                {{ profile.isActive ? 'Deactivate' : 'Activate' }}
              </button>
            </template>
            <span v-else-if="profile.id === currentUser?.id" class="you">You</span>
          </div>

          <form v-if="resetTargetId === profile.id" class="reset" @submit.prevent="submitPasswordReset(profile)">
            <input v-model="resetPasswordValue" class="input" type="text" required minlength="6" placeholder="New password (at least 6 characters)" />
            <button type="submit" class="btn btn-primary" :disabled="isSaving">Save password</button>
            <button type="button" class="btn btn-secondary" @click="resetTargetId = ''">Cancel</button>
          </form>
        </div>
      </div>

      <!-- Create account (managers) -->
      <form v-if="isManager" class="create" @submit.prevent="handleCreateStaff">
        <span class="create-title">Create staff account</span>
        <div class="create-grid">
          <div class="field">
            <label for="new-name">Full name</label>
            <input id="new-name" v-model="newStaffForm.displayName" class="input" required placeholder="Enter full name" />
          </div>
          <div class="field">
            <label for="new-user">Username</label>
            <input
              id="new-user"
              v-model="newStaffForm.username"
              class="input"
              required
              autocapitalize="none"
              pattern="[A-Za-z0-9][A-Za-z0-9._\-]{2,31}"
              title="3-32 characters: letters, numbers, dot, dash or underscore"
              placeholder="Choose a username"
            />
          </div>
          <div class="field">
            <label for="new-pass">Initial password</label>
            <input id="new-pass" v-model="newStaffForm.password" class="input" type="text" required minlength="6" placeholder="At least 6 characters" />
          </div>
          <div class="seg role-seg">
            <button type="button" :class="['seg-btn', { 'is-on': newStaffForm.role === 'staff' }]" @click="newStaffForm.role = 'staff'">Staff</button>
            <button type="button" :class="['seg-btn', { 'is-on': newStaffForm.role === 'manager' }]" @click="newStaffForm.role = 'manager'">Manager</button>
          </div>
        </div>
        <div class="create-actions">
          <button type="button" class="btn btn-ghost logout" @click="$emit('logout')">Log out</button>
          <button type="submit" class="btn btn-primary" :disabled="isSaving">Create account</button>
        </div>
      </form>
      <div v-else class="create-actions">
        <button type="button" class="btn btn-ghost logout" @click="$emit('logout')">Log out</button>
      </div>
    </div>

    <ConfirmDialog
      v-if="confirmTarget"
      :title="`Deactivate ${confirmTarget.displayName}?`"
      body="They are signed out and can no longer sign in. Their past log entries are kept."
      okLabel="Deactivate"
      @confirm="confirmDeactivate"
      @cancel="confirmTarget = null"
    />
  </div>
</template>

<script setup>
import { ref, computed, reactive, onMounted, onUnmounted } from 'vue';
import ConfirmDialog from './ConfirmDialog.vue';
import {
  currentStaffUser,
  staffProfiles,
  currentTeam,
  isCurrentUserManager,
  loadTeamRoster,
  createStaffAccount,
  setStaffRole,
  resetStaffPassword,
  setStaffActive,
  updateMyDisplayName
} from '../services/authService';
import { getShiftConfig } from '../config/shifts';
import { initials } from '../utils/format';

const emit = defineEmits(['close', 'user-changed', 'logout']);

const currentUser = computed(() => currentStaffUser.value);
const isManager = computed(() => isCurrentUserManager());
const profiles = computed(() => staffProfiles.value);
const activeTeam = computed(() => currentTeam.value);

const editName = ref(currentUser.value?.displayName || '');
const feedbackMessage = ref('');
const feedbackType = ref('success');
const isSaving = ref(false);
const resetTargetId = ref('');
const resetPasswordValue = ref('');
const confirmTarget = ref(null);

const newStaffForm = reactive({ displayName: '', username: '', password: '', role: 'staff' });

function shiftName(code) {
  return code ? getShiftConfig(code).label : 'No shift';
}

function showFeedback(message, type = 'success') {
  feedbackMessage.value = message;
  feedbackType.value = type;
}

// Run a database action with consistent feedback
async function run(action, successMessage) {
  isSaving.value = true;
  try {
    await action();
    if (successMessage) showFeedback(successMessage, 'success');
    return true;
  } catch (err) {
    showFeedback(err.message || 'Something went wrong', 'error');
    return false;
  } finally {
    isSaving.value = false;
  }
}

function togglePasswordReset(profile) {
  resetPasswordValue.value = '';
  resetTargetId.value = resetTargetId.value === profile.id ? '' : profile.id;
}

async function submitPasswordReset(profile) {
  const ok = await run(
    () => resetStaffPassword(profile.id, resetPasswordValue.value),
    `Password for ${profile.displayName} updated. They were signed out everywhere; share the new password with them.`
  );
  if (ok) {
    resetTargetId.value = '';
    resetPasswordValue.value = '';
  }
}

function askToggleActive(profile) {
  if (profile.isActive) {
    confirmTarget.value = profile;
  } else {
    run(() => setStaffActive(profile.id, true), `${profile.displayName} can sign in again.`);
  }
}

async function confirmDeactivate() {
  const profile = confirmTarget.value;
  confirmTarget.value = null;
  await run(() => setStaffActive(profile.id, false), `${profile.displayName} has been deactivated. Their log entries are kept.`);
}

async function toggleRole(profile) {
  const next = profile.role === 'manager' ? 'staff' : 'manager';
  await run(() => setStaffRole(profile.id, next), `${profile.displayName} is now ${next === 'manager' ? 'a manager' : 'staff'}.`);
}

async function handleCreateStaff() {
  let created = null;
  const ok = await run(async () => {
    created = await createStaffAccount({ ...newStaffForm });
  });
  if (ok && created) {
    showFeedback(`Account created. ${created.displayName} can sign in as @${created.username} with the password you set.`);
    Object.assign(newStaffForm, { displayName: '', username: '', password: '', role: 'staff' });
  }
}

async function saveDisplayName() {
  if (!editName.value.trim()) return;
  const ok = await run(() => updateMyDisplayName(editName.value), 'Display name updated. Past log entries keep the old name.');
  if (ok) emit('user-changed', currentStaffUser.value);
}

function onKeydown(e) {
  if (e.key === 'Escape' && !confirmTarget.value) emit('close');
}

onMounted(() => {
  window.addEventListener('keydown', onKeydown);
  // Always show the latest roster from the database
  loadTeamRoster().catch(err => showFeedback(err.message, 'error'));
});
onUnmounted(() => window.removeEventListener('keydown', onKeydown));
</script>

<style scoped>
.staff { width: min(760px, 100%); gap: 20px; }
.head { display: flex; align-items: flex-start; justify-content: space-between; }
.head-text { display: flex; flex-direction: column; gap: 2px; }
.kicker { font-size: 10px; letter-spacing: 0.1em; text-transform: uppercase; color: var(--color-accent-700); }
.close { width: 32px; height: 32px; color: var(--color-text); }
.feedback { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.feedback .btn { color: inherit; }

.name-row { display: flex; align-items: flex-end; gap: 10px; }
.grow { flex: 1; }
.tall { min-height: 36px; }

.roster { border: 1px solid var(--color-divider); }
.member {
  display: grid; grid-template-columns: minmax(0, 1fr) 84px 84px 320px; align-items: center; gap: 10px;
  padding: 8px 12px; border-top: 1px solid var(--color-hairline);
}
.member:first-child { border-top: 0; }
.member.is-off { opacity: 0.55; }
.who { display: flex; align-items: center; gap: 10px; min-width: 0; }
.avatar { width: 30px; height: 30px; font-size: 13px; }
.who-text { display: flex; flex-direction: column; min-width: 0; }
.who-name { font-size: 14px; font-weight: 500; }
.who-meta { font-size: 12px; color: var(--color-neutral-700); }
.role {
  justify-self: start; font-size: 10px; letter-spacing: 0.08em; text-transform: uppercase; padding: 2px 7px;
  background: var(--color-accent-100); color: var(--color-accent-800);
}
.role.is-manager { background: var(--color-accent); color: var(--color-bg); }
.state { font-size: 12px; color: var(--color-neutral-700); }
.member-actions { display: flex; gap: 2px; justify-content: flex-end; flex-wrap: wrap; }
.member-actions .btn { font-size: 13px; }
.you { font-size: 12px; color: var(--color-neutral-700); padding: 0 8px; }
.reset { grid-column: 1 / -1; display: flex; gap: 8px; padding-top: 6px; }

.create { display: flex; flex-direction: column; gap: 12px; padding-top: 4px; }
.create-title { font-family: var(--font-heading); font-weight: 600; font-size: 18px; }
.create-grid { display: grid; grid-template-columns: 1.3fr 1fr 1fr auto; gap: 10px; align-items: end; }
.role-seg { height: 36px; }
.create-actions { display: flex; justify-content: flex-end; gap: 8px; }
.logout { margin-right: auto; color: var(--color-neutral-700); }

@media (max-width: 760px) {
  .member { grid-template-columns: minmax(0, 1fr) auto; }
  .create-grid { grid-template-columns: 1fr; }
}
</style>
