<template>
  <tr
    ref="rowRef"
    :draggable="canDragCompany"
    @dragstart="onDragStart"
    @dragend="onDragEnd"
    @dragover.prevent="$emit('company-drag-over', { event: $event, company })"
    @drop.prevent="$emit('company-drop', { event: $event, company })"
    :class="[
      'bg-slate-700 text-white select-none transition-colors duration-150 group text-sm',
      isDragging ? 'opacity-30 bg-slate-800' : 'hover:bg-slate-700/95'
    ]"
  >
    <!-- Column 0: Company Order Number (#) - Fixed 56px Width (Draggable Handle ONLY) -->
    <td
      class="w-14 min-w-[56px] max-w-[56px] px-2 py-2 text-center text-xs font-mono font-bold select-none cursor-grab active:cursor-grabbing border-r border-slate-600 text-slate-300 hover:text-white bg-slate-800/95 group-hover:bg-slate-900 transition-colors"
      @mousedown="canDragCompany = true"
      @mouseup="canDragCompany = false"
      @mouseleave="canDragCompany = false"
      :title="`Drag to reorder company #${companyIndex}`"
    >
      <div class="flex items-center justify-center gap-1">
        <span class="text-[10px] text-slate-400 group-hover:text-slate-200">⠿</span>
        <span>{{ companyIndex }}</span>
      </div>
    </td>

    <!-- Columns 1 to 4: Company Title, Count, and Optional Actions (4 cols) -->
    <td colspan="4" class="px-4 py-2">
      <div class="flex items-center justify-between gap-3">
        <!-- Left: Collapse Arrow + Company Name + Note + Count -->
        <div class="flex items-center gap-2.5">
          <button
            @click="$emit('toggle-collapse')"
            class="text-slate-300 hover:text-white transition-colors p-1 rounded hover:bg-slate-600/60 text-xs font-mono"
            :title="isCollapsed ? 'Expand drivers' : 'Collapse drivers'"
          >
            {{ isCollapsed ? '▶' : '▼' }}
          </button>

          <span
            class="font-bold tracking-wide text-sm flex items-center gap-2 cursor-pointer"
            @click="$emit('toggle-collapse')"
          >
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

        <!-- Right: Actions (+ Add Driver, Edit, Delete) - SHOWN ONLY ON MAIN CHECKINGBOARD TAB;
             adding and deleting are manager-only -->

        <div v-if="showActions" class="flex items-center gap-2">
          <!-- + Add Driver Button (managers only) -->
          <button
            v-if="canManageFleet"
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

          <!-- Delete Company (managers only) -->
          <button
            v-if="canManageFleet"
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
  companyIndex: {
    type: Number,
    required: true
  },
  driverCount: {
    type: Number,
    default: 0
  },
  isCollapsed: {
    type: Boolean,
    default: true
  },
  showActions: {
    type: Boolean,
    default: true
  },
  canManageFleet: {
    type: Boolean,
    default: false
  },
  isDragging: {
    type: Boolean,
    default: false
  }
});

const emit = defineEmits([
  'add-driver',
  'edit-company',
  'delete-company',
  'toggle-collapse',
  'company-drag-start',
  'company-drag-end',
  'company-drag-over',
  'company-drop'
]);

const canDragCompany = ref(false);

function onDragStart(e) {
  if (!canDragCompany.value) {
    e.preventDefault();
    return;
  }
  emit('company-drag-start', props.company.id);
  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData('text/plain', `company:${props.company.id}`);
}

function onDragEnd() {
  canDragCompany.value = false;
  emit('company-drag-end');
}
</script>
