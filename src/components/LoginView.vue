<template>
  <div class="login">
    <!-- Brand panel -->
    <div class="hero">
      <div class="hero-brand">
        <span class="hero-mark">CB</span>
        <span class="hero-name">CheckingBoard</span>
      </div>
      <div class="hero-copy">
        <div class="hero-title">Every driver,<br>checked on time.</div>
        <p class="hero-text">
          A live dispatch board for carrier teams. Drivers grouped by company, sorted by status and aged by
          their last check, with every ELD action logged to the shift that made it.
        </p>
      </div>
      <div class="hero-shifts">
        <div v-for="s in SHIFTS" :key="s.code" class="hero-shift">
          <span class="hero-shift-label">{{ s.label }}</span>
          <span class="hero-shift-hours">{{ shiftHours(s.code).tashkent }}</span>
        </div>
      </div>
    </div>

    <!-- Form -->
    <div class="form-side">
      <form class="card" @submit.prevent="mode === 'login' ? handleLogin() : handleCreateTeam()">
        <div class="seg">
          <button type="button" :class="['seg-btn', { 'is-on': mode === 'login' }]" @click="setMode('login')">Sign in</button>
          <button type="button" :class="['seg-btn', { 'is-on': mode === 'create_team' }]" @click="setMode('create_team')">Create a team</button>
        </div>

        <div v-if="errorMessage" class="cb-error">{{ errorMessage }}</div>

        <div v-if="mode === 'login'" class="fields">
          <h3 class="card-title">Sign in to CheckingBoard</h3>
          <div class="field">
            <label for="login-user">Username</label>
            <input id="login-user" v-model="loginForm.username" class="input" required autocomplete="username" autocapitalize="none" placeholder="Enter your username" />
          </div>
          <div class="field">
            <label for="login-pass">Password</label>
            <input id="login-pass" v-model="loginForm.password" class="input" type="password" required autocomplete="current-password" placeholder="Enter your password" />
          </div>
        </div>

        <div v-else class="fields">
          <h3 class="card-title">Create a team</h3>
          <p class="cb-sub card-note">You become the team's manager and can create logins for your staff.</p>
          <div class="field">
            <label for="team-name">Team / company name</label>
            <input id="team-name" v-model="teamForm.teamName" class="input" required placeholder="Enter team name" />
          </div>
          <div class="field">
            <label for="team-manager">Manager full name</label>
            <input id="team-manager" v-model="teamForm.managerName" class="input" required placeholder="Enter your full name" />
          </div>
          <div class="two-col">
            <div class="field">
              <label for="team-user">Username</label>
              <input
                id="team-user"
                v-model="teamForm.username"
                class="input"
                required
                autocapitalize="none"
                pattern="[A-Za-z0-9][A-Za-z0-9._\-]{2,31}"
                title="3-32 characters: letters, numbers, dot, dash or underscore"
                placeholder="Choose a username"
              />
            </div>
            <div class="field">
              <label for="team-pass">Password</label>
              <input id="team-pass" v-model="teamForm.password" class="input" type="password" required minlength="6" autocomplete="new-password" placeholder="At least 6 characters" />
            </div>
          </div>
        </div>

        <button type="submit" class="btn btn-primary submit" :disabled="isLoading">
          {{ isLoading ? 'Please wait…' : (mode === 'login' ? 'Sign in' : 'Create team and sign in') }}
        </button>
      </form>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive } from 'vue';
import { loginUser, createTeam } from '../services/authService';
import { SHIFTS, shiftHours } from '../config/shifts';

const emit = defineEmits(['login-success']);

const mode = ref('login'); // 'login' | 'create_team'
const errorMessage = ref('');
const isLoading = ref(false);

const loginForm = reactive({
  username: '',
  password: ''
});

const teamForm = reactive({
  teamName: '',
  managerName: '',
  username: '',
  password: ''
});

function setMode(next) {
  mode.value = next;
  errorMessage.value = '';
}

async function handleLogin() {
  errorMessage.value = '';
  isLoading.value = true;
  try {
    const res = await loginUser(loginForm.username, loginForm.password);
    emit('login-success', res.user);
  } catch (err) {
    errorMessage.value = err.message || 'Login failed';
  } finally {
    isLoading.value = false;
  }
}

async function handleCreateTeam() {
  errorMessage.value = '';
  isLoading.value = true;
  try {
    const res = await createTeam({
      teamName: teamForm.teamName,
      managerName: teamForm.managerName,
      username: teamForm.username,
      password: teamForm.password
    });
    emit('login-success', res.user);
  } catch (err) {
    errorMessage.value = err.message || 'Team registration failed';
  } finally {
    isLoading.value = false;
  }
}
</script>

<style scoped>
.login {
  height: 100vh; display: grid; grid-template-columns: minmax(0, 1.1fr) minmax(0, 1fr);
  background: var(--color-surface); user-select: none;
}
.hero {
  background: var(--color-accent-900); color: var(--color-bg); padding: 48px 56px;
  display: flex; flex-direction: column; justify-content: space-between; gap: 32px;
}
.hero-brand { display: flex; align-items: center; gap: 10px; }
.hero-mark {
  width: 30px; height: 30px; display: grid; place-items: center;
  background: var(--color-accent); font-family: var(--font-heading); font-weight: 600; font-size: 14px;
}
.hero-name { font-family: var(--font-heading); font-weight: 600; font-size: 19px; }
.hero-copy { display: flex; flex-direction: column; gap: 18px; max-width: 540px; }
.hero-title {
  font-family: var(--font-heading); font-weight: 600; font-size: 68px; line-height: 0.94;
  letter-spacing: -0.01em; text-transform: uppercase;
}
.hero-text { margin: 0; font-size: 16px; line-height: 1.5; color: var(--color-accent-200); max-width: 440px; text-wrap: pretty; }
.hero-shifts { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); border-top: 1px solid var(--color-accent-700); }
.hero-shift { padding: 14px 0 0 16px; display: flex; flex-direction: column; gap: 2px; border-left: 1px solid var(--color-accent-700); }
.hero-shift:first-child { padding-left: 0; border-left: 0; }
.hero-shift-label { font-size: 11px; letter-spacing: 0.1em; text-transform: uppercase; color: var(--color-accent-300); }
.hero-shift-hours { font-family: var(--font-heading); font-size: 20px; }

.form-side { display: flex; align-items: center; justify-content: center; padding: 48px; }
.card {
  width: 100%; max-width: 400px; padding: 32px; display: flex; flex-direction: column; gap: 18px;
  background: var(--color-neutral-100); border: 1px solid var(--color-divider); box-shadow: var(--shadow-md);
}
.card .seg { display: flex; }
.fields { display: flex; flex-direction: column; gap: 14px; }
.card-title { margin: 0; font-family: var(--font-heading); font-weight: 600; font-size: 28px; line-height: 1.1; }
.card-note { margin: 0; }
.two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.submit { width: 100%; padding: 11px 14px; font-size: 15px; }

@media (max-width: 900px) {
  .login { grid-template-columns: 1fr; }
  .hero { display: none; }
}
</style>
