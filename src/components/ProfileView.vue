<template>
  <div class="cb-page cb-scroll profile">
    <div class="cb-page-head">
      <div class="title-block">
        <h2 class="cb-title">Profile settings</h2>
        <span class="cb-sub">Your own account. Changes apply on every device.</span>
      </div>
    </div>

    <div class="body">
      <!-- Who you are -->
      <div class="cb-panel me">
        <span class="cb-avatar me-avatar">{{ initials(user?.displayName) }}</span>
        <div class="me-text">
          <span class="me-name cb-ellipsis">{{ user?.displayName }}</span>
          <span class="cb-sub cb-ellipsis">@{{ user?.username }} · {{ user?.role }} · {{ teamName }}</span>
        </div>
      </div>

      <!-- Name -->
      <form class="cb-panel section" @submit.prevent="saveName">
        <span class="section-title">Name</span>
        <div class="field">
          <label for="profile-name">Display name · past log entries keep the old name</label>
          <input id="profile-name" v-model="form.name" class="input" required maxlength="80" autocomplete="name" />
        </div>
        <div v-if="notes.name" :class="notes.name.ok ? 'cb-success' : 'cb-error'">{{ notes.name.text }}</div>
        <div class="actions">
          <button type="submit" class="btn btn-primary" :disabled="busy === 'name' || !nameChanged">
            {{ busy === 'name' ? 'Saving…' : 'Save name' }}
          </button>
        </div>
      </form>

      <!-- Username -->
      <form class="cb-panel section" @submit.prevent="saveUsername">
        <span class="section-title">Username</span>
        <div class="field">
          <label for="profile-username">You sign in with your username</label>
          <input
            id="profile-username"
            v-model="form.username"
            class="input"
            required
            autocomplete="username"
            autocapitalize="none"
            spellcheck="false"
            pattern="[A-Za-z0-9][A-Za-z0-9._\-]{2,31}"
            title="3-32 characters: letters, numbers, dot, dash or underscore"
          />
        </div>
        <span class="cb-sub hint">3-32 characters: letters, numbers, dot, dash or underscore. You stay signed in; next time sign in with the new username (also in the Leader ELD extension).</span>
        <div v-if="notes.username" :class="notes.username.ok ? 'cb-success' : 'cb-error'">{{ notes.username.text }}</div>
        <div class="actions">
          <button type="submit" class="btn btn-primary" :disabled="busy === 'username' || !usernameChanged">
            {{ busy === 'username' ? 'Saving…' : 'Save username' }}
          </button>
        </div>
      </form>

      <!-- Password -->
      <form class="cb-panel section" @submit.prevent="savePassword">
        <span class="section-title">Password</span>
        <div class="field">
          <label for="profile-current">Current password</label>
          <input id="profile-current" v-model="form.current" class="input" type="password" required autocomplete="current-password" />
        </div>
        <div class="two-col">
          <div class="field">
            <label for="profile-new">New password</label>
            <input id="profile-new" v-model="form.next" class="input" type="password" required minlength="6" autocomplete="new-password" placeholder="At least 6 characters" />
          </div>
          <div class="field">
            <label for="profile-confirm">Repeat new password</label>
            <input id="profile-confirm" v-model="form.confirm" class="input" type="password" required minlength="6" autocomplete="new-password" />
          </div>
        </div>
        <span class="cb-sub hint">This device stays signed in; your other devices are signed out.</span>
        <div v-if="notes.password" :class="notes.password.ok ? 'cb-success' : 'cb-error'">{{ notes.password.text }}</div>
        <div class="actions">
          <button type="submit" class="btn btn-primary" :disabled="busy === 'password'">
            {{ busy === 'password' ? 'Saving…' : 'Change password' }}
          </button>
        </div>
      </form>

      <!-- Phone alerts on this device (hidden when push isn't configured) -->
      <PushAlertsToggle />

      <div class="signout">
        <button type="button" class="btn btn-secondary" @click="$emit('logout')">Sign out of this device</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { reactive, ref, computed, watch } from 'vue';
import PushAlertsToggle from './PushAlertsToggle.vue';
import {
  currentStaffUser, currentTeam, updateMyDisplayName, updateMyUsername, changeMyPassword
} from '../services/authService';
import { initials } from '../utils/format';

const emit = defineEmits(['logout', 'saved']);

const user = computed(() => currentStaffUser.value);
const teamName = computed(() => currentTeam.value?.name || 'Your team');

const form = reactive({ name: '', username: '', current: '', next: '', confirm: '' });
// One message per section: { ok, text }
const notes = reactive({ name: null, username: null, password: null });
const busy = ref('');

// Fill the boxes with the saved values (again after each save)
watch(user, (u) => {
  form.name = u?.displayName || '';
  form.username = u?.username || '';
}, { immediate: true });

const nameChanged = computed(() => form.name.trim() && form.name.trim() !== user.value?.displayName);
const usernameChanged = computed(() => form.username.trim() && form.username.trim().toLowerCase() !== user.value?.username);

async function run(section, action, success) {
  busy.value = section;
  notes[section] = null;
  try {
    await action();
    notes[section] = { ok: true, text: success };
    emit('saved', success);
    return true;
  } catch (err) {
    notes[section] = { ok: false, text: err.message || 'Something went wrong' };
    return false;
  } finally {
    busy.value = '';
  }
}

function saveName() {
  return run('name', () => updateMyDisplayName(form.name), 'Name saved. Past log entries keep the old name.');
}

function saveUsername() {
  const next = form.username.trim().toLowerCase();
  return run('username', () => updateMyUsername(next), `Username changed. Next time sign in as @${next}.`);
}

async function savePassword() {
  if (form.next !== form.confirm) {
    notes.password = { ok: false, text: 'The new passwords don\'t match.' };
    return;
  }
  const ok = await run('password', () => changeMyPassword(form.current, form.next), 'Password changed. Your other devices were signed out.');
  if (ok) Object.assign(form, { current: '', next: '', confirm: '' });
}
</script>

<style scoped>
.profile { user-select: text; }
.title-block { display: flex; flex-direction: column; gap: 1px; min-width: 0; }
.body { display: flex; flex-direction: column; gap: 14px; width: 100%; max-width: 640px; }

.me { display: flex; align-items: center; gap: 14px; padding: 16px; }
.me-avatar { width: 48px; height: 48px; font-size: 18px; }
.me-text { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.me-name { font-family: var(--font-heading); font-weight: 600; font-size: 22px; line-height: 1.1; }

.section { display: flex; flex-direction: column; gap: 12px; padding: 16px; }
.section-title { font-family: var(--font-heading); font-weight: 600; font-size: 18px; text-transform: uppercase; }
.two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.hint { font-size: 12px; line-height: 1.45; }
.actions { display: flex; justify-content: flex-end; }
.signout { display: flex; justify-content: flex-start; padding-bottom: 8px; }

@media (max-width: 640px) {
  .two-col { grid-template-columns: 1fr; }
  .actions .btn, .signout .btn { width: 100%; min-height: 42px; }
}
</style>
