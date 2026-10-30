<template>
  <!-- DEPLOYMENT NOT CONFIGURED: the database comes only from env variables -->
  <div v-if="!isSupabaseConfigured" class="center-screen">
    <div class="cb-dialog setup">
      <span class="cb-dialog-title">CheckingBoard is not connected to its database</span>
      <p class="cb-sub">Set these environment variables where the frontend is built and deployed, then rebuild:</p>
      <pre class="setup-code">VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-public-key</pre>
    </div>
  </div>

  <!-- RESTORING SESSION (a saved sign-in is retried while offline, not dropped) -->
  <div v-else-if="authLoading" class="center-screen loading">
    <div v-if="sessionReconnecting" class="reconnecting">
      <span>Reconnecting to CheckingBoard…</span>
      <span class="cb-sub">You're still signed in. Check your internet connection.</span>
      <button class="btn btn-secondary" @click="handleLogout">Sign out</button>
    </div>
    <template v-else>Loading CheckingBoard…</template>
  </div>

  <!-- NOT SIGNED IN: SIGN IN / CREATE A TEAM -->
  <LoginView v-else-if="!currentUser" />

  <!-- SIGNED IN ON A PHONE: only the phone features, tabs at the bottom -->
  <div v-else-if="isPhone" class="phone">
    <header class="phone-top">
      <span class="phone-mark">CB</span>
      <!-- Your name opens Profile settings -->
      <button :class="['phone-title', { 'is-on': phoneTab === 'profile' }]" title="Profile settings" aria-label="Profile settings" @click="phoneTab = 'profile'">
        <span class="phone-team cb-ellipsis">{{ currentTeam?.name || 'CheckingBoard' }}</span>
        <span class="phone-user cb-ellipsis">{{ currentUser.displayName }} · {{ currentUser.role }} · Profile</span>
      </button>
      <span :class="['live-dot', { 'is-live': isLive }]" :title="isLive ? 'Live' : 'Connecting…'"></span>
      <button class="phone-signout" title="Sign out" aria-label="Sign out" @click="handleLogout">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" x2="9" y1="12" y2="12" /></svg>
      </button>
    </header>

    <main class="phone-main">
      <div v-if="phoneTab === 'checkin'" class="cb-page cb-scroll"><CheckInView :refreshKey="attendanceVersion" /></div>
      <div v-else-if="phoneTab === 'team' && !isManager" class="cb-page cb-scroll"><TeamView /></div>
      <TeamManagementView
        v-else-if="phoneTab === 'team' && isManager"
        :refreshKey="attendanceVersion"
        @saved="showToast($event)"
        @error="showErrorToast($event.title, $event.message)"
      />
      <ProfileView v-else-if="phoneTab === 'profile'" @logout="handleLogout" />
      <div v-else-if="phoneTab === 'notifications'" class="cb-page cb-scroll">
        <NotificationsPanel
          asPage
          :notifications="notifications"
          :unreadIds="unreadIdsAtOpen"
          :isManager="isManager"
          :roster="activeStaffProfiles"
          @changed="loadNotifications"
          @sent="showToast({ title: 'Notification sent', message: $event })"
        />
      </div>
      <ShiftControlView
        v-else-if="phoneTab === 'shifts' && isManager"
        @saved="showToast({ title: 'Shift schedule saved', message: 'New actions use the updated shifts' })"
        @office-saved="showToast($event)"
        @office-error="showErrorToast($event.title, $event.message)"
      />
      <ActivityLogView v-else-if="phoneTab === 'logs' && isManager" :activeDrivers="drivers" :refreshKey="activityVersion" />
      <DailyStatisticsView v-else-if="phoneTab === 'stats' && isManager" :refreshKey="activityVersion" />
    </main>

    <nav class="phone-tabs" aria-label="Sections">
      <button
        v-for="t in phoneTabs"
        :key="t.id"
        :class="['phone-tab', { 'is-on': phoneTab === t.id }]"
        :aria-current="phoneTab === t.id ? 'page' : null"
        @click="phoneTab = t.id"
      >
        <span class="phone-tab-icon">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" v-html="t.icon"></svg>
          <span v-if="t.id === 'notifications' && unreadCount" class="phone-badge">{{ unreadCount > 99 ? '99+' : unreadCount }}</span>
        </span>
        <span class="phone-tab-label">{{ t.label }}</span>
      </button>
    </nav>
  </div>

  <!-- SIGNED IN: SIDEBAR + CURRENT VIEW -->
  <div v-else class="shell">
    <SideNav
      :collapsed="railCollapsed"
      :activeView="activeView"
      :currentUser="currentUser"
      :teamName="currentTeam?.name || ''"
      :isLive="isLive"
      :boardCount="tabCounts.CHECKING_BOARD"
      :todayActivities="todayActivities"
      :roster="activeStaffProfiles"
      :unreadCount="unreadCount"
      :notificationsOpen="showNotifications"
      @update:collapsed="toggleSidebar"
      @navigate="navigateTo"
      @open-notifications="showNotifications = !showNotifications"
      @logout="handleLogout"
    />

    <!-- Notifications drawer (slides out beside the sidebar) -->
    <NotificationsPanel
      v-if="showNotifications"
      :notifications="notifications"
      :unreadIds="unreadIdsAtOpen"
      :isManager="isManager"
      :roster="activeStaffProfiles"
      :sidebarCollapsed="railCollapsed"
      @close="showNotifications = false"
      @changed="loadNotifications"
      @sent="showToast({ title: 'Notification sent', message: $event })"
    />

    <main class="main">
      <!-- 1. BOARD -->
      <CheckingBoardTable
        v-if="activeView === 'fleet'"
        v-model:searchQuery="searchQuery"
        :companies="companies"
        :drivers="drivers"
        :tabs="tabs"
        :activeTabId="activeTabId"
        :tabCounts="tabCounts"
        :selectedDriverId="selectedDriverId"
        :canManageFleet="isManager"
        :todayActivities="todayActivities"
        :keyboardEnabled="!anyDialogOpen"
        @select-driver="selectedDriverId = $event"
        @select-tab="activeTabId = $event"
        @reorder-tabs="handleReorderTabs"
        @reorder-driver="handleReorderDriver"
        @reorder-company="handleReorderCompany"
        @add-company="openAddCompanyModal"
        @add-driver="openAddDriverForCompany"
        @edit-driver="openEditDriverModal"
        @delete-driver="deleteDriver"
        @update-driver="updateDriver"
        @edit-company="openEditCompanyModal"
        @delete-company="deleteCompany"
        @reset-data="handleResetData"
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
        @saved="showToast({ title: 'Shift schedule saved', message: 'New actions use the updated shifts' })"
        @office-saved="showToast($event)"
        @office-error="showErrorToast($event.title, $event.message)"
      />

      <!-- 4. STATISTICS (manager) -->
      <DailyStatisticsView
        v-else-if="activeView === 'statistics' && isManager"
        :refreshKey="activityVersion"
      />

      <!-- 5. TEAM (manager): members and their accounts, attendance -->
      <TeamManagementView
        v-else-if="activeView === 'team' && isManager"
        :refreshKey="attendanceVersion"
        @saved="showToast($event)"
        @error="showErrorToast($event.title, $event.message)"
      />

      <!-- 6. EXTENSIONS (everyone downloads, managers publish) -->
      <ExtensionsView
        v-else-if="activeView === 'extensions'"
        :isManager="isManager"
        :teamId="currentUser?.teamId || ''"
        @published="showToast({ title: 'Extension published', message: $event })"
      />

      <!-- 7. PROFILE SETTINGS (everyone): own name, username, password -->
      <ProfileView v-else-if="activeView === 'profile'" @logout="handleLogout" />
    </main>

    <!-- Add / edit company -->
    <AddCompanyModal
      v-if="showCompanyModal"
      :editingCompany="editingCompany"
      @close="closeCompanyModal"
      @save="saveCompany"
    />

    <!-- Add / edit driver -->
    <AddDriverModal
      v-if="showDriverModal"
      :companies="companies"
      :defaultCompanyId="targetCompanyId"
      :editingDriver="editingDriver"
      @close="closeDriverModal"
      @save="saveDriver"
    />

    <!-- Confirmations (delete, reset) -->
    <ConfirmDialog
      v-if="confirmState"
      :title="confirmState.title"
      :body="confirmState.body"
      :okLabel="confirmState.ok"
      @confirm="runConfirm"
      @cancel="confirmState = null"
    />
  </div>

  <!-- Toasts (top right; click to dismiss) - shared by the desktop and phone layouts -->
  <div v-if="currentUser" class="toasts">
    <transition-group name="toast">
      <div
        v-for="toast in toasts"
        :key="toast.id"
        :class="['toast', { 'is-error': toast.isError }]"
        title="Click to dismiss"
        @click="removeToast(toast.id)"
      >
        <span class="toast-mark" :style="{ background: toast.markColor }"></span>
        <div class="toast-body">
          <div class="toast-top">
            <span class="toast-title cb-ellipsis">{{ toast.title }}</span>
            <span class="toast-time">{{ toast.time }}</span>
          </div>
          <div class="toast-line">
            <span class="cb-ellipsis">{{ toast.message }}</span>
            <span v-if="toast.destTab" class="tag tag-outline toast-dest">{{ toast.destTab }}</span>
          </div>
        </div>
      </div>
    </transition-group>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue';
