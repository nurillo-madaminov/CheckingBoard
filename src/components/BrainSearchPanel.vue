<template>
  <div class="cb-embedded">
    <form class="filters" role="search" @submit.prevent="run">
      <div class="search">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="search-icon" aria-hidden="true"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></svg>
        <input ref="inputRef" v-model="query" class="input search-input" placeholder="Load, BOL, PRO, trailer or seal number, or words" aria-label="Search the driver groups" />
      </div>
      <div class="seg" role="group" aria-label="Period (word search)">
        <button v-for="p in PERIODS" :key="p.code" type="button" :class="['seg-btn', { 'is-on': since === p.code }]" :aria-pressed="since === p.code ? 'true' : 'false'" @click="since = p.code">{{ p.label }}</button>
      </div>
      <button type="submit" class="btn btn-primary" :disabled="!query.trim() || isLoading">{{ isLoading ? 'Searching…' : 'Search' }}</button>
      <span class="cb-spacer"></span>
      <span v-if="summary" class="cb-sub">{{ summary }}</span>
    </form>

    <div v-if="errorMessage" class="cb-error">{{ errorMessage }}</div>

    <div v-if="!result && !isLoading && !errorMessage" class="cb-panel cb-empty-state">
      <strong>Search every driver group in Telegram.</strong>
      <span>A number (load, BOL, PRO, trailer, seal) finds every message and scanned document that mentions it, with the messages around it. Words search the message text.</span>
    </div>

    <!-- A number: each place it was mentioned, with the messages around it -->
    <template v-if="result?.kind === 'load'">
      <div v-for="(r, i) in result.results" :key="`${r.chat_id}:${r.msg_id}:${i}`" class="cb-panel hit">
        <div class="hit-head">
          <span class="strong cb-ellipsis">{{ r.chat }}</span>
          <span class="cb-muted small">found in {{ foundIn(r.found_in) }}<template v-if="r.as_written"> as “{{ r.as_written }}”</template> · {{ r.time }}</span>
          <span class="cb-spacer"></span>
          <a v-if="safeLink(r.link)" :href="safeLink(r.link)" class="cb-link small" target="_blank" rel="noopener">Open in Telegram</a>
        </div>
        <BrainMessage v-for="m in r.messages || []" :key="m.msg_id" :message="m" :hit="m.msg_id === r.msg_id && m.chat_id === r.chat_id" />
      </div>
    </template>

    <!-- Words: matching messages, newest first -->
    <div v-if="result?.kind === 'text' && result.results?.length" class="cb-panel list">
      <BrainMessage v-for="m in result.results" :key="`${m.chat_id}:${m.msg_id}`" :message="m" show-chat />
    </div>

    <div v-if="result && !resultCount" class="cb-panel cb-empty-state">
      <strong>Nothing found for “{{ lastQuery }}”.</strong>
      <span>{{ result.kind === 'text' ? 'Try fewer words or a longer period.' : 'Check the number; letters and dashes do not matter.' }}</span>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import BrainMessage from './BrainMessage.vue';
import { searchBrain, safeLink } from '../services/dispatchBrainService';

const PERIODS = [
  { code: '24h', label: '24 hours' },
  { code: '7d', label: '7 days' },
  { code: '30d', label: '30 days' },
  { code: '', label: 'All' }
];

const query = ref('');
const lastQuery = ref('');
const since = ref('7d');
const result = ref(null);
const isLoading = ref(false);
const errorMessage = ref('');
const inputRef = ref(null);
let controller = null;

const resultCount = computed(() => result.value?.results?.length || 0);
const summary = computed(() => {
  if (!result.value) return '';
  if (result.value.kind === 'load') {
    const n = result.value.matches ?? resultCount.value;
    return `${n} ${n === 1 ? 'mention' : 'mentions'}${n > resultCount.value ? `, first ${resultCount.value} shown` : ''}, oldest first`;
  }
  return `${resultCount.value} ${resultCount.value === 1 ? 'message' : 'messages'}, newest first`;
});

function foundIn(where) {
  if (!where || where === 'text') return 'the message';
  return where.replace(/^document:/, 'a document, ').replace(/_/g, ' ');
}

async function run() {
  const q = query.value.trim();
  if (!q) return;
  controller?.abort();
  controller = new AbortController();
  isLoading.value = true;
  errorMessage.value = '';
  try {
    result.value = await searchBrain(q, { since: since.value }, controller.signal);
    lastQuery.value = q;
  } catch (e) {
    if (e.name === 'AbortError') return;
    errorMessage.value = `Search failed. ${e.message}`;
  } finally {
    isLoading.value = false;
  }
}

// Opened from elsewhere with a query (e.g. a load number)
function searchFor(q) {
  query.value = q;
  run();
}

onMounted(() => inputRef.value?.focus());
defineExpose({ searchFor });
</script>

<style scoped>
.filters { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.search { position: relative; flex: 1 1 340px; max-width: 520px; }
.search-icon { position: absolute; left: 10px; top: 50%; transform: translateY(-50%); color: var(--color-neutral-600); }
.search-input { padding-left: 32px; }
.hit { display: flex; flex-direction: column; padding-bottom: 6px; }
.hit-head { display: flex; align-items: baseline; gap: 10px; flex-wrap: wrap; padding: 10px 12px 6px; border-bottom: 1px solid var(--color-hairline); }
.list { display: flex; flex-direction: column; }
.list > * + * { border-top: 1px solid var(--color-hairline); }
.strong { font-weight: 600; max-width: 50%; }
.small { font-size: 12px; }
</style>
