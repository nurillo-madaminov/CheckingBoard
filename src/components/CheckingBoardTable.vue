<template>
  <div class="board-page">
    <!-- Title, search, actions -->
    <div class="top">
      <div class="title-block">
        <h2 class="cb-title">Board</h2>
        <span class="cb-sub">{{ currentTab.subtitle }}</span>
      </div>
      <div class="cb-spacer"></div>
      <div class="search">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="search-icon"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></svg>
        <input
          ref="searchRef"
          :value="searchQuery"
          class="input search-input"
          placeholder="Search driver, unit, company"
          @input="$emit('update:searchQuery', $event.target.value)"
          @keydown.esc.stop="onSearchEscape"
        />
        <!-- ✕ clears the search at once (Esc does the same); "/" hint while empty -->
        <button v-if="searchQuery" class="search-clear" title="Clear search (Esc)" @click="clearSearch">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>
        </button>
        <span v-else class="cb-key search-key">/</span>
      </div>
      <!-- The one primary action of the board -->
      <button class="btn btn-primary" @click="$emit('add-driver-new')">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M5 12h14" /><path d="M12 5v14" /></svg>
        Add driver
      </button>
      <!-- Rare and destructive actions -->
      <MoreMenu :items="menuItems" label="More board actions" @select="onMenu" />
    </div>

    <!-- KPI strip -->
    <div class="kpis">
      <div class="cb-panel kpi">
        <div class="kpi-head"><span class="cb-label">Active drivers</span><span class="kpi-side">{{ kpi.carriers }}</span></div>
        <span class="cb-num kpi-num">{{ kpi.active }}</span>
        <div class="mix">
          <span v-for="m in kpi.mix" :key="m.id" :title="m.title" :style="{ width: `${m.pct}%`, background: m.color }"></span>
        </div>
      </div>
      <div class="cb-panel kpi">
        <div class="kpi-head"><span class="cb-label">Checked in last hour</span><span class="kpi-side">{{ kpi.withinPct }}%</span></div>
        <span class="cb-num kpi-num">{{ kpi.within }}<span class="kpi-of"> / {{ kpi.active }}</span></span>
        <span class="cb-bar kpi-bar"><span :style="{ width: `${kpi.withinPct}%`, background: 'var(--color-accent)' }"></span></span>
      </div>
      <button
        :class="['cb-panel', 'kpi', 'kpi-btn', { 'is-alert': kpi.overdue.length }]"
        :aria-pressed="attention.overdue ? 'true' : 'false'"
        @click="showOverdue"
      >
        <div class="kpi-head"><span class="cb-label">Overdue · 4h+</span><span class="kpi-side">{{ attention.overdue ? 'Showing only these' : 'Show only these →' }}</span></div>
        <span :class="['cb-num', 'kpi-num', { 'is-signal': kpi.overdue.length }]">{{ kpi.overdue.length }}</span>
        <span class="kpi-foot cb-ellipsis">{{ kpi.oldestLabel }}</span>
      </button>
      <div class="cb-panel kpi kpi-acts">
        <span class="cb-label span-all">Actions · {{ kpi.shiftLabel }} so far</span>
        <span class="cb-num kpi-num">{{ kpi.shiftActs }}</span>
        <div class="hours">
          <span v-for="h in kpi.hours" :key="h.key" :title="h.title" :style="{ height: `${h.pct}%`, background: h.future ? 'var(--color-neutral-300)' : 'var(--color-accent-500)' }"></span>
        </div>
      </div>
    </div>

    <!-- Filters, right above the table they filter -->
    <div class="filters">
      <div class="seg status-seg" role="group" aria-label="Status">
        <button
          v-for="(tab, index) in tabs"
          :key="tab.id"
          type="button"
          :class="['seg-btn', 'status-btn', { 'is-on': activeTabId === tab.id, 'is-drag': draggedTabId === tab.id }]"
          :style="tabDropStyle(tab.id)"
          :aria-pressed="activeTabId === tab.id ? 'true' : 'false'"
          :draggable="index > 0"
          :title="index > 0 ? `${tab.subtitle} · drag to reorder` : tab.subtitle"
          @click="$emit('select-tab', tab.id)"
          @dragstart="onTabDragStart(tab, index, $event)"
          @dragend="onTabDragEnd"
          @dragover.prevent="onTabDragOver(tab, index, $event)"
          @drop.prevent="onTabDrop(index)"
        >
          <span>{{ index === 0 ? 'All active' : tab.label }}</span>
          <span class="status-count">{{ tabCounts[tab.id] || 0 }}</span>
        </button>
      </div>
      <div class="attention" role="group" aria-label="Needs attention">
        <span class="cb-label attention-label">Needs attention</span>
        <button
          type="button"
          :class="['cb-chip', 'is-signal', { 'is-on': attention.overdue }]"
          :aria-pressed="attention.overdue ? 'true' : 'false'"
          title="Not checked for 4 hours or more"
          @click="toggleAttention('overdue')"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>
          Overdue <span class="cb-chip-count">{{ attentionCounts.overdue }}</span>
        </button>
        <button
          type="button"
          :class="['cb-chip', { 'is-on': attention.unsigned }]"
          :aria-pressed="attention.unsigned ? 'true' : 'false'"
          title="Sign is NO SIGN"
          @click="toggleAttention('unsigned')"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>
          No sign <span class="cb-chip-count">{{ attentionCounts.unsigned }}</span>
        </button>
        <button
          type="button"
          :class="['cb-chip', { 'is-on': attention.flagged }]"
          :aria-pressed="attention.flagged ? 'true' : 'false'"
          title="Flagged rows"
          @click="toggleAttention('flagged')"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" aria-hidden="true"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" /><path d="M4 22v-7" fill="none" /></svg>
          Flagged <span class="cb-chip-count">{{ attentionCounts.flagged }}</span>
        </button>
        <button v-if="anyAttention" type="button" class="cb-link clear-filters" @click="clearAttention">Clear</button>
      </div>
    </div>

    <!-- Board -->
    <div class="cb-panel board">
      <div ref="scrollRef" class="cb-scroll board-scroll" @dragover.prevent @drop.prevent="onContainerDrop">
        <div class="col-head">
          <div class="center">#</div>
          <div class="driver-head">Driver</div>
          <div>Sign</div>
          <div>Status</div>
          <div>Last check</div>
          <div class="notes-head">
            <span>Notes</span>
            <button
              class="toggle-all"
              :title="allCollapsed ? 'Open every company' : 'Close every company'"
              @click="toggleAllCompanies"
            >
              <!-- arrows apart = expand, arrows together = collapse -->
              <svg v-if="allCollapsed" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="m7 15 5 5 5-5" /><path d="m7 9 5-5 5 5" /></svg>
              <svg v-else width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="m7 20 5-5 5 5" /><path d="m7 4 5 5 5-5" /></svg>
              {{ allCollapsed ? 'Expand all' : 'Collapse all' }}
            </button>
          </div>
          <div class="check-head">Check</div>
        </div>

        <div v-if="companies.length === 0" class="empty">
          {{ canManageFleet ? 'No companies yet. Add one with + Company.' : 'No companies yet. A manager adds companies.' }}
        </div>

        <div v-for="(group, gIdx) in groups" :key="group.company.id">
          <CompanyHeaderRow
            :company="group.company"
            :companyIndex="gIdx + 1"
            :drivers="group.drivers"
            :isCollapsed="!group.expanded"
            :showActions="currentTab.id === 'CHECKING_BOARD'"
            :canManageFleet="canManageFleet"
            :isDragging="draggedCompanyId === group.company.id"
            :dropPosition="dropTargetCompany?.companyId === group.company.id ? dropTargetCompany.position : ''"
            @toggle-collapse="toggleCompanyCollapse(group.company.id)"
            @add-driver="$emit('add-driver', group.company)"
            @edit-company="$emit('edit-company', group.company)"
            @delete-company="$emit('delete-company', group.company.id)"
            @company-drag-start="handleCompanyDragStart"
            @company-drag-end="handleCompanyDragEnd"
            @company-drag-over="handleCompanyDragOver"
            @company-drop="handleCompanyDrop"
          />
          <template v-if="group.expanded">
            <DriverRow
              v-for="row in group.rows"
              :key="row.driver.id"
              :driver="row.driver"
              :orderIndex="row.n"
              :isActive="selectedDriverId === row.driver.id"
              :isDragging="draggedDriverId === row.driver.id"
              :dropPosition="dropTarget?.driverId === row.driver.id ? dropTarget.position : ''"
              :canDelete="canManageFleet && currentTab.id === 'CHECKING_BOARD'"
              @select-row="$emit('select-driver', $event)"
              @open="$emit('open-driver', $event)"
              @update="$emit('update-driver', $event)"
              @delete="$emit('delete-driver', $event)"
              @edit="$emit('edit-driver', $event)"
              @drag-start="handleDragStart"
              @drag-end="handleDragEnd"
              @row-dragover="handleRowDragOver"
              @row-drop="handleRowDrop"
            />
            <div v-if="group.rows.length === 0" class="group-empty">
              No drivers yet in {{ group.company.name }}.
              <button v-if="currentTab.id === 'CHECKING_BOARD'" class="btn btn-ghost" @click="$emit('add-driver', group.company)">Add the first driver</button>
            </div>
          </template>
        </div>

        <div v-if="noResults" class="empty">
          No drivers match {{ searchText ? `“${searchQuery}”` : 'these filters' }}{{ searchText && anyAttention ? ' and these filters' : '' }}.
          <button type="button" class="cb-link" @click="clearAll">Clear</button>
        </div>
      </div>

      <div class="board-foot">
        <span>Click a name to open the driver</span>
        <span><span class="cb-key">↑</span> <span class="cb-key">↓</span> move</span>
        <span><span class="cb-key">Enter</span> open</span>
        <span><span class="cb-key">C</span> check</span>
        <span><span class="cb-key">E</span> edit</span>
        <span><span class="cb-key">/</span> search</span>
        <span><span class="cb-key">Esc</span> clear</span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, nextTick, onMounted, onUnmounted, onActivated, onDeactivated } from 'vue';