import SideNav from './components/SideNav.vue';
import CheckingBoardTable from './components/CheckingBoardTable.vue';
import AddCompanyModal from './components/AddCompanyModal.vue';
import AddDriverModal from './components/AddDriverModal.vue';
import ConfirmDialog from './components/ConfirmDialog.vue';
import ActivityLogView from './components/ActivityLogView.vue';
import ShiftControlView from './components/ShiftControlView.vue';
import DailyStatisticsView from './components/DailyStatisticsView.vue';
import ExtensionsView from './components/ExtensionsView.vue';
import NotificationsPanel from './components/NotificationsPanel.vue';
import LoginView from './components/LoginView.vue';
import CheckInView from './components/CheckInView.vue';
import TeamView from './components/TeamView.vue';
import TeamManagementView from './components/TeamManagementView.vue';
import ProfileView from './components/ProfileView.vue';
import { syncPushSubscription, forgetThisDevice } from './services/pushService';

import { BOTTOM_TABS, getStatusConfig, getStatusTab } from './config/statusConfig';
import { currentWorkDay, clockTashkent } from './config/shifts';
import { supabase, isSupabaseConfigured } from './services/supabaseClient';
import {
  currentStaffUser,
  currentTeam,
  activeStaffProfiles,
  sessionReconnecting,
  initAuth,
  logoutUser
} from './services/authService';
import { fetchActivities } from './services/activityService';
import { fetchNotifications, fetchReadIds, markRead } from './services/notificationService';
import * as db from './services/supabaseService';
import { driverLabel as driverLabelOf } from './utils/format';

