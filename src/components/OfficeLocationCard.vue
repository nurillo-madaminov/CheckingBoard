<template>
  <section class="cb-panel office" aria-labelledby="office-title" @keydown.esc="onEscape">
    <div class="office-head">
      <div class="title-block">
        <h3 id="office-title" class="office-title">Office location</h3>
        <span class="cb-sub">Where your team works. Check-ins will only count inside this circle.</span>
      </div>
      <div class="cb-spacer"></div>
      <div class="head-actions">
        <span v-if="isDirty" class="unsaved">{{ saveBlocker || 'Unsaved changes' }}</span>
        <button type="button" class="btn btn-secondary" :disabled="!isDirty || isSaving" @click="discard">Discard</button>
        <button type="button" class="btn btn-primary" :disabled="!canSave" @click="save">{{ isSaving ? 'Saving…' : 'Save office' }}</button>
      </div>
    </div>

    <div v-if="loadError" class="cb-error">{{ loadError }}</div>

    <div class="office-body">
      <!-- Map: click (or Enter on the focused map) to pin; drag the pin to move it -->
      <div class="map-wrap">
        <div
          ref="mapEl"
          class="map"
          tabindex="0"
          role="application"
          aria-label="Office map. Arrow keys pan, plus and minus zoom, Enter pins the office at the map center. Drag the pin to move it."
          @keydown.enter.self.prevent="pinAtCenter"
        ></div>
        <span v-if="!hasPin" class="map-hint">Click the map to pin the office</span>
      </div>

      <div class="form">
        <div class="field">
          <label for="office-name">Office name</label>
          <input id="office-name" v-model="draft.name" class="input" maxlength="80" placeholder="e.g. Tashkent office" />
        </div>

        <div class="field">
          <label for="office-radius">Allowed check-in radius</label>
          <div class="radius-row">
            <input
              v-model.number="draft.radius"
              type="range"
              class="range"
              :min="OFFICE_RADIUS_MIN"
              :max="OFFICE_RADIUS_MAX"
              step="10"
              aria-label="Allowed check-in radius in meters"
            />
            <div class="radius-num">
              <input
                id="office-radius"
                v-model.number="draft.radius"
                type="number"
                class="input"
                :min="OFFICE_RADIUS_MIN"
                :max="OFFICE_RADIUS_MAX"
                step="1"
                @blur="clampRadius"
              />
              <span class="unit">m</span>
            </div>
          </div>
          <span class="hint">
            {{ OFFICE_RADIUS_MIN }}–{{ OFFICE_RADIUS_MAX }} m. Indoor GPS is often off by 20–100 m, so a very small
            radius turns away people who really are in the office. 100–200 m is a safe start.
          </span>
        </div>

        <div class="coords">
          <div class="field">
            <label for="office-lat">Latitude</label>
            <input
              id="office-lat"
              v-model="latText"
              class="input"
              inputmode="decimal"
              placeholder="41.311081"
              @change="applyTypedCoords"
              @keydown.enter.prevent="applyTypedCoords"
            />
          </div>
          <div class="field">
            <label for="office-lng">Longitude</label>
            <input
              id="office-lng"
              v-model="lngText"
              class="input"
              inputmode="decimal"
              placeholder="69.240562"
              @change="applyTypedCoords"
              @keydown.enter.prevent="applyTypedCoords"
            />
          </div>
        </div>
        <span v-if="coordError" class="hint is-error" role="alert">{{ coordError }}</span>

        <button type="button" class="btn btn-secondary locate" :disabled="isLocating" @click="useMyLocation">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="7" /><circle cx="12" cy="12" r="2" /><path d="M12 2v3" /><path d="M12 19v3" /><path d="M2 12h3" /><path d="M19 12h3" /></svg>
          {{ isLocating ? 'Finding your location…' : 'Use my current location' }}
        </button>
        <span v-if="locateMessage" :class="['hint', { 'is-error': locateIsError }]" role="status">{{ locateMessage }}</span>
      </div>
    </div>

    <div class="office-foot">
      <span class="cb-sub">{{ statusLine }}</span>
      <button v-if="saved" type="button" class="btn btn-ghost btn-danger" :disabled="isSaving" @click="askRemove">Remove office</button>
    </div>

    <ConfirmDialog
      v-if="confirmState"
      :title="confirmState.title"
      :body="confirmState.body"
      :okLabel="confirmState.ok"
      @confirm="runConfirm"
      @cancel="confirmState = null"
    />
  </section>
</template>