import CompanyHeaderRow from './CompanyHeaderRow.vue';
import DriverRow from './DriverRow.vue';
import MoreMenu from './MoreMenu.vue';
import { BOTTOM_TABS, isFlagged } from '../config/statusConfig';
import { getFreshnessInfo, currentFreshnessTimestamp } from '../utils/freshness';
import { getShiftConfig, shiftProgress, currentWorkDay, clockTashkent } from '../config/shifts';
import { driverLabel } from '../utils/format';

const props = defineProps({
  companies: { type: Array, required: true },
  drivers: { type: Array, required: true },
  tabs: { type: Array, required: true },
  activeTabId: { type: String, required: true },
  tabCounts: { type: Object, required: true },
  searchQuery: { type: String, default: '' },
  selectedDriverId: { type: String, default: '' },
  // Managers add / delete companies and delete drivers; everyone adds drivers and works the board
  canManageFleet: { type: Boolean, default: false },
  // Today's action records, for the "Actions this shift" card
  todayActivities: { type: Array, default: () => [] },
  // Off while a dialog is open
  keyboardEnabled: { type: Boolean, default: true }
});

const emit = defineEmits([
  'add-driver', 'edit-driver', 'delete-driver', 'update-driver', 'edit-company', 'delete-company',
  'select-driver', 'reorder-driver', 'reorder-company',
  'select-tab', 'reorder-tabs', 'update:searchQuery', 'reset-data', 'add-company',
  'add-driver-new', 'open-driver'
]);

