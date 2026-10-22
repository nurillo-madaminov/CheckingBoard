<template>
  <div class="h-screen w-screen flex items-center justify-center bg-slate-900 select-none p-4 relative overflow-hidden">
    <!-- Subtle Background Elements -->
    <div class="absolute -top-40 -right-40 w-96 h-96 bg-emerald-600/10 rounded-full blur-3xl pointer-events-none"></div>
    <div class="absolute -bottom-40 -left-40 w-96 h-96 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none"></div>

    <!-- Login / Register Card -->
    <div class="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden z-10 animate-in fade-in zoom-in-95 duration-200">
      <!-- Card Header -->
      <div class="bg-gradient-to-r from-emerald-600 to-teal-700 px-6 py-6 text-white text-center relative">
        <div class="w-12 h-12 rounded-xl bg-white/20 backdrop-blur-sm border border-white/30 text-white flex items-center justify-center font-black text-2xl mx-auto shadow-md mb-2">
          CB
        </div>
        <h1 class="text-xl font-black tracking-tight">CheckingBoard</h1>
        <p class="text-xs text-emerald-100 font-medium mt-0.5">
          Dynamic Fleet & Activity Audit Tracking System
        </p>

        <!-- Mode Toggle Tabs -->
        <div class="mt-4 flex rounded-lg bg-black/20 p-1 text-xs font-bold">
          <button
            @click="mode = 'login'"
            :class="[
              'flex-1 py-1.5 rounded-md transition-all',
              mode === 'login' ? 'bg-white text-slate-900 shadow-sm' : 'text-emerald-100 hover:text-white'
            ]"
          >
            Sign In
          </button>
          <button
            @click="mode = 'create_team'"
            :class="[
              'flex-1 py-1.5 rounded-md transition-all',
              mode === 'create_team' ? 'bg-white text-slate-900 shadow-sm' : 'text-emerald-100 hover:text-white'
            ]"
          >
            Create a Team
          </button>
        </div>
      </div>

      <!-- Card Body -->
      <div class="p-6">
        <!-- Error Message Alert -->
        <div
          v-if="errorMessage"
          class="mb-4 p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium flex items-center gap-2"
        >
          <span>⚠️</span>
          <span>{{ errorMessage }}</span>
        </div>

        <!-- 1. SIGN IN FORM -->
        <form v-if="mode === 'login'" @submit.prevent="handleLogin" class="space-y-4">
          <div>
            <label class="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
              Username
            </label>
            <input
              v-model="loginForm.username"
              type="text"
              required
              autocomplete="username"
              autocapitalize="none"
              placeholder="Enter your username"
              class="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-900"
            />
          </div>

          <div>
            <label class="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
              Password
            </label>
            <input
              v-model="loginForm.password"
              type="password"
              required
              autocomplete="current-password"
              placeholder="Enter your password"
              class="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-900"
            />
          </div>

          <button
            type="submit"
            :disabled="isLoading"
            class="w-full py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 active:scale-[0.99] text-white font-bold text-sm shadow-md transition-all disabled:opacity-50"
          >
            {{ isLoading ? 'Signing in...' : 'Sign In to Dispatch' }}
          </button>

          <!-- Create a Team Prompt -->
          <div class="pt-3 border-t border-slate-100 text-center">
            <p class="text-xs text-slate-500">
              Don't have a team account?
            </p>
            <button
              type="button"
              @click="mode = 'create_team'"
              class="mt-1 text-xs font-bold text-emerald-700 hover:text-emerald-800 underline"
            >
              + Create a Team as Manager
            </button>
          </div>
        </form>

        <!-- 2. CREATE A TEAM FORM (CREATOR IS MANAGER) -->
        <form v-else @submit.prevent="handleCreateTeam" class="space-y-3.5">
          <!-- Role Note -->
          <div class="p-2.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
            <span>👑</span>
            <span class="font-medium">
              You are creating a new team. You will be the <strong>Manager</strong> and can create accounts for your staff.
            </span>
          </div>

          <div>
            <label class="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
              Team / Company Name
            </label>
            <input
              v-model="teamForm.teamName"
              type="text"
              required
              placeholder="e.g. Apex Logistics"
              class="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-900"
            />
          </div>

          <div>
            <label class="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
              Manager Full Name
            </label>
            <input
              v-model="teamForm.managerName"
              type="text"
              required
              placeholder="e.g. Sarah Connor"
              class="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-900"
            />
          </div>

          <div class="grid grid-cols-2 gap-2">
            <div>
              <label class="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                Username
              </label>
              <input
                v-model="teamForm.username"
                type="text"
                required
                autocapitalize="none"
                pattern="[A-Za-z0-9][A-Za-z0-9._\-]{2,31}"
                title="3-32 characters: letters, numbers, dot, dash or underscore"
                placeholder="e.g. sarah"
                class="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-900"
              />
            </div>
            <div>
              <label class="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                Password
              </label>
              <input
                v-model="teamForm.password"
                type="password"
                required
                minlength="6"
                autocomplete="new-password"
                placeholder="Min. 6 characters"
                class="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-900"
              />
            </div>
          </div>

          <button
            type="submit"
            :disabled="isLoading"
            class="w-full py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 active:scale-[0.99] text-white font-bold text-sm shadow-md transition-all disabled:opacity-50 mt-2"
          >
            {{ isLoading ? 'Creating Team...' : 'Create Team & Enter as Manager' }}
          </button>

          <div class="text-center pt-2">
            <button
              type="button"
              @click="mode = 'login'"
              class="text-xs font-bold text-slate-500 hover:text-slate-800"
            >
              ← Back to Sign In
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive } from 'vue';
import { loginUser, createTeam } from '../services/authService';

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
