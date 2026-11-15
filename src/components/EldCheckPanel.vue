<template>
  <div class="cb-embedded">
    <!-- Filters, right above the list -->
    <div class="filters">
      <div class="seg" role="group" aria-label="What differs">
        <button v-for="o in FIELD_FILTERS" :key="o.code" type="button" :class="['seg-btn', { 'is-on': fieldFilter === o.code }]" :aria-pressed="fieldFilter === o.code ? 'true' : 'false'" @click="fieldFilter = o.code">
          {{ o.label }} <span class="seg-count">{{ countField(o.code) }}</span>
        </button>
      </div>
      <div class="search">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="search-icon" aria-hidden="true"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></svg>
        <input v-model="search" class="input search-input" placeholder="Search driver, truck or group" aria-label="Search driver, truck or group" />
      </div>
      <span class="cb-spacer"></span>
      <span class="cb-sub">{{ rows.length }} of {{ items.length }} shown</span>
      <button type="button" class="btn btn-secondary" :disabled="isLoading" @click="load">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12a9 9 0 1 1-3-6.7L21 8" /><path d="M21 3v5h-5" /></svg>
        {{ isLoading ? 'Loading…' : 'Reload' }}
      </button>
    </div>

    <p v-if="!canFix && items.length" class="cb-sub note">Only managers and supervisors can fix or dismiss. Tell one of them when a value is wrong.</p>

    <div v-if="errorMessage" class="cb-error">
      {{ errorMessage }}
      <button type="button" class="cb-link" @click="load">Try again</button>
    </div>

    <div class="cb-panel table">
      <div class="table-scroll">
        <div class="row head">
          <div>Driver</div><div>Field</div><div>ELD shows</div><div>Telegram says</div><div></div>
        </div>
        <div v-if="isLoading && !loaded" class="cb-empty-state">Loading the ELD check…</div>
        <template v-else>
          <div v-for="m in rows" :key="`${m.driver_id}:${m.field}`" class="row">
            <div class="c-driver">
              <span class="strong cb-ellipsis">{{ niceName(m.name) }}</span>
              <span class="cb-muted small cb-ellipsis" :title="m.group">Truck {{ m.truck || '—' }}<template v-if="m.group"> · {{ m.group }}</template></span>
              <span class="cb-muted small">ELD read {{ m.eld_checked || '—' }}</span>
              <span v-if="m.handed_over" class="warn small">{{ m.handed_over.note }}</span>
              <span v-if="isBusy(m)" class="warn small" :title="(m.freshness?.reasons || []).join(', ')">Still reading this group's messages, wait a moment</span>
            </div>
            <div><span class="field-tag">{{ fieldLabel(m.field) }}</span></div>
            <div class="c-val">
              <span class="val mono">{{ plainValue(m.field, m.eld_value) }}</span>
            </div>
            <div class="c-val">
              <span class="val mono is-tg">{{ m.telegram_value ?? 'none' }}</span>
              <span class="cb-muted small">
                <a v-if="safeLink(m.telegram_link)" :href="safeLink(m.telegram_link)" class="cb-link" target="_blank" rel="noopener">{{ cardLabel(m.telegram_card) }} card</a>
                <template v-else>{{ cardLabel(m.telegram_card) }} card</template>
                · {{ m.telegram_since || '—' }}
              </span>
            </div>
            <div class="c-actions">
              <template v-if="canFix">
                <button type="button" class="btn btn-primary" :disabled="isBusy(m)" :title="isBusy(m) ? 'Wait: this group is still being read' : 'Write the right values to the ELD'" @click="fixing = m; lastFixed = m">Fix…</button>
                <button type="button" class="btn btn-ghost" :disabled="isBusy(m) || dismissingKey === keyOf(m)" title="Hide until either value changes" @click="dismissTarget = m">Dismiss</button>
              </template>
              <button type="button" class="btn btn-ghost" :disabled="refreshingId === m.driver_id" title="Read this driver from the ELD again" @click="refresh(m)">{{ refreshingId === m.driver_id ? 'Reading…' : 'Re-read' }}</button>
            </div>
          </div>
          <div v-if="!rows.length && !errorMessage" class="cb-empty-state">
            <strong>{{ items.length ? 'Nothing matches these filters.' : 'The ELD matches Telegram.' }}</strong>
            <span>{{ items.length ? 'Change the filters above.' : 'Every driver with a Telegram group has the same trailer and shipping docs in the ELD.' }}</span>
          </div>
        </template>
      </div>
    </div>

    <EldFixDialog v-if="fixing" :item="fixing" :related="items" @close="fixing = null" @fixed="onFixed" />
    <ConfirmDialog
      v-if="dismissTarget"
      :title="`Dismiss this ${fieldLabel(dismissTarget.field).toLowerCase()} difference?`"
      :body="`${niceName(dismissTarget.name)} · the ELD shows ${plainValue(dismissTarget.field, dismissTarget.eld_value)}, Telegram says ${dismissTarget.telegram_value ?? 'none'}. It comes back if either value changes.`"
      okLabel="Dismiss"
      @confirm="dismiss"
      @cancel="dismissTarget = null"
    />
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue';
import EldFixDialog from './EldFixDialog.vue';
import ConfirmDialog from './ConfirmDialog.vue';
import { getEldCheck, refreshFromEld, dismissDifference, fieldLabel, safeLink } from '../services/dispatchBrainService';
import { niceName, plainValue, cardLabel } from '../utils/brainFormat';

