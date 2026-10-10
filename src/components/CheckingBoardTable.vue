<template>
  <div class="h-full flex flex-col overflow-hidden bg-white">
    <!-- Active Tab Banner (if in a specific category tab) -->
    <div
      v-if="currentTab.id !== 'CHECKING_BOARD'"
      class="bg-slate-50 border-b border-slate-200 px-4 py-2 flex items-center justify-between text-xs shrink-0"
    >
      <div class="flex items-center gap-2">
        <span class="font-bold text-slate-800 uppercase tracking-wider text-xs">
          {{ currentTab.label }}
        </span>
        <span class="text-slate-400">—</span>
        <span class="text-slate-600 font-medium italic">
          {{ currentTab.subtitle }}
        </span>
      </div>
      <div class="flex items-center gap-3">
        <span class="text-slate-500 font-medium">Drivers in this view:</span>
        <span class="px-2 py-0.5 rounded font-bold text-xs bg-emerald-100 text-emerald-800 border border-emerald-300">
          {{ totalVisibleDrivers }}
        </span>
      </div>
    </div>

    <!-- Table Container (Scrollable) -->
    <div
      class="flex-1 overflow-auto"
      @dragover.prevent
      @drop.prevent="onContainerDrop"
    >
      <!-- TABLE FIXED: Guaranteed Locked Column Widths -->
      <table class="w-full text-left table-grid border-separate table-fixed">
        <!-- Strictly Defined Column Widths -->
        <colgroup>
          <col style="width: 56px;" />
          <col style="width: 320px;" />
          <col style="width: 140px;" />
          <col style="width: 190px;" />
          <col />
        </colgroup>

        <!-- Table Column Headers -->
        <thead class="sticky top-0 z-20 bg-slate-100 text-slate-700 text-xs font-bold uppercase tracking-wider shadow-xs">
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
          <template v-for="company in filteredCompanies" :key="company.id">
            <!-- Company Separator Line -->
            <CompanyHeaderRow
              :company="company"
              :driverCount="getCompanyDrivers(company.id).length"
              :isCollapsed="collapsedCompanies[company.id]"
              @toggle-collapse="toggleCompanyCollapse(company.id)"
              @add-driver="$emit('add-driver', company)"
              @edit-company="$emit('edit-company', company)"
              @delete-company="$emit('delete-company', company.id)"
              @drop-driver="handleDropOnCompany"
            />

            <!-- Driver Rows (if not collapsed) -->
            <template v-if="!collapsedCompanies[company.id]">
              <template v-for="driver in getCompanyDrivers(company.id)" :key="driver.id">
                <!-- EXCEL-STYLE INSERTION GUIDE LINE: Shown BEFORE this row -->
                <tr
                  v-if="dropTarget && dropTarget.driverId === driver.id && dropTarget.position === 'before'"
                  class="pointer-events-none select-none"
                >
                  <td colspan="5" class="p-0 border-0 h-1 bg-blue-600 relative shadow-sm">
                    <div class="h-1 bg-blue-600 w-full relative flex items-center">
                      <!-- Left arrow guide -->
                      <span class="absolute -left-1 w-2.5 h-2.5 bg-blue-600 rotate-45"></span>
                      <!-- Right arrow guide -->
                      <span class="absolute -right-1 w-2.5 h-2.5 bg-blue-600 rotate-45"></span>
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

                <!-- EXCEL-STYLE INSERTION GUIDE LINE: Shown AFTER this row -->
                <tr
                  v-if="dropTarget && dropTarget.driverId === driver.id && dropTarget.position === 'after'"
                  class="pointer-events-none select-none"
                >
                  <td colspan="5" class="p-0 border-0 h-1 bg-blue-600 relative shadow-sm">
                    <div class="h-1 bg-blue-600 w-full relative flex items-center">
                      <span class="absolute -left-1 w-2.5 h-2.5 bg-blue-600 rotate-45"></span>
                      <span class="absolute -right-1 w-2.5 h-2.5 bg-blue-600 rotate-45"></span>
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
import { ref, computed } from 'vue';
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
  'move-driver-to-company'
]);

const collapsedCompanies = ref({});
const draggedDriverId = ref(null);
const dropTarget = ref(null); // { driverId, position: 'before' | 'after', companyId }

function toggleCompanyCollapse(companyId) {
  collapsedCompanies.value[companyId] = !collapsedCompanies.value[companyId];
}

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

// In category tabs, hide companies that have 0 matching drivers (or keep all if searching)
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
    if (!collapsedCompanies.value[comp.id]) {
      const compDrivers = getCompanyDrivers(comp.id);
      compDrivers.forEach(d => result.push(d));
    }
  });
  return result;
});

// Computes the 1-based row index just like Excel line numbers
function getRowIndex(driverId) {
  const index = visibleDriversList.value.findIndex(d => d.id === driverId);
  return index !== -1 ? index + 1 : 1;
}

const totalVisibleDrivers = computed(() => {
  return visibleDriversList.value.length;
});

// Drag & Drop Management
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

function handleDropOnCompany({ driverId, targetCompanyId }) {
  emit('move-driver-to-company', { driverId, targetCompanyId });
  handleDragEnd();
}

function onContainerDrop() {
  handleDragEnd();
}
</script>
