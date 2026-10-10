<template>
  <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
    <div
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
              class="w-full px-3 py-2 rounded-lg border border-slate-300 font-mono text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div>
            <label class="block font-bold text-slate-700 mb-1">
              Anon Public API Key <span class="text-rose-500">*</span>
            </label>
            <input
              v-model="key"
              type="password"
              placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
              class="w-full px-3 py-2 rounded-lg border border-slate-300 font-mono text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
        </div>

        <!-- Setup Instructions & SQL Script Tip -->
        <div class="bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-1.5 text-slate-600 leading-relaxed">
          <p class="font-bold text-slate-800 text-[11px]">📋 Quick 2-Minute Setup Steps:</p>
          <ol class="list-decimal list-inside space-y-1 text-[11px]">
            <li>Create a free project at <a href="https://supabase.com" target="_blank" class="text-emerald-700 font-bold underline">supabase.com</a>.</li>
            <li>Go to <strong>SQL Editor</strong> and run the script in <code class="bg-slate-200 px-1 py-0.5 rounded font-mono font-bold text-slate-800">supabase_schema.sql</code> (in your project folder).</li>
            <li>Copy your <strong>Project URL</strong> and <strong>anon key</strong> from <strong>Project Settings -> API</strong> and paste them above.</li>
          </ol>
        </div>

        <!-- Test Message -->
        <div v-if="testMessage" :class="testSuccess ? 'text-emerald-700 font-semibold' : 'text-rose-600 font-semibold'">
          {{ testMessage }}
        </div>
      </div>

      <!-- Footer Buttons -->
      <div class="bg-slate-100 px-5 py-3 border-t border-slate-200 flex items-center justify-between">
        <button
          v-if="url || key"
          @click="disconnect"
          class="text-xs text-rose-600 hover:text-rose-800 font-semibold underline"
        >
          Disconnect
        </button>
        <span v-else></span>

        <div class="flex items-center gap-2">
          <button
            @click="testConnection"
            :disabled="isTesting || !url || !key"
            class="px-3.5 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 font-semibold text-xs transition-colors disabled:opacity-50"
          >
            {{ isTesting ? 'Testing...' : 'Test Connection' }}
          </button>
          <button
            @click="saveAndConnect"
            :disabled="!url || !key"
            class="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-xs hover:shadow transition-all disabled:opacity-50"
          >
            Save & Connect
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { getSupabaseCredentials, saveSupabaseCredentials } from '../services/supabaseClient';
import { isSupabaseReady, fetchCompaniesFromSupabase } from '../services/supabaseService';

const emit = defineEmits(['close', 'connected']);

const url = ref('');
const key = ref('');
const isConnected = ref(false);
const isTesting = ref(false);
const testMessage = ref('');
const testSuccess = ref(false);

onMounted(() => {
  const creds = getSupabaseCredentials();
  url.value = creds.url;
  key.value = creds.key;
  isConnected.value = isSupabaseReady();
});

async function testConnection() {
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
</script>