<script setup>
import { ref, reactive, computed, watch, onMounted, onUnmounted, nextTick } from 'vue';
import * as L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import ConfirmDialog from './ConfirmDialog.vue';
import {
  OFFICE_RADIUS_MIN, OFFICE_RADIUS_MAX, OFFICE_RADIUS_DEFAULT,
  fetchOfficeLocation, setOfficeLocation, clearOfficeLocation
} from '../services/officeService';
import { staffProfiles } from '../services/authService';
import { formatTashkentDateTime, formatEasternDateTime } from '../config/shifts';

const emit = defineEmits(['saved', 'error']);

// Where the map opens before an office is pinned
const DEFAULT_CENTER = [41.311081, 69.240562];
const round6 = n => Math.round(n * 1e6) / 1e6;

const saved = ref(null); // { name, lat, lng, radiusM, updatedAt, updatedBy } or null
const draft = reactive({ name: '', lat: null, lng: null, radius: OFFICE_RADIUS_DEFAULT });
const latText = ref('');
const lngText = ref('');
const coordError = ref('');
const loadError = ref('');
const isSaving = ref(false);
const isLocating = ref(false);
const locateMessage = ref('');
const locateIsError = ref(false);
const confirmState = ref(null); // { title, body, ok, onConfirm }

const mapEl = ref(null);
let map = null;
let marker = null;
let circle = null;
let resizeObserver = null;

const hasPin = computed(() => draft.lat !== null && draft.lng !== null);
const radiusValid = computed(() => Number.isInteger(draft.radius)
  && draft.radius >= OFFICE_RADIUS_MIN && draft.radius <= OFFICE_RADIUS_MAX);

const isDirty = computed(() => {
  const s = saved.value;
  return draft.name.trim() !== (s?.name || '')
    || draft.lat !== (s ? round6(s.lat) : null)
    || draft.lng !== (s ? round6(s.lng) : null)
    || draft.radius !== (s?.radiusM ?? OFFICE_RADIUS_DEFAULT);
});

// Why Save is off while there are changes (mirrors the database checks)
const saveBlocker = computed(() => {
  if (!hasPin.value) return 'Pin the office on the map';
  if (!draft.name.trim()) return 'Add an office name';
  if (!radiusValid.value) return `Radius must be ${OFFICE_RADIUS_MIN}–${OFFICE_RADIUS_MAX} m`;
  if (coordError.value) return 'Fix the coordinates';
  return '';
});

const canSave = computed(() => isDirty.value && !isSaving.value && !saveBlocker.value);

const statusLine = computed(() => {
  const s = saved.value;
  if (!s) return 'No office set yet. Pin it on the map or use your current location, then save.';
  if (!s.updatedAt) return `${s.name} · ${s.radiusM} m radius`;
  const who = staffProfiles.value.find(p => p.id === s.updatedBy)?.displayName || 'a former manager';
  return `Last set by ${who} on ${formatTashkentDateTime(s.updatedAt)} Tashkent · ${formatEasternDateTime(s.updatedAt)} ET`;
});

// ---------------- map ----------------
function drawPin() {
  if (!map) return;
  if (!hasPin.value) {
    marker?.remove();
    circle?.remove();
    marker = null;
    circle = null;
    return;
  }
  const at = [draft.lat, draft.lng];
  if (!marker) {
    marker = L.marker(at, {
      draggable: true,
      keyboard: true,
      title: 'Office (drag to move)',
      icon: L.divIcon({ className: 'office-pin', html: '<span></span>', iconSize: [18, 18], iconAnchor: [9, 9] })
    }).addTo(map);
    // Live while dragging, so the circle and the coordinates follow the pin
    marker.on('drag dragend', e => {
      const p = e.target.getLatLng();
      setCoords(p.lat, p.lng);
      circle?.setLatLng(p);
    });
  } else {
    marker.setLatLng(at);
  }
  const radius = radiusValid.value ? draft.radius : OFFICE_RADIUS_DEFAULT;
  if (!circle) {
    circle = L.circle(at, { radius, className: 'office-radius', interactive: false }).addTo(map);
  } else {
    circle.setLatLng(at);
    circle.setRadius(radius);
  }
}

function fitToOffice() {
  if (map && circle) map.fitBounds(circle.getBounds(), { padding: [24, 24], maxZoom: 18 });
}

function setCoords(lat, lng) {
  draft.lat = round6(lat);
  draft.lng = round6(lng);
  latText.value = draft.lat.toFixed(6);
  lngText.value = draft.lng.toFixed(6);
  coordError.value = '';
}

function setPin(lat, lng) {
  setCoords(lat, lng);
  drawPin();
}

function pinAtCenter() {
  if (!map) return;
  const c = map.getCenter();
  setPin(c.lat, c.lng);
}

