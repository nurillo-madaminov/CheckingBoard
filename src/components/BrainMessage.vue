<template>
  <div :class="['msg', { 'is-hit': hit, 'is-staff': message.role === 'staff' }]">
    <div class="msg-top">
      <span class="sender cb-ellipsis">{{ message.sender || 'Unknown' }}</span>
      <span v-if="message.role" class="tag tag-neutral">{{ message.role }}</span>
      <span v-if="showChat && message.chat" class="cb-muted cb-ellipsis chat" :title="message.chat">{{ message.chat }}</span>
      <span class="cb-spacer"></span>
      <span class="cb-muted time">{{ message.time }}</span>
      <a v-if="safeLink(message.link)" :href="safeLink(message.link)" class="cb-link small" target="_blank" rel="noopener" title="Open in the Telegram app (dispatch account)">Telegram</a>
      <a v-if="safeLink(message.web_link)" :href="safeLink(message.web_link)" class="cb-link small" target="_blank" rel="noopener" title="Open the group in Telegram Web">Web</a>
    </div>
    <div v-if="message.text" class="text">{{ message.text }}</div>
    <div v-if="message.documents?.length" class="docs">
      <div v-for="(d, i) in message.documents" :key="i" class="doc">
        <span class="doc-name cb-ellipsis">📄 {{ d.file }}<template v-if="d.page"> · p{{ d.page }}</template></span>
        <template v-if="d.type">
          <span class="doc-what">{{ d.what || d.type }}</span>
          <span v-for="(v, k) in d.fields" :key="k" class="doc-field"><span class="cb-muted">{{ k.replace(/_/g, ' ') }}:</span> {{ v }}</span>
        </template>
        <span v-else class="cb-muted">{{ d.status }}</span>
      </div>
    </div>
    <div v-else-if="message.files?.length" class="cb-muted small">📎 {{ message.files.join(', ') }}</div>
  </div>
</template>

<script setup>
import { safeLink } from '../services/dispatchBrainService';

defineProps({
  message: { type: Object, required: true },
  // The message a search found (the others are the ones around it)
  hit: { type: Boolean, default: false },
  showChat: { type: Boolean, default: false }
});
</script>

<style scoped>
.msg { padding: 8px 12px; border-left: 3px solid transparent; display: flex; flex-direction: column; gap: 3px; font-size: 13px; }
.msg.is-hit { border-left-color: var(--color-accent); background: var(--color-accent-100); }
.msg-top { display: flex; align-items: center; gap: 8px; min-width: 0; }
.sender { font-weight: 600; max-width: 40%; }
.chat { max-width: 40%; font-size: 12px; }
.time { font-size: 12px; white-space: nowrap; }
.small { font-size: 12px; }
.text { white-space: pre-wrap; word-break: break-word; }
.docs { display: flex; flex-direction: column; gap: 4px; }
.doc { display: flex; flex-wrap: wrap; gap: 2px 10px; padding: 4px 8px; font-size: 12px; background: var(--color-bg); border: 1px solid var(--color-hairline); }
.doc-name { font-weight: 500; max-width: 100%; }
.doc-what { color: var(--color-accent-800); }
.doc-field { white-space: nowrap; }
</style>
