<template>
  <div class="cb-backdrop" @click.self="$emit('close')">
    <form class="cb-dialog company" @submit.prevent="handleSubmit">
      <span class="cb-dialog-title">{{ editingCompany ? 'Edit company' : 'Add company' }}</span>
      <div class="field">
        <label for="comp-name">Company name</label>
        <input id="comp-name" ref="nameRef" v-model="form.name" class="input" required placeholder="Enter company name" />
      </div>
      <div class="field">
        <label for="comp-note">Note</label>
        <input id="comp-note" v-model="form.note" class="input" placeholder="e.g. FACTOR, Fleet 1" />
      </div>
      <div class="cb-dialog-actions">
        <button type="button" class="btn btn-secondary" @click="$emit('close')">Cancel</button>
        <button type="submit" class="btn btn-primary">Save company</button>
      </div>
    </form>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, onUnmounted } from 'vue';

const props = defineProps({
  editingCompany: { type: Object, default: null }
});

const emit = defineEmits(['close', 'save']);
const nameRef = ref(null);

const form = reactive({
  name: props.editingCompany?.name || '',
  note: props.editingCompany?.note || ''
});

function handleSubmit() {
  if (!form.name.trim()) return;
  emit('save', {
    ...(props.editingCompany || {}),
    name: form.name.trim(),
    note: form.note.trim()
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
.company { width: min(420px, 100%); }
</style>
