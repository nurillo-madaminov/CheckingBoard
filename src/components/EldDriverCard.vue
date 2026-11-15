<template>
  <section v-if="available" class="cb-panel eld-card" aria-labelledby="eld-card-title">
    <div class="head">
      <span id="eld-card-title" class="cb-label">ELD</span>
      <span class="cb-spacer"></span>
      <span v-if="info?.eld_checked" class="cb-muted small">read {{ info.eld_checked }}</span>
      <button v-if="eldId" type="button" class="btn btn-ghost" :disabled="isLoading" @click="reread">{{ isLoading ? 'Reading…' : 'Re-read' }}</button>
    </div>

    <div v-if="errorMessage" class="cb-error">{{ errorMessage }} <button type="button" class="cb-link" @click="load">Try again</button></div>
    <div v-else-if="isLoading && !info" class="cb-muted small">Looking this driver up in the ELD…</div>

    <!-- Not matched: pick from the candidates, or nothing found -->
    <div v-else-if="!eldId" class="match">
      <template v-if="candidates.length">
        <span class="small">Several ELD drivers match {{ driver.unit ? `unit ${driver.unit}` : driver.name }}. Which one is it?</span>
        <div class="cands">
          <button v-for="c in candidates.slice(0, 6)" :key="c.driver_id" type="button" class="cb-chip" @click="pick(c.driver_id)">
            {{ niceName(c.name) }} · truck {{ c.truck || '—' }}<template v-if="c.company"> · {{ c.company }}</template>
          </button>
        </div>
      </template>
      <span v-else class="cb-muted small">Not found in the ELD by {{ driver.unit ? `unit ${driver.unit} or ` : '' }}name. Check the unit number on the board.</span>
    </div>

    <template v-else-if="info">
      <div class="top">
        <span :class="['duty', `is-${dutyClass}`]">{{ info.duty_status || 'unknown' }}</span>
        <span v-if="!info.eld_connected" class="tag tag-neutral">ELD not connected</span>
        <span class="small cb-ellipsis loc" :title="info.location">{{ info.location || 'No location' }}</span>
      </div>

      <div v-if="info.hours_left" class="hours">
        <div v-for="k in ['drive', 'shift', 'cycle']" :key="k" class="hour">
          <span class="cb-label">{{ k }}</span>
          <span class="cb-num big">{{ info.hours_left[k] ?? '—' }}</span>
        </div>
      </div>
      <div v-if="info.violations?.length" class="cb-error small">Violations: {{ info.violations.join(', ') }}</div>

      <div class="compare">
        <div v-for="f in ['trailer', 'shipping_docs']" :key="f" :class="['cmp', { 'is-off': differs.has(f) }]">
          <span class="cb-label">{{ fieldLabel(f) }}</span>
          <span class="mono">ELD: <b>{{ plainValue(f, info[`eld_${f}`]) }}</b></span>
          <span class="mono">Telegram: <b>{{ info.telegram_says?.[f]?.value ?? 'none' }}</b></span>
          <a v-if="safeLink(info.telegram_says?.[f]?.link)" :href="safeLink(info.telegram_says[f].link)" class="cb-link small" target="_blank" rel="noopener">{{ info.telegram_says[f].time }}</a>
        </div>
      </div>
      <div v-if="differs.size" class="differs">
        <span class="warn small">The ELD differs from Telegram on {{ [...differs].map(fieldLabel).join(' and ').toLowerCase() }}.</span>
        <button v-if="canFix" type="button" class="btn btn-primary" @click="fixing = fixItem">Fix in ELD…</button>
      </div>

      <div v-if="info.current_load" class="line small">
        <span class="cb-label">Load</span>
        <span class="mono">{{ info.current_load.load }}</span> · {{ info.current_load.status }} {{ info.current_load.since }}
        <a v-if="safeLink(info.current_load.link)" :href="safeLink(info.current_load.link)" class="cb-link" target="_blank" rel="noopener">message</a>
      </div>

      <div v-if="info.recent_events?.length" class="events">
        <span class="cb-label">Recent events</span>
        <div v-for="(e, i) in info.recent_events.slice(0, 5)" :key="i" class="event small">
          <span class="cb-muted">{{ e.time }}</span>
          <span class="tag tag-outline">{{ e.kind }}</span>
          <span v-if="e.load" class="mono">{{ e.load }}</span>
          <span v-if="e.reason" class="cb-muted cb-ellipsis">{{ e.reason }}</span>
          <a v-if="safeLink(e.link)" :href="safeLink(e.link)" class="cb-link" target="_blank" rel="noopener">open</a>
        </div>
      </div>

      <div v-if="info.groups?.length" class="line small cb-muted">
        Telegram: <template v-for="(g, i) in info.groups" :key="g.chat_id">{{ i ? ', ' : '' }}{{ g.title }}<template v-if="g.last_message"> (last {{ g.last_message }})</template></template>
      </div>
      <button v-if="matchedBy === 'picked'" type="button" class="cb-link small unlink" @click="unpick">Not this driver? Choose again</button>
    </template>

    <EldFixDialog v-if="fixing" :item="fixing" :related="relatedItems" @close="fixing = null" @fixed="onFixed" />
  </section>
</template>