// ---------------------------------------------------------------------------
// State: everything comes from the shared team database
// ---------------------------------------------------------------------------
const currentUser = computed(() => currentStaffUser.value);
// Only managers add or remove companies and remove drivers; everyone adds drivers
// (also enforced by the database)
const isManager = computed(() => currentUser.value?.role === 'manager');
const authLoading = ref(isSupabaseConfigured);
const companies = ref([]);
const drivers = ref([]);
const activityVersion = ref(0); // bumped when new actions arrive so open log views reload
const attendanceVersion = ref(0); // bumped when a check-in / check-out arrives live
const activeTabId = ref('CHECKING_BOARD');
const activeView = ref('fleet'); // 'fleet' | 'activity_log' | 'shifts' | 'statistics' | 'team' | 'extensions' | 'profile'
const searchQuery = ref('');
const selectedDriverId = ref('');
const isLive = ref(false);

// Sidebar open / closed is a per-browser view preference
const SIDEBAR_KEY = 'checkingboard_sidebar_collapsed';
function loadSidebarCollapsed() {
  try {
    return localStorage.getItem(SIDEBAR_KEY) === '1';
  } catch (e) {
    return false;
  }
}
const sidebarCollapsed = ref(loadSidebarCollapsed());
watch(sidebarCollapsed, (value) => {
  try {
    localStorage.setItem(SIDEBAR_KEY, value ? '1' : '0');
  } catch (e) {
    // Preference not saved; it still applies for this session
  }
});

