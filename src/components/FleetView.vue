<template>
  <div class="cb-page cb-scroll fleet">
    <!-- Header: title + the one primary action of the open tab -->
    <div class="cb-page-head">
      <div class="title-block">
        <h2 class="cb-title">Fleet</h2>
        <span class="cb-sub">{{ drivers.length }} {{ drivers.length === 1 ? 'driver' : 'drivers' }} in {{ companies.length }} {{ companies.length === 1 ? 'company' : 'companies' }} · {{ inactiveCount }} inactive</span>
      </div>
      <div class="cb-spacer"></div>
      <button v-if="tab === 'drivers'" type="button" class="btn btn-primary" @click="$emit('add-driver', companyFilter)">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" aria-hidden="true"><path d="M5 12h14" /><path d="M12 5v14" /></svg>
        Add driver
      </button>
      <button v-else type="button" class="btn btn-primary" @click="$emit('add-company')">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" aria-hidden="true"><path d="M5 12h14" /><path d="M12 5v14" /></svg>
        Add company
      </button>
    </div>

    <div class="cb-tabs" role="tablist" aria-label="Fleet sections">
      <button type="button" role="tab" :aria-selected="tab === 'drivers'" :class="['cb-tab', { 'is-on': tab === 'drivers' }]" @click="tab = 'drivers'">
        Drivers <span class="cb-tab-count">{{ drivers.length }}</span>
      </button>
      <button type="button" role="tab" :aria-selected="tab === 'companies'" :class="['cb-tab', { 'is-on': tab === 'companies' }]" @click="tab = 'companies'">
        Companies <span class="cb-tab-count">{{ companies.length }}</span>
      </button>
    </div>

    <!-- ================= DRIVERS ================= -->
    <template v-if="tab === 'drivers'">
      <!-- Filters, right above the table -->
      <div class="filters">
        <div class="search">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="search-icon" aria-hidden="true"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></svg>
          <input v-model="search" class="input search-input" placeholder="Search unit, driver or notes" aria-label="Search unit, driver or notes" />
        </div>
        <select v-model="companyFilter" class="input compact" aria-label="Company">
          <option value="">All companies</option>
          <option v-for="c in companies" :key="c.id" :value="c.id">{{ c.name }}</option>
        </select>
        <select v-model="statusFilter" class="input compact" aria-label="Status">
          <option value="">Any status</option>
          <option v-for="st in DRIVER_STATUSES" :key="st.code" :value="st.code">{{ st.code }}</option>
        </select>
        <select v-model="signFilter" class="input compact" aria-label="Sign">
          <option value="">Any sign</option>
          <option v-for="s in SIGN_STATUSES" :key="s.code" :value="s.code">{{ s.label }}</option>
        </select>
        <label class="check-label">
          <input v-model="showInactive" type="checkbox" />
          Show inactive ({{ inactiveCount }})
        </label>
        <button v-if="anyFilter" type="button" class="cb-link" @click="clearFilters">Clear filters</button>
        <span class="cb-spacer"></span>
        <span class="cb-sub">{{ rows.length }} of {{ drivers.length }} shown</span>
      </div>

      <!-- Bulk actions: only while rows are ticked -->
      <div v-if="selected.size" class="bulk" role="region" aria-label="Bulk actions">
        <span class="bulk-count">{{ selected.size }} selected</span>
        <span class="cb-spacer"></span>
        <select class="input compact bulk-select" value="" aria-label="Set status of the selected drivers" @change="bulkStatus($event.target.value); $event.target.value = ''">
          <option value="">Set status…</option>
          <option v-for="st in DRIVER_STATUSES" :key="st.code" :value="st.code">{{ st.code }} – {{ st.label }}</option>
        </select>
        <select class="input compact bulk-select" value="" aria-label="Move the selected drivers to a company" @change="bulkMove($event.target.value); $event.target.value = ''">
          <option value="">Move to company…</option>
          <option v-for="c in companies" :key="c.id" :value="c.id">{{ c.name }}</option>
        </select>
        <button type="button" class="btn bulk-btn" @click="bulkStatus('INACTIVE')">Make inactive</button>
        <button v-if="canManageFleet" type="button" class="btn bulk-btn is-danger" @click="bulkDelete">Delete…</button>
        <button type="button" class="cb-link bulk-clear" @click="selected = new Set()">Clear</button>
      </div>

      <div class="cb-panel table">
        <div class="table-scroll">
          <div class="row head">
            <div class="c-check"><input type="checkbox" :checked="allSelected" :indeterminate.prop="someSelected" aria-label="Select all shown" @change="toggleAll" /></div>
            <button v-for="col in SORTABLE" :key="col.key" type="button" :class="['sort', col.cls]" :aria-sort="sortKey === col.key ? (sortDir > 0 ? 'ascending' : 'descending') : 'none'" @click="sortBy(col.key)">
              {{ col.label }}<span v-if="sortKey === col.key" aria-hidden="true">{{ sortDir > 0 ? ' ↑' : ' ↓' }}</span>
            </button>
            <div>Status</div><div>Sign</div><div>Notes</div><div></div>
          </div>
          <div v-for="r in rows" :key="r.driver.id" :class="['row', { 'is-selected': selected.has(r.driver.id), 'is-inactive': r.driver.status === 'INACTIVE' }]">
            <div class="c-check"><input type="checkbox" :checked="selected.has(r.driver.id)" :aria-label="`Select ${r.label}`" @change="toggleOne(r.driver.id)" /></div>
            <div class="c-unit"><span class="unit">{{ r.driver.unit || '—' }}</span></div>
            <div class="c-name"><button type="button" class="name-link" @click="$emit('open-driver', r.driver.id)">{{ r.driver.name }}</button></div>
            <div class="cb-ellipsis cb-muted">{{ r.company?.name || '—' }}</div>
            <div :class="['c-age', { 'is-overdue': r.fresh.level === 'overdue' && r.driver.status !== 'INACTIVE' }]">{{ r.driver.status === 'INACTIVE' ? '—' : r.fresh.long }}</div>
            <div><span class="status-tag" :style="getStatusConfig(r.driver.status).look">{{ r.driver.status }}</span></div>
            <div><span :class="['sign-tag', r.driver.sign === 'SIGNED' ? 'is-on' : 'is-off']">{{ r.driver.sign }}</span></div>
            <div class="cb-ellipsis cb-muted" :title="r.driver.notes">{{ r.driver.notes || '—' }}</div>
            <div class="c-menu">
              <MoreMenu compact vertical :items="rowMenu(r.driver)" :label="`Actions for ${r.label}`" @select="onRowMenu(r.driver, $event)" />
            </div>
          </div>
          <div v-if="!rows.length" class="cb-empty-state">
            <strong>{{ drivers.length ? 'No drivers match these filters.' : 'No drivers yet.' }}</strong>
            <span v-if="drivers.length">Clear the filters, or add a driver with the button at the top right.</span>
            <span v-else>Add a company first, then add its drivers.</span>
            <button v-if="anyFilter" type="button" class="btn btn-secondary" @click="clearFilters">Clear filters</button>
          </div>
        </div>
      </div>
    </template>

    <!-- ================= COMPANIES ================= -->
    <div v-else class="cb-panel table">
      <div class="table-scroll">
        <div class="crow head">
          <div>Company</div><div class="num">Active</div><div class="num">Inactive</div><div class="num">No sign</div><div class="num">Overdue</div><div></div>
        </div>
        <div v-for="c in companyRows" :key="c.company.id" class="crow">
          <div class="c-company">
            <button type="button" class="name-link" :title="`Show ${c.company.name}'s drivers`" @click="showCompany(c.company.id)">{{ c.company.name }}</button>
            <span v-if="c.company.note" class="tag tag-outline">{{ c.company.note }}</span>
          </div>
          <div class="num">{{ c.active }}</div>
          <div class="num cb-muted">{{ c.inactive || '—' }}</div>
          <div :class="['num', { 'is-signal': c.unsigned }]">{{ c.unsigned || '—' }}</div>
          <div :class="['num', { 'is-signal': c.overdue }]">{{ c.overdue || '—' }}</div>
          <div class="c-actions">
            <button type="button" class="btn btn-ghost" @click="$emit('add-driver', c.company.id)">+ Driver</button>
            <MoreMenu compact vertical :items="companyMenu" :label="`Actions for ${c.company.name}`" @select="onCompanyMenu(c.company, $event)" />
          </div>
        </div>
        <div v-if="!companies.length" class="cb-empty-state">
          <strong>No companies yet.</strong>
          <span>Add one with the button at the top right; drivers are grouped by company on the board.</span>
        </div>
      </div>
      <div class="cb-sub table-foot">Drag companies on the Board to change their order.</div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue';
