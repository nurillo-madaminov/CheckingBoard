<template>
  <div class="h-full flex flex-col overflow-hidden bg-white">
    <!-- Top Bar: Category Banner & Expand/Collapse All Toggle -->
    <div
      class="bg-slate-50 border-b border-slate-200 px-4 py-2 flex items-center justify-between text-xs shrink-0 select-none"
    >
      <div class="flex items-center gap-3">
        <template v-if="currentTab.id !== 'CHECKING_BOARD'">
          <span class="font-bold text-slate-800 uppercase tracking-wider text-xs">
            {{ currentTab.label }}
          </span>
          <span class="text-slate-400">—</span>
          <span class="text-slate-600 font-medium italic">
            {{ currentTab.subtitle }}
          </span>
        </template>
        <template v-else>
          <span class="font-bold text-slate-800 uppercase tracking-wider text-xs">
            Main Board
          </span>
          <span class="text-slate-400">—</span>
          <span class="text-slate-500 font-medium">
            All Carrier Companies & Drivers
          </span>
        </template>
      </div>

      <div class="flex items-center gap-3">
        <!-- Expand / Collapse All Toggle Button -->
        <button
          @click="toggleAllCompanies"
          class="flex items-center gap-1.5 px-2.5 py-1 rounded bg-white hover:bg-slate-100 text-slate-700 font-semibold text-xs border border-slate-300 transition-colors shadow-2xs"
          :title="allCollapsed ? 'Expand all companies' : 'Collapse all companies'"
        >
          <span>{{ allCollapsed ? '▼' : '▶' }}</span>
          <span>{{ allCollapsed ? 'Expand All' : 'Collapse All' }}</span>
        </button>

        <span class="text-slate-300">|</span>

        <!-- Drivers count -->
        <div class="flex items-center gap-1.5">
          <span class="text-slate-500 font-medium">Drivers in view:</span>
          <span class="px-2 py-0.5 rounded font-bold text-xs bg-emerald-100 text-emerald-800 border border-emerald-300">
            {{ totalVisibleDrivers }}
          </span>
        </div>
      </div>
    </div>

    <!-- Table Container (Scrollable) -->
    <div
      class="flex-1 overflow-auto"
      @dragover.prevent
      @drop.prevent="onContainerDrop"
    >
      <table class="w-full text-left table-grid border-separate table-fixed">
        <!-- Strictly Defined Locked Column Widths -->
        <colgroup>
          <col style="width: 56px;" />
          <col style="width: 320px;" />
          <col style="width: 140px;" />
          <col style="width: 190px;" />
          <col />
        </colgroup>

        <!-- Table Column Headers -->
        <thead class="sticky top-0 z-30 bg-slate-100 text-slate-700 text-xs font-bold uppercase tracking-wider shadow-xs">
          <tr>
            <!-- Col 0: Excel-style Row # Header (Fixed 56px) -->
            <th class="w-14 min-w-[56px] max-w-[56px] px-2 py-2.5 border-b border-r border-slate-300 text-center select-none bg-slate-200/90 text-slate-700">
              #
            </th>
            <!-- Col 1: Driver (Fixed 320px) -->
            <th class="w-80 min-w-[320px] max-w-[320px] px-4 py-2.5 border-b border-r border-slate-300">
              <div class="flex items-center gap-1.5 truncate">
                <span>Driver (Unit - Name)</span>
              </div>
            </th>
            <!-- Col 2: Sign (Fixed 140px) -->
            <th class="w-36 min-w-[140px] max-w-[140px] px-3 py-2.5 border-b border-r border-slate-300 text-center">
              Sign
            </th>
            <!-- Col 3: Status (Fixed 190px) -->
            <th class="w-48 min-w-[190px] max-w-[190px] px-3 py-2.5 border-b border-r border-slate-300 text-center">
              Status
            </th>
            <!-- Col 4: Notes (Remaining width) -->
            <th class="px-4 py-2.5 border-b border-slate-300">
              Notes
            </th>
          </tr>
        </thead>

        <!-- Table Body -->
        <tbody>
          <!-- Empty State if no companies -->
          <tr v-if="companies.length === 0">
            <td colspan="5" class="text-center py-12 text-slate-400">
              <div class="text-4xl mb-2">📋</div>
              <div class="font-bold text-base text-slate-600">No Companies Found</div>
              <p class="text-xs text-slate-500 mt-1">Click "+ Add Company" above to get started.</p>
            </td>
          </tr>

          <!-- Company Sections -->
          <template v-for="(company, compIdx) in filteredCompanies" :key="company.id">
            <!-- COMPANY INSERTION GUIDE LINE: BEFORE -->
            <tr
              v-if="dropTargetCompany && dropTargetCompany.companyId === company.id && dropTargetCompany.position === 'before'"
              class="pointer-events-none select-none"
            >
              <td colspan="5" class="p-0 border-0 h-1.5 bg-blue-600 relative shadow-sm">
                <div class="h-1.5 bg-blue-600 w-full relative flex items-center">
                  <span class="absolute -left-1 w-3 h-3 bg-blue-600 rotate-45"></span>
                  <span class="absolute -right-1 w-3 h-3 bg-blue-600 rotate-45"></span>
                </div>
              </td>
            </tr>

            <!-- Company Header Row (Draggable via order number handle) -->
            <CompanyHeaderRow
              :company="company"
              :companyIndex="compIdx + 1"
              :driverCount="getCompanyDrivers(company.id).length"
              :isCollapsed="isCompanyCollapsed(company.id)"
              :showActions="currentTab.id === 'CHECKING_BOARD'"
              :isDragging="draggedCompanyId === company.id"
              @toggle-collapse="toggleCompanyCollapse(company.id)"
              @add-driver="$emit('add-driver', company)"
              @edit-company="$emit('edit-company', company)"
              @delete-company="$emit('delete-company', company.id)"
              @company-drag-start="handleCompanyDragStart"
              @company-drag-end="handleCompanyDragEnd"
              @company-drag-over="handleCompanyDragOver"
              @company-drop="handleCompanyDrop"
            />

            <!-- COMPANY INSERTION GUIDE LINE: AFTER -->
            <tr
              v-if="dropTargetCompany && dropTargetCompany.companyId === company.id && dropTargetCompany.position === 'after'"
              class="pointer-events-none select-none"
            >
              <td colspan="5" class="p-0 border-0 h-1.5 bg-blue-600 relative shadow-sm">
                <div class="h-1.5 bg-blue-600 w-full relative flex items-center">
                  <span class="absolute -left-1 w-3 h-3 bg-blue-600 rotate-45"></span>
                  <span class="absolute -right-1 w-3 h-3 bg-blue-600 rotate-45"></span>
                </div>
              </td>
            </tr>

            <!-- Driver Rows (Rendered only if company is NOT collapsed) -->
            <template v-if="!isCompanyCollapsed(company.id)">
              <template v-for="driver in getCompanyDrivers(company.id)" :key="driver.id">
                <!-- DRIVER INSERTION GUIDE LINE: BEFORE -->
                <tr
                  v-if="dropTarget && dropTarget.driverId === driver.id && dropTarget.position === 'before'"
                  class="pointer-events-none select-none"
                >
                  <td colspan="5" class="p-0 border-0 h-1.5 bg-blue-600 relative shadow-sm">
                    <div class="h-1.5 bg-blue-600 w-full relative flex items-center">
                      <span class="absolute -left-1 w-3 h-3 bg-blue-600 rotate-45"></span>
                      <span class="absolute -right-1 w-3 h-3 bg-blue-600 rotate-45"></span>
                    </div>
                  </td>
                </tr>

                <!-- DRIVER ROW -->
                <DriverRow
                  :driver="driver"
                  :orderIndex="getRowIndex(driver.id)"
                  :isActive="selectedDriverId === driver.id"
                  :isDragging="draggedDriverId === driver.id"
                  @select-row="$emit('select-driver', $event)"
                  @update="$emit('update-driver', $event)"
                  @delete="$emit('delete-driver', $event)"
                  @edit="$emit('edit-driver', $event)"
                  @drag-start="handleDragStart"
                  @drag-end="handleDragEnd"
                  @row-dragover="handleRowDragOver"
                  @row-drop="handleRowDrop"
                />

                <!-- DRIVER INSERTION GUIDE LINE: AFTER -->
                <tr
                  v-if="dropTarget && dropTarget.driverId === driver.id && dropTarget.position === 'after'"
                  class="pointer-events-none select-none"
                >
                  <td colspan="5" class="p-0 border-0 h-1.5 bg-blue-600 relative shadow-sm">
                    <div class="h-1.5 bg-blue-600 w-full relative flex items-center">
                      <span class="absolute -left-1 w-3 h-3 bg-blue-600 rotate-45"></span>
                      <span class="absolute -right-1 w-3 h-3 bg-blue-600 rotate-45"></span>
                    </div>
                  </td>
                </tr>
              </template>

              <!-- Empty state for company with 0 drivers in this view -->
              <tr
                v-if="getCompanyDrivers(company.id).length === 0"
                class="bg-slate-50/50 italic text-xs text-slate-400"
              >
                <td colspan="5" class="px-8 py-3 text-center">
                  <span v-if="currentTab.id === 'CHECKING_BOARD'">
                    No drivers yet in {{ company.name }}.
                    <button
                      @click="$emit('add-driver', company)"
                      class="text-emerald-700 font-bold hover:underline ml-1"
                    >
                      + Add first driver
                    </button>
                  </span>
                  <span v-else>
                    No drivers in "{{ currentTab.label }}" status for this company.
                  </span>
                </td>
              </tr>
            </template>
          </template>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue';
