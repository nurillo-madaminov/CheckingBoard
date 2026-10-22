<template>
  <!-- DEPLOYMENT NOT CONFIGURED: the database comes only from env variables -->
  <div
    v-if="!isSupabaseConfigured"
    class="h-screen w-screen flex items-center justify-center bg-slate-900 p-6"
  >
    <div class="max-w-md bg-white rounded-2xl shadow-2xl p-6 text-sm text-slate-700 space-y-3">
      <h1 class="text-lg font-black text-slate-900">CheckingBoard is not connected to its database</h1>
      <p>
        Set these environment variables where the frontend is built and deployed, then rebuild:
      </p>
      <pre class="bg-slate-100 rounded-lg p-3 text-xs font-mono text-slate-800">VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-public-key</pre>
    </div>
  </div>

  <!-- RESTORING SESSION -->
  <div
    v-else-if="authLoading"
    class="h-screen w-screen flex items-center justify-center bg-slate-900 text-slate-300 text-sm font-semibold"
  >
    Loading CheckingBoard...
  </div>

  <!-- IF VISITOR IS NOT LOGGED IN: SHOW LOGIN & CREATE A TEAM VIEW -->
  <LoginView
    v-else-if="!currentUser"
  />

  <!-- AUTHENTICATED USER: MAIN CHECKINGBOARD SYSTEM -->
  <div v-else class="h-screen w-screen flex flex-col overflow-hidden bg-slate-100 select-none">
    <!-- Top Header Bar -->
    <StatsBar
      v-model:searchQuery="searchQuery"
      :activeView="activeView"
      :currentUser="currentUser"
      :canManageFleet="isManager"
      :teamName="currentTeam?.name || ''"
      :isLive="isLive"
      @update:activeView="activeView = $event"
      @open-staff-switch="showStaffModal = true"
      @logout="handleLogout"
      @open-add-company="openAddCompanyModal"
      @open-config="showConfigModal = true"
      @reset-data="handleResetData"
    />
    <!-- Main Content Area: Dynamic View (Fleet Board | Logs | Shifts | Statistics) -->
    <main class="flex-1 overflow-hidden relative">
      <!-- 1. FLEET BOARD VIEW -->
      <CheckingBoardTable
        v-if="activeView === 'fleet'"
        :companies="companies"
        :drivers="drivers"
        :currentTab="currentTab"
        :searchQuery="searchQuery"
        :selectedDriverId="selectedDriverId"
        :canManageFleet="isManager"
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
        @log-action="handleDriverAction"
      />

      <!-- 2. ACTION LOGS (staff: own records, manager: whole team) -->
      <ActivityLogView
        v-else-if="activeView === 'activity_log'"
        :activeDrivers="drivers"
        :refreshKey="activityVersion"
      />

      <!-- 3. SHIFT CONTROL PANEL (manager) -->
      <ShiftControlView
        v-else-if="activeView === 'shifts' && isManager"
        @saved="showToast({ title: 'Shift schedule saved', message: 'New actions are credited to the updated shifts' })"
      />

      <!-- 4. DAILY STATISTICS (manager) -->
      <DailyStatisticsView
        v-else-if="activeView === 'statistics' && isManager"
        :refreshKey="activityVersion"
      />
    </main>

    <!-- Excel-like Bottom Sheet Tabs (Only visible in Fleet View) -->
    <BottomTabs
      v-if="activeView === 'fleet'"
      :tabs="tabs"
      :activeTabId="activeTabId"
      :counts="tabCounts"
      @select-tab="activeTabId = $event"
      @reorder-tabs="handleReorderTabs"
    />

    <!-- Staff Switch & Team Management Modal -->
    <StaffSwitchModal
      v-if="showStaffModal"
      @close="showStaffModal = false"
      @user-changed="handleStaffUserChanged"
      @logout="handleLogout"
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

    <!-- Floating Alerts / Toasts (Top-Right Corner, click anywhere on card to close) -->
    <div class="fixed top-3 right-3 z-50 flex flex-col items-end gap-2 pointer-events-none">
      <transition-group
        enter-active-class="transition ease-out duration-200"
        enter-from-class="transform -translate-y-3 opacity-0 scale-95"
        enter-to-class="transform translate-y-0 opacity-100 scale-100"
        leave-active-class="transition ease-in duration-150"
        leave-from-class="opacity-100 scale-100"
        leave-to-class="opacity-0 scale-95"
      >
        <div
          v-for="toast in toasts"
          :key="toast.id"
          @click="removeToast(toast.id)"
          :style="{
            backgroundColor: toast.bgColor,
            borderColor: toast.borderColor
          }"
          :class="toast.isError ? 'ring-2 ring-rose-300' : ''"
          class="pointer-events-auto border rounded-2xl shadow-xl px-3.5 py-2 flex items-center gap-3 w-80 min-w-80 max-w-80 h-16 min-h-16 max-h-16 select-none cursor-pointer transition-all active:scale-95 hover:brightness-95"
          title="Click to dismiss"
        >
          <!-- Status icon badge with matching accent color -->
          <div
            :style="{ backgroundColor: toast.iconBg }"
            class="w-6 h-6 rounded-full text-white flex items-center justify-center text-xs font-bold shrink-0 shadow-2xs"
          >
            {{ toast.isError ? '!' : '✓' }}
          </div>

          <!-- Alert content with uniform dimensions and prominent destination badge -->
          <div class="flex-1 min-w-0">
            <div class="flex items-center justify-between gap-1">
              <span
                class="text-xs font-extrabold tracking-tight truncate"
                :style="{ color: toast.textColor }"
              >
                {{ toast.driverName || toast.title }}
              </span>
              <span
                class="text-[10px] font-mono font-medium shrink-0 opacity-75"
                :style="{ color: toast.textColor }"
              >
                {{ toast.time }}
              </span>
            </div>

            <!-- Obvious & easy-to-understand transferred location badge -->
            <div v-if="toast.destTab" class="flex items-center gap-1.5 mt-0.5 truncate">
              <span
                class="text-[10px] font-bold uppercase tracking-wider opacity-85 shrink-0"
                :style="{ color: toast.textColor }"
              >
                Transferred to:
              </span>
              <span
                class="px-2 py-0.5 rounded text-[10px] font-black tracking-wide uppercase border bg-white/90 shadow-2xs truncate"
                :style="{
                  borderColor: toast.borderColor,
                  color: toast.textColor
                }"
              >
                {{ toast.destTab }}
              </span>
            </div>
            <div
              v-else-if="toast.message"
              class="text-xs font-semibold mt-0.5 truncate"
              :style="{ color: toast.textColor }"
              :title="toast.message"
            >
              {{ toast.message }}
            </div>
          </div>
        </div>
      </transition-group>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue';
