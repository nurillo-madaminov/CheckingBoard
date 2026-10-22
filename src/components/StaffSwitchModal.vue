<template>
  <div
    class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-2xs p-4 select-none"
    @click.self="$emit('close')"
  >
    <div
      class="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 flex flex-col max-h-[90vh]"
    >
      <!-- Header -->
      <div class="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50 shrink-0">
        <div class="flex items-center gap-3">
          <div class="w-9 h-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-bold text-base shadow-xs">
            👥
          </div>
          <div>
            <h3 class="font-extrabold text-sm text-slate-900 flex items-center gap-2">
              <span>Team & Staff Management</span>
              <span class="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-800 border border-indigo-200">
                {{ activeTeam?.name || 'Fleet Team' }}
              </span>
            </h3>
            <p class="text-[11px] text-slate-500">
              Manage team accounts, create staff logins, and promote managers
            </p>
          </div>
        </div>
        <button
          @click="$emit('close')"
          class="text-slate-400 hover:text-slate-700 text-sm font-bold w-7 h-7 flex items-center justify-center rounded-lg hover:bg-slate-200 transition-colors"
        >
          ✕
        </button>
      </div>

      <!-- Navigation Tabs (Only for Managers) -->
      <div v-if="isManager" class="px-6 pt-3 border-b border-slate-100 flex gap-2 shrink-0 bg-white">
        <button
          @click="activeTab = 'members'"
          :class="[
            'pb-2.5 px-3 text-xs font-bold border-b-2 transition-all',
            activeTab === 'members'
              ? 'border-indigo-600 text-indigo-700'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          ]"
        >
          Team Members ({{ profiles.length }})
        </button>
        <button
          @click="activeTab = 'create_staff'"
          :class="[
            'pb-2.5 px-3 text-xs font-bold border-b-2 transition-all flex items-center gap-1',
            activeTab === 'create_staff'
              ? 'border-indigo-600 text-indigo-700'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          ]"
        >
          <span class="text-sm font-black">+</span>
          <span>Create Staff Account</span>
        </button>
      </div>

      <!-- Body Container -->
      <div class="p-6 overflow-y-auto space-y-4 flex-1">
        <!-- Notification Banner -->
        <div
          v-if="feedbackMessage"
          :class="[
            'p-3 rounded-lg text-xs font-semibold flex items-center justify-between',
            feedbackType === 'success'
              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
              : 'bg-rose-50 text-rose-800 border border-rose-200'
          ]"
        >
          <span>{{ feedbackMessage }}</span>
          <button @click="feedbackMessage = ''" class="font-bold opacity-70 hover:opacity-100">✕</button>
        </div>

        <!-- Current User Card with Logout Button -->
        <div class="bg-indigo-50/70 border border-indigo-200 p-3.5 rounded-xl flex items-center justify-between flex-wrap gap-2">
          <div class="flex items-center gap-2.5">
            <span class="text-2xl">{{ currentUser?.role === 'manager' ? '👑' : '👤' }}</span>
            <div>
              <div class="font-extrabold text-slate-900 text-xs flex items-center gap-2">
                <span>{{ currentUser?.displayName }}</span>
                <span
                  :class="[
                    'text-[9px] px-1.5 py-0.2 rounded font-black uppercase tracking-wider',
                    currentUser?.role === 'manager' ? 'bg-purple-200 text-purple-900' : 'bg-blue-200 text-blue-900'
                  ]"
                >
                  {{ currentUser?.role }}
                </span>
              </div>
              <div class="text-[11px] text-slate-500 font-mono">
                Username: <strong>{{ currentUser?.username || currentUser?.email }}</strong>
              </div>
            </div>
          </div>

          <div class="flex items-center gap-2">
            <button
              @click="handleLogout"
              class="px-3 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold transition-all"
            >
              Log Out
            </button>
          </div>
        </div>

        <!-- 1. TAB: TEAM MEMBERS LIST -->
        <div v-if="activeTab === 'members'" class="space-y-2.5">
          <div class="text-xs font-bold text-slate-700 flex items-center justify-between">
            <span>Staff Roster</span>
            <span class="text-[10px] text-slate-400">Managers can promote staff or reset credentials</span>
          </div>

          <div class="space-y-2">
            <div
              v-for="profile in profiles"
              :key="profile.id"
              :class="[
                'p-3 rounded-xl border bg-white hover:border-slate-300 transition-all flex items-center justify-between gap-3 flex-wrap',
                profile.isActive ? 'border-slate-200' : 'border-rose-200 bg-rose-50/40'
              ]"
            >
              <!-- Profile Info -->
              <div class="flex items-center gap-2.5 min-w-[180px]">
                <span class="text-xl">{{ profile.role === 'manager' ? '👑' : '👤' }}</span>
                <div>
                  <div class="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                    <span>{{ profile.displayName }}</span>
                    <span
                      :class="[
                        'text-[9px] px-1.5 py-0.2 rounded font-black uppercase',
                        profile.role === 'manager' ? 'bg-purple-100 text-purple-800' : 'bg-slate-100 text-slate-700'
                      ]"
                    >
                      {{ profile.role }}
                    </span>
                    <span v-if="!profile.isActive" class="text-[9px] px-1 py-0.2 rounded bg-rose-100 text-rose-700 font-bold">
                      Deactivated
                    </span>
                  </div>
                  <div class="text-[11px] text-slate-500 font-mono">
                    Login: <strong>{{ profile.username || profile.email }}</strong>
                  </div>
                </div>
              </div>

              <!-- Actions (Promote / Demote, Reset Password, Deactivate / Activate) -->
              <div class="flex items-center gap-1.5 flex-wrap">
                <!-- Promote to Manager button -->
                <button
                  v-if="isManager && profile.role !== 'manager' && profile.isActive"
                  @click="promoteMember(profile)"
                  class="px-2.5 py-1 rounded-lg bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 text-[11px] font-bold transition-all"
                  title="Promote this staff member to Manager role"
                >
                  ⭐ Promote to Manager
                </button>

                <!-- Demote to Staff button -->
                <button
                  v-if="isManager && profile.role === 'manager' && profile.id !== currentUser.id"
                  @click="demoteMember(profile)"
                  class="px-2 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 border border-slate-200 text-[11px] font-semibold transition-all"
                  title="Demote to Staff role"
                >
                  Demote to Staff
                </button>

                <!-- Reset Password (opens inline form below) -->
                <button
                  v-if="isManager && profile.id !== currentUser.id"
                  @click="togglePasswordReset(profile)"
                  class="px-2 py-1 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 text-[11px] font-semibold transition-all"
                  title="Set a new password for this account"
                >
                  🔑 Reset Password
                </button>

                <!-- Deactivate / Activate -->
                <button
                  v-if="isManager && profile.id !== currentUser.id"
                  @click="toggleActive(profile)"
                  :class="[
                    'px-2 py-1 rounded-lg border text-[11px] font-semibold transition-all',
                    profile.isActive
                      ? 'bg-rose-50 hover:bg-rose-100 text-rose-700 border-rose-200'
                      : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border-emerald-200'
                  ]"
                  :title="profile.isActive ? 'Block this account from signing in (history is kept)' : 'Allow this account to sign in again'"
                >
                  {{ profile.isActive ? 'Deactivate' : 'Activate' }}
                </button>

              </div>

              <!-- Inline Reset Password Form -->
              <form
                v-if="resetTargetId === profile.id"
                @submit.prevent="submitPasswordReset(profile)"
                class="w-full flex items-center gap-2 pt-2 border-t border-slate-100"
              >
                <input
                  v-model="resetPasswordValue"
                  type="text"
                  required
                  minlength="6"
                  placeholder="New password..."
                  class="flex-1 px-3 py-1.5 rounded-lg border border-slate-300 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
                <button
                  type="submit"
                  class="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shadow-2xs transition-all"
                >
                  Save Password
                </button>
                <button
                  type="button"
                  @click="resetTargetId = ''"
                  class="px-2 py-1.5 rounded-lg text-slate-500 hover:text-slate-800 text-xs font-semibold"
                >
                  Cancel
                </button>
              </form>
            </div>
          </div>
        </div>

        <!-- 2. TAB: CREATE STAFF ACCOUNT (MANAGER ADDS STAFF WITH USERNAME & PASSWORD) -->
        <div v-else-if="activeTab === 'create_staff'" class="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
          <div>
            <h4 class="font-bold text-xs text-slate-900">Create Account for Staff Member</h4>
            <p class="text-[11px] text-slate-500">
              Staff members will use this username and password to log in.
            </p>
          </div>

          <form @submit.prevent="handleCreateStaff" class="space-y-3 text-xs">
            <div>
              <label class="block font-bold text-slate-700 mb-1">
                Full Display Name
              </label>
              <input
                v-model="newStaffForm.displayName"
                type="text"
                required
                placeholder="e.g. Johnathan Smith"
                class="w-full px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div class="grid grid-cols-2 gap-2">
              <div>
                <label class="block font-bold text-slate-700 mb-1">
                  Username (Login ID)
                </label>
                <input
                  v-model="newStaffForm.username"
                  type="text"
                  required
                  autocapitalize="none"
                  pattern="[A-Za-z0-9][A-Za-z0-9._\-]{2,31}"
                  title="3-32 characters: letters, numbers, dot, dash or underscore"
                  placeholder="e.g. jsmith"
                  class="w-full px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label class="block font-bold text-slate-700 mb-1">
                  Initial Password
                </label>
                <input
                  v-model="newStaffForm.password"
                  type="text"
                  required
                  minlength="6"
                  placeholder="Min. 6 characters"
                  class="w-full px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            <div>
              <label class="block font-bold text-slate-700 mb-1">
                Role
              </label>
              <select
                v-model="newStaffForm.role"
                class="w-full px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
              >
                <option value="staff">Staff (Checking board + own activity log)</option>
                <option value="manager">Manager (Full team analytics + management)</option>
              </select>
            </div>

            <button
              type="submit"
              :disabled="isSaving"
              class="w-full py-2 rounded-lg disabled:opacity-50 bg-indigo-600 hover:bg-indigo-700 active:scale-[0.99] text-white font-bold text-xs shadow-sm transition-all"
            >
              Create Staff Account
            </button>
          </form>
        </div>

        <!-- Display Name Rename for Current User -->
        <div class="pt-3 border-t border-slate-100">
          <div class="text-xs font-bold text-slate-700 mb-1.5 flex items-center justify-between">
            <span>Update Your Display Name</span>
            <span class="text-[10px] text-emerald-600 font-normal">Past audit logs preserve historical snapshot</span>
          </div>
          <div class="flex items-center gap-2">
            <input
              v-model="editName"
              type="text"
              placeholder="New display name..."
              class="flex-1 px-3 py-1.5 rounded-lg border border-slate-300 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <button
              @click="saveDisplayName"
              :disabled="isSaving"
              class="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-2xs transition-all"
            >
              Update
            </button>
          </div>
        </div>
      </div>

      <!-- Footer -->
      <div class="px-6 py-3 bg-slate-50 border-t border-slate-100 flex justify-end shrink-0">
        <button
          @click="$emit('close')"
          class="px-4 py-1.5 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-bold transition-colors"
        >
          Close
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, reactive, onMounted, onUnmounted } from 'vue';
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