const searchRef = ref(null);
const scrollRef = ref(null);

const currentTab = computed(() => props.tabs.find(t => t.id === props.activeTabId) || props.tabs[0]);

// ---------------- groups (collapsed by default) ----------------
const collapsedCompanies = ref({});
const searchText = computed(() => props.searchQuery.trim().toLowerCase());

// "Needs attention" filters; they combine with the status and the search
const attention = ref({ overdue: false, unsigned: false, flagged: false });
const anyAttention = computed(() => Object.values(attention.value).some(Boolean));

function needsAttention(d) {
  const a = attention.value;
  if (a.overdue && getFreshnessInfo(d.lastCheckedAt).level !== 'overdue') return false;
  if (a.unsigned && d.sign === 'SIGNED') return false;
  if (a.flagged && !isFlagged(d)) return false;
  return true;
}

function toggleAttention(key) {
  attention.value = { ...attention.value, [key]: !attention.value[key] };
}

function clearAttention() {
  attention.value = { overdue: false, unsigned: false, flagged: false };
}

function clearAll() {
  clearAttention();
  emit('update:searchQuery', '');
}

function isCompanyCollapsed(companyId) {
  if (searchText.value || anyAttention.value) return false; // a search or filter opens every matching company
  return collapsedCompanies.value[companyId] !== false;
}

