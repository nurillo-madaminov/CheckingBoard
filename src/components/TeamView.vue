<template>
  <div class="team">
    <div class="cb-panel head-card">
      <span class="cb-label">{{ teamName || 'Your team' }}</span>
      <template v-if="myShift">
        <span class="title">{{ getShiftConfig(myShift).label }} shift</span>
        <span class="cb-sub">{{ hoursToday }} today (Tashkent) · {{ shiftMates.length + 1 }} {{ shiftMates.length ? 'people' : 'person' }}</span>
      </template>
      <template v-else>
        <span class="title">No shift yet</span>
        <span class="cb-sub">Ask your manager to add you to a shift.</span>
      </template>
    </div>

    <section v-if="myShift" class="group">
      <span class="cb-label">On your shift</span>
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
      <span class="cb-label">Managers</span>
      <div class="cb-panel list">
        <div v-for="p in managers" :key="p.id" class="person">
          <span class="cb-avatar avatar is-manager">{{ initials(p.displayName) }}</span>
          <span class="name cb-ellipsis">{{ p.displayName }}</span>
          <span v-if="p.shiftCode" class="meta">{{ getShiftConfig(p.shiftCode).label }}</span>
        </div>
        <div v-if="!managers.length" class="empty">No managers listed.</div>
      </div>
    </section>
  </div>
</template>

<script setup>
import { computed, onMounted } from 'vue';
import { currentStaffUser, currentTeam, staffProfiles, loadTeamRoster } from '../services/authService';
import { getShiftConfig, shiftHours, placeShift } from '../config/shifts';
import { initials } from '../utils/format';

const teamName = computed(() => currentTeam.value?.name || '');
const me = computed(() => staffProfiles.value.find(p => p.id === currentStaffUser.value?.id) || currentStaffUser.value);
const myShift = computed(() => me.value?.shiftCode || '');
const active = computed(() => staffProfiles.value.filter(p => p.isActive));
const shiftMates = computed(() => active.value.filter(p => p.shiftCode === myShift.value && p.id !== me.value?.id));
const managers = computed(() => active.value.filter(p => p.role === 'manager' && p.id !== me.value?.id));
const hoursToday = computed(() => {
  if (!myShift.value) return '';
  const run = placeShift(new Date(), myShift.value);
  return shiftHours(myShift.value, run.day).tashkent;
});

onMounted(() => loadTeamRoster().catch(() => {}));
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