import CompanyHeaderRow from './CompanyHeaderRow.vue';
import DriverRow from './DriverRow.vue';

const props = defineProps({
  companies: {
    type: Array,
    required: true
  },
  drivers: {
    type: Array,
    required: true
  },
  currentTab: {
    type: Object,
    required: true
  },
  searchQuery: {
    type: String,
    default: ''
  },
  selectedDriverId: {
    type: String,
    default: ''
  }
});

const emit = defineEmits([
  'add-driver',
  'edit-driver',
  'delete-driver',
  'update-driver',
  'edit-company',
  'delete-company',
  'select-driver',
  'reorder-driver',
  'reorder-company',
  'move-driver-to-company'
]);

// Collapsed state: CLOSED (COLLAPSED) BY DEFAULT as requested
const collapsedCompanies = ref({});

function isCompanyCollapsed(companyId) {
  // If not explicitly set to false, it is collapsed (true) by default
  return collapsedCompanies.value[companyId] !== false;
}

function toggleCompanyCollapse(companyId) {
  const current = isCompanyCollapsed(companyId);
  collapsedCompanies.value[companyId] = !current;
}

const allCollapsed = computed(() => {
  return props.companies.every(c => isCompanyCollapsed(c.id));
});

function toggleAllCompanies() {
  const targetState = allCollapsed.value ? false : true; // if all collapsed, expand all (false); otherwise collapse all (true)
  props.companies.forEach(c => {
    collapsedCompanies.value[c.id] = targetState;
  });
}