watch(() => draft.radius, () => {
  if (circle && radiusValid.value) circle.setRadius(draft.radius);
});

// ---------------- inputs ----------------
function clampRadius() {
  const n = Math.round(Number(draft.radius));
  draft.radius = Number.isFinite(n)
    ? Math.min(OFFICE_RADIUS_MAX, Math.max(OFFICE_RADIUS_MIN, n))
    : OFFICE_RADIUS_DEFAULT;
}

// Typed coordinates move the pin once both are valid (a comma works as the decimal mark)
function applyTypedCoords() {
  const raw = [latText.value, lngText.value].map(t => String(t).trim().replace(',', '.'));
  if (!raw[0] && !raw[1]) {
    coordError.value = '';
    return;
  }
  if (!raw[0] || !raw[1]) {
    coordError.value = 'Enter both latitude and longitude.';
    return;
  }
  const [lat, lng] = raw.map(Number);
  if (!Number.isFinite(lat) || lat < -90 || lat > 90) {
    coordError.value = 'Latitude must be a number between -90 and 90.';
    return;
  }
  if (!Number.isFinite(lng) || lng < -180 || lng > 180) {
    coordError.value = 'Longitude must be a number between -180 and 180.';
    return;
  }
  setPin(lat, lng);
  map?.panTo([draft.lat, draft.lng]);
}

// Only on click; nothing is asked for until the manager wants it
function useMyLocation() {
  locateMessage.value = '';
  locateIsError.value = false;
  if (!window.isSecureContext || !('geolocation' in navigator)) {
    locateIsError.value = true;
    locateMessage.value = 'This browser can\'t share its location here (it needs a secure https page). Pin the office on the map instead.';
    return;
  }
  isLocating.value = true;
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      isLocating.value = false;
      setPin(pos.coords.latitude, pos.coords.longitude);
      fitToOffice();
      const accuracy = Math.round(pos.coords.accuracy);
      locateMessage.value = accuracy > draft.radius
        ? `Pinned your location, but it is only accurate to about ${accuracy} m. Check the pin is on the office and drag it if needed.`
        : `Pinned your location (accurate to about ${accuracy} m).`;
    },
    (err) => {
      isLocating.value = false;
      locateIsError.value = true;
      locateMessage.value = err.code === 1
        ? 'Location access was denied. Allow location for this site in your browser settings, or pin the office on the map.'
        : err.code === 3
          ? 'Finding your location took too long. Try again, or pin the office on the map.'
          : 'Your location is not available right now. Pin the office on the map instead.';
    },
    { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
  );
}

// ---------------- load / save ----------------
function resetDraft() {
  const s = saved.value;
  draft.name = s?.name || '';
  draft.radius = s?.radiusM ?? OFFICE_RADIUS_DEFAULT;
  if (s) {
    setCoords(s.lat, s.lng);
  } else {
    draft.lat = null;
    draft.lng = null;
    latText.value = '';
    lngText.value = '';
    coordError.value = '';
  }
  locateMessage.value = '';
  drawPin();
  if (s) fitToOffice();
}

function discard() {
  resetDraft();
}

async function load() {
  try {
    saved.value = await fetchOfficeLocation();
    loadError.value = '';
  } catch (err) {
    saved.value = null;
    loadError.value = err.message;
  }
  resetDraft();
}

async function save() {
  if (!canSave.value) return;
  isSaving.value = true;
  try {
    await setOfficeLocation({ name: draft.name, lat: draft.lat, lng: draft.lng, radiusM: draft.radius });
    emit('saved', { title: 'Office location saved', message: `${draft.name.trim()} · ${draft.radius} m radius` });
  } catch (err) {
    emit('error', { title: 'Office not saved', message: err.message });
  } finally {
    // Either way, show what the database now holds
    await load();
    isSaving.value = false;
  }
}

function askRemove() {
  confirmState.value = {
    title: 'Remove the office location?',
    body: 'The pin and radius are deleted. Check-ins will have no office to measure against until a manager sets one again.',
    ok: 'Remove office',
    onConfirm: async () => {
      isSaving.value = true;
      try {
        await clearOfficeLocation();
        emit('saved', { title: 'Office location removed', message: 'No office is set for check-ins' });
      } catch (err) {
        emit('error', { title: 'Office not removed', message: err.message });
      } finally {
        await load();
        isSaving.value = false;
      }
    }
  };
}

async function runConfirm() {
  const state = confirmState.value;
  confirmState.value = null;
  if (state) await state.onConfirm();
}