import StatsBar from './components/StatsBar.vue';
import CheckingBoardTable from './components/CheckingBoardTable.vue';
import BottomTabs from './components/BottomTabs.vue';
import AddCompanyModal from './components/AddCompanyModal.vue';
import AddDriverModal from './components/AddDriverModal.vue';
import StatusConfigModal from './components/StatusConfigModal.vue';
import StaffSwitchModal from './components/StaffSwitchModal.vue';
import ActivityLogView from './components/ActivityLogView.vue';
import ShiftControlView from './components/ShiftControlView.vue';
import DailyStatisticsView from './components/DailyStatisticsView.vue';
import LoginView from './components/LoginView.vue';

import { BOTTOM_TABS, getStatusConfig } from './config/statusConfig';
import { supabase, isSupabaseConfigured } from './services/supabaseClient';
import {
  currentStaffUser,
  currentTeam,
  initAuth,
  logoutUser
} from './services/authService';
import { recordActivity, getActionTypeConfig } from './services/activityService';
import * as db from './services/supabaseService';

// ---------------------------------------------------------------------------
// State: everything comes from the shared team database
// ---------------------------------------------------------------------------
const currentUser = computed(() => currentStaffUser.value);
// Only managers add or remove drivers and companies (also enforced by the database)
const isManager = computed(() => currentUser.value?.role === 'manager');
const authLoading = ref(isSupabaseConfigured);
const companies = ref([]);
const drivers = ref([]);
const activityVersion = ref(0); // bumped after recording an action so open log views reload
const activeTabId = ref('CHECKING_BOARD');
const activeView = ref('fleet'); // 'fleet' | 'activity_log' | 'shifts' | 'statistics'
const searchQuery = ref('');
const selectedDriverId = ref('');
const showStaffModal = ref(false);
const isLive = ref(false);
let signResetTimer = null;
let authSubscription = null;