import MoreMenu from './MoreMenu.vue';
import { DRIVER_STATUSES, SIGN_STATUSES, getStatusConfig, FLAG_COLOR, isFlagged } from '../config/statusConfig';
import { getFreshnessInfo } from '../utils/freshness';
import { driverLabel } from '../utils/format';

const props = defineProps({
  companies: { type: Array, required: true },
  drivers: { type: Array, required: true },
  canManageFleet: { type: Boolean, default: false },
  // Opened from a driver page's company link: start filtered to it
  initialCompanyId: { type: String, default: '' }
});

const emit = defineEmits([
  'open-driver', 'add-driver', 'add-company', 'edit-company', 'delete-company',
  'edit-driver', 'delete-driver', 'update-driver', 'bulk-update', 'bulk-delete'
]);

const tab = ref('drivers');
const search = ref('');
const companyFilter = ref(props.initialCompanyId);
const statusFilter = ref('');
const signFilter = ref('');
const showInactive = ref(false);
const sortKey = ref('');
const sortDir = ref(1);
const selected = ref(new Set());

watch(() => props.initialCompanyId, (id) => {
  companyFilter.value = id;
  tab.value = 'drivers';
});

const SORTABLE = [
  { key: 'unit', label: 'Unit', cls: '' },
  { key: 'name', label: 'Driver', cls: '' },
  { key: 'company', label: 'Company', cls: '' },
  { key: 'age', label: 'Last check', cls: '' }
];

