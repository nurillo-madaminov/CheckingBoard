<template>
  <div
    class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4"
    @click.self="$emit('close')"
  >
    <div
      @click.stop
      class="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-150"
    >
      <!-- Header -->
      <div class="bg-slate-900 text-white px-5 py-4 flex items-center justify-between">
        <div class="flex items-center gap-2.5">
          <span class="text-xl">⚡</span>
          <div>
            <h3 class="font-bold text-base leading-tight">Supabase Database Connection</h3>
            <p class="text-xs text-slate-400">Plan B: Cloud PostgreSQL with live real-time sync</p>
          </div>
        </div>
        <button
          @click="$emit('close')"
          class="text-slate-400 hover:text-white p-1 rounded hover:bg-slate-800 transition-colors"
        >
          ✕
        </button>
      </div>

      <!-- Body -->
      <div class="p-5 space-y-4 text-xs">
        <!-- Status Indicator Banner -->
        <div
          :class="[
            'p-3 rounded-lg border flex items-center justify-between',
            isConnected
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : 'bg-amber-50 border-amber-200 text-amber-900'
          ]"
        >
          <div class="flex items-center gap-2">
            <span class="w-3 h-3 rounded-full shrink-0" :class="isConnected ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'"></span>
            <span class="font-bold text-xs">
              {{ isConnected ? 'Connected to Supabase (Realtime Active)' : 'Supabase Not Connected (Using Local Storage)' }}
            </span>
          </div>
          <span v-if="isConnected" class="text-[11px] font-semibold text-emerald-700">✓ Live Syncing</span>
        </div>

        <!-- Form Inputs -->
        <div class="space-y-3">
          <div>
            <label class="block font-bold text-slate-700 mb-1">
              Project URL <span class="text-rose-500">*</span>
            </label>
            <input
              v-model="url"
              type="text"
              placeholder="https://your-project.supabase.co"
              class="w-full px-3 py-2 rounded-lg border border-slate-300 font-mono text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-800"
            />
          </div>

          <div>
            <label class="block font-bold text-slate-700 mb-1">
              Anon Public API Key <span class="text-rose-500">*</span>
            </label>
            <textarea
              v-model="key"
              rows="3"
              placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
              class="w-full px-3 py-2 rounded-lg border border-slate-300 font-mono text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-800"
            ></textarea>
          </div>
        </div>

        <!-- Feedback message -->
        <div
          v-if="testMessage"
          :class="[
            'p-2.5 rounded-lg text-xs font-semibold',
            testSuccess ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' : 'bg-rose-100 text-rose-800 border border-rose-200'
          ]"
        >
          {{ testMessage }}
        </div>

        <!-- SQL Schema Guide -->
        <div class="bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-1.5">
          <div class="font-bold text-slate-700 flex items-center justify-between">
            <span>Schema Setup Required:</span>
            <span class="font-mono text-[10px] text-slate-500">supabase_schema.sql</span>
          </div>
          <p class="text-[11px] text-slate-600 leading-relaxed">
            Ensure you copied and ran the SQL statements from <code class="bg-white px-1 py-0.5 rounded border border-slate-200 font-mono text-slate-800">supabase_schema.sql</code> in your Supabase SQL Editor.
          </p>
        </div>
      </div>

      <!-- Footer Actions -->
      <div class="bg-slate-100 px-5 py-3 border-t border-slate-200 flex items-center justify-between">
        <button
          v-if="isConnected"
          @click="disconnect"
          type="button"
          class="text-xs font-semibold text-rose-600 hover:text-rose-800 hover:underline"
        >
          Disconnect Database
        </button>
        <span v-else></span>

        <div class="flex items-center gap-2">
          <button
            type="button"
            @click="testConnection"
            :disabled="isTesting || !url || !key"
            class="px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-700 border border-slate-300 bg-white hover:bg-slate-50 transition-colors disabled:opacity-50"
          >
            {{ isTesting ? 'Testing...' : 'Test Connection' }}
          </button>
          <button
            type="button"
            @click="saveAndConnect"
            :disabled="!url || !key"
            class="px-4 py-1.5 rounded-lg text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 transition-colors shadow-xs hover:shadow disabled:opacity-50"
          >
            Connect & Sync
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue';
import {
  getSupabaseCredentials,
  saveSupabaseCredentials
} from '../services/supabaseClient';
import { fetchCompaniesFromSupabase } from '../services/supabaseService';

const emit = defineEmits(['close', 'connected']);

const creds = getSupabaseCredentials();
const url = ref(creds.url);
const key = ref(creds.key);

const isConnected = ref(Boolean(creds.url && creds.key));
const isTesting = ref(false);
const testMessage = ref('');
const testSuccess = ref(false);

async function testConnection() {
  if (!url.value || !key.value) return;

  isTesting.value = true;
  testMessage.value = '';
  try {
    saveSupabaseCredentials(url.value, key.value);
    const companies = await fetchCompaniesFromSupabase();
    testSuccess.value = true;
    testMessage.value = `✓ Connected successfully! Found ${companies.length} companies in Supabase.`;
    isConnected.value = true;
  } catch (err) {
    testSuccess.value = false;
    testMessage.value = `✗ Connection failed: ${err.message || 'Make sure you ran supabase_schema.sql first.'}`;
    isConnected.value = false;
  } finally {
    isTesting.value = false;
  }
}

async function saveAndConnect() {
  saveSupabaseCredentials(url.value, key.value);
  await testConnection();
  if (testSuccess.value) {
    emit('connected');
    setTimeout(() => {
      emit('close');
    }, 800);
  }
}

function disconnect() {
  saveSupabaseCredentials('', '');
  url.value = '';
  key.value = '';
  isConnected.value = false;
  testMessage.value = 'Disconnected. App will use local storage.';
  testSuccess.value = false;
  emit('connected');
}

function onKeydown(e) {
  if (e.key === 'Escape') {
    emit('close');
  }
}

onMounted(() => {
  window.addEventListener('keydown', onKeydown);
});

onUnmounted(() => {
  window.removeEventListener('keydown', onKeydown);
});
</script>