// On narrow screens the sidebar is an icon rail unless opened for a moment;
// that doesn't change the saved preference for wide screens.
const narrowQuery = window.matchMedia('(max-width: 900px)');
const isNarrow = ref(narrowQuery.matches);
const narrowOpen = ref(false);
function onNarrowChange(e) {
  isNarrow.value = e.matches;
  narrowOpen.value = false;
}
narrowQuery.addEventListener('change', onNarrowChange);
const railCollapsed = computed(() => (isNarrow.value ? !narrowOpen.value : sidebarCollapsed.value));

function toggleSidebar() {
  if (isNarrow.value) narrowOpen.value = !narrowOpen.value;
  else sidebarCollapsed.value = !sidebarCollapsed.value;
}

// ---------------------------------------------------------------------------
// Phone layout (installed app or phone browser): only the phone features
// ---------------------------------------------------------------------------
// A phone-sized screen, or a phone turned sideways (short and touch)
const phoneQuery = window.matchMedia('(max-width: 640px), (pointer: coarse) and (max-height: 500px)');
const isPhone = ref(phoneQuery.matches);
function onPhoneChange(e) {
  isPhone.value = e.matches;
}
phoneQuery.addEventListener('change', onPhoneChange);

const ICONS = {
  checkin: '<path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" /><polyline points="10 17 15 12 10 7" /><line x1="15" x2="3" y1="12" y2="12" />',
  notifications: '<path d="M10.268 21a2 2 0 0 0 3.464 0" /><path d="M3.262 15.326A1 1 0 0 0 4 17h16a1 1 0 0 0 .74-1.673C19.41 13.956 18 12.499 18 8A6 6 0 0 0 6 8c0 4.499-1.411 5.956-2.738 7.326" />',
  team: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />',
  shifts: '<path d="M21 7.5V6a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h3.5" /><path d="M16 2v4" /><path d="M8 2v4" /><path d="M3 10h5" /><path d="M17.5 17.5 16 16.3V14" /><circle cx="16" cy="16" r="6" />',
  logs: '<path d="M15 12h-5" /><path d="M15 8h-5" /><path d="M19 17V5a2 2 0 0 0-2-2H4" /><path d="M8 21h12a2 2 0 0 0 2-2v-1a1 1 0 0 0-1-1H11a1 1 0 0 0-1 1v1a2 2 0 1 1-4 0V5a2 2 0 1 0-4 0v2a1 1 0 0 0 1 1h3" />',
  stats: '<path d="M3 3v16a2 2 0 0 0 2 2h16" /><path d="M18 17V9" /><path d="M13 17V5" /><path d="M8 17v-3" />'
};

// Staff: check in, notifications, team. Managers: shifts, logs, statistics, attendance, notifications.
const phoneTabs = computed(() => (isManager.value
  ? [
      { id: 'shifts', label: 'Shifts' },
      { id: 'logs', label: 'Logs' },
      { id: 'stats', label: 'Stats' },
      { id: 'team', label: 'Team' },
      { id: 'notifications', label: 'Alerts' }
    ]
  : [
      { id: 'checkin', label: 'Check in' },
      { id: 'notifications', label: 'Alerts' },
      { id: 'team', label: 'Team' }
    ]).map(t => ({ ...t, icon: ICONS[t.id] })));
const phoneTab = ref('checkin');

function resetPhoneTab() {
  phoneTab.value = phoneTabs.value[0].id;
}

// From a tapped phone alert (service worker message) or a ?view=... link
function openNotifications() {
  if (isPhone.value) phoneTab.value = 'notifications';
  else showNotifications.value = true;
}
// A shift reminder opens Check in (phone tab for staff); anything else opens the notifications
function openView(view) {
  if (view === 'checkin' && isPhone.value && phoneTabs.value.some(t => t.id === 'checkin')) {
    phoneTab.value = 'checkin';
  } else if (view !== 'checkin') {
    openNotifications();
  }
}
function onServiceWorkerMessage(e) {
  if (!currentUser.value) return;
  if (e.data?.type === 'open-view') openView(e.data.view);
  else if (e.data?.type === 'open-notifications') openNotifications();
}
navigator.serviceWorker?.addEventListener('message', onServiceWorkerMessage);