const companyById = computed(() => new Map(props.companies.map(c => [c.id, c])));
const inactiveCount = computed(() => props.drivers.filter(d => d.status === 'INACTIVE').length);
const anyFilter = computed(() => !!(search.value || companyFilter.value || statusFilter.value || signFilter.value));

function clearFilters() {
  search.value = '';
  companyFilter.value = '';
  statusFilter.value = '';
  signFilter.value = '';
}

const rows = computed(() => {
  const q = search.value.trim().toLowerCase();
  const list = props.drivers
    .filter(d => (showInactive.value || statusFilter.value === 'INACTIVE' || d.status !== 'INACTIVE'))
    .filter(d => !companyFilter.value || d.companyId === companyFilter.value)
    .filter(d => !statusFilter.value || d.status === statusFilter.value)
    .filter(d => !signFilter.value || d.sign === signFilter.value)
    .filter(d => !q || `${d.unit} ${d.name} ${d.notes}`.toLowerCase().includes(q))
    .map(d => ({ driver: d, company: companyById.value.get(d.companyId), fresh: getFreshnessInfo(d.lastCheckedAt), label: driverLabel(d) }));
  if (!sortKey.value) return list;
  const val = {
    unit: r => r.driver.unit || '',
    name: r => r.driver.name || '',
    company: r => r.company?.name || '',
    age: r => (r.driver.lastCheckedAt ? Date.parse(r.driver.lastCheckedAt) : 0)
  }[sortKey.value];
  return [...list].sort((a, b) => {
    const x = val(a);
    const y = val(b);
    const cmp = typeof x === 'number' ? x - y : String(x).localeCompare(String(y), undefined, { numeric: true });
    return cmp * sortDir.value;
  });
});

function sortBy(key) {
  if (sortKey.value === key) {
    if (sortDir.value === 1) sortDir.value = -1;
    else { sortKey.value = ''; sortDir.value = 1; }
  } else {
    sortKey.value = key;
    sortDir.value = 1;
  }
}

// ---------------- selection & bulk actions ----------------
// Drop ticks for drivers that are filtered out or gone
watch(rows, (list) => {
  const shown = new Set(list.map(r => r.driver.id));
  if ([...selected.value].some(id => !shown.has(id))) {
    selected.value = new Set([...selected.value].filter(id => shown.has(id)));
  }
});