// Driver Drag & Drop State
const draggedDriverId = ref(null);
const dropTarget = ref(null); // { driverId, position: 'before' | 'after', companyId }

// Company Drag & Drop State
const draggedCompanyId = ref(null);
const dropTargetCompany = ref(null); // { companyId, position: 'before' | 'after' }

// Get drivers for a company based on tab filter & search query
function getCompanyDrivers(companyId) {
  let list = props.drivers.filter(d => d.companyId === companyId);

  // Apply tab filter (if not "CHECKING_BOARD")
  if (props.currentTab.id !== 'CHECKING_BOARD' && props.currentTab.filterFn) {
    list = list.filter(props.currentTab.filterFn);
  }

  // Apply search query filter
  if (props.searchQuery.trim()) {
    const q = props.searchQuery.trim().toLowerCase();
    list = list.filter(d =>
      (d.name && d.name.toLowerCase().includes(q)) ||
      (d.unit && d.unit.toLowerCase().includes(q)) ||
      (d.notes && d.notes.toLowerCase().includes(q)) ||
      (d.status && d.status.toLowerCase().includes(q)) ||
      (d.sign && d.sign.toLowerCase().includes(q))
    );
  }

  return list;
}

// In category tabs, hide companies that have 0 matching drivers
const filteredCompanies = computed(() => {
  if (props.currentTab.id === 'CHECKING_BOARD') {
    return props.companies;
  }
  return props.companies.filter(c => getCompanyDrivers(c.id).length > 0);
});

