<template>
  <div
    class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4"
    @click.self="$emit('close')"
  >
    <div
      @click.stop
      class="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-150"
    >
      <!-- Modal Header -->
      <div class="bg-slate-800 text-white px-5 py-4 flex items-center justify-between">
        <div class="flex items-center gap-2">
          <span class="text-lg">🏢</span>
          <div>
            <h3 class="font-bold text-base leading-tight">
              {{ editingCompany ? 'Edit Company' : 'Add New Company' }}
            </h3>
            <p class="text-xs text-slate-300">
              Create a carrier or fleet group for drivers
            </p>
          </div>
        </div>
        <button
          @click="$emit('close')"
          class="text-slate-400 hover:text-white p-1 rounded hover:bg-slate-700 transition-colors"
        >
          ✕
        </button>
      </div>

      <!-- Modal Form Body -->
      <form @submit.prevent="handleSubmit" class="p-5 space-y-4">
        <!-- Company Name (Preserves exact casing as typed, no forced uppercase) -->
        <div>
          <label class="block text-xs font-bold text-slate-700 mb-1">
            Company Name <span class="text-rose-500">*</span>
          </label>
          <input
            v-model="form.name"
            type="text"
            placeholder="e.g. AK carrier or EVO ELD WENZE LLC"
            required
            autofocus
            class="w-full text-sm font-semibold px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-800"
          />
        </div>

        <!-- Optional Company Note -->
        <div>
          <label class="block text-xs font-bold text-slate-700 mb-1">
            Company Note / Tag <span class="text-slate-400 font-normal">(Optional)</span>
          </label>
          <input
            v-model="form.note"
            type="text"
            placeholder="e.g. FACTOR, LEADER, Fleet 1, etc."
            class="w-full text-sm px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-800"
          />
          <p class="text-[11px] text-slate-400 mt-1">
            Will display as: <strong class="text-slate-700">{{ previewText }}</strong>
          </p>
        </div>

        <!-- Actions -->
        <div class="pt-3 border-t border-slate-200 flex items-center justify-end gap-2">
          <button
            type="button"
            @click="$emit('close')"
            class="px-4 py-2 text-sm font-semibold text-slate-600 hover:text-slate-800 rounded-lg hover:bg-slate-100 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            class="px-5 py-2 text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg shadow-sm hover:shadow transition-all active:scale-95 flex items-center gap-1.5"
          >
            <span>{{ editingCompany ? 'Save Changes' : 'Add Company' }}</span>
          </button>
        </div>
      </form>
    </div>
  </div>
</template>

<script setup>
import { reactive, computed, onMounted, onUnmounted } from 'vue';

const props = defineProps({
  editingCompany: {
    type: Object,
    default: null
  }
});

const emit = defineEmits(['close', 'save']);

const form = reactive({
  name: props.editingCompany?.name || '',
  note: props.editingCompany?.note || ''
});

const previewText = computed(() => {
  const name = form.name.trim() || 'COMPANY NAME';
  const note = form.note.trim();
  return note ? `${name} (${note})` : name;
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