function toggleCompanyCollapse(companyId) {
  collapsedCompanies.value[companyId] = !isCompanyCollapsed(companyId);
}

const allCollapsed = computed(() => props.companies.every(c => isCompanyCollapsed(c.id)));

function toggleAllCompanies() {
  const next = !allCollapsed.value;
  props.companies.forEach(c => { collapsedCompanies.value[c.id] = next; });
}

function matchesSearch(d, company) {
  const q = searchText.value;
  return !q || `${d.name} ${d.unit} ${d.notes} ${company?.name || ''}`.toLowerCase().includes(q);
}

function companyDrivers(company) {
  void currentFreshnessTimestamp.value;
  return props.drivers.filter(d =>
    d.companyId === company.id &&
    currentTab.value.filterFn(d) &&
    matchesSearch(d, company) &&
    needsAttention(d)
  );
}

// Counts on the "Needs attention" chips: within the status and search shown
const attentionCounts = computed(() => {
  void currentFreshnessTimestamp.value;
  const byId = new Map(props.companies.map(c => [c.id, c]));
  const shown = props.drivers.filter(d => currentTab.value.filterFn(d) && matchesSearch(d, byId.get(d.companyId)));
  return {
    overdue: shown.filter(d => getFreshnessInfo(d.lastCheckedAt).level === 'overdue').length,
    unsigned: shown.filter(d => d.sign !== 'SIGNED').length,
    flagged: shown.filter(isFlagged).length
  };
});

const groups = computed(() => {
  let n = 0;
  return props.companies
    .map(company => {
      const drivers = companyDrivers(company);
      return {
        company,
        drivers,
        expanded: !isCompanyCollapsed(company.id),
        rows: drivers.map(driver => ({ driver, n: ++n }))
      };
    })
    .filter(g => g.drivers.length || (currentTab.value.id === 'CHECKING_BOARD' && !searchText.value && !anyAttention.value));
});

const noResults = computed(() => (!!searchText.value || anyAttention.value) && groups.value.length === 0);

// Drivers in board order that are on screen (for ↑ ↓)
const visibleIds = computed(() => groups.value.flatMap(g => (g.expanded ? g.rows.map(r => r.driver.id) : [])));

// ---------------- KPI cards ----------------
const now = ref(Date.now());
let clockTimer = null;