function driverLabelOf(driver) {
  if (!driver) return '';
  return driver.unit ? `${driver.unit} - ${driver.name}` : driver.name;
}

function sortCompanies(list) {
  return [...list].sort((a, b) => (a.order - b.order) || a.id.localeCompare(b.id));
}

function sortDrivers(list) {
  return [...list].sort((a, b) => (a.orderIndex - b.orderIndex) || a.id.localeCompare(b.id));
}

function errorText(err) {
  return err?.message || String(err || 'Unknown error');
}

// ---------------------------------------------------------------------------
// Loading & live sync
// ---------------------------------------------------------------------------
async function loadFleet() {
  try {
    const [comps, drvs] = await Promise.all([db.fetchCompanies(), db.fetchDrivers()]);
    companies.value = sortCompanies(comps);
    drivers.value = sortDrivers(drvs);
  } catch (err) {
    console.error('Failed to load fleet:', err);
    showErrorToast('Could not load the fleet', errorText(err));
  }
}

// Save a change; if the database rejects it, tell the dispatcher and resync
async function persist(promise, failTitle = 'Change not saved') {
  try {
    await promise;
    return true;
  } catch (err) {
    console.error(failTitle, err);
    showErrorToast(failTitle, errorText(err));
    await loadFleet();
    return false;
  }
}

function applyDriverRow(row) {
  const mapped = db.mapDriverRow(row);
  const idx = drivers.value.findIndex(d => d.id === mapped.id);
  const next = [...drivers.value];
  if (idx === -1) next.push(mapped);
  else next[idx] = { ...next[idx], ...mapped };
  drivers.value = sortDrivers(next);
}

function setupRealtime() {
  const teamId = currentUser.value?.teamId;
  if (!teamId) return;
  isLive.value = false;
  db.subscribeToFleetChanges({
    teamId,
    onStatus: (status) => {
      isLive.value = status === 'SUBSCRIBED';
    },
    onCompanyChange: async () => {
      try {
        companies.value = sortCompanies(await db.fetchCompanies());
      } catch (e) {
        console.error('Realtime company update error:', e);
      }
    },
    onDriverChange: (payload) => {
      if (payload.eventType === 'DELETE') {
        const id = payload.old?.id;
        if (id) drivers.value = drivers.value.filter(d => d.id !== id);
      } else if (payload.new?.id) {
        applyDriverRow(payload.new);
      }
    },
    onFleetReset: async () => {
      drivers.value = sortDrivers(await db.fetchDrivers());
      showToast({
        title: 'Events up to date',
        message: 'Fleet reset to READY by another dispatcher'
      });
    }
  });
}

async function runSignReset() {
  try {
    if (await db.runDailySignReset()) {
      drivers.value = sortDrivers(await db.fetchDrivers());
      showToast({
        title: 'Daily Reset (EST)',
        message: 'All drivers sign status reset to NO SIGN for the new day'
      });
    }
  } catch (err) {
    console.warn('Daily sign reset check failed:', err);
  }
}

async function enterTeam() {
  await loadFleet();
  setupRealtime();
  await runSignReset();
  if (signResetTimer) clearInterval(signResetTimer);
  // Midnight rollover without reloading: the database decides if a reset is due
  signResetTimer = setInterval(runSignReset, 60000);
}

