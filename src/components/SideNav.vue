<template>
  <aside :class="['side', 'cb-scroll', { 'is-collapsed': collapsed }]">
    <!-- Brand + open / close -->
    <div class="brand">
      <span class="brand-mark">CB</span>
      <div class="brand-text fade">
        <span class="brand-name">CheckingBoard</span>
        <span class="brand-team">{{ teamName || 'Team' }}</span>
      </div>
      <button
        class="collapse-btn"
        :title="collapsed ? 'Open sidebar' : 'Close sidebar'"
        :aria-label="collapsed ? 'Open sidebar' : 'Close sidebar'"
        @click="$emit('update:collapsed', !collapsed)"
      >
        <svg v-if="collapsed" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="m6 17 5-5-5-5" /><path d="m13 17 5-5-5-5" /></svg>
        <svg v-else width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="m11 17-5-5 5-5" /><path d="m18 17-5-5 5-5" /></svg>
      </button>
    </div>

    <!-- Views -->
    <nav class="nav">
      <button :class="['nav-item', { 'is-on': activeView === 'fleet' }]" title="Board" @click="$emit('navigate', 'fleet')">
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="3" rx="1" /><path d="M3 9h18" /><path d="M3 15h18" /><path d="M9 3v18" /></svg>
        <span class="nav-label fade">Board</span>
        <span class="nav-count fade">{{ boardCount }}</span>
      </button>
      <button :class="['nav-item', { 'is-on': activeView === 'activity_log' }]" title="Logs" @click="$emit('navigate', 'activity_log')">
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M15 12h-5" /><path d="M15 8h-5" /><path d="M19 17V5a2 2 0 0 0-2-2H4" /><path d="M8 21h12a2 2 0 0 0 2-2v-1a1 1 0 0 0-1-1H11a1 1 0 0 0-1 1v1a2 2 0 1 1-4 0V5a2 2 0 1 0-4 0v2a1 1 0 0 0 1 1h3" /></svg>
        <span class="nav-label fade">Logs</span>
        <span class="nav-count fade">{{ logsToday }}</span>
      </button>
      <template v-if="isManager">
        <button :class="['nav-item', { 'is-on': activeView === 'shifts' }]" title="Shifts" @click="$emit('navigate', 'shifts')">
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 7.5V6a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h3.5" /><path d="M16 2v4" /><path d="M8 2v4" /><path d="M3 10h5" /><path d="M17.5 17.5 16 16.3V14" /><circle cx="16" cy="16" r="6" /></svg>
          <span class="nav-label fade">Shifts</span>
        </button>
        <button :class="['nav-item', { 'is-on': activeView === 'statistics' }]" title="Statistics" @click="$emit('navigate', 'statistics')">
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3v16a2 2 0 0 0 2 2h16" /><path d="M18 17V9" /><path d="M13 17V5" /><path d="M8 17v-3" /></svg>
          <span class="nav-label fade">Statistics</span>
        </button>
      </template>
      <button :class="['nav-item', { 'is-on': activeView === 'extensions' }]" title="Extensions" @click="$emit('navigate', 'extensions')">
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M15.39 4.39a1 1 0 0 0 1.68-.474 2.5 2.5 0 1 1 3.014 3.015 1 1 0 0 0-.474 1.68l1.683 1.682a2.414 2.414 0 0 1 0 3.414L19.61 15.39a1 1 0 0 1-1.68-.474 2.5 2.5 0 1 0-3.014 3.015 1 1 0 0 1 .474 1.68l-1.683 1.682a2.414 2.414 0 0 1-3.414 0L8.61 19.61a1 1 0 0 0-1.68.474 2.5 2.5 0 1 1-3.014-3.015 1 1 0 0 0 .474-1.68l-1.683-1.682a2.414 2.414 0 0 1 0-3.414L4.39 8.61a1 1 0 0 1 1.68.474 2.5 2.5 0 1 0 3.014-3.015 1 1 0 0 1-.474-1.68l1.683-1.682a2.414 2.414 0 0 1 3.414 0z" /></svg>
        <span class="nav-label fade">Extensions</span>
      </button>
      <button :class="['nav-item', { 'is-on': notificationsOpen }]" title="Notifications" @click="$emit('open-notifications')">
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M10.268 21a2 2 0 0 0 3.464 0" /><path d="M3.262 15.326A1 1 0 0 0 4 17h16a1 1 0 0 0 .74-1.673C19.41 13.956 18 12.499 18 8A6 6 0 0 0 6 8c0 4.499-1.411 5.956-2.738 7.326" /></svg>
        <span class="nav-label fade">Notifications</span>
        <span v-if="unreadCount" class="nav-badge">{{ unreadCount > 99 ? '99+' : unreadCount }}</span>
      </button>
    </nav>

    <!-- Shift on duty -->
    <div class="block fade">
      <div class="row-between">
        <span class="kicker">On duty</span>
        <span class="dim">{{ duty.left }}</span>
      </div>
      <div class="duty">
        <div class="row-between">
          <span class="duty-label">{{ dutyShift.label }}</span>
          <span class="duty-range">{{ dutyHours }}</span>
        </div>
        <span class="duty-bar"><span :style="{ width: `${duty.pct}%` }"></span></span>
      </div>
      <div class="tall-only duty-staff">
        <div v-for="p in dutyStaff" :key="p.id" class="duty-person">
          <span class="cb-avatar duty-avatar">{{ p.initials }}</span>
          <div class="duty-person-text">
            <span class="cb-ellipsis duty-name">{{ p.name }}</span>
            <span class="dim small">{{ p.count }} {{ p.count === 1 ? 'action' : 'actions' }} this shift</span>
          </div>
        </div>
        <span v-if="!dutyStaff.length" class="dim small">Nobody scheduled</span>
      </div>
    </div>

    <!-- Clocks -->
    <div class="block clocks tall-only fade">
      <div class="clock"><span class="kicker">Tashkent</span><span class="clock-time">{{ clocks.tas }}</span></div>
      <div class="clock"><span class="kicker">Eastern</span><span class="clock-time">{{ clocks.et }}</span></div>
    </div>

    <div class="cb-spacer"></div>

    <div class="live tall-only" :title="isLive ? 'Live · synced with your team' : 'Connecting to live updates…'">
      <span :class="['live-dot', { 'is-live': isLive }]"></span>
      <span class="fade">{{ isLive ? 'Live · synced with your team' : 'Connecting to live updates…' }}</span>
    </div>

    <!-- Me -->
    <div class="me">
      <button class="me-btn" title="Team &amp; staff" @click="$emit('open-staff')">
        <span class="cb-avatar me-avatar">{{ myInitials }}</span>
        <span class="me-text fade">
          <span class="cb-ellipsis me-name">{{ currentUser?.displayName }}</span>
          <span class="dim small me-role">{{ currentUser?.role }} · Team &amp; staff</span>
        </span>
      </button>
      <button class="signout" title="Sign out" @click="$emit('logout')">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" x2="9" y1="12" y2="12" /></svg>
      </button>
    </div>
  </aside>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { getShiftConfig, shiftProgress, shiftHours, clockTashkent, clockEastern } from '../config/shifts';