function navigateTo(view) {
  activeView.value = view;
  narrowOpen.value = false;
}
// Today's action records (staff: their own and their shift-mates', manager: the team) for the sidebar and KPI cards
const todayActivities = ref([]);
let signResetTimer = null;
let todayTimer = null;
let authSubscription = null;

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
    onActivityInsert: onActivityLogged,
    onNotificationChange,
    onAttendanceChange: () => { attendanceVersion.value += 1; },
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

async function loadTodayActivities() {
  try {
    const day = currentWorkDay();
    todayActivities.value = await fetchActivities({ fromDate: day, toDate: day });
  } catch (err) {
    console.warn('Could not load today\'s actions:', err);
  }
}

async function enterTeam() {
  await loadFleet();
  setupRealtime();
  loadTodayActivities();
  loadNotifications();
  await runSignReset();
  if (signResetTimer) clearInterval(signResetTimer);
  // Midnight rollover without reloading: the database decides if a reset is due
  signResetTimer = setInterval(runSignReset, 60000);
  // Teammates' actions show up in the sidebar and KPI cards within a minute
  if (todayTimer) clearInterval(todayTimer);
  todayTimer = setInterval(loadTodayActivities, 60000);
}

function leaveTeam() {
  if (signResetTimer) clearInterval(signResetTimer);
  if (todayTimer) clearInterval(todayTimer);
  signResetTimer = null;
  todayTimer = null;
  db.unsubscribeFromRealtime();
  isLive.value = false;
  companies.value = [];
  drivers.value = [];
  todayActivities.value = [];
  notifications.value = [];
  readIds.value = new Set();
  showNotifications.value = false;
  confirmState.value = null;
  activeView.value = 'fleet';
}

// Whenever a (different) user signs in - restored session, sign in, or a new
// team - load that team's fleet. (Watching the user instead of a LoginView event:
// the login screen unmounts the instant the user is set.)
let restoringSession = true;
watch(() => currentUser.value?.id, async (id, oldId) => {
  if (!id || id === oldId) return;
  activeView.value = 'fleet';
  resetPhoneTab();
  // Opened from a phone alert: go straight to the notifications or check-in
  const params = new URLSearchParams(window.location.search);
  if (params.has('view')) {
    openView(params.get('view'));
    params.delete('view');
    const rest = params.toString();
    window.history.replaceState(null, '', `${window.location.pathname}${rest ? `?${rest}` : ''}`);
  }
  // A phone that already allows alerts now delivers them to whoever signed in
  syncPushSubscription();
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
  narrowQuery.removeEventListener('change', onNarrowChange);
  phoneQuery.removeEventListener('change', onPhoneChange);
  navigator.serviceWorker?.removeEventListener('message', onServiceWorkerMessage);
});

// ---------------------------------------------------------------------------
// Session events
// ---------------------------------------------------------------------------
async function handleLogout() {
  // Stop sending this person's alerts to this device (while still signed in)
  await forgetThisDevice();
  leaveTeam();
  await logoutUser();
}

// ---------------------------------------------------------------------------
// Toast / Alert Notification System
// ---------------------------------------------------------------------------
const toasts = ref([]);
// title / message / destTab (the sheet tab a driver moved to) / status (colors the mark)
function showToast({ title = 'Up to date', message = '', status = null, destTab = '', isError = false }) {
  const id = `toast-${Date.now()}-${Math.random()}`;
  let markColor = 'var(--color-accent)';
  if (isError) {
    markColor = 'var(--color-signal)';
  } else if (status) {
    const look = getStatusConfig(status).look;
    if (look && look.background !== 'transparent') markColor = look.background;
  }
  // Keep at most four on screen
  toasts.value = [...toasts.value, { id, title, message, destTab, isError, markColor, time: clockTashkent() }].slice(-4);
  setTimeout(() => removeToast(id), isError ? 7000 : 4000);
}

