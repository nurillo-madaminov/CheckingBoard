<template>
  <div class="h-screen w-screen flex flex-col overflow-hidden bg-slate-100 select-none">
    <!-- Top Header Bar -->
    <StatsBar
      v-model:searchQuery="searchQuery"
      :isSupabaseConnected="isSupabaseConnected"
      @open-add-company="openAddCompanyModal"
      @open-config="showConfigModal = true"
      @open-supabase="showSupabaseModal = true"
      @reset-data="handleResetData"
    />

    <!-- Main Content Area: Table -->
    <main class="flex-1 overflow-hidden relative">
      <CheckingBoardTable
        :companies="companies"
        :drivers="drivers"
        :currentTab="currentTab"
        :searchQuery="searchQuery"
        :selectedDriverId="selectedDriverId"
        @select-driver="selectedDriverId = $event"
        @reorder-driver="handleReorderDriver"
        @reorder-company="handleReorderCompany"
        @move-driver-to-company="handleMoveDriverToCompany"
        @add-driver="openAddDriverForCompany"
        @edit-driver="openEditDriverModal"
        @delete-driver="deleteDriver"
        @update-driver="updateDriver"
        @edit-company="openEditCompanyModal"
        @delete-company="deleteCompany"
      />
    </main>

    <!-- Excel-like Bottom Sheet Tabs (Reorderable via Drag & Drop except Tab 0) -->
    <BottomTabs
      :tabs="tabs"
      :activeTabId="activeTabId"
      :counts="tabCounts"
      @select-tab="activeTabId = $event"
      @reorder-tabs="handleReorderTabs"
    />

    <!-- Add / Edit Company Modal -->
    <AddCompanyModal
      v-if="showCompanyModal"
      :editingCompany="editingCompany"
      @close="closeCompanyModal"
      @save="saveCompany"
    />

    <!-- Add / Edit Driver Modal -->
    <AddDriverModal
      v-if="showDriverModal"
      :companies="companies"
      :defaultCompanyId="targetCompanyId"
      :editingDriver="editingDriver"
      @close="closeDriverModal"
      @save="saveDriver"
    />

    <!-- Status & Color Config Modal -->
    <StatusConfigModal
      v-if="showConfigModal"
      @close="showConfigModal = false"
    />

    <!-- Supabase Database Connection Modal -->
    <SupabaseConnectModal
      v-if="showSupabaseModal"
      @close="showSupabaseModal = false"
      @connected="handleSupabaseConnected"
    />
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import StatsBar from './components/StatsBar.vue';
import CheckingBoardTable from './components/CheckingBoardTable.vue';
import BottomTabs from './components/BottomTabs.vue';
import AddCompanyModal from './components/AddCompanyModal.vue';
import AddDriverModal from './components/AddDriverModal.vue';
import StatusConfigModal from './components/StatusConfigModal.vue';
import SupabaseConnectModal from './components/SupabaseConnectModal.vue';

import { BOTTOM_TABS } from './config/statusConfig';
import {
  loadCompanies,
  saveCompanies,
  loadDrivers,
  saveDrivers,
  resetToDefaults
} from './services/storageService';
import {
  isSupabaseReady,
  fetchCompaniesFromSupabase,
  fetchDriversFromSupabase,
  insertCompanyToSupabase,
  updateCompanyInSupabase,
  deleteCompanyFromSupabase,
  insertDriverToSupabase,
  updateDriverInSupabase,
  deleteDriverFromSupabase,
  syncDriversOrderToSupabase,
  syncCompaniesOrderToSupabase,
  subscribeToRealtimeChanges
} from './services/supabaseService';

// State
const companies = ref(loadCompanies());
const drivers = ref(loadDrivers());
const activeTabId = ref('CHECKING_BOARD');
const searchQuery = ref('');
const selectedDriverId = ref('');
const isSupabaseConnected = ref(isSupabaseReady());
const showSupabaseModal = ref(false);
let realtimeChannel = null;