import { initials } from '../utils/format';

const props = defineProps({
  activeView: { type: String, default: 'fleet' },
  currentUser: { type: Object, default: null },
  teamName: { type: String, default: '' },
  isLive: { type: Boolean, default: false },
  boardCount: { type: Number, default: 0 },
  // Today's action records (staff: their own and their shift-mates', manager: the team)
  todayActivities: { type: Array, default: () => [] },
  roster: { type: Array, default: () => [] },
  // Closed = a slim icon rail
  collapsed: { type: Boolean, default: false },
  unreadCount: { type: Number, default: 0 },
  notificationsOpen: { type: Boolean, default: false }
});

defineEmits(['navigate', 'open-staff', 'logout', 'open-notifications', 'update:collapsed']);

const now = ref(new Date());
let timer = null;
onMounted(() => { timer = setInterval(() => { now.value = new Date(); }, 15000); });
onUnmounted(() => clearInterval(timer));

const isManager = computed(() => props.currentUser?.role === 'manager');
const myInitials = computed(() => initials(props.currentUser?.displayName));
const duty = computed(() => shiftProgress(now.value));
const dutyShift = computed(() => getShiftConfig(duty.value.code));
const dutyHours = computed(() => shiftHours(duty.value.code, duty.value.day).tashkent);
const clocks = computed(() => ({ tas: clockTashkent(now.value), et: clockEastern(now.value) }));
const logsToday = computed(() => props.todayActivities.length);