const emit = defineEmits(['close', 'user-changed', 'logout']);

const activeTab = ref('members'); // 'members' | 'create_staff'
const currentUser = computed(() => currentStaffUser.value);
const isManager = computed(() => isCurrentUserManager());
const profiles = computed(() => staffProfiles.value);
const activeTeam = computed(() => currentTeam.value);

const editName = ref(currentUser.value?.displayName || '');
const feedbackMessage = ref('');
const feedbackType = ref('success');
const isSaving = ref(false);

const newStaffForm = reactive({
  displayName: '',
  username: '',
  password: '',
  role: 'staff'
});

const resetTargetId = ref('');
const resetPasswordValue = ref('');

function showFeedback(message, type = 'success') {
  feedbackMessage.value = message;
  feedbackType.value = type;
}

// Run a database action with consistent feedback
async function run(action, successMessage) {
  isSaving.value = true;
  try {
    await action();
    showFeedback(successMessage, 'success');
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
    `Password for ${profile.displayName} updated. Share the new password with them; they were signed out everywhere.`
  );
  if (ok) {
    resetTargetId.value = '';
    resetPasswordValue.value = '';
  }
}

async function toggleActive(profile) {
  const activate = !profile.isActive;
  if (!activate && !confirm(`Deactivate ${profile.displayName}? They will be signed out and can no longer sign in. Their activity history is kept.`)) {
    return;
  }
  await run(
    () => setStaffActive(profile.id, activate),
    activate
      ? `${profile.displayName} can sign in again.`
      : `${profile.displayName} has been deactivated. Historical activity logs are preserved.`
  );
}