// Modals
const showCompanyModal = ref(false);
const editingCompany = ref(null);

const showDriverModal = ref(false);
const editingDriver = ref(null);
const targetCompanyId = ref('');

const showConfigModal = ref(false);

// Load tabs order from local storage
function loadSavedTabs() {
  try {
    const raw = localStorage.getItem('checkingboard_tabs_order_v1');
    if (raw) {
      const ids = JSON.parse(raw);
      if (Array.isArray(ids) && ids.length > 0) {
        const ordered = [];
        ids.forEach(id => {
          const found = BOTTOM_TABS.find(t => t.id === id);
          if (found) ordered.push(found);
        });
        BOTTOM_TABS.forEach(t => {
          if (!ordered.find(o => o.id === t.id)) ordered.push(t);
        });
        const cbIdx = ordered.findIndex(t => t.id === 'CHECKING_BOARD');
        if (cbIdx > 0) {
          const [cb] = ordered.splice(cbIdx, 1);
          ordered.unshift(cb);
        }
        return ordered;
      }
    }
  } catch (e) {
    console.error('Error loading tab order:', e);
  }
  return [...BOTTOM_TABS];
}

const tabs = ref(loadSavedTabs());

const currentTab = computed(() => {
  return tabs.value.find(t => t.id === activeTabId.value) || tabs.value[0];
});

// Real-time Counts for all tabs
const tabCounts = computed(() => {
  const allDrivers = drivers.value;
  return {
    CHECKING_BOARD: allDrivers.length,
    all: allDrivers.length,
    AT_PU_DEL: allDrivers.filter(d => ['AT PU', 'AT DEL'].includes(d.status)).length,
    READY: allDrivers.filter(d => d.status === 'READY').length,
    COVERED: allDrivers.filter(d => d.status === 'COVERED').length,
    GOING_TO_DEL: allDrivers.filter(d => ['GOING DEL', 'GOING TO DEL'].includes(d.status)).length,
    HOME_INACTIVE: allDrivers.filter(d => ['HOME', 'INACTIVE', 'SHOP'].includes(d.status)).length
  };
});

// Reorder Tabs
function handleReorderTabs({ draggedId, targetId, position }) {
  const list = [...tabs.value];
  const fromIdx = list.findIndex(t => t.id === draggedId);
  const toIdx = list.findIndex(t => t.id === targetId);

  // Tab 0 (CHECKING_BOARD) cannot be moved or replaced
  if (fromIdx <= 0 || toIdx <= 0) return;

  const [moved] = list.splice(fromIdx, 1);
  const newTargetIdx = list.findIndex(t => t.id === targetId);
  const insertIdx = position === 'before' ? newTargetIdx : newTargetIdx + 1;

  list.splice(Math.max(1, insertIdx), 0, moved);
  tabs.value = list;

  try {
    localStorage.setItem('checkingboard_tabs_order_v1', JSON.stringify(list.map(t => t.id)));
  } catch (e) {
    console.error('Failed to save tab order:', e);
  }
}

// Supabase Sync Methods
async function loadDataFromSupabase() {
  if (!isSupabaseReady()) return;
  try {
    const remoteComps = await fetchCompaniesFromSupabase();
    const remoteDrivers = await fetchDriversFromSupabase();
    if (remoteComps && remoteComps.length > 0) {
      companies.value = remoteComps;
      saveCompanies(remoteComps);
    }
    if (remoteDrivers && remoteDrivers.length > 0) {
      drivers.value = remoteDrivers;
      saveDrivers(remoteDrivers);
    }
    isSupabaseConnected.value = true;
  } catch (err) {
    console.error('Failed to load from Supabase:', err);
    isSupabaseConnected.value = false;
  }
}