const kpi = computed(() => {
  void now.value;
  const active = props.drivers.filter(d => d.status !== 'INACTIVE');
  const levels = active.map(d => getFreshnessInfo(d.lastCheckedAt));
  const within = levels.filter(f => f.level === 'fresh').length;
  const overdue = active
    .filter(d => getFreshnessInfo(d.lastCheckedAt).level === 'overdue')
    .sort((a, b) => (a.lastCheckedAt ? Date.parse(a.lastCheckedAt) : 0) - (b.lastCheckedAt ? Date.parse(b.lastCheckedAt) : 0));
  const oldest = overdue[0];

  const mixColors = {
    AT_PU_DEL: 'var(--color-accent-700)',
    COVERED: 'var(--color-accent-500)',
    GOING_TO_DEL: 'var(--color-accent-300)',
    READY: 'var(--color-accent-200)',
    HOME: 'var(--color-neutral-300)'
  };
  const mix = Object.keys(mixColors).map(id => {
    const tab = BOTTOM_TABS.find(t => t.id === id);
    const count = active.filter(tab.filterFn).length;
    return { id, title: `${tab.label}: ${count}`, color: mixColors[id], pct: active.length ? (count / active.length) * 100 : 0 };
  });

  // Actions logged in the shift on the clock, hour by hour
  const shift = shiftProgress(new Date(now.value));
  const day = currentWorkDay(new Date(now.value));
  const shiftActs = props.todayActivities.filter(a => a.shift_code === shift.code && a.shift_date === day);
  const hours = [];
  for (let t = shift.start.getTime(); t < shift.end.getTime(); t += 3600e3) {
    const count = props.todayActivities.filter(a => {
      const at = Date.parse(a.action_at);
      return at >= t && at < t + 3600e3;
    }).length;
    hours.push({ key: t, count, future: t > now.value, title: `${clockTashkent(new Date(t))} · ${count}` });
  }
  const hourMax = Math.max(1, ...hours.map(h => h.count));
  hours.forEach(h => { h.pct = Math.max(8, (h.count / hourMax) * 100); });

  return {
    active: active.length,
    carriers: `${props.companies.length} carriers · ${active.filter(d => d.sign !== 'SIGNED').length} unsigned`,
    mix,
    within,
    withinPct: active.length ? Math.round((within / active.length) * 100) : 0,
    overdue,
    oldest,
    oldestLabel: oldest ? `Oldest: ${driverLabel(oldest)} · ${getFreshnessInfo(oldest.lastCheckedAt).short}` : 'Nobody past 4 hours',
    shiftLabel: getShiftConfig(shift.code).label,
    shiftActs: shiftActs.length,
    hours
  };
});

async function scrollToDriver(id) {
  await nextTick();
  const el = scrollRef.value?.querySelector(`[data-driver-id="${CSS.escape(id)}"]`);
  el?.scrollIntoView({ block: 'nearest' });
}

// Overdue card: show only the overdue drivers, oldest selected
function showOverdue() {
  if (attention.value.overdue) {
    toggleAttention('overdue');
    return;
  }
  attention.value = { ...attention.value, overdue: true };
  emit('select-tab', 'CHECKING_BOARD');
  const oldest = kpi.value.oldest;
  if (!oldest) return;
  emit('select-driver', oldest.id);
  scrollToDriver(oldest.id);
}

// ---------------- More menu ----------------
const menuItems = computed(() => [
  ...(props.canManageFleet ? [{ id: 'add-company', label: 'Add company' }] : []),
  { id: 'toggle-all', label: allCollapsed.value ? 'Expand every company' : 'Collapse every company' },
  { id: 'div', divider: true },
  { id: 'reset', label: 'Reset fleet to Ready…', danger: true }
]);

function onMenu(id) {
  if (id === 'add-company') emit('add-company');
  else if (id === 'toggle-all') toggleAllCompanies();
  else if (id === 'reset') emit('reset-data');
}

// ---------------- search ----------------
function clearSearch() {
  emit('update:searchQuery', '');
  searchRef.value?.focus();
}

// Esc in the box: first clears the text, then leaves the box
function onSearchEscape(e) {
  if (props.searchQuery) emit('update:searchQuery', '');
  else e.target.blur();
}