// Esc discards unsaved edits, after confirming (the open dialog handles its own Esc)
function onEscape() {
  if (confirmState.value || !isDirty.value) return;
  confirmState.value = {
    title: 'Discard unsaved changes?',
    body: 'Your changes to the office location will be lost.',
    ok: 'Discard changes',
    onConfirm: discard
  };
}

onMounted(async () => {
  map = L.map(mapEl.value, { center: DEFAULT_CENTER, zoom: 12, scrollWheelZoom: true });
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
  }).addTo(map);
  map.on('click', e => setPin(e.latlng.lat, e.latlng.lng));
  // The card can change size (sidebar, window); keep the tiles filling it
  resizeObserver = new ResizeObserver(() => map?.invalidateSize());
  resizeObserver.observe(mapEl.value);
  await nextTick();
  map.invalidateSize();
  await load();
});

onUnmounted(() => {
  resizeObserver?.disconnect();
  map?.remove();
  map = null;
  marker = null;
  circle = null;
});
</script>

<style scoped>
.office { padding: 16px; display: flex; flex-direction: column; gap: 14px; }
.office-head { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
.title-block { display: flex; flex-direction: column; gap: 1px; min-width: 0; }
.office-title { margin: 0; font-family: var(--font-heading); font-weight: 600; font-size: 22px; line-height: 1.1; text-transform: uppercase; }
.head-actions { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.unsaved { font-size: 13px; color: var(--color-accent-700); }

.office-body { display: grid; grid-template-columns: minmax(0, 1.5fr) minmax(280px, 1fr); gap: 16px; align-items: start; }

/* isolate: Leaflet's panes use z-index 400+, which must not cover dialogs and drawers */
.map-wrap { position: relative; isolation: isolate; border: 1px solid var(--color-divider); }
.map { height: 360px; background: var(--color-neutral-200); }
.map:focus-visible { outline: 2px solid var(--color-accent); outline-offset: 2px; }
.map-hint {
  position: absolute; left: 50%; top: 12px; transform: translateX(-50%); z-index: 500; pointer-events: none;
  padding: 4px 10px; font-size: 12px; background: var(--color-neutral-100); color: var(--color-text);
  border: 1px solid var(--color-divider); box-shadow: var(--shadow-sm); white-space: nowrap;
}

/* Leaflet in the Industry look: square, hairline, steel */
.map { font-family: var(--font-body); }
.map :deep(.leaflet-bar) { border-radius: 0; border: 1px solid var(--color-divider); box-shadow: var(--shadow-sm); }
.map :deep(.leaflet-bar a) { border-radius: 0 !important; color: var(--color-text); background: var(--color-neutral-100); }
.map :deep(.leaflet-bar a:hover) { background: var(--color-neutral-200); }
.map :deep(.leaflet-control-attribution) { font-size: 11px; background: color-mix(in srgb, var(--color-neutral-100) 85%, transparent); }
.map :deep(.leaflet-control-attribution a) { color: var(--color-accent-700); }
.map :deep(.office-pin) { background: transparent; border: 0; }
.map :deep(.office-pin span) {
  display: block; width: 18px; height: 18px; box-sizing: border-box; cursor: grab;
  background: var(--color-accent); border: 2px solid var(--color-bg); box-shadow: 0 0 0 1px var(--color-accent-900), var(--shadow-md);
}
.map :deep(.office-pin:focus-visible) { outline: 2px solid var(--color-accent-900); outline-offset: 2px; }
.map :deep(.office-radius) { stroke: var(--color-accent); stroke-width: 2; fill: var(--color-accent); fill-opacity: 0.12; }

.form { display: flex; flex-direction: column; gap: 14px; min-width: 0; }
.radius-row { display: flex; align-items: center; gap: 10px; }
.range { flex: 1; min-width: 0; accent-color: var(--color-accent); }
.radius-num { display: flex; align-items: center; gap: 6px; flex-shrink: 0; }
.radius-num .input { width: 84px; }
.unit { font-size: 13px; color: var(--color-neutral-700); }
.hint { font-size: 12px; line-height: 1.45; color: var(--color-neutral-700); margin-top: 5px; }
.hint.is-error { color: var(--color-signal); margin-top: 0; }
.coords { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.locate { align-self: flex-start; }

.office-foot { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; border-top: 1px solid var(--color-hairline); padding-top: 12px; }

@media (max-width: 900px) {
  .office-body { grid-template-columns: 1fr; }
  .map { height: 300px; }
}
@media (max-width: 600px) {
  .office { padding: 12px; }
  .map { height: 240px; }
  .coords { grid-template-columns: 1fr; }
}
</style>