const allSelected = computed(() => rows.value.length > 0 && rows.value.every(r => selected.value.has(r.driver.id)));
const someSelected = computed(() => selected.value.size > 0 && !allSelected.value);

function toggleAll() {
  selected.value = allSelected.value ? new Set() : new Set(rows.value.map(r => r.driver.id));
}

function toggleOne(id) {
  const next = new Set(selected.value);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  selected.value = next;
}

function selectedDrivers() {
  return props.drivers.filter(d => selected.value.has(d.id));
}

function bulkStatus(status) {
  if (!status) return;
  const list = selectedDrivers().filter(d => d.status !== status).map(d => ({ ...d, status }));
  if (list.length) emit('bulk-update', list);
  selected.value = new Set();
}

function bulkMove(companyId) {
  if (!companyId) return;
  const list = selectedDrivers().filter(d => d.companyId !== companyId).map(d => ({ ...d, companyId }));
  if (list.length) emit('bulk-update', list);
  selected.value = new Set();
}

function bulkDelete() {
  emit('bulk-delete', [...selected.value]);
}

// ---------------- row menus ----------------
function rowMenu(driver) {
  return [
    { id: 'open', label: 'Open driver page' },
    { id: 'edit', label: 'Edit driver' },
    { id: 'flag', label: isFlagged(driver) ? 'Remove flag' : 'Flag driver' },
    { id: 'inactive', label: driver.status === 'INACTIVE' ? 'Make active (Ready)' : 'Make inactive' },
    ...(props.canManageFleet ? [{ id: 'div', divider: true }, { id: 'delete', label: 'Delete driver…', danger: true }] : [])
  ];
}

function onRowMenu(driver, id) {
  if (id === 'open') emit('open-driver', driver.id);
  else if (id === 'edit') emit('edit-driver', driver);
  else if (id === 'flag') emit('update-driver', { ...driver, highlightColor: isFlagged(driver) ? '' : FLAG_COLOR });
  else if (id === 'inactive') emit('update-driver', { ...driver, status: driver.status === 'INACTIVE' ? 'READY' : 'INACTIVE', lastCheckedAt: new Date().toISOString() });
  else if (id === 'delete') emit('delete-driver', driver.id);
}

// ---------------- companies ----------------
const companyRows = computed(() => props.companies.map(company => {
  const list = props.drivers.filter(d => d.companyId === company.id);
  const active = list.filter(d => d.status !== 'INACTIVE');
  return {
    company,
    active: active.length,
    inactive: list.length - active.length,
    unsigned: active.filter(d => d.sign !== 'SIGNED').length,
    overdue: active.filter(d => getFreshnessInfo(d.lastCheckedAt).level === 'overdue').length
  };
}));

const companyMenu = computed(() => [
  { id: 'show', label: "Show its drivers" },
  ...(props.canManageFleet ? [
    { id: 'edit', label: 'Rename or edit note' },
    { id: 'div', divider: true },
    { id: 'delete', label: 'Delete company…', danger: true }
  ] : [])
]);

function showCompany(id) {
  clearFilters();
  companyFilter.value = id;
  tab.value = 'drivers';
}

function onCompanyMenu(company, id) {
  if (id === 'show') showCompany(company.id);
  else if (id === 'edit') emit('edit-company', company);
  else if (id === 'delete') emit('delete-company', company.id);
}
</script>