function setupRealtime() {
  if (!isSupabaseReady()) return;
  if (realtimeChannel) {
    realtimeChannel.unsubscribe();
  }
  realtimeChannel = subscribeToRealtimeChanges({
    onCompanyChange: async () => {
      try {
        const remoteComps = await fetchCompaniesFromSupabase();
        if (remoteComps) {
          companies.value = remoteComps;
          saveCompanies(remoteComps);
        }
      } catch (e) {
        console.error('Realtime company update error:', e);
      }
    },
    onDriverChange: async () => {
      try {
        const remoteDrivers = await fetchDriversFromSupabase();
        if (remoteDrivers) {
          drivers.value = remoteDrivers;
          saveDrivers(remoteDrivers);
        }
      } catch (e) {
        console.error('Realtime driver update error:', e);
      }
    }
  });
}

function handleSupabaseConnected() {
  isSupabaseConnected.value = isSupabaseReady();
  if (isSupabaseConnected.value) {
    loadDataFromSupabase();
    setupRealtime();
  }
}

onMounted(() => {
  if (isSupabaseReady()) {
    loadDataFromSupabase();
    setupRealtime();
  }
});

// Company Management
function openAddCompanyModal() {
  editingCompany.value = null;
  showCompanyModal.value = true;
}

function openEditCompanyModal(company) {
  editingCompany.value = company;
  showCompanyModal.value = true;
}

function closeCompanyModal() {
  showCompanyModal.value = false;
  editingCompany.value = null;
}

function saveCompany(companyData) {
  if (companyData.id) {
    const idx = companies.value.findIndex(c => c.id === companyData.id);
    if (idx !== -1) {
      companies.value[idx] = { ...companies.value[idx], ...companyData };
    }
    if (isSupabaseConnected.value) {
      updateCompanyInSupabase(companyData.id, companyData).catch(console.error);
    }
  } else {
    const newComp = {
      id: `comp-${Date.now()}`,
      name: companyData.name,
      note: companyData.note || '',
      order: companies.value.length + 1
    };
    companies.value.push(newComp);
    if (isSupabaseConnected.value) {
      insertCompanyToSupabase(newComp).catch(console.error);
    }
  }
  saveCompanies(companies.value);
  closeCompanyModal();
}

function deleteCompany(companyId) {
  const comp = companies.value.find(c => c.id === companyId);
  const name = comp ? comp.name : 'this company';
  const driverCount = drivers.value.filter(d => d.companyId === companyId).length;

  if (confirm(`Are you sure you want to delete ${name}?${driverCount > 0 ? ` This will also delete ${driverCount} driver(s).` : ''}`)) {
    companies.value = companies.value.filter(c => c.id !== companyId);
    drivers.value = drivers.value.filter(d => d.companyId !== companyId);
    saveCompanies(companies.value);
    saveDrivers(drivers.value);
    if (isSupabaseConnected.value) {
      deleteCompanyFromSupabase(companyId).catch(console.error);
    }
  }
}

// Company Reordering
function handleReorderCompany({ draggedId, targetId, position }) {
  if (draggedId === targetId) return;

  const list = [...companies.value];
  const draggedIdx = list.findIndex(c => c.id === draggedId);
  const targetIdx = list.findIndex(c => c.id === targetId);

  if (draggedIdx === -1 || targetIdx === -1) return;

  const [draggedItem] = list.splice(draggedIdx, 1);
  const newTargetIdx = list.findIndex(c => c.id === targetId);
  const insertIdx = position === 'before' ? newTargetIdx : newTargetIdx + 1;

  list.splice(insertIdx, 0, draggedItem);
  list.forEach((c, i) => {
    c.order = i + 1;
  });

  companies.value = list;
  saveCompanies(list);

  if (isSupabaseConnected.value) {
    syncCompaniesOrderToSupabase(list).catch(console.error);
  }
}

// Driver Management
function openAddDriverForCompany(company) {
  editingDriver.value = null;
  targetCompanyId.value = company.id;
  showDriverModal.value = true;
}