// ---------------- keyboard ----------------
// Actions (Shift, Cycle, ...) are logged by the Leader ELD extension, so the board
// only has navigation shortcuts.
function handleKey(e) {
  if (!props.keyboardEnabled || e.ctrlKey || e.metaKey || e.altKey) return;
  const tag = (e.target.tagName || '').toLowerCase();
  if (tag === 'input' || tag === 'textarea' || tag === 'select') return;

  if (e.key === 'Escape' && props.searchQuery) {
    emit('update:searchQuery', '');
    return;
  }
  if (e.key === '/') {
    e.preventDefault();
    searchRef.value?.focus();
    return;
  }
  const ids = visibleIds.value;
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    if (!ids.length) return;
    e.preventDefault();
    const i = ids.indexOf(props.selectedDriverId);
    const next = e.key === 'ArrowDown' ? Math.min(ids.length - 1, i + 1) : Math.max(0, i === -1 ? 0 : i - 1);
    emit('select-driver', ids[next]);
    scrollToDriver(ids[next]);
    return;
  }
  const driver = props.drivers.find(d => d.id === props.selectedDriverId);
  if (!driver) return;
  if (e.key === 'Enter') {
    // Leave buttons and links to do their own thing
    if (tag === 'button' || tag === 'a') return;
    e.preventDefault();
    emit('open-driver', driver.id);
    return;
  }
  const key = e.key.toLowerCase();
  if (key === 'c') {
    emit('update-driver', { ...driver, lastCheckedAt: new Date().toISOString() });
  } else if (key === 'e') {
    emit('edit-driver', driver);
  }
}

onMounted(() => {
  clockTimer = setInterval(() => { now.value = Date.now(); }, 30000);
});
// The board stays alive (open companies, scroll) while a driver page is open;
// its shortcuts only listen while it is on screen
onActivated(() => {
  window.addEventListener('keydown', handleKey);
  if (props.selectedDriverId) scrollToDriver(props.selectedDriverId);
});
onDeactivated(() => window.removeEventListener('keydown', handleKey));
onUnmounted(() => {
  window.removeEventListener('keydown', handleKey);
  clearInterval(clockTimer);
});

// ---------------- driver drag & drop ----------------
const draggedDriverId = ref(null);
const dropTarget = ref(null); // { driverId, position }

function handleDragStart(driverId) {
  draggedDriverId.value = driverId;
  dropTarget.value = null;
}

function handleDragEnd() {
  draggedDriverId.value = null;
  dropTarget.value = null;
}

function dropPositionOf(event) {
  const rect = event.currentTarget.getBoundingClientRect();
  return event.clientY - rect.top < rect.height / 2 ? 'before' : 'after';
}

function handleRowDragOver({ event, driver }) {
  if (!draggedDriverId.value || draggedDriverId.value === driver.id) {
    dropTarget.value = null;
    return;
  }
  event.dataTransfer.dropEffect = 'move';
  dropTarget.value = { driverId: driver.id, position: dropPositionOf(event) };
}

function handleRowDrop() {
  if (draggedDriverId.value && dropTarget.value && draggedDriverId.value !== dropTarget.value.driverId) {
    emit('reorder-driver', {
      draggedId: draggedDriverId.value,
      targetId: dropTarget.value.driverId,
      position: dropTarget.value.position
    });
  }
  handleDragEnd();
}

// ---------------- company drag & drop ----------------
const draggedCompanyId = ref(null);
const dropTargetCompany = ref(null); // { companyId, position }

function handleCompanyDragStart(companyId) {
  draggedCompanyId.value = companyId;
  dropTargetCompany.value = null;
}

function handleCompanyDragEnd() {
  draggedCompanyId.value = null;
  dropTargetCompany.value = null;
}

function handleCompanyDragOver({ event, company }) {
  if (!draggedCompanyId.value || draggedCompanyId.value === company.id) {
    dropTargetCompany.value = null;
    return;
  }
  event.dataTransfer.dropEffect = 'move';
  dropTargetCompany.value = { companyId: company.id, position: dropPositionOf(event) };
}

function handleCompanyDrop() {
  if (draggedCompanyId.value && dropTargetCompany.value && draggedCompanyId.value !== dropTargetCompany.value.companyId) {
    emit('reorder-company', {
      draggedId: draggedCompanyId.value,
      targetId: dropTargetCompany.value.companyId,
      position: dropTargetCompany.value.position
    });
  }
  handleCompanyDragEnd();
}

function onContainerDrop() {
  handleDragEnd();
  handleCompanyDragEnd();
}