<script setup>
import { ref, computed, watch } from 'vue';
import EldFixDialog from './EldFixDialog.vue';
import {
  brainAccess, loadBrainAccess, matchEldDriver, getEldDriver, refreshFromEld, fieldLabel, safeLink
} from '../services/dispatchBrainService';
import { niceName, plainValue } from '../utils/brainFormat';

const props = defineProps({
  // The board driver ({ id, unit, name })
  driver: { type: Object, required: true }
});
const emit = defineEmits(['saved', 'error']);

// A choice between several ELD drivers is remembered in this browser
const PICKS_KEY = 'checkingboard_eld_driver_picks_v1';
const readPicks = () => { try { return JSON.parse(localStorage.getItem(PICKS_KEY) || '{}'); } catch { return {}; } };
const writePick = (id, eldId) => {
  const picks = readPicks();
  if (eldId) picks[id] = eldId; else delete picks[id];
  localStorage.setItem(PICKS_KEY, JSON.stringify(picks));
};

const eldId = ref('');
const matchedBy = ref('');
const candidates = ref([]);
const info = ref(null);
const isLoading = ref(false);
const errorMessage = ref('');
const fixing = ref(null);

const available = computed(() => !!brainAccess.value.me);
const canFix = computed(() => !!brainAccess.value.me?.can_fix);
const differs = computed(() => new Set(info.value?.eld_differs_on || []));
const dutyClass = computed(() => String(info.value?.duty_status || '').replace(/[^a-z]+/gi, '-').toLowerCase());

// The ELD check item EldFixDialog expects, built from the driver details
const relatedItems = computed(() => [...differs.value].map(field => ({ driver_id: eldId.value, field })));
const fixItem = computed(() => {
  const i = info.value;
  if (!i) return null;
  return {
    driver_id: i.driver_id, name: i.name, truck: i.truck,
    field: [...differs.value][0] || 'trailer',
    eld_now: { trailer: i.eld_trailer || '', shipping_docs: i.eld_shipping_docs || '' },
    telegram_now: { trailer: i.telegram_says?.trailer?.value ?? null, shipping_docs: i.telegram_says?.shipping_docs?.value ?? null }
  };
});

async function loadDetails() {
  info.value = await getEldDriver(eldId.value);
  if (info.value?.error) throw new Error(info.value.error);
}

async function load() {
  if (!brainAccess.value.checked) await loadBrainAccess();
  if (!available.value) return;
  isLoading.value = true;
  errorMessage.value = '';
  info.value = null;
  try {
    const picked = readPicks()[props.driver.id];
    if (picked) {
      eldId.value = picked;
      matchedBy.value = 'picked';
    } else {
      const m = await matchEldDriver(props.driver);
      candidates.value = m.candidates;
      eldId.value = m.driver?.driver_id || '';
      matchedBy.value = eldId.value ? 'auto' : '';
    }
    if (eldId.value) await loadDetails();
  } catch (e) {
    errorMessage.value = `Could not load the ELD. ${e.message}`;
  } finally {
    isLoading.value = false;
  }
}

function pick(id) {
  writePick(props.driver.id, id);
  load();
}

function unpick() {
  writePick(props.driver.id, '');
  load();
}

async function reread() {
  isLoading.value = true;
  try {
    await refreshFromEld(eldId.value);
    await loadDetails();
  } catch (e) {
    emit('error', { title: 'Could not read the ELD', message: e.message });
  } finally {
    isLoading.value = false;
  }
}

function onFixed(r) {
  if (r.status === 'ok') emit('saved', { title: 'ELD updated', message: `${niceName(info.value?.name)} · trailer and shipping docs written` });
  loadDetails().catch(() => {});
}

watch(() => [props.driver.id, props.driver.unit, props.driver.name], load, { immediate: true });
</script>

<style scoped>
.eld-card { padding: 14px 16px; display: flex; flex-direction: column; gap: 10px; }
.head { display: flex; align-items: center; gap: 8px; }
.small { font-size: 12px; }
.mono { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
.warn { color: var(--color-signal); }
.match { display: flex; flex-direction: column; gap: 8px; }
.cands { display: flex; flex-wrap: wrap; gap: 6px; }
.top { display: flex; align-items: center; gap: 8px; min-width: 0; }
.loc { min-width: 0; }
.duty { font-family: var(--font-heading); font-weight: 600; font-size: 16px; text-transform: uppercase; padding: 0 8px; border: 1px solid var(--color-divider); white-space: nowrap; }
.duty.is-driving { color: var(--color-bg); background: var(--color-accent); border-color: var(--color-accent); }
.duty.is-on-duty { color: var(--color-accent-800); border-color: var(--color-accent-400); }
.hours { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
.hour { display: flex; flex-direction: column; gap: 2px; padding: 6px 8px; background: var(--color-bg); border: 1px solid var(--color-hairline); }
.big { font-size: 24px; }
.compare { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.cmp { display: flex; flex-direction: column; gap: 2px; padding: 6px 8px; border: 1px solid var(--color-hairline); font-size: 13px; min-width: 0; word-break: break-all; }
.cmp.is-off { border-color: var(--color-signal); }
.differs { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.line { display: flex; align-items: baseline; gap: 6px; flex-wrap: wrap; }
.events { display: flex; flex-direction: column; gap: 3px; }
.event { display: flex; align-items: center; gap: 8px; min-width: 0; }
.unlink { align-self: flex-start; }
</style>