function leaveTeam() {
  if (signResetTimer) clearInterval(signResetTimer);
  signResetTimer = null;
  db.unsubscribeFromRealtime();
  isLive.value = false;
  companies.value = [];
  drivers.value = [];
  activeView.value = 'fleet';
  showStaffModal.value = false;
}

// Whenever a (different) user signs in - restored session, sign in, or a new
// team - load that team's fleet. (Watching the user instead of a LoginView event:
// the login screen unmounts the instant the user is set.)
let restoringSession = true;
watch(() => currentUser.value?.id, async (id, oldId) => {
  if (!id || id === oldId) return;
  activeView.value = 'fleet';
  await enterTeam();
  if (!restoringSession) {
    showToast({
      title: 'Welcome Back',
      message: `Logged in as ${currentUser.value?.displayName} (${currentUser.value?.role})`
    });
  }
});

onMounted(async () => {
  if (!isSupabaseConfigured) return;
  await initAuth();
  authLoading.value = false;
  restoringSession = false;

  // Signed out elsewhere, session expired, or account deactivated -> back to login
  const { data } = supabase.auth.onAuthStateChange((event) => {
    if (event === 'SIGNED_OUT' && currentStaffUser.value) {
      currentStaffUser.value = null;
      leaveTeam();
    }
  });
  authSubscription = data?.subscription;
});

onUnmounted(() => {
  leaveTeam();
  authSubscription?.unsubscribe();
});

// ---------------------------------------------------------------------------
// Session events
// ---------------------------------------------------------------------------
function handleStaffUserChanged(updatedUser) {
  if (updatedUser) {
    showToast({
      title: 'Team Updated',
      message: `Signed in as ${updatedUser.displayName} (${updatedUser.role})`
    });
  }
}

async function handleLogout() {
  leaveTeam();
  await logoutUser();
}

// ---------------------------------------------------------------------------
// Toast / Alert Notification System
// ---------------------------------------------------------------------------
const toasts = ref([]);
function showToast({
  title = 'Events up to date',
  message = '',
  status = null,
  driverName = '',
  destTab = '',
  isError = false
}) {
  const now = new Date();
  const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const id = `toast-${Date.now()}-${Math.random()}`;

  let bgColor = '#eaffea';
  let borderColor = '#86efac';
  let textColor = '#065f46';
  let iconBg = '#047857';

  if (isError) {
    bgColor = '#FFE4E6';
    borderColor = '#FDA4AF';
    textColor = '#9F1239';
    iconBg = '#E11D48';
  } else if (status) {
    const config = getStatusConfig(status);
    if (config) {
      bgColor = config.bgColor || bgColor;
      borderColor = config.borderColor || borderColor;
      textColor = config.textColor || textColor;
      iconBg = config.color || config.textColor || iconBg;
    }
  }

  toasts.value.push({
    id,
    title,
    message,
    driverName,
    destTab,
    status,
    isError,
    time: timeStr,
    bgColor,
    borderColor,
    textColor,
    iconBg
  });

  setTimeout(() => {
    removeToast(id);
  }, isError ? 7000 : 4000);
}

function showErrorToast(title, message) {
  showToast({ title, message, isError: true });
}

function removeToast(id) {
  toasts.value = toasts.value.filter(t => t.id !== id);
}

function getDestinationTab(status) {
  const tab = BOTTOM_TABS.find(t => t.id !== 'CHECKING_BOARD' && t.filterFn({ status }));
  return tab ? tab.label : 'CHECKING BOARD';
}

// ---------------------------------------------------------------------------
// Modals & bottom tabs
// ---------------------------------------------------------------------------
const showCompanyModal = ref(false);
const editingCompany = ref(null);

const showDriverModal = ref(false);
const editingDriver = ref(null);
const targetCompanyId = ref('');

const showConfigModal = ref(false);

// Tab order is a personal view preference of this browser (not fleet data)
const TAB_ORDER_KEY = 'checkingboard_tabs_order_v1';
function loadSavedTabs() {
  try {
    const raw = localStorage.getItem(TAB_ORDER_KEY);
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
    // Storage unavailable: default order
  }
  return [...BOTTOM_TABS];
}

