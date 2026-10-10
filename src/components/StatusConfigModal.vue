<template>
  <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
    <div
      class="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150"
    >
      <!-- Header -->
      <div class="bg-slate-800 text-white px-5 py-4 flex items-center justify-between shrink-0">
        <div class="flex items-center gap-2">
          <span class="text-lg">⚙️</span>
          <div>
            <h3 class="font-bold text-base leading-tight">Status & Colors Configuration</h3>
            <p class="text-xs text-slate-300">
              Customize status codes, labels, and badges (backed by <code class="bg-slate-700 px-1 py-0.5 rounded text-amber-300 font-mono">src/config/statusConfig.js</code>)
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

      <!-- Content -->
      <div class="p-5 overflow-y-auto space-y-6 flex-1 text-sm">
        <!-- Status Colors List -->
        <div>
          <h4 class="font-bold text-slate-800 text-xs uppercase tracking-wider mb-3 flex items-center justify-between">
            <span>Driver Statuses ({{ statuses.length }})</span>
            <span class="text-[11px] text-slate-400 font-normal">Click colors to modify</span>
          </h4>

          <div class="space-y-2.5">
            <div
              v-for="st in statuses"
              :key="st.id"
              class="flex items-center justify-between gap-3 p-2.5 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors"
            >
              <div class="flex items-center gap-3">
                <!-- Preview Badge -->
                <span
                  class="px-2.5 py-1 text-xs font-bold rounded border shadow-2xs min-w-[90px] text-center"
                  :style="{
                    backgroundColor: st.bgColor,
                    color: st.textColor,
                    borderColor: st.borderColor
                  }"
                >
                  {{ st.code }}
                </span>

                <div>
                  <div class="font-bold text-xs text-slate-800">{{ st.label }}</div>
                  <div class="text-[11px] text-slate-400">{{ st.description }}</div>
                </div>
              </div>

              <!-- Color Controls -->
              <div class="flex items-center gap-2 shrink-0">
                <label class="text-[11px] text-slate-500 font-medium">Bg:</label>
                <input
                  v-model="st.bgColor"
                  type="color"
                  class="w-6 h-6 rounded cursor-pointer border border-slate-300 p-0"
                />

                <label class="text-[11px] text-slate-500 font-medium ml-1">Text:</label>
                <input
                  v-model="st.textColor"
                  type="color"
                  class="w-6 h-6 rounded cursor-pointer border border-slate-300 p-0"
                />
              </div>
            </div>
          </div>
        </div>

        <!-- Sign Statuses -->
        <div>
          <h4 class="font-bold text-slate-800 text-xs uppercase tracking-wider mb-3">
            Sign Dropdown Values
          </h4>
          <div class="grid grid-cols-2 gap-3">
            <div
              v-for="s in signStatuses"
              :key="s.code"
              class="p-3 rounded-lg border border-slate-200 flex items-center justify-between"
            >
              <div class="flex items-center gap-2">
                <span
                  class="px-2 py-0.5 text-xs font-bold rounded border font-mono"
                  :style="{
                    backgroundColor: s.bgColor,
                    color: s.textColor,
                    borderColor: s.borderColor
                  }"
                >
                  {{ s.code }}
                </span>
                <span class="text-xs font-semibold text-slate-700">{{ s.label }}</span>
              </div>
              <div class="flex items-center gap-1.5">
                <input
                  v-model="s.bgColor"
                  type="color"
                  class="w-6 h-6 rounded cursor-pointer border border-slate-300 p-0"
                  title="Background"
                />
                <input
                  v-model="s.textColor"
                  type="color"
                  class="w-6 h-6 rounded cursor-pointer border border-slate-300 p-0"
                  title="Text color"
                />
              </div>
            </div>
          </div>
        </div>

        <!-- Note about config file -->
        <div class="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-900 leading-relaxed">
          <strong>Tip:</strong> These statuses are configured in <code class="font-bold text-amber-950 font-mono">src/config/statusConfig.js</code>. You can also edit that file directly in your code editor to permanently alter defaults!
        </div>
      </div>

      <!-- Footer -->
      <div class="bg-slate-100 px-5 py-3 border-t border-slate-200 flex items-center justify-between shrink-0">
        <button
          @click="resetDefaults"
          class="text-xs font-semibold text-rose-600 hover:text-rose-800 underline"
        >
          Reset Status Colors
        </button>
        <button
          @click="$emit('close')"
          class="px-4 py-2 text-xs font-bold bg-slate-800 hover:bg-slate-700 text-white rounded-lg transition-colors"
        >
          Close
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { DRIVER_STATUSES, SIGN_STATUSES } from '../config/statusConfig';

defineEmits(['close']);

const statuses = ref(DRIVER_STATUSES);
const signStatuses = ref(SIGN_STATUSES);

function resetDefaults() {
  window.location.reload();
}
</script>