function showErrorToast(title, message) {
  showToast({ title, message, isError: true });
}

function removeToast(id) {
  toasts.value = toasts.value.filter(t => t.id !== id);
}

// ---------------------------------------------------------------------------
// Modals & bottom tabs
// ---------------------------------------------------------------------------
const showCompanyModal = ref(false);
const editingCompany = ref(null);

const showDriverModal = ref(false);
const editingDriver = ref(null);
const targetCompanyId = ref('');

// Confirmation dialog: { title, body, ok, onConfirm }
const confirmState = ref(null);

function askConfirm(state) {
  confirmState.value = state;
}

async function runConfirm() {
  const state = confirmState.value;
  confirmState.value = null;
  if (state) await state.onConfirm();
}

// Board shortcuts pause while any dialog is open
const anyDialogOpen = computed(() =>
  showCompanyModal.value || showDriverModal.value || !!confirmState.value
);

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
    HOME: allDrivers.filter(d => ['HOME', 'SHOP'].includes(d.status)).length,
    INACTIVE: allDrivers.filter(d => d.status === 'INACTIVE').length
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
// Notifications (managers send, staff receive)
// ---------------------------------------------------------------------------
const notifications = ref([]);
const readIds = ref(new Set());
const showNotifications = ref(false);
// Unread when the drawer was opened, so they stay marked "New" while it is open
const unreadIdsAtOpen = ref(new Set());

// Managers see what they sent; only what others sent counts as unread
const incomingNotifications = computed(() =>
  notifications.value.filter(n => n.sender_id !== currentUser.value?.id)
);
const unreadCount = computed(() => incomingNotifications.value.filter(n => !readIds.value.has(n.id)).length);

async function loadNotifications() {
  try {
    const list = await fetchNotifications();
    notifications.value = list;
    readIds.value = await fetchReadIds(list.map(n => n.id));
  } catch (err) {
    console.warn('Could not load notifications:', err);
  }
}

// The drawer on a PC, the Alerts tab on a phone
const notificationsOpen = computed(() => (isPhone.value ? phoneTab.value === 'notifications' : showNotifications.value));

watch(notificationsOpen, async (open) => {
  if (!open) return;
  const unread = incomingNotifications.value.filter(n => !readIds.value.has(n.id)).map(n => n.id);
  unreadIdsAtOpen.value = new Set(unread);
  if (!unread.length) return;
  try {
    await markRead(unread, currentUser.value.id);
    readIds.value = new Set([...readIds.value, ...unread]);
  } catch (err) {
    console.warn('Could not mark notifications read:', err);
  }
});

// Actions arrive from the Leader ELD extension; refresh counts and open log views
let activityRefreshTimer = null;
function onActivityLogged() {
  clearTimeout(activityRefreshTimer);
  activityRefreshTimer = setTimeout(() => {
    activityVersion.value += 1;
    loadTodayActivities();
  }, 800);
}

async function onNotificationChange(payload) {
  await loadNotifications();
  const n = payload.new;
  if (payload.eventType === 'INSERT' && n?.id && n.sender_id !== currentUser.value?.id
      && notifications.value.some(x => x.id === n.id)) {
    showToast({ title: n.title, message: n.body || `From ${n.sender_name}` });
  }
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
  if (!isManager.value) return;
  editingCompany.value = company;
  showCompanyModal.value = true;
}

function closeCompanyModal() {
  showCompanyModal.value = false;
  editingCompany.value = null;
}