const tabs = ref(loadSavedTabs());

const currentTab = computed(() => {
  return tabs.value.find(t => t.id === activeTabId.value) || tabs.value[0];
});

// Real-time Counts for all tabs (Excludes INACTIVE drivers from main tab and all count)
const tabCounts = computed(() => {
  const allDrivers = drivers.value;
  const activeFleet = allDrivers.filter(d => d.status !== 'INACTIVE');
  return {
    CHECKING_BOARD: activeFleet.length,
    all: activeFleet.length,
    AT_PU_DEL: allDrivers.filter(d => ['AT PU', 'AT DEL'].includes(d.status)).length,
    READY: allDrivers.filter(d => d.status === 'READY').length,
    COVERED: allDrivers.filter(d => d.status === 'COVERED').length,
    GOING_TO_DEL: allDrivers.filter(d => ['GOING DEL', 'GOING TO DEL'].includes(d.status)).length,
    HOME_INACTIVE: allDrivers.filter(d => ['HOME', 'INACTIVE', 'SHOP'].includes(d.status)).length
  };
});

function handleReorderTabs({ draggedId, targetId, position }) {
  const list = [...tabs.value];
  const fromIdx = list.findIndex(t => t.id === draggedId);
  const toIdx = list.findIndex(t => t.id === targetId);

  if (fromIdx <= 0 || toIdx <= 0) return;

  const [moved] = list.splice(fromIdx, 1);
  const newTargetIdx = list.findIndex(t => t.id === targetId);
  const insertIdx = position === 'before' ? newTargetIdx : newTargetIdx + 1;

  list.splice(Math.max(1, insertIdx), 0, moved);
  tabs.value = list;

  try {
    localStorage.setItem(TAB_ORDER_KEY, JSON.stringify(list.map(t => t.id)));
  } catch (e) {
    // Preference not saved; order still applies for this session
  }
}

// ---------------------------------------------------------------------------
// Dispatch Quick Action handler (Shift, Cycle, Fix Log, Break, Connect)
// These buttons are the ONLY thing that writes the action log.
// ---------------------------------------------------------------------------
async function handleDriverAction({ actionType, driver, extraNote = '' }) {
  const comp = companies.value.find(c => c.id === driver.companyId);
  const actionConfig = getActionTypeConfig(actionType);
  const driverLabel = driverLabelOf(driver);

  // 1. Mark driver as freshly checked
  const idx = drivers.value.findIndex(d => d.id === driver.id);
  if (idx !== -1) {
    const updated = { ...drivers.value[idx], lastCheckedAt: new Date().toISOString() };
    drivers.value[idx] = updated;
    persist(db.updateDriver(updated));
  }

  // 2. Log the action (actor, time and shift are stamped by the database from the session)
  try {
    await recordActivity({
      driver,
      company: comp,
      actionType,
      extraNote: extraNote || `${actionConfig.label} performed for ${driverLabel}`
    });
    activityVersion.value += 1;
  } catch (err) {
    showErrorToast('Action not recorded', errorText(err));
    return;
  }

  // 3. Show alert
  showToast({
    title: actionConfig.label,
    driverName: driverLabel,
    message: `${driverLabel}: ${actionConfig.label} logged by ${currentUser.value?.displayName}`
  });
}