const props = defineProps({
  canFix: { type: Boolean, default: false }
});
const emit = defineEmits(['count', 'saved', 'error']);

const FIELD_FILTERS = [
  { code: 'ALL', label: 'All' },
  { code: 'trailer', label: 'Trailer' },
  { code: 'shipping_docs', label: 'Shipping docs' }
];
const RELOAD_MS = 2 * 60 * 1000;

const items = ref([]);
const loaded = ref(false);
const isLoading = ref(false);
const errorMessage = ref('');
const fieldFilter = ref('ALL');
const search = ref('');
const fixing = ref(null);
const lastFixed = ref(null);
const dismissTarget = ref(null);
const dismissingKey = ref('');
const refreshingId = ref('');

const keyOf = (m) => `${m.driver_id}:${m.field}`;
const isBusy = (m) => m.freshness?.light === 'yellow' || m.freshness?.light === 'red';
const countField = (code) => (code === 'ALL' ? items.value.length : items.value.filter(m => m.field === code).length);

const rows = computed(() => {
  const words = search.value.trim().toLowerCase().split(/\s+/).filter(Boolean);
  return items.value.filter(m => {
    if (fieldFilter.value !== 'ALL' && m.field !== fieldFilter.value) return false;
    const hay = `${m.name} ${m.truck} ${m.group}`.toLowerCase();
    return words.every(w => hay.includes(w));
  });
});

async function load() {
  isLoading.value = true;
  try {
    items.value = await getEldCheck();
    errorMessage.value = '';
    loaded.value = true;
    emit('count', items.value.length);
  } catch (e) {
    errorMessage.value = `Could not load the ELD check. ${e.message}`;
  } finally {
    isLoading.value = false;
  }
}

function onFixed(r) {
  if (r.status === 'ok') emit('saved', { title: 'ELD updated', message: `${niceName(lastFixed.value?.name)} · trailer and shipping docs written` });
  load();
}

async function dismiss() {
  const m = dismissTarget.value;
  dismissTarget.value = null;
  dismissingKey.value = keyOf(m);
  try {
    await dismissDifference(m);
    items.value = items.value.filter(x => keyOf(x) !== keyOf(m));
    emit('count', items.value.length);
    emit('saved', { title: 'Dismissed', message: `${niceName(m.name)} · hidden until a value changes` });
  } catch (e) {
    emit('error', { title: 'Could not dismiss', message: e.message });
  } finally {
    dismissingKey.value = '';
  }
}

async function refresh(m) {
  refreshingId.value = m.driver_id;
  try {
    await refreshFromEld(m.driver_id);
    emit('saved', { title: 'Read from the ELD again', message: niceName(m.name) });
    await load();
  } catch (e) {
    emit('error', { title: 'Could not read the ELD', message: e.message });
  } finally {
    refreshingId.value = '';
  }
}

let timer = null;
onMounted(() => {
  load();
  timer = setInterval(() => { if (!fixing.value && !document.hidden) load(); }, RELOAD_MS);
});
onUnmounted(() => clearInterval(timer));

defineExpose({ load });
</script>

<style scoped>
.filters { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.seg-count { opacity: 0.75; margin-left: 2px; }
.search { position: relative; flex: 0 1 280px; }
.search-icon { position: absolute; left: 10px; top: 50%; transform: translateY(-50%); color: var(--color-neutral-600); }
.search-input { padding-left: 32px; }
.note { margin: 0; }

.table { min-width: 0; }
.table-scroll { overflow-x: auto; }
.row {
  display: grid; grid-template-columns: minmax(220px, 1.4fr) 120px minmax(120px, 0.8fr) minmax(170px, 1fr) 230px;
  align-items: center; min-width: 880px; min-height: 52px; font-size: 13px; border-bottom: 1px solid var(--color-hairline);
}
.row > div { padding: 8px 10px; min-width: 0; }
.row:not(.head):hover { background: var(--color-bg); }
.row.head { min-height: 0; font-size: 11px; letter-spacing: 0.08em; text-transform: uppercase; color: var(--color-neutral-700); border-bottom-color: var(--color-divider); }
.c-driver, .c-val { display: flex; flex-direction: column; gap: 1px; }
.c-actions { display: flex; justify-content: flex-end; gap: 4px; flex-wrap: wrap; }
.strong { font-weight: 600; }
.small { font-size: 12px; }
.warn { color: var(--color-signal); }
.mono { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
.val { font-size: 14px; word-break: break-all; }
.val.is-tg { color: var(--color-accent-800); font-weight: 600; }
.field-tag {
  display: inline-block; padding: 1px 8px; font-size: 12px; font-weight: 500;
  border: 1px solid var(--color-accent-400); color: var(--color-accent-800);
}
</style>