async function promoteMember(profile) {
  await run(() => setStaffRole(profile.id, 'manager'), `${profile.displayName} has been promoted to Manager!`);
}

async function demoteMember(profile) {
  await run(() => setStaffRole(profile.id, 'staff'), `${profile.displayName} role changed to Staff.`);
}

async function handleCreateStaff() {
  let created = null;
  const ok = await run(async () => {
    created = await createStaffAccount({
      displayName: newStaffForm.displayName,
      username: newStaffForm.username,
      password: newStaffForm.password,
      role: newStaffForm.role
    });
  }, '');
  if (ok && created) {
    showFeedback(`Account created! ${created.displayName} can now sign in with username '${created.username}' and the password you set.`);
    newStaffForm.displayName = '';
    newStaffForm.username = '';
    newStaffForm.password = '';
    newStaffForm.role = 'staff';
    activeTab.value = 'members';
  }
}

async function saveDisplayName() {
  if (!editName.value.trim()) return;
  const ok = await run(
    () => updateMyDisplayName(editName.value),
    'Display name updated. Historical activity logs keep the old name.'
  );
  if (ok) emit('user-changed', currentStaffUser.value);
}

function handleLogout() {
  emit('logout');
}

function onKeydown(e) {
  if (e.key === 'Escape') {
    emit('close');
  }
}

onMounted(() => {
  window.addEventListener('keydown', onKeydown);
  // Always show the latest roster from the database
  loadTeamRoster().catch(err => showFeedback(err.message, 'error'));
});

onUnmounted(() => {
  window.removeEventListener('keydown', onKeydown);
});
</script>
