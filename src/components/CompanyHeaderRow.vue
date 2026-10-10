<template>
  <tr
    :class="[
      'bg-slate-700 text-white select-none shadow-xs transition-colors',
      isOver ? 'bg-slate-800 ring-2 ring-emerald-400' : ''
    ]"
    @dragover.prevent="onDragOver"
    @dragleave="isOver = false"
    @drop="onDrop"
  >
    <td colspan="5" class="px-4 py-2">
      <div class="flex items-center justify-between gap-3">
        <!-- Left: Company Name + Optional Note -->
        <div class="flex items-center gap-2.5">
          <button
            @click="$emit('toggle-collapse')"
            class="text-slate-300 hover:text-white transition-colors p-0.5 rounded text-xs font-mono"
            :title="isCollapsed ? 'Expand drivers' : 'Collapse drivers'"
          >
            {{ isCollapsed ? '▶' : '▼' }}
          </button>

          <span class="font-bold tracking-wide text-sm flex items-center gap-2">
            <span>{{ company.name }}</span>
            <span
              v-if="company.note"
              class="text-xs font-semibold px-2 py-0.5 rounded bg-slate-600/90 text-amber-300 border border-slate-500/60"
            >
              ({{ company.note }})
            </span>
          </span>

          <!-- Driver Count Badge -->
          <span class="text-[11px] font-medium px-2 py-0.5 rounded-full bg-slate-800/80 text-slate-300 border border-slate-600">
            {{ driverCount }} {{ driverCount === 1 ? 'driver' : 'drivers' }}
          </span>
        </div>

        <!-- Right: Actions (+ Add Driver, Edit Company, Delete Company) -->
        <div class="flex items-center gap-2">
          <!-- + Add Driver Button on Company Line (As requested!) -->
          <button
            @click="$emit('add-driver', company)"
            class="flex items-center gap-1.5 px-3 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-xs hover:shadow transition-all active:scale-95"
            title="Add a new driver to this company"
          >
            <span class="text-sm leading-none">+</span>
            <span>Add Driver</span>
          </button>

          <!-- Edit Company -->
          <button
            @click="$emit('edit-company', company)"
            class="p-1 text-slate-300 hover:text-white hover:bg-slate-600 rounded transition-colors text-xs"
            title="Edit company name or note"
          >
            ✏️
          </button>

          <!-- Delete Company -->
          <button
            @click="$emit('delete-company', company.id)"
            class="p-1 text-slate-300 hover:text-rose-400 hover:bg-slate-600 rounded transition-colors text-xs"
            title="Delete company"
          >
            🗑️
          </button>
        </div>
      </div>
    </td>
  </tr>
</template>

<script setup>
import { ref } from 'vue';

const props = defineProps({
  company: {
    type: Object,
    required: true
  },
  driverCount: {
    type: Number,
    default: 0
  },
  isCollapsed: {
    type: Boolean,
    default: false
  }
});

const emit = defineEmits(['add-driver', 'edit-company', 'delete-company', 'toggle-collapse', 'drop-driver']);

const isOver = ref(false);

function onDragOver(e) {
  e.dataTransfer.dropEffect = 'move';
  isOver.value = true;
}

function onDrop(e) {
  isOver.value = false;
  const driverId = e.dataTransfer.getData('text/plain');
  if (driverId) {
    emit('drop-driver', { driverId, targetCompanyId: props.company.id });
  }
}
</script>