// ---------------- sheet tab drag & drop (first tab stays put) ----------------
const draggedTabId = ref(null);
const dropTargetTab = ref(null); // { tabId, position }

function onTabDragStart(tab, index, event) {
  if (index === 0) {
    event.preventDefault();
    return;
  }
  draggedTabId.value = tab.id;
  event.dataTransfer.effectAllowed = 'move';
  event.dataTransfer.setData('text/plain', `tab:${tab.id}`);
}

function onTabDragEnd() {
  draggedTabId.value = null;
  dropTargetTab.value = null;
}

function onTabDragOver(tab, index, event) {
  if (!draggedTabId.value || draggedTabId.value === tab.id || index === 0) {
    dropTargetTab.value = null;
    return;
  }
  const rect = event.currentTarget.getBoundingClientRect();
  dropTargetTab.value = { tabId: tab.id, position: event.clientX - rect.left < rect.width / 2 ? 'before' : 'after' };
}

function onTabDrop(index) {
  if (draggedTabId.value && dropTargetTab.value && index > 0) {
    emit('reorder-tabs', {
      draggedId: draggedTabId.value,
      targetId: dropTargetTab.value.tabId,
      position: dropTargetTab.value.position
    });
  }
  onTabDragEnd();
}

function tabDropStyle(tabId) {
  if (dropTargetTab.value?.tabId !== tabId) return null;
  return { boxShadow: `inset ${dropTargetTab.value.position === 'before' ? '2px' : '-2px'} 0 0 var(--color-accent)` };
}
</script>