// Flat list of all currently visible drivers in order
const visibleDriversList = computed(() => {
  const result = [];
  filteredCompanies.value.forEach(comp => {
    if (!isCompanyCollapsed(comp.id)) {
      const compDrivers = getCompanyDrivers(comp.id);
      compDrivers.forEach(d => result.push(d));
    }
  });
  return result;
});

function getRowIndex(driverId) {
  const index = visibleDriversList.value.findIndex(d => d.id === driverId);
  return index !== -1 ? index + 1 : 1;
}

const totalVisibleDrivers = computed(() => {
  return visibleDriversList.value.length;
});

// ================= DRIVER DRAG & DROP =================
function handleDragStart(driverId) {
  draggedDriverId.value = driverId;
  dropTarget.value = null;
}

function handleDragEnd() {
  draggedDriverId.value = null;
  dropTarget.value = null;
}

function handleRowDragOver({ event, driver }) {
  event.preventDefault();
  event.dataTransfer.dropEffect = 'move';

  if (!draggedDriverId.value || draggedDriverId.value === driver.id) {
    dropTarget.value = null;
    return;
  }

  const rect = event.currentTarget.getBoundingClientRect();
  const offset = event.clientY - rect.top;
  const position = offset < (rect.height / 2) ? 'before' : 'after';

  dropTarget.value = {
    driverId: driver.id,
    position,
    companyId: driver.companyId
  };
}

function handleRowDrop({ event, driver }) {
  event.preventDefault();

  if (!draggedDriverId.value || !dropTarget.value) {
    handleDragEnd();
    return;
  }

  const { driverId, position, companyId } = dropTarget.value;

  if (draggedDriverId.value !== driverId) {
    emit('reorder-driver', {
      draggedId: draggedDriverId.value,
      targetId: driverId,
      position: position,
      targetCompanyId: companyId
    });
  }

  handleDragEnd();
}

// ================= COMPANY DRAG & DROP =================
function handleCompanyDragStart(companyId) {
  draggedCompanyId.value = companyId;
  dropTargetCompany.value = null;
}

function handleCompanyDragEnd() {
  draggedCompanyId.value = null;
  dropTargetCompany.value = null;
}

function handleCompanyDragOver({ event, company }) {
  event.preventDefault();
  event.dataTransfer.dropEffect = 'move';

  if (!draggedCompanyId.value || draggedCompanyId.value === company.id) {
    dropTargetCompany.value = null;
    return;
  }

  const rect = event.currentTarget.getBoundingClientRect();
  const offset = event.clientY - rect.top;
  const position = offset < (rect.height / 2) ? 'before' : 'after';

  dropTargetCompany.value = {
    companyId: company.id,
    position
  };
}

function handleCompanyDrop({ event, company }) {
  event.preventDefault();

  if (!draggedCompanyId.value || !dropTargetCompany.value) {
    handleCompanyDragEnd();
    return;
  }

  const { companyId, position } = dropTargetCompany.value;

  if (draggedCompanyId.value !== companyId) {
    emit('reorder-company', {
      draggedId: draggedCompanyId.value,
      targetId: companyId,
      position: position
    });
  }

  handleCompanyDragEnd();
}

function onContainerDrop() {
  handleDragEnd();
  handleCompanyDragEnd();
}
</script>
