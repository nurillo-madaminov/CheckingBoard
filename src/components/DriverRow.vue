<template>
  <tr
    ref="rowRef"
    :draggable="canDragDriver"
    @dragstart="onDragStart"
    @dragend="onDragEnd"
    @dragover.prevent="$emit('row-dragover', { event: $event, driver })"
    @drop.prevent="$emit('row-drop', { event: $event, driver })"
    @click="$emit('select-row', driver.id)"
    :style="rowCustomStyle"
    :class="[
      'transition-colors duration-150 group text-sm select-text relative cursor-default',
      isDragging ? 'opacity-30 bg-slate-300' : '',
      isActive ? 'is-active-row z-20' : 'hover:brightness-95',
      showColorPicker ? 'z-50 relative' : '',
      justChanged ? 'animate-pulse' : ''
    ]"
  >
    <!-- Column 0: ORDER NUMBER (#) - Fixed 56px Width (Draggable Handle ONLY) -->
    <td
      class="w-14 min-w-[56px] max-w-[56px] px-2 py-2 text-center text-xs font-mono font-bold select-none cursor-grab active:cursor-grabbing border-r border-slate-300 text-slate-500 hover:text-slate-800 bg-slate-100/90 group-hover:bg-slate-200/90 transition-colors"
      @mousedown="canDragDriver = true"
      @mouseup="canDragDriver = false"
      @mouseleave="canDragDriver = false"
      :title="`Drag to reorder line #${orderIndex}`"
    >
      <div class="flex items-center justify-center gap-1">
        <span class="text-[10px] text-slate-400 group-hover:text-slate-600 opacity-60 group-hover:opacity-100">⠿</span>
        <span>{{ orderIndex }}</span>
      </div>
    </td>

    <!-- Column 1: DRIVER (122 - Driver Name) - Fixed 320px Width (overflow-visible for color picker) -->
    <td class="w-80 min-w-[320px] max-w-[320px] px-4 py-2 text-slate-800 font-medium overflow-visible relative">
      <div class="flex items-center justify-between gap-2">
        <div class="flex items-center gap-2 truncate">
          <!-- Optional Color Highlight Dot -->
          <span
            v-if="driver.highlightColor"
            class="w-3 h-3 rounded-full shrink-0 border border-black/20 shadow-xs"
            :style="{ backgroundColor: driver.highlightColor }"
            title="Custom highlight"
          ></span>

          <!-- Driver Display with Unit Number (NO click-to-edit on name; edit is strictly via pencil icon) -->
          <div class="flex items-center gap-1.5 font-semibold text-slate-900 tracking-tight truncate">
            <span
              v-if="driver.unit"
              class="text-indigo-950 font-bold bg-white/90 px-1.5 py-0.5 rounded text-xs border border-indigo-200 shadow-2xs font-mono shrink-0"
            >
              {{ driver.unit }}
            </span>
            <span v-if="driver.unit" class="text-slate-400 font-bold shrink-0">-</span>
            <span
              class="truncate select-text"
              :title="driver.name"
            >
              {{ driver.name }}
            </span>
          </div>
        </div>

        <!-- Quick row actions (hover only, shrink-0) -->
        <div class="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 shrink-0">
          <!-- Highlight Color Picker -->
          <div class="relative flex items-center">
            <button
              @click.stop="toggleColorPicker"
              title="Highlight driver row"
              class="p-1 text-slate-400 hover:text-amber-500 rounded hover:bg-slate-200/60 transition-colors text-xs"
            >
              🎨
            </button>

            <!-- Floating Color Palette: High z-index, appears above all next lines -->
            <div
              v-if="showColorPicker"
              @click.stop
              class="absolute right-0 top-8 z-50 bg-white p-2.5 rounded-lg shadow-2xl border border-slate-300 flex items-center gap-1.5"
            >
              <button
                v-for="color in highlightPresets"
                :key="color.hex"
                @click.stop="setHighlightColor(color.hex)"
                class="w-5 h-5 rounded-full border border-slate-300 hover:scale-110 transition-transform shadow-2xs"
                :style="{ backgroundColor: color.hex }"
                :title="color.name"
              ></button>
              <button
                @click.stop="setHighlightColor('')"
                class="w-5 h-5 rounded-full border border-dashed border-slate-400 text-[10px] text-slate-500 hover:bg-slate-100 flex items-center justify-center font-bold"
                title="Remove highlight"
              >
                ✕
              </button>
            </div>
          </div>

          <!-- Edit Driver Info (Pencil icon ONLY opens the edit modal) -->
          <button
            @click.stop="$emit('edit', driver)"
            title="Edit driver info (Unit, Name, Notes)"
            class="p-1 text-slate-400 hover:text-indigo-600 rounded hover:bg-slate-200/60 transition-colors text-xs"
          >
            ✏️
          </button>

          <!-- Delete Driver -->
          <button
            @click.stop="$emit('delete', driver.id)"
            title="Delete driver"
            class="p-1 text-slate-400 hover:text-rose-600 rounded hover:bg-slate-200/60 transition-colors text-xs"
          >
            🗑️
          </button>
        </div>
      </div>
    </td>

    <!-- Column 2: SIGN DROPDOWN - Fixed 140px Width -->
    <td class="w-36 min-w-[140px] max-w-[140px] px-3 py-1.5 overflow-hidden">
      <div class="relative">
        <select
          :value="driver.sign"
          @focus="onSelectLine"
          @change="onSignChange($event.target.value)"
          :style="{
            backgroundColor: currentSignConfig.bgColor,
            color: currentSignConfig.textColor,
            borderColor: currentSignConfig.borderColor
          }"
          class="w-full text-xs font-bold px-2.5 py-1 rounded-md border appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-indigo-500 shadow-2xs font-mono tracking-wider transition-all"
        >
          <option
            v-for="signOpt in signOptions"
            :key="signOpt.code"
            :value="signOpt.code"
            class="bg-white text-slate-900 font-sans"
          >
            {{ signOpt.label }}
          </option>
        </select>
        <span
          class="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[9px] font-bold"
          :style="{ color: currentSignConfig.textColor }"
        >
          ▼
        </span>
      </div>
    </td>

    <!-- Column 3: STATUS DROPDOWN - Fixed 190px Width -->
    <td class="w-48 min-w-[190px] max-w-[190px] px-3 py-1.5 overflow-hidden">
      <div class="relative">
        <select
          :value="driver.status"
          @focus="onSelectLine"
          @change="onStatusChange($event.target.value)"
          :style="{
            backgroundColor: currentStatusConfig.bgColor,
            color: currentStatusConfig.textColor,
            borderColor: currentStatusConfig.borderColor
          }"
          class="w-full text-xs font-bold px-2.5 py-1 rounded-md border appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-indigo-500 shadow-2xs tracking-wide transition-all"
        >
          <option
            v-for="st in statusOptions"
            :key="st.code"
            :value="st.code"
            class="bg-white text-slate-900 font-sans"
          >
            {{ st.code }} - {{ st.label }}
          </option>
        </select>
        <span
          class="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[9px] font-bold"
          :style="{ color: currentStatusConfig.textColor }"
        >
          ▼
        </span>
      </div>
    </td>

    <!-- Column 4: NOTES - Takes Remaining Flex Width -->
    <td class="px-4 py-1.5 text-slate-700 min-w-[200px]">
      <input
        v-model="localNotes"
        @focus="onSelectLine"
        @blur="saveNotes"
        @keyup.enter="$event.target.blur()"
        type="text"
        placeholder="Add note..."
        class="w-full bg-white/70 hover:bg-white focus:bg-white px-2 py-1 rounded text-xs text-slate-800 placeholder-slate-400 border border-transparent hover:border-slate-300 focus:border-indigo-400 focus:outline-none transition-all shadow-2xs"
      />
    </td>
  </tr>
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue';
import {
  DRIVER_STATUSES,
  SIGN_STATUSES,
  getStatusConfig,
  getSignConfig
} from '../config/statusConfig';