<style scoped>
.title-block { display: flex; flex-direction: column; gap: 1px; min-width: 0; }
.filters { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.search { position: relative; width: 260px; min-width: 160px; }
.search-icon { position: absolute; left: 10px; top: 50%; transform: translateY(-50%); color: var(--color-neutral-600); }
.search-input { padding-left: 32px; min-height: 34px; font-size: 13px; background: var(--color-neutral-100); }
.compact { width: auto; min-height: 34px; font-size: 13px; background-color: var(--color-neutral-100); }
.check-label { display: flex; align-items: center; gap: 6px; font-size: 13px; cursor: pointer; white-space: nowrap; }
.check-label input, .c-check input { width: 16px; height: 16px; accent-color: var(--color-accent); cursor: pointer; }

.bulk {
  display: flex; align-items: center; gap: 8px; flex-wrap: wrap; padding: 8px 12px;
  background: var(--color-accent-900); color: var(--color-bg);
}
.bulk-count { font-weight: 600; font-size: 14px; }
.bulk-select { background-color: var(--color-accent-800); color: var(--color-bg); border-color: var(--color-accent-600); }
.bulk-btn { color: var(--color-bg); border-color: var(--color-accent-600); }
.bulk-btn:hover { background: var(--color-accent-800); }
.bulk-btn.is-danger { color: var(--color-signal-soft); border-color: var(--color-signal-soft); }
.bulk-clear { color: var(--color-accent-200); }

.table { display: flex; flex-direction: column; }
.table-scroll { overflow-x: auto; }
.row {
  display: grid; align-items: center; min-height: 46px; min-width: 1040px; font-size: 14px;
  grid-template-columns: 44px 90px minmax(170px, 1.3fr) minmax(150px, 1.1fr) 150px 140px 104px minmax(140px, 1.4fr) 48px;
  border-bottom: 1px solid var(--color-hairline);
}
.row > * { padding: 0 10px; min-width: 0; }
.row:hover:not(.head) { background: var(--color-bg); }
.row.is-selected { background: var(--color-accent-100); }
.row.is-inactive .c-name, .row.is-inactive .c-unit { opacity: 0.7; }
.head { min-height: 0; font-size: 11px; letter-spacing: 0.08em; text-transform: uppercase; color: var(--color-neutral-700); border-bottom-color: var(--color-divider); }
.head > * { padding-top: 10px; padding-bottom: 10px; }
/* Column order in the head: check, Unit, Driver, Company, Last check, Status, Sign, Notes, menu */
.sort {
  border: 0; background: transparent; cursor: pointer; text-align: left; font: inherit; letter-spacing: inherit; text-transform: inherit; color: inherit;
}
.sort:hover { color: var(--color-text); }
.c-check { display: grid; place-items: center; padding: 0; }
.unit {
  font-family: var(--font-heading); font-weight: 600; font-size: 14px; padding: 1px 6px;
  color: var(--color-accent-800); background: var(--color-accent-100); border: 1px solid var(--color-accent-200);
}
.name-link {
  border: 0; background: transparent; padding: 0; cursor: pointer; text-align: left; max-width: 100%;
  font: inherit; font-weight: 500; color: var(--color-text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.name-link:hover { color: var(--color-accent-700); text-decoration: underline; text-underline-offset: 2px; }
.c-age { font-size: 13px; color: var(--color-neutral-800); }
.c-age.is-overdue { color: var(--color-signal); font-weight: 600; }
.status-tag { display: inline-block; padding: 3px 8px; font-family: var(--font-heading); font-weight: 600; font-size: 12px; letter-spacing: 0.06em; white-space: nowrap; }
.sign-tag { display: inline-block; padding: 3px 8px; font-family: var(--font-heading); font-weight: 600; font-size: 12px; letter-spacing: 0.06em; white-space: nowrap; }
.sign-tag.is-on { color: var(--color-accent-800); border: 1px solid var(--color-accent-400); }
.sign-tag.is-off { color: var(--color-signal); border: 1px dashed var(--color-signal); }
.c-menu { display: grid; place-items: center; padding: 0; }

.crow {
  display: grid; align-items: center; min-height: 48px; min-width: 760px; font-size: 14px;
  grid-template-columns: minmax(240px, 2fr) 90px 90px 90px 90px 170px;
  border-bottom: 1px solid var(--color-hairline);
}
.crow > * { padding: 0 12px; min-width: 0; }
.crow:hover:not(.head) { background: var(--color-bg); }
.c-company { display: flex; align-items: center; gap: 8px; min-width: 0; }
.num { text-align: right; font-family: var(--font-heading); font-size: 16px; }
.head .num { font-family: var(--font-body); font-size: 11px; }
.is-signal { color: var(--color-signal); font-weight: 600; }
.c-actions { display: flex; align-items: center; justify-content: flex-end; gap: 4px; }
.table-foot { padding: 10px 14px; font-size: 12px; }
</style>