<style scoped>
.board-page {
  --board-num-col: 52px;
  --board-cols: 52px minmax(240px, 1.3fr) 128px 168px 108px minmax(160px, 1.6fr) 100px;
  height: 100%; display: flex; flex-direction: column; gap: 14px; padding: 18px 20px 20px; min-height: 0;
}
.top { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
.title-block { display: flex; flex-direction: column; gap: 1px; min-width: 0; }
.search { position: relative; width: 300px; min-width: 160px; flex-shrink: 1; }
.search-icon { position: absolute; left: 10px; top: 50%; transform: translateY(-50%); color: var(--color-neutral-600); }
.search-input { padding-left: 32px; padding-right: 36px; min-height: 34px; font-size: 13px; background: var(--color-neutral-100); }
.search-clear {
  position: absolute; right: 5px; top: 50%; transform: translateY(-50%); width: 24px; height: 24px;
  display: grid; place-items: center; border: 0; background: transparent; cursor: pointer; color: var(--color-neutral-700);
}
.search-clear:hover { background: var(--color-neutral-200); color: var(--color-text); }
.search-key { position: absolute; right: 8px; top: 50%; transform: translateY(-50%); font-family: var(--font-body); font-size: 11px; }

.kpis { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 14px; }
.kpi { padding: 14px 16px; display: flex; flex-direction: column; gap: 10px; min-width: 0; }
.kpi-head { display: flex; justify-content: space-between; align-items: baseline; gap: 10px; min-width: 0; width: 100%; }
.kpi-head .cb-label { white-space: nowrap; flex-shrink: 0; }
.kpi-side { font-size: 12px; color: var(--color-neutral-700); min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.kpi-num { font-size: 38px; }
.kpi-num.is-signal { color: var(--color-signal); }
.kpi-of { font-size: 20px; color: var(--color-neutral-600); font-weight: 400; }
.kpi-bar { height: 6px; }
.mix { display: flex; height: 6px; gap: 2px; }
.mix > span { display: block; height: 100%; }
.kpi-btn { text-align: left; font: inherit; color: inherit; cursor: pointer; }
.kpi-btn:hover { background: var(--color-bg); }
.kpi-btn.is-alert { box-shadow: inset 0 3px 0 var(--color-signal), var(--shadow-sm); }
.kpi-foot { font-size: 12px; color: var(--color-neutral-800); width: 100%; }
.kpi-acts { display: grid; grid-template-columns: auto minmax(0, 1fr); column-gap: 16px; row-gap: 10px; align-items: end; }
.span-all { grid-column: 1 / -1; }
.hours { display: flex; align-items: flex-end; gap: 3px; height: 34px; }
.hours > span { flex: 1; display: block; }

.board { flex: 1; min-height: 0; display: flex; flex-direction: column; }
.board-scroll { flex: 1; min-height: 0; overflow: auto; position: relative; }
.col-head {
  display: grid; grid-template-columns: var(--board-cols); position: sticky; top: 0; z-index: 5;
  background: var(--color-neutral-100); border-bottom: 1px solid var(--color-divider);
  font-size: 11px; letter-spacing: 0.08em; text-transform: uppercase; color: var(--color-neutral-700);
}
.col-head > div { padding: 10px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.col-head .center { text-align: center; padding-inline: 0; }
.driver-head { padding-inline: 12px !important; }
.notes-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 0 8px 0 12px !important; }
.toggle-all {
  display: inline-flex; align-items: center; gap: 5px; height: 24px; padding: 0 8px; flex-shrink: 0; cursor: pointer;
  font: inherit; letter-spacing: inherit; text-transform: inherit; font-weight: 600;
  color: var(--color-accent-700); background: var(--color-bg); border: 1px solid var(--color-accent-400);
}
.toggle-all:hover { background: var(--color-accent-100); border-color: var(--color-accent); color: var(--color-accent-800); }
.toggle-all:active { background: var(--color-accent-200); }
.empty { padding: 48px; text-align: center; color: var(--color-neutral-700); font-size: 14px; }
.group-empty {
  display: flex; align-items: center; gap: 8px; padding: 10px 16px 10px 64px;
  font-size: 13px; color: var(--color-neutral-700); border-bottom: 1px solid var(--color-hairline);
}

.filters { display: flex; align-items: center; gap: 8px 14px; flex-wrap: wrap; }
.status-seg { flex-wrap: wrap; }
.status-btn { display: inline-flex; align-items: center; gap: 6px; flex: 0 0 auto; }
.status-btn.is-drag { opacity: 0.4; }
.status-count {
  font-size: 11px; font-weight: 500; min-width: 20px; padding: 1px 5px; text-align: center;
  background: var(--color-neutral-200); color: var(--color-neutral-800);
}
.status-btn.is-on .status-count { background: var(--color-accent-800); color: var(--color-bg); }
.attention { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.attention-label { white-space: nowrap; }
.clear-filters { font-size: 13px; }
.check-head { text-align: left; }

.board-foot {
  display: flex; align-items: center; gap: 6px 16px; flex-wrap: wrap; flex-shrink: 0; padding: 8px 14px;
  border-top: 1px solid var(--color-divider); background: var(--color-neutral-200);
  font-size: 12px; color: var(--color-neutral-700);
}
.board-foot .cb-key { font-family: var(--font-body); font-size: 11px; }

@media (max-width: 1240px) {
  .board-page {
    --board-num-col: 44px;
    --board-cols: 44px minmax(170px, 1.4fr) 108px 140px 80px minmax(90px, 1fr) 92px;
  }
  .board-foot { display: none; }
}
@media (max-width: 1100px) {
  .kpis { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
}
/* Narrow: the toolbar wraps under the title, columns get tighter (the board scrolls sideways) */
@media (max-width: 900px) {
  .board-page {
    --board-num-col: 36px;
    --board-cols: 36px minmax(150px, 1.4fr) 96px 124px 72px minmax(110px, 1fr) 88px;
    gap: 10px; padding: 12px;
  }
  .title-block { flex: 1 1 100%; }
  .search { flex: 1 1 200px; width: auto; }
}
@media (max-width: 600px) {
  .kpi { padding: 10px 12px; gap: 6px; }
  .kpi-num { font-size: 28px; }
  .kpi-of { font-size: 16px; }
  .kpi-side { display: none; }
  .kpi-head .cb-label { white-space: normal; flex-shrink: 1; }
}
@media (max-height: 720px) { .kpis { display: none; } }
</style>