const dutyStaff = computed(() => {
  const day = duty.value.day;
  return props.roster
    .filter(p => p.isActive && p.shiftCode === duty.value.code)
    .map(p => ({
      id: p.id,
      name: p.displayName,
      initials: initials(p.displayName),
      count: props.todayActivities.filter(a =>
        a.staff_user_id === p.id && a.shift_code === duty.value.code && a.shift_date === day
      ).length
    }));
});
</script>

<style scoped>
.side {
  width: 236px; flex-shrink: 0; display: flex; flex-direction: column; min-height: 0;
  overflow-y: auto; overflow-x: hidden;
  background: var(--color-accent-900); color: var(--color-bg);
}
.brand { display: flex; align-items: center; gap: 10px; padding: 18px 16px 16px; }
.brand-mark {
  width: 32px; height: 32px; display: grid; place-items: center; flex-shrink: 0;
  background: var(--color-accent); font-family: var(--font-heading); font-weight: 600; font-size: 14px;
}
.brand-text { display: flex; flex-direction: column; line-height: 1.15; min-width: 0; }
.brand-name { font-family: var(--font-heading); font-weight: 600; font-size: 17px; }
.brand-team { font-size: 12px; color: var(--color-accent-300); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

.nav { display: flex; flex-direction: column; gap: 2px; padding: 6px 8px; }
.nav-item {
  display: flex; align-items: center; gap: 10px; width: 100%; padding: 9px 10px;
  border: 0; cursor: pointer; font: inherit; font-size: 14px; font-weight: 500; text-align: left;
  background: transparent; color: var(--color-accent-200);
}
.nav-item:hover { background: color-mix(in srgb, var(--color-accent-800) 60%, transparent); color: var(--color-bg); }
.nav-item.is-on { background: var(--color-accent-800); color: var(--color-bg); box-shadow: inset 2px 0 0 var(--color-accent-400); }
.nav-label { flex: 1; }
.nav-count { font-size: 12px; color: var(--color-accent-300); }

.block {
  margin: 18px 16px 0; padding-top: 16px; border-top: 1px solid var(--color-accent-800);
  display: flex; flex-direction: column; gap: 12px;
}
/* Wraps in the narrower sidebar (≤1240px) instead of pushing the hours past the edge */
.row-between { display: flex; justify-content: space-between; align-items: baseline; gap: 0 8px; flex-wrap: wrap; }
.kicker { font-size: 11px; letter-spacing: 0.1em; text-transform: uppercase; color: var(--color-accent-300); }
.dim { font-size: 12px; color: var(--color-accent-300); }
.small { font-size: 11px; }
.duty { display: flex; flex-direction: column; gap: 6px; }
.duty-label { font-family: var(--font-heading); font-weight: 600; font-size: 20px; text-transform: uppercase; }
.duty-range { font-family: var(--font-heading); font-size: 14px; color: var(--color-accent-200); }
.duty-bar { display: block; height: 3px; background: var(--color-accent-800); }
.duty-bar > span { display: block; height: 100%; background: var(--color-accent-400); }
.duty-staff { display: flex; flex-direction: column; gap: 12px; }
.duty-person { display: flex; align-items: center; gap: 10px; }
.duty-avatar { width: 28px; height: 28px; font-size: 12px; background: var(--color-accent-700); color: var(--color-bg); }
.duty-person-text { flex: 1; min-width: 0; display: flex; flex-direction: column; line-height: 1.2; }
.duty-name { font-size: 13px; font-weight: 500; }

.clocks { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.clock { display: flex; flex-direction: column; gap: 2px; }
.clock-time { font-family: var(--font-heading); font-size: 24px; line-height: 1; }

.live { display: flex; align-items: center; gap: 6px; padding: 0 16px 10px; font-size: 12px; color: var(--color-accent-300); }
.live-dot { width: 6px; height: 6px; background: var(--color-neutral-600); }
.live-dot.is-live { background: var(--color-accent-400); }

.me { display: flex; align-items: center; gap: 4px; padding: 10px 8px 10px 12px; border-top: 1px solid var(--color-accent-800); }
.me-btn {
  flex: 1; min-width: 0; display: flex; align-items: center; gap: 10px; padding: 6px 4px;
  border: 0; background: transparent; color: inherit; cursor: pointer; text-align: left; font: inherit;
}
.me-btn:hover, .signout:hover { background: var(--color-accent-800); }
.me-avatar { width: 32px; height: 32px; font-size: 13px; }
.me-text { display: flex; flex-direction: column; min-width: 0; line-height: 1.2; }
.me-name { font-size: 13px; font-weight: 500; }
.me-role { text-transform: capitalize; }
.signout {
  width: 32px; height: 32px; display: grid; place-items: center; flex-shrink: 0;
  border: 0; background: transparent; color: var(--color-accent-300); cursor: pointer;
}
.signout:hover { color: var(--color-bg); }

.collapse-btn {
  margin-left: auto; width: 28px; height: 28px; flex-shrink: 0; display: grid; place-items: center;
  border: 0; background: transparent; color: var(--color-accent-300); cursor: pointer;
}
.collapse-btn:hover { background: var(--color-accent-800); color: var(--color-bg); }
.nav-badge {
  min-width: 18px; padding: 0 5px; font-size: 11px; font-weight: 600; line-height: 18px; text-align: center;
  background: var(--color-signal); color: var(--color-bg);
}

/* Closed: a slim rail of icons; labels show as tooltips.
   Only the width animates. Every child keeps the open sidebar's width and is clipped,
   icons sit on the rail's center line, and text just fades, so nothing reflows mid-animation. */
.side {
  --side-w: 236px; --ease: 200ms cubic-bezier(0.2, 0, 0, 1);
  width: var(--side-w); position: relative; transition: width var(--ease);
}
@media (max-width: 1240px) { .side { --side-w: 200px; } }
.side.is-collapsed { width: 60px; }
.side > * { width: var(--side-w); flex-shrink: 0; box-sizing: border-box; }
.side > .cb-spacer { flex: 1 1 auto; }
.side > .block { width: calc(var(--side-w) - 32px); }
.fade { white-space: nowrap; transition: opacity 140ms ease 60ms, visibility 0s; }
.side.is-collapsed .fade { opacity: 0; visibility: hidden; pointer-events: none; transition: opacity 80ms ease, visibility 0s 200ms; }

/* Scrolls (short windows) without a scrollbar: one would eat into the 60px rail and clip the open sidebar */
.side { scrollbar-width: none; }
.side::-webkit-scrollbar { width: 0; height: 0; }

/* Brand: the mark stays put (top-aligned, so the taller closed header doesn't move it);
   the open / close button slides under it */
.brand { position: relative; height: 66px; padding: 18px 14px 16px; align-items: flex-start; transition: height var(--ease); }
.side.is-collapsed .brand { height: 100px; }
.brand-text { padding-right: 36px; }
.collapse-btn { position: absolute; top: 20px; left: calc(var(--side-w) - 44px); margin: 0; transition: left var(--ease), top var(--ease); }
.side.is-collapsed .collapse-btn { left: 16px; top: 58px; }

/* Nav: the same left padding open and closed puts each icon on the rail's center line */
.nav-item { padding-left: 13px; position: relative; }
/* The hidden labels still take room, so without this the icon is squeezed to nothing when closed */
.nav-item > svg, .nav-badge { flex-shrink: 0; }
.side.is-collapsed .nav-item { width: 44px; }
.side.is-collapsed .nav-badge { position: absolute; top: 3px; left: 28px; min-width: 16px; padding: 0 3px; font-size: 10px; line-height: 16px; }
.live { padding-left: 27px; }

/* Me: the sign-out button slides above the avatar when closed */
.me { position: relative; padding: 10px 8px 10px 14px; transition: padding-top var(--ease); }
.me-btn { padding: 0; }
.side.is-collapsed .me { padding-top: 50px; }
.side.is-collapsed .me-btn { flex: none; width: 32px; overflow: hidden; }
.signout { position: absolute; top: 10px; left: calc(var(--side-w) - 40px); transition: left var(--ease); }
.side.is-collapsed .signout { left: 14px; }
@media (max-height: 720px) { .tall-only { display: none; } }
</style>
