<template>
  <div class="team">
    <div class="cb-panel head-card">
      <span class="cb-label">{{ teamName || 'Your team' }}</span>
      <template v-if="myShift">
        <span class="title">{{ getShiftConfig(myShift).label }} shift</span>
        <span class="cb-sub">{{ hoursToday }} {{ myRun.day === today ? 'today' : formatWorkDayShort(myRun.day) }} (Tashkent) · {{ shiftMates.length + 1 }} {{ shiftMates.length ? 'people' : 'person' }}</span>
      </template>
      <template v-else-if="nextRun">
        <span class="title">Day off</span>
        <span class="cb-sub">Next: {{ getShiftConfig(nextRun.code).label }} shift, {{ formatWorkDayShort(nextRun.day) }} · {{ shiftHours(nextRun.code, nextRun.day).tashkent }} (Tashkent)</span>
      </template>
      <template v-else>
        <span class="title">No shift yet</span>
        <span class="cb-sub">Ask your manager to add you to a shift.</span>
      </template>
    </div>

    <section v-if="myShift" class="group">
      <span class="cb-label">On your shift {{ myRun.day === today ? 'today' : `· ${formatWorkDayShort(myRun.day)}` }}</span>
      <div class="cb-panel list">
        <div class="person is-me">
          <span class="cb-avatar avatar">{{ initials(me?.displayName) }}</span>
          <span class="name cb-ellipsis">{{ me?.displayName }}</span>
          <span class="tag-you">You</span>
        </div>
        <div v-for="p in shiftMates" :key="p.id" class="person">
          <span class="cb-avatar avatar">{{ initials(p.displayName) }}</span>
          <span class="name cb-ellipsis">{{ p.displayName }}</span>
        </div>
        <div v-if="!shiftMates.length" class="empty">You're the only one on this shift.</div>
      </div>
    </section>

    <section class="group">
      <span class="cb-label">Managers &amp; supervisors</span>
      <div class="cb-panel list">
        <div v-for="p in managers" :key="p.id" class="person">
          <span class="cb-avatar avatar is-manager">{{ initials(p.displayName) }}</span>
          <span class="name cb-ellipsis">{{ p.displayName }}</span>
          <span class="meta">{{ roleLabel(p.role) }}<template v-if="shiftOn(p.id, today)"> · {{ getShiftConfig(shiftOn(p.id, today)).label }}</template></span>
        </div>
        <div v-if="!managers.length" class="empty">No managers listed.</div>
      </div>
    </section>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { currentStaffUser, currentTeam, staffProfiles, loadTeamRoster } from '../services/authService';
import {
  getShiftConfig, shiftHours, shiftOn, placeStaffShift, nextStaffShift, currentWorkDay, formatWorkDayShort
} from '../config/shifts';
import { initials } from '../utils/format';
import { canManage, roleLabel } from '../config/roles';

const teamName = computed(() => currentTeam.value?.name || '');
const me = computed(() => staffProfiles.value.find(p => p.id === currentStaffUser.value?.id) || currentStaffUser.value);
const now = ref(new Date());
const today = computed(() => currentWorkDay(now.value));
// The run of my schedule that is on (or nearest) now; null on my day off
const myRun = computed(() => placeStaffShift(now.value, me.value?.id));
const myShift = computed(() => myRun.value?.code || '');
const nextRun = computed(() => (myRun.value ? null : nextStaffShift(now.value, me.value?.id)));
const active = computed(() => staffProfiles.value.filter(p => p.isActive));
// Whoever is scheduled on the same shift that day
const shiftMates = computed(() => active.value.filter(p =>
  myRun.value && p.id !== me.value?.id && shiftOn(p.id, myRun.value.day) === myShift.value
));
const managers = computed(() => active.value.filter(p => canManage(p.role) && p.id !== me.value?.id));
const hoursToday = computed(() => (myRun.value ? shiftHours(myShift.value, myRun.value.day).tashkent : ''));

let timer = null;
onMounted(() => {
  loadTeamRoster().catch(() => {});
  timer = setInterval(() => { now.value = new Date(); }, 60000);
});
onUnmounted(() => clearInterval(timer));
</script>

<style scoped>
.team { display: flex; flex-direction: column; gap: 14px; }
.head-card { padding: 16px; display: flex; flex-direction: column; gap: 4px; }
.title { font-family: var(--font-heading); font-weight: 600; font-size: 28px; line-height: 1.05; text-transform: uppercase; }
.group { display: flex; flex-direction: column; gap: 8px; }
.list { display: flex; flex-direction: column; }
.person { display: flex; align-items: center; gap: 12px; padding: 12px 14px; border-top: 1px solid var(--color-hairline); min-height: 56px; }
.person:first-child { border-top: 0; }
.person.is-me { background: var(--color-accent-100); }
.avatar { width: 36px; height: 36px; font-size: 14px; }
.avatar.is-manager { background: var(--color-accent); color: var(--color-bg); }
.name { flex: 1; min-width: 0; font-size: 15px; font-weight: 500; }
.tag-you { font-size: 10px; letter-spacing: 0.08em; text-transform: uppercase; padding: 1px 6px; background: var(--color-accent); color: var(--color-bg); }
.meta { font-size: 12px; color: var(--color-neutral-700); }
.empty { padding: 16px 14px; font-size: 13px; color: var(--color-neutral-700); }
</style>