function openEditDriverModal(driver) {
  editingDriver.value = driver;
  targetCompanyId.value = driver.companyId;
  showDriverModal.value = true;
}

function closeDriverModal() {
  showDriverModal.value = false;
  editingDriver.value = null;
}

function saveDriver(driverData) {
  if (driverData.id) {
    const idx = drivers.value.findIndex(d => d.id === driverData.id);
    if (idx !== -1) {
      drivers.value[idx] = { ...drivers.value[idx], ...driverData };
    }
    if (isSupabaseConnected.value) {
      updateDriverInSupabase(driverData.id, driverData).catch(console.error);
    }
  } else {
    const newDriver = {
      id: `drv-${Date.now()}`,
      companyId: driverData.companyId,
      unit: driverData.unit || '',
      name: driverData.name,
      sign: driverData.sign || 'SIGNED',
      status: driverData.status || 'READY',
      notes: driverData.notes || '',
      highlightColor: driverData.highlightColor || '',
      orderIndex: drivers.value.length + 1
    };
    drivers.value.push(newDriver);
    if (isSupabaseConnected.value) {
      insertDriverToSupabase(newDriver).catch(console.error);
    }
  }
  saveDrivers(drivers.value);
  closeDriverModal();
}

function updateDriver(updatedDriver) {
  const idx = drivers.value.findIndex(d => d.id === updatedDriver.id);
  if (idx !== -1) {
    drivers.value[idx] = { ...updatedDriver };
    saveDrivers(drivers.value);
    selectedDriverId.value = updatedDriver.id;
    if (isSupabaseConnected.value) {
      updateDriverInSupabase(updatedDriver.id, updatedDriver).catch(console.error);
    }
  }
}

function handleReorderDriver({ draggedId, targetId, position }) {
  if (draggedId === targetId) return;

  const list = [...drivers.value];
  const draggedIdx = list.findIndex(d => d.id === draggedId);
  const targetIdx = list.findIndex(d => d.id === targetId);

  if (draggedIdx === -1 || targetIdx === -1) return;

  const targetItem = list[targetIdx];
  const [draggedItem] = list.splice(draggedIdx, 1);

  if (targetItem) {
    draggedItem.companyId = targetItem.companyId;
  }

  const newTargetIdx = list.findIndex(d => d.id === targetId);
  const insertIdx = position === 'before' ? newTargetIdx : newTargetIdx + 1;

  list.splice(insertIdx, 0, draggedItem);
  drivers.value = list;
  saveDrivers(drivers.value);
  selectedDriverId.value = draggedId;

  if (isSupabaseConnected.value) {
    syncDriversOrderToSupabase(drivers.value).catch(console.error);
  }
}

function handleMoveDriverToCompany({ driverId, targetCompanyId }) {
  const idx = drivers.value.findIndex(d => d.id === driverId);
  if (idx !== -1) {
    drivers.value[idx].companyId = targetCompanyId;
    saveDrivers(drivers.value);
    selectedDriverId.value = driverId;
    if (isSupabaseConnected.value) {
      updateDriverInSupabase(driverId, drivers.value[idx]).catch(console.error);
    }
  }
}

function deleteDriver(driverId) {
  const driver = drivers.value.find(d => d.id === driverId);
  const label = driver ? (driver.unit ? `${driver.unit} - ${driver.name}` : driver.name) : 'this driver';
  if (confirm(`Are you sure you want to delete driver ${label}?`)) {
    drivers.value = drivers.value.filter(d => d.id !== driverId);
    saveDrivers(drivers.value);
    if (isSupabaseConnected.value) {
      deleteDriverFromSupabase(driverId).catch(console.error);
    }
  }
}

function handleResetData() {
  if (confirm('Reset all data to default fleet roster? Any manual edits will be overwritten.')) {
    const data = resetToDefaults();
    companies.value = data.companies;
    drivers.value = data.drivers;
  }
}
</script>