// Adding, renaming and deleting companies is manager-only (also enforced by the database)
async function saveCompany(companyData) {
  closeCompanyModal();
  if (!isManager.value) return;
  if (companyData.id) {
    const idx = companies.value.findIndex(c => c.id === companyData.id);
    if (idx === -1) return;
    const updated = { ...companies.value[idx], name: companyData.name, note: companyData.note || '' };
    companies.value[idx] = updated;
    await persist(db.updateCompany(updated), 'Company not saved');
  } else {
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
function deleteCompany(companyId) {
  if (!isManager.value) return;
  const comp = companies.value.find(c => c.id === companyId);
  const name = comp ? comp.name : 'this company';
  const driverCount = drivers.value.filter(d => d.companyId === companyId).length;

  askConfirm({
    title: `Delete ${name}?`,
    body: `${driverCount > 0 ? `This also removes ${driverCount} driver${driverCount === 1 ? '' : 's'} from the board. ` : ''}Past log entries keep the company and driver names.`,
    ok: 'Delete company',
    onConfirm: async () => {
      companies.value = companies.value.filter(c => c.id !== companyId);
      drivers.value = drivers.value.filter(d => d.companyId !== companyId);
      if (await persist(db.deleteCompany(companyId), 'Company not deleted')) {
        showToast({ title: 'Company deleted', message: name });
      }
    }
  });
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
  showToast({
    title: driverLabelOf(driver),
    message: 'Moved to',
    destTab: getStatusTab(driver.status).label,
    status: driver.status
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

  showToast({
    title: 'Driver added',
    message: `${driverLabelOf(newDriver)} →`,
    destTab: getStatusTab(newDriver.status).label,
    status: newDriver.status
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

// Manager only. Deleting a driver never touches past action records
// (the link is set to NULL; the name snapshot stays).
function deleteDriver(driverId) {
  if (!isManager.value) return;
  const driver = drivers.value.find(d => d.id === driverId);
  const label = driver ? driverLabelOf(driver) : 'this driver';

  askConfirm({
    title: `Delete ${label}?`,
    body: 'The driver is removed from the board. Past log entries keep the driver\'s name.',
    ok: 'Delete driver',
    onConfirm: async () => {
      drivers.value = drivers.value.filter(d => d.id !== driverId);
      if (selectedDriverId.value === driverId) selectedDriverId.value = '';
      if (await persist(db.deleteDriver(driverId), 'Driver not deleted')) {
        showToast({ title: 'Driver deleted', message: `${label} · logs kept` });
      }
    }
  });
}

function handleResetData() {
  askConfirm({
    title: 'Reset fleet to READY?',
    body: 'Every active driver goes to READY and is marked overdue, so the next check round starts clean. Inactive drivers stay inactive. Teammates see the reset live.',
    ok: 'Reset fleet',
    onConfirm: async () => {
      drivers.value = drivers.value.map(d =>
        d.status === 'INACTIVE' ? d : { ...d, status: 'READY', lastCheckedAt: null }
      );
      if (await persist(db.resetActiveDrivers(), 'Fleet reset failed')) {
        db.broadcastFleetReset();
        showToast({ title: 'Fleet reset to READY', message: 'Inactive drivers unchanged' });
      }
    }
  });
}
</script>

<style scoped>
/* dvh: phone browser bars don't push the bottom of the app off screen */
.shell { height: 100vh; height: 100dvh; display: flex; overflow: hidden; background: var(--color-surface); user-select: none; }
.main { flex: 1; min-width: 0; min-height: 0; display: flex; flex-direction: column; position: relative; }

.center-screen { height: 100vh; height: 100dvh; display: grid; place-items: center; padding: 24px; background: var(--color-surface); }
.loading { font-family: var(--font-heading); font-size: 18px; color: var(--color-neutral-700); }
.setup { width: min(520px, 100%); }
.reconnecting { display: flex; flex-direction: column; align-items: center; gap: 10px; text-align: center; }
.setup-code { margin: 0; padding: 12px; font-size: 12px; background: var(--color-bg); border: 1px solid var(--color-divider); white-space: pre-wrap; }

.toasts { position: fixed; top: 16px; right: 16px; z-index: 70; display: flex; flex-direction: column; gap: 8px; pointer-events: none; }
.toast {
  pointer-events: auto; width: min(320px, calc(100vw - 32px)); height: 64px; padding: 10px 14px; cursor: pointer;
  display: flex; align-items: center; gap: 12px;
  background: var(--color-neutral-100); border: 1px solid var(--color-divider); box-shadow: var(--shadow-md);
}
.toast.is-error { border-color: color-mix(in srgb, var(--color-signal) 45%, transparent); }
.toast-mark { width: 4px; align-self: stretch; flex-shrink: 0; }
.toast-body { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 3px; }
.toast-top { display: flex; justify-content: space-between; gap: 8px; }
.toast-title { font-size: 13px; font-weight: 600; }
.toast-time { font-family: var(--font-heading); font-size: 12px; color: var(--color-neutral-600); flex-shrink: 0; }
.toast-line { display: flex; align-items: center; gap: 6px; font-size: 12px; color: var(--color-neutral-700); min-width: 0; }
.toast-dest { font-family: var(--font-heading); font-size: 11px; }
.toast-enter-active, .toast-leave-active { transition: opacity 150ms, transform 150ms; }
.toast-enter-from, .toast-leave-to { opacity: 0; transform: translateY(-6px); }

/* Phone layout: steel top bar, one scrolling page, tab bar at the bottom.
   Safe-area insets keep it clear of the notch and the home indicator. */
.phone {
  height: 100vh; height: 100dvh; display: flex; flex-direction: column; overflow: hidden;
  background: var(--color-surface); -webkit-tap-highlight-color: transparent;
}
.phone-top {
  display: flex; align-items: center; gap: 10px; flex-shrink: 0;
  padding: calc(env(safe-area-inset-top) + 10px) calc(env(safe-area-inset-right) + 12px) 10px calc(env(safe-area-inset-left) + 12px);
  background: var(--color-accent-900); color: var(--color-bg);
}
.phone-mark {
  width: 30px; height: 30px; flex-shrink: 0; display: grid; place-items: center;
  background: var(--color-accent); font-family: var(--font-heading); font-weight: 600; font-size: 13px;
}
.phone-title {
  flex: 1; min-width: 0; display: flex; flex-direction: column; line-height: 1.15; text-align: left;
  border: 0; padding: 4px 6px; margin: -4px 0 -4px -6px; background: transparent; color: inherit; font: inherit; cursor: pointer;
}
.phone-title:active, .phone-title.is-on { background: var(--color-accent-800); }
.phone-team { font-family: var(--font-heading); font-weight: 600; font-size: 17px; }
.phone-user { font-size: 12px; color: var(--color-accent-300); text-transform: capitalize; }
.live-dot { width: 7px; height: 7px; flex-shrink: 0; background: var(--color-neutral-600); }
.live-dot.is-live { background: var(--color-accent-400); }
.phone-signout {
  width: 40px; height: 40px; flex-shrink: 0; display: grid; place-items: center;
  border: 0; background: transparent; color: var(--color-accent-300); cursor: pointer;
}
.phone-signout:active { background: var(--color-accent-800); color: var(--color-bg); }

.phone-main { flex: 1; min-height: 0; display: flex; flex-direction: column; padding-left: env(safe-area-inset-left); padding-right: env(safe-area-inset-right); }
.phone-main > .cb-page { padding-bottom: 20px; }

.phone-tabs {
  display: flex; flex-shrink: 0; border-top: 1px solid var(--color-accent-800);
  padding: 0 env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left);
  background: var(--color-accent-900);
}
.phone-tab {
  flex: 1; min-width: 0; min-height: 58px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 3px;
  border: 0; background: transparent; color: var(--color-accent-300); cursor: pointer; font: inherit; position: relative;
  touch-action: manipulation;
}
.phone-tab.is-on { color: var(--color-bg); box-shadow: inset 0 2px 0 var(--color-accent-400); background: var(--color-accent-800); }
.phone-tab:focus-visible { outline: 2px solid var(--color-accent-400); outline-offset: -2px; }
.phone-tab-icon { position: relative; display: grid; place-items: center; }
.phone-tab-label { font-size: 11px; font-weight: 500; letter-spacing: 0.02em; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 100%; }
.phone-badge {
  position: absolute; top: -6px; left: 14px; min-width: 16px; padding: 0 4px;
  font-size: 10px; font-weight: 600; line-height: 16px; text-align: center;
  background: var(--color-signal); color: var(--color-bg);
}
/* Toasts sit below the phone's top bar */
@media (max-width: 640px) {
  .toasts { top: calc(env(safe-area-inset-top) + 62px); right: 12px; left: 12px; align-items: stretch; }
  .toast { width: auto; }
}
</style>