const props = defineProps({
  driver: {
    type: Object,
    required: true
  },
  orderIndex: {
    type: Number,
    required: true
  },
  isActive: {
    type: Boolean,
    default: false
  },
  isDragging: {
    type: Boolean,
    default: false
  }
});

const emit = defineEmits([
  'update',
  'delete',
  'edit',
  'select-row',
  'drag-start',
  'drag-end',
  'row-dragover',
  'row-drop'
]);

const rowRef = ref(null);
const localNotes = ref(props.driver.notes || '');
const showColorPicker = ref(false);
const justChanged = ref(false);
const canDragDriver = ref(false);

watch(() => props.driver.notes, (newVal) => {
  localNotes.value = newVal || '';
});

const statusOptions = DRIVER_STATUSES;
const signOptions = SIGN_STATUSES;

const currentStatusConfig = computed(() => getStatusConfig(props.driver.status));
const currentSignConfig = computed(() => getSignConfig(props.driver.sign));

const highlightPresets = [
  { name: 'Yellow', hex: '#FEF08A' },
  { name: 'Orange', hex: '#FED7AA' },
  { name: 'Blue', hex: '#BAE6FD' },
  { name: 'Pink', hex: '#FBCFE8' },
  { name: 'Green', hex: '#BBF7D0' },
  { name: 'Purple', hex: '#E9D5FF' }
];

// Row background styling based on active state, highlight color, and status
const rowCustomStyle = computed(() => {
  const cfg = currentStatusConfig.value;

  if (props.driver.highlightColor) {
    return {
      backgroundColor: props.isActive ? props.driver.highlightColor + '70' : props.driver.highlightColor + '40'
    };
  }

  if (props.isActive) {
    return {
      backgroundColor: cfg.activeBgColor || cfg.rowBgColor || '#FEF9C3'
    };
  }

  return {
    backgroundColor: cfg.rowBgColor || '#FFFFFF'
  };
});

function onSelectLine() {
  emit('select-row', props.driver.id);
}

function onSignChange(newSign) {
  onSelectLine();
  emit('update', { ...props.driver, sign: newSign });
}

function onStatusChange(newStatus) {
  onSelectLine();
  justChanged.value = true;
  emit('update', { ...props.driver, status: newStatus });
  setTimeout(() => {
    justChanged.value = false;
  }, 1000);
}

function saveNotes() {
  if (localNotes.value !== (props.driver.notes || '')) {
    emit('update', { ...props.driver, notes: localNotes.value });
  }
}

function toggleColorPicker() {
  showColorPicker.value = !showColorPicker.value;
}

function setHighlightColor(color) {
  showColorPicker.value = false;
  emit('update', { ...props.driver, highlightColor: color });
}

// Global click outside to close color picker
function handleDocumentClick(e) {
  if (showColorPicker.value && rowRef.value && !rowRef.value.contains(e.target)) {
    showColorPicker.value = false;
  }
}

onMounted(() => {
  document.addEventListener('click', handleDocumentClick);
});

onUnmounted(() => {
  document.removeEventListener('click', handleDocumentClick);
});

// Drag & Drop Handlers - DRIVER CAN ONLY BE DRAGGED FROM ORDER NUMBER
function onDragStart(e) {
  if (!canDragDriver.value) {
    e.preventDefault();
    return;
  }
  emit('drag-start', props.driver.id);
  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData('text/plain', `driver:${props.driver.id}`);
}

function onDragEnd() {
  canDragDriver.value = false;
  emit('drag-end');
}
</script>
