<template>
  <div class="members">
    <div v-if="feedbackMessage" :class="feedbackType === 'success' ? 'cb-success' : 'cb-error'" class="feedback">
      <span>{{ feedbackMessage }}</span>
      <button class="btn btn-ghost btn-icon" title="Dismiss" @click="feedbackMessage = ''">✕</button>
    </div>

    <!-- Roster: the only place deactivated members are listed -->
    <div class="cb-panel roster">
      <div v-for="profile in profiles" :key="profile.id" :class="['member', { 'is-off': !profile.isActive }]">
        <div class="who">
          <span class="cb-avatar avatar">{{ initials(profile.displayName) }}</span>
          <div class="who-text">
            <span class="who-name cb-ellipsis">{{ profile.displayName }}</span>
            <span class="who-meta cb-ellipsis">@{{ profile.username || profile.email }} · {{ shiftName(profile.shiftCode) }}</span>
          </div>
        </div>
        <span :class="['role', `is-${profile.role}`]">{{ roleLabel(profile.role) }}</span>
        <span class="state">{{ profile.isActive ? 'Active' : 'Deactivated' }}</span>
        <div class="member-actions">
          <template v-if="profile.id !== currentUser?.id">
            <select
              v-if="profile.isActive"
              class="input role-select"
              :value="profile.role"
              :disabled="isSaving"
              :aria-label="`Role of ${profile.displayName}`"
              @change="changeRole(profile, $event)"
            >
              <option v-for="r in ROLES" :key="r.code" :value="r.code">{{ r.label }}</option>
            </select>
            <button class="btn btn-ghost" @click="togglePasswordReset(profile)">Reset password</button>
            <button class="btn btn-ghost" :disabled="isSaving" @click="askToggleActive(profile)">
              {{ profile.isActive ? 'Deactivate' : 'Activate' }}
            </button>
          </template>
          <span v-else class="you">You · edit in Profile settings</span>
        </div>

        <form v-if="resetTargetId === profile.id" class="reset" @submit.prevent="submitPasswordReset(profile)">
          <input v-model="resetPasswordValue" class="input" type="text" required minlength="6" placeholder="New password (at least 6 characters)" />
          <button type="submit" class="btn btn-primary" :disabled="isSaving">Save password</button>
          <button type="button" class="btn btn-secondary" @click="resetTargetId = ''">Cancel</button>
        </form>
      </div>
      <div v-if="!profiles.length" class="empty">No team members yet.</div>
    </div>

    <!-- Create account -->
    <form class="cb-panel create" @submit.prevent="handleCreateStaff">
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
          <button
            v-for="r in ROLES"
            :key="r.code"
            type="button"
            :class="['seg-btn', { 'is-on': newStaffForm.role === r.code }]"
            @click="newStaffForm.role = r.code"
          >
            {{ r.label }}
          </button>
        </div>
      </div>
      <span class="cb-sub hint">Supervisors lead a group: they have every manager power and check in / out. Managers run the whole team and don't check in.</span>
      <div class="create-actions">
        <button type="submit" class="btn btn-primary" :disabled="isSaving">Create account</button>
      </div>
    </form>

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
import { ref, computed, reactive, onMounted } from 'vue';
import ConfirmDialog from './ConfirmDialog.vue';
import {
  currentStaffUser,
  staffProfiles,
  loadTeamRoster,
  createStaffAccount,
  setStaffRole,
  resetStaffPassword,
  setStaffActive
} from '../services/authService';
import { getShiftConfig } from '../config/shifts';
import { ROLES, roleLabel } from '../config/roles';
import { initials } from '../utils/format';

const currentUser = computed(() => currentStaffUser.value);
const profiles = computed(() => staffProfiles.value);

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

async function changeRole(profile, event) {
  const next = event.target.value;
  const ok = await run(() => setStaffRole(profile.id, next), `${profile.displayName} is now ${next === 'staff' ? 'staff' : `a ${roleLabel(next).toLowerCase()}`}.`);
  // The list keeps the old role on failure; put the picker back to match it
  if (!ok) event.target.value = profile.role;
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

// Always show the latest roster from the database
onMounted(() => {
  loadTeamRoster().catch(err => showFeedback(err.message, 'error'));
});
</script>

<style scoped>
.members { display: flex; flex-direction: column; gap: 14px; }
.feedback { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.feedback .btn { color: inherit; }

.roster { display: flex; flex-direction: column; }
.member {
  display: grid; grid-template-columns: minmax(0, 1fr) 96px 84px 340px; align-items: center; gap: 10px;
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
.role.is-supervisor { background: var(--color-accent-300); color: var(--color-accent-900); }
.role-select { width: auto; min-height: 30px; padding-block: 2px; font-size: 13px; background-color: var(--color-bg); }
.hint { font-size: 12px; }
.state { font-size: 12px; color: var(--color-neutral-700); }
.member-actions { display: flex; gap: 2px; justify-content: flex-end; flex-wrap: wrap; }
.member-actions .btn { font-size: 13px; }
.you { font-size: 12px; color: var(--color-neutral-700); padding: 0 8px; }
.reset { grid-column: 1 / -1; display: flex; gap: 8px; padding-top: 6px; }
.empty { padding: 24px; text-align: center; font-size: 13px; color: var(--color-neutral-700); }

.create { display: flex; flex-direction: column; gap: 12px; padding: 16px; }
.create-title { font-family: var(--font-heading); font-weight: 600; font-size: 18px; }
.create-grid { display: grid; grid-template-columns: 1.3fr 1fr 1fr auto; gap: 10px; align-items: end; }
.role-seg { height: 36px; }
.create-actions { display: flex; justify-content: flex-end; gap: 8px; }

@media (max-width: 900px) {
  .member { grid-template-columns: minmax(0, 1fr) auto auto; }
  .member-actions { grid-column: 1 / -1; justify-content: flex-start; }
  .create-grid { grid-template-columns: 1fr; }
}
@media (max-width: 640px) {
  .reset { flex-wrap: wrap; }
  .reset .input { flex: 1 1 100%; }
  .role-seg { height: 42px; }
  .create-actions .btn { width: 100%; min-height: 42px; }
}
</style>