// ---------------------------------------------------------------------------
// Company Management
// ---------------------------------------------------------------------------
function openAddCompanyModal() {
  if (!isManager.value) return;
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

async function saveCompany(companyData) {
  closeCompanyModal();
  if (companyData.id) {
    const idx = companies.value.findIndex(c => c.id === companyData.id);
    if (idx === -1) return;
    const updated = { ...companies.value[idx], name: companyData.name, note: companyData.note || '' };
    companies.value[idx] = updated;
    await persist(db.updateCompany(updated), 'Company not saved');
  } else {
    if (!isManager.value) return;
    const maxOrder = companies.value.reduce((m, c) => Math.max(m, c.order || 0), 0);
    const newComp = {
      id: db.newId('comp'),
      name: companyData.name,
      note: companyData.note || '',
      order: maxOrder + 1
    };
    companies.value = sortCompanies([...companies.value, newComp]);
    await persist(db.insertCompany(newComp), 'Company not added');
  }
}

// Manager only. Deleting a company never touches past action records
// (their links are set to NULL; the name snapshots stay).
async function deleteCompany(companyId) {
  if (!isManager.value) return;
  const comp = companies.value.find(c => c.id === companyId);
  const name = comp ? comp.name : 'this company';
  const driverCount = drivers.value.filter(d => d.companyId === companyId).length;

  if (!confirm(`Are you sure you want to delete ${name}?${driverCount > 0 ? ` This will also delete ${driverCount} driver(s).` : ''}`)) {
    return;
  }

  companies.value = companies.value.filter(c => c.id !== companyId);
  drivers.value = drivers.value.filter(d => d.companyId !== companyId);
  await persist(db.deleteCompany(companyId), 'Company not deleted');
}

// Company Reordering: only companies whose position changed are saved
async function handleReorderCompany({ draggedId, targetId, position }) {
  if (draggedId === targetId) return;

  const list = [...companies.value];
  const draggedIdx = list.findIndex(c => c.id === draggedId);
  const targetIdx = list.findIndex(c => c.id === targetId);
  if (draggedIdx === -1 || targetIdx === -1) return;

  const [draggedItem] = list.splice(draggedIdx, 1);
  const newTargetIdx = list.findIndex(c => c.id === targetId);
  const insertIdx = position === 'before' ? newTargetIdx : newTargetIdx + 1;
  list.splice(insertIdx, 0, draggedItem);

  const changed = [];
  const renumbered = list.map((c, i) => {
    if (c.order === i + 1) return c;
    const moved = { ...c, order: i + 1 };
    changed.push(moved);
    return moved;
  });
  companies.value = renumbered;
  await persist(db.saveCompanyOrder(changed), 'Company order not saved');
}

// ---------------------------------------------------------------------------
// Driver Management
// ---------------------------------------------------------------------------
function openAddDriverForCompany(company) {
  if (!isManager.value) return;
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

function statusToast(driver) {
  const destTab = getDestinationTab(driver.status);
  const driverLabel = driverLabelOf(driver);
  showToast({
    title: 'Status Updated',
    driverName: driverLabel,
    destTab,
    status: driver.status,
    message: `${driverLabel} transferred to [${destTab}] tab`
  });
}

async function saveDriver(driverData) {
  closeDriverModal();

  if (driverData.id) {
    const idx = drivers.value.findIndex(d => d.id === driverData.id);
    if (idx === -1) return;
    const oldDriver = drivers.value[idx];
    const statusChanged = oldDriver.status !== driverData.status;
    const signChanged = oldDriver.sign !== driverData.sign;
    const updated = {
      ...oldDriver,
      companyId: driverData.companyId,
      unit: driverData.unit || '',
      name: driverData.name,
      sign: driverData.sign,
      status: driverData.status,
      notes: driverData.notes || '',
      highlightColor: driverData.highlightColor || '',
      // Modifying sign or status marks the line as checked (notes do not)
      lastCheckedAt: (statusChanged || signChanged) ? new Date().toISOString() : oldDriver.lastCheckedAt
    };
    drivers.value[idx] = updated;
    if (!(await persist(db.updateDriver(updated), 'Driver not saved'))) return;
    if (statusChanged) statusToast(updated);
    return;
  }

  if (!isManager.value) return;
  const maxOrder = drivers.value.reduce((m, d) => Math.max(m, d.orderIndex || 0), 0);
  const newDriver = {
    id: db.newId('drv'),
    companyId: driverData.companyId,
    unit: driverData.unit || '',
    name: driverData.name,
    sign: driverData.sign || 'SIGNED',
    status: driverData.status || 'READY',
    notes: driverData.notes || '',
    highlightColor: driverData.highlightColor || '',
    orderIndex: maxOrder + 1,
    lastCheckedAt: new Date().toISOString()
  };
  drivers.value = sortDrivers([...drivers.value, newDriver]);
  if (!(await persist(db.insertDriver(newDriver), 'Driver not added'))) return;

  const driverName = driverLabelOf(newDriver);
  const destTab = getDestinationTab(newDriver.status);
  showToast({
    title: 'Driver Added',
    driverName,
    destTab,
    status: newDriver.status,
    message: `${driverName} added to [${destTab}] tab`
  });
}

// Inline row edits from the board (sign, status, notes, highlight, ✓ quick check)
async function updateDriver(updatedDriver) {
  const idx = drivers.value.findIndex(d => d.id === updatedDriver.id);
  if (idx === -1) return;

  const oldDriver = drivers.value[idx];
  const statusChanged = oldDriver.status !== updatedDriver.status;

  drivers.value[idx] = { ...updatedDriver };
  selectedDriverId.value = updatedDriver.id;
  if (!(await persist(db.updateDriver(updatedDriver), 'Driver not saved'))) return;

  // Status changes are not logged; only the ⚡ action buttons write the log
  if (statusChanged) statusToast(updatedDriver);
}

// Driver Reordering: only drivers whose position or company changed are saved
async function handleReorderDriver({ draggedId, targetId, position }) {
  if (draggedId === targetId) return;

  const list = [...drivers.value];
  const draggedIdx = list.findIndex(d => d.id === draggedId);
  const targetIdx = list.findIndex(d => d.id === targetId);
  if (draggedIdx === -1 || targetIdx === -1) return;

  const targetItem = list[targetIdx];
  const [draggedItem] = list.splice(draggedIdx, 1);
  const fromCompanyId = draggedItem.companyId;
  const movedItem = { ...draggedItem, companyId: targetItem ? targetItem.companyId : fromCompanyId };

  const newTargetIdx = list.findIndex(d => d.id === targetId);
  const insertIdx = position === 'before' ? newTargetIdx : newTargetIdx + 1;
  list.splice(insertIdx, 0, movedItem);

  const changed = [];
  const renumbered = list.map((d, i) => {
    const moved = d.id === movedItem.id && movedItem.companyId !== fromCompanyId;
    if (d.orderIndex === i + 1 && !moved) return d;
    const next = { ...d, orderIndex: i + 1 };
    changed.push(next);
    return next;
  });
  drivers.value = renumbered;
  selectedDriverId.value = draggedId;

  await persist(db.saveDriverOrder(changed), 'Driver order not saved');
}

async function handleMoveDriverToCompany({ driverId, targetCompanyId: toCompanyId }) {
  const idx = drivers.value.findIndex(d => d.id === driverId);
  if (idx === -1) return;
  const updated = { ...drivers.value[idx], companyId: toCompanyId };
  drivers.value[idx] = updated;
  selectedDriverId.value = driverId;
  await persist(db.updateDriver(updated), 'Transfer not saved');
}

// Manager only. Deleting a driver never touches past action records
// (the link is set to NULL; the name snapshot stays).
async function deleteDriver(driverId) {
  if (!isManager.value) return;
  const driver = drivers.value.find(d => d.id === driverId);
  const label = driver ? driverLabelOf(driver) : 'this driver';

  if (!confirm(`Are you sure you want to delete driver ${label}?`)) {
    return;
  }

  drivers.value = drivers.value.filter(d => d.id !== driverId);
  await persist(db.deleteDriver(driverId), 'Driver not deleted');
}

async function handleResetData() {
  if (!confirm('Reset active drivers status to READY and mark rows RED (needs check ASAP)? Inactive drivers will remain inactive.')) {
    return;
  }
  drivers.value = drivers.value.map(d =>
    d.status === 'INACTIVE' ? d : { ...d, status: 'READY', lastCheckedAt: null }
  );
  if (await persist(db.resetActiveDrivers(), 'Fleet reset failed')) {
    db.broadcastFleetReset();
    showToast({
      title: 'Events up to date',
      message: 'Active drivers reset to READY (Inactive unchanged)'
    });
  }
}
</script>
