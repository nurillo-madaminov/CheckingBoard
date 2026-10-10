<template>
  <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
    <div
      class="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-150"
    >
      <!-- Modal Header -->
      <div class="bg-slate-800 text-white px-5 py-4 flex items-center justify-between">
        <div class="flex items-center gap-2">
          <span class="text-lg">🚚</span>
          <div>
            <h3 class="font-bold text-base leading-tight">
              {{ editingDriver ? 'Edit Driver' : 'Add New Driver' }}
            </h3>
            <p class="text-xs text-slate-300">
              Company: <span class="font-semibold text-amber-300">{{ selectedCompanyName }}</span>
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
        <!-- Company Selector (if editing or changing company) -->
        <div>
          <label class="block text-xs font-bold text-slate-700 mb-1">Company</label>
          <select
            v-model="form.companyId"
            class="w-full text-sm px-3 py-2 rounded-lg border border-slate-300 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
            required
          >
            <option v-for="c in companies" :key="c.id" :value="c.id">
              {{ c.name }} {{ c.note ? `(${c.note})` : '' }}
            </option>
          </select>
        </div>

        <!-- Row: Unit Number & Driver Name -->
        <div class="grid grid-cols-3 gap-3">
          <!-- Unit Number -->
          <div>
            <label class="block text-xs font-bold text-slate-700 mb-1">
              Unit # <span class="text-slate-400 font-normal">(e.g. 122)</span>
            </label>
            <input
              v-model="form.unit"
              type="text"
              placeholder="122"
              class="w-full text-sm font-mono font-bold px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <!-- Driver Name -->
          <div class="col-span-2">
            <label class="block text-xs font-bold text-slate-700 mb-1">
              Driver Name <span class="text-rose-500">*</span>
            </label>
            <input
              v-model="form.name"
              type="text"
              placeholder="e.g. MOUZ TEDLA"
              required
              class="w-full text-sm font-semibold uppercase px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
        </div>

        <!-- Live Preview of Display Name -->
        <div class="bg-slate-50 border border-slate-200 rounded-lg p-2.5 flex items-center justify-between text-xs">
          <span class="text-slate-500 font-medium">Table Display Preview:</span>
          <span class="font-bold text-slate-800 bg-white px-2 py-1 rounded border border-slate-300 font-mono shadow-2xs">
            {{ previewDisplay }}
          </span>
        </div>

        <!-- Row: Sign Status & Initial Driver Status -->
        <div class="grid grid-cols-2 gap-3">
          <!-- Sign Status -->
          <div>
            <label class="block text-xs font-bold text-slate-700 mb-1">Sign Status</label>
            <select
              v-model="form.sign"
              class="w-full text-xs font-bold px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono"
            >
              <option v-for="s in signOptions" :key="s.code" :value="s.code">
                {{ s.label }}
              </option>
            </select>
          </div>

          <!-- Driver Status -->
          <div>
            <label class="block text-xs font-bold text-slate-700 mb-1">Driver Status</label>
            <select
              v-model="form.status"
              class="w-full text-xs font-bold px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option v-for="st in statusOptions" :key="st.code" :value="st.code">
                {{ st.code }} - {{ st.label }}
              </option>
            </select>
          </div>
        </div>

        <!-- Highlight Color (Optional) -->
        <div>
          <label class="block text-xs font-bold text-slate-700 mb-1">
            Row Highlight Color <span class="text-slate-400 font-normal">(Optional)</span>
          </label>
          <div class="flex items-center gap-2">
            <button
              type="button"
              v-for="color in highlightPresets"
              :key="color.hex"
              @click="form.highlightColor = form.highlightColor === color.hex ? '' : color.hex"
              class="w-7 h-7 rounded-full border-2 transition-transform hover:scale-110 flex items-center justify-center text-xs"
              :class="form.highlightColor === color.hex ? 'border-slate-800 scale-105 shadow-md' : 'border-slate-300'"
              :style="{ backgroundColor: color.hex }"
              :title="color.name"
            >
              <span v-if="form.highlightColor === color.hex" class="text-slate-900 font-bold text-xs">✓</span>
            </button>
            <button
              type="button"
              @click="form.highlightColor = ''"
              class="text-xs px-2.5 py-1 text-slate-500 hover:text-slate-800 border border-slate-300 rounded hover:bg-slate-100"
            >
              None
            </button>
          </div>
        </div>

        <!-- Note (Optional) -->
        <div>
          <label class="block text-xs font-bold text-slate-700 mb-1">
            Note <span class="text-slate-400 font-normal">(Optional)</span>
          </label>
          <input
            v-model="form.notes"
            type="text"
            placeholder="e.g. will leave in 1hour, def issue, etc."
            class="w-full text-sm px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
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
            <span>{{ editingDriver ? 'Save Changes' : 'Add Driver' }}</span>
          </button>
        </div>
      </form>
    </div>
  </div>
</template>

<script setup>
import { reactive, computed } from 'vue';
import { DRIVER_STATUSES, SIGN_STATUSES } from '../config/statusConfig';

const props = defineProps({
  companies: {
    type: Array,
    required: true
  },
  defaultCompanyId: {
    type: String,
    default: ''
  },
  editingDriver: {
    type: Object,
    default: null
  }
});

const emit = defineEmits(['close', 'save']);

const form = reactive({
  companyId: props.editingDriver?.companyId || props.defaultCompanyId || props.companies[0]?.id || '',
  unit: props.editingDriver?.unit || '',
  name: props.editingDriver?.name || '',
  sign: props.editingDriver?.sign || 'SIGNED',
  status: props.editingDriver?.status || 'READY',
  notes: props.editingDriver?.notes || '',
  highlightColor: props.editingDriver?.highlightColor || ''
});

const statusOptions = DRIVER_STATUSES;
const signOptions = SIGN_STATUSES;

const highlightPresets = [
  { name: 'Yellow', hex: '#FEF08A' },
  { name: 'Orange', hex: '#FED7AA' },
  { name: 'Blue', hex: '#BAE6FD' },
  { name: 'Pink', hex: '#FBCFE8' },
  { name: 'Green', hex: '#BBF7D0' },
  { name: 'Purple', hex: '#E9D5FF' }
];

const selectedCompanyName = computed(() => {
  const comp = props.companies.find(c => c.id === form.companyId);
  return comp ? (comp.note ? `${comp.name} (${comp.note})` : comp.name) : 'None';
});

const previewDisplay = computed(() => {
  const unit = form.unit.trim();
  const name = form.name.trim() || 'DRIVER NAME';
  return unit ? `${unit} - ${name}` : name;
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
    highlightColor: form.highlightColor
  });
}
</script>
