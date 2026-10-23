<template>
  <div class="cb-backdrop" @click.self="$emit('close')">
    <form class="cb-dialog" @submit.prevent="handleSubmit">
      <span class="cb-dialog-title">{{ editingDriver ? 'Edit driver' : 'Add driver' }}</span>

      <div class="unit-row">
        <div class="field">
          <label for="drv-unit">Unit</label>
          <input id="drv-unit" v-model="form.unit" class="input" placeholder="Unit #" />
        </div>
        <div class="field">
          <label for="drv-name">Driver name</label>
          <input id="drv-name" ref="nameRef" v-model="form.name" class="input" required placeholder="Enter driver name" />
        </div>
      </div>

      <div class="field">
        <label for="drv-company">Company</label>
        <select id="drv-company" v-model="form.companyId" class="input" required>
          <option v-for="comp in companies" :key="comp.id" :value="comp.id">
            {{ comp.note ? `${comp.name} (${comp.note})` : comp.name }}
          </option>
        </select>
      </div>

      <div class="two-col">
        <div class="field">
          <label for="drv-sign">Sign</label>
          <select id="drv-sign" v-model="form.sign" class="input">
            <option v-for="s in SIGN_STATUSES" :key="s.code" :value="s.code">{{ s.label }}</option>
          </select>
        </div>
        <div class="field">
          <label for="drv-status">Status</label>
          <select id="drv-status" v-model="form.status" class="input">
            <option v-for="st in DRIVER_STATUSES" :key="st.code" :value="st.code">{{ st.code }} – {{ st.label }}</option>
          </select>
        </div>
      </div>

      <div class="field">
        <label for="drv-notes">Notes</label>
        <input id="drv-notes" v-model="form.notes" class="input" />
      </div>

      <label class="flag-toggle">
        <input v-model="form.flagged" type="checkbox" />
        Flag this row
      </label>

      <div class="cb-dialog-actions">
        <button type="button" class="btn btn-secondary" @click="$emit('close')">Cancel</button>
        <button type="submit" class="btn btn-primary">Save driver</button>
      </div>
    </form>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, onUnmounted } from 'vue';
import { DRIVER_STATUSES, SIGN_STATUSES, FLAG_COLOR } from '../config/statusConfig';

const props = defineProps({
  companies: { type: Array, required: true },
  defaultCompanyId: { type: String, default: '' },
  editingDriver: { type: Object, default: null }
});

const emit = defineEmits(['close', 'save']);
const nameRef = ref(null);

const form = reactive({
  companyId: props.editingDriver?.companyId || props.defaultCompanyId || props.companies[0]?.id || '',
  unit: props.editingDriver?.unit || '',
  name: props.editingDriver?.name || '',
  sign: props.editingDriver?.sign || 'SIGNED',
  status: props.editingDriver?.status || 'READY',
  notes: props.editingDriver?.notes || '',
  flagged: !!props.editingDriver?.highlightColor
});

function handleSubmit() {
  if (!form.name.trim()) return;
  emit('save', {
    ...(props.editingDriver || {}),
    companyId: form.companyId,
    unit: form.unit.trim(),
    name: form.name.trim(),
    sign: form.sign,
    status: form.status,
    notes: form.notes.trim(),
    highlightColor: form.flagged ? FLAG_COLOR : ''
  });
}

function onKeydown(e) {
  if (e.key === 'Escape') emit('close');
}

onMounted(() => {
  nameRef.value?.focus();
  window.addEventListener('keydown', onKeydown);
});
onUnmounted(() => window.removeEventListener('keydown', onKeydown));
</script>

<style scoped>
.unit-row { display: grid; grid-template-columns: 100px 1fr; gap: 10px; }
.two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.flag-toggle { display: flex; align-items: center; gap: 8px; font-size: 13px; color: var(--color-neutral-800); cursor: pointer; }
.flag-toggle input { accent-color: var(--color-accent); }
</style>
