<template>
  <div class="cb-backdrop" @click.self="close">
    <form class="cb-dialog fix-dialog" role="dialog" aria-modal="true" aria-labelledby="fix-title" @submit.prevent="save" @keydown.esc="close">
      <span id="fix-title" class="cb-dialog-title">Update the ELD for {{ niceName(item.name) }}</span>
      <p class="now">
        Truck {{ item.truck || '—' }}. Right now the ELD shows trailer <b>{{ item.eld_now?.trailer || '—' }}</b>
        and shipping docs <b>{{ item.eld_now?.shipping_docs || '—' }}</b>. Check the new values below.
      </p>

      <div v-for="f in FIELDS" :key="f" class="field">
        <label :for="`fix-${f}`">{{ fieldLabel(f) }}</label>
        <input :id="`fix-${f}`" v-model.trim="form[f]" class="input mono" :disabled="busy || done" required autocomplete="off" />
        <span class="src small">
          <template v-if="form[f] === (item.eld_now?.[f] || '')"><span class="same">Unchanged</span>, the ELD already shows this</template>
          <template v-else><span class="change">Changes</span> from <b class="mono">{{ item.eld_now?.[f] || '—' }}</b>{{ wrong.has(f) && form[f] === suggested[f] ? ' to the Telegram value' : '' }}</template>
        </span>
      </div>
      <p class="hint small">No trailer: <span class="mono">Bobtail</span>. No shipping docs: <span class="mono">na</span>.</p>

      <div v-if="result" :class="result.ok ? 'cb-success' : 'cb-error'" role="status">{{ result.text }}</div>

      <div class="cb-dialog-actions">
        <button type="button" class="btn btn-secondary" @click="close">{{ done ? 'Close' : 'Cancel' }}</button>
        <button v-if="!done" type="submit" class="btn btn-primary" :disabled="busy || !changed">{{ busy ? 'Writing…' : 'Update ELD' }}</button>
      </div>
    </form>
  </div>
</template>

<script setup>
import { ref, reactive, computed } from 'vue';
import { fixInEld, fieldLabel } from '../services/dispatchBrainService';
import { niceName, eldEmptyValue } from '../utils/brainFormat';

const props = defineProps({
  // One ELD check item; the other differences of the same driver are in `related`
  item: { type: Object, required: true },
  related: { type: Array, default: () => [] }
});
const emit = defineEmits(['close', 'fixed']);

const FIELDS = ['trailer', 'shipping_docs'];
const wrong = new Set([props.item.field, ...props.related.filter(r => r.driver_id === props.item.driver_id).map(r => r.field)]);

// A field that differs gets the Telegram value; the other keeps what the ELD shows
const suggested = Object.fromEntries(FIELDS.map(f => {
  const tg = props.item.telegram_now?.[f];
  return [f, wrong.has(f) ? (tg == null || tg === '' ? eldEmptyValue(f) : String(tg)) : (props.item.eld_now?.[f] || '')];
}));
const form = reactive({ ...suggested });
const busy = ref(false);
const done = ref(false);
const result = ref(null);

const changed = computed(() => FIELDS.some(f => form[f] !== (props.item.eld_now?.[f] || '')));

function close() {
  if (!busy.value) emit('close');
}

async function save() {
  busy.value = true;
  result.value = null;
  let r;
  try {
    r = await fixInEld({ driverId: props.item.driver_id, trailer: form.trailer, shippingDocs: form.shipping_docs, expect: props.item.eld_now });
  } catch (e) {
    r = { status: 'error', error: e.message };
  }
  busy.value = false;
  const eld = r.eld || {};
  const text = {
    ok: 'Done. The ELD now shows the new values.',
    changed_meanwhile: `Nothing written: someone changed the ELD since this list loaded (now trailer ${eld.trailer ?? '—'}, shipping docs ${eld.shipping_docs ?? '—'}). Close and review it again.`,
    failed: `Written, but the ELD now shows trailer ${eld.trailer ?? '—'}, shipping docs ${eld.shipping_docs ?? '—'}.`,
    rejected: r.error || 'The ELD refused the change.',
    error: r.error || 'Something went wrong.'
  }[r.status] || `Unexpected answer: ${JSON.stringify(r)}`;
  result.value = { ok: r.status === 'ok', text };
  if (r.status === 'ok' || r.status === 'changed_meanwhile' || r.status === 'failed') {
    done.value = r.status !== 'failed';
    emit('fixed', r);
  }
}
</script>

<style scoped>
.fix-dialog { width: min(480px, 100%); }
.now { margin: 0; font-size: 14px; color: var(--color-neutral-800); text-wrap: pretty; }
.field { gap: 4px; }
.mono { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
.src { color: var(--color-neutral-700); }
.small { font-size: 12px; }
.same { color: var(--color-accent-700); font-weight: 600; }
.change { color: var(--color-signal); font-weight: 600; }
.hint { margin: 0; color: var(--color-neutral-700); }
</style>
