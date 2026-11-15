<template>
  <div class="assistant">
    <!-- Conversations -->
    <aside class="cb-panel convs" aria-label="Conversations">
      <div class="convs-head">
        <span class="cb-label">Conversations</span>
        <span class="cb-spacer"></span>
        <button type="button" class="btn btn-ghost" :disabled="isAsking" @click="newConversation">+ New</button>
      </div>
      <div class="convs-list cb-scroll">
        <button
          v-for="c in conversations"
          :key="c.id"
          type="button"
          :class="['conv', { 'is-on': c.id === conversationId }]"
          :disabled="isAsking"
          @click="open(c.id)"
        >
          <span class="cb-ellipsis conv-title">{{ c.title || 'Untitled' }}</span>
          <span class="cb-muted small">{{ c.updated }} · {{ c.messages }} {{ c.messages === 1 ? 'message' : 'messages' }}</span>
        </button>
        <span v-if="!conversations.length" class="cb-muted small empty">No conversations yet.</span>
      </div>
    </aside>

    <!-- Chat -->
    <section class="cb-panel chat" aria-label="Assistant">
      <div ref="scrollRef" class="chat-scroll cb-scroll">
        <div v-if="!messages.length && !isAsking" class="cb-empty-state">
          <strong>Ask about any driver, load or group.</strong>
          <span>It reads the Telegram groups and the ELD, and links the messages it used.</span>
          <div class="examples">
            <button v-for="q in EXAMPLES" :key="q" type="button" class="cb-chip" @click="ask(q)">{{ q }}</button>
          </div>
        </div>
        <div v-for="(m, i) in messages" :key="i" :class="['bubble', m.role === 'user' ? 'is-user' : 'is-bot']">
          <span class="cb-label who">{{ m.role === 'user' ? 'You' : 'Dispatch Brain' }}</span>
          <div v-if="m.role === 'user'" class="text">{{ m.content }}</div>
          <!-- renderMarkdown escapes everything and only links https:// and tg:// -->
          <div v-else class="text md" v-html="renderMarkdown(m.content)"></div>
        </div>
        <div v-if="isAsking" class="bubble is-bot">
          <span class="cb-label who">Dispatch Brain</span>
          <div class="cb-muted">Reading the groups… {{ elapsed }}s <span class="small">(can take up to a minute)</span></div>
        </div>
      </div>

      <div v-if="errorMessage" class="cb-error chat-error">{{ errorMessage }}</div>

      <form class="composer" @submit.prevent="ask(draft)">
        <textarea
          ref="inputRef"
          v-model="draft"
          class="input"
          rows="2"
          placeholder="e.g. status of unit 1658? · where is load 5123062? · who has no trailer?"
          aria-label="Question"
          :disabled="isAsking"
          @keydown.enter.exact.prevent="ask(draft)"
        ></textarea>
        <button type="submit" class="btn btn-primary" :disabled="!draft.trim() || isAsking">Ask</button>
      </form>
    </section>
  </div>
</template>

<script setup>
import { ref, nextTick, onMounted, onUnmounted } from 'vue';
import { askAssistant, listConversations, getConversation } from '../services/dispatchBrainService';
import { renderMarkdown } from '../utils/brainFormat';

const EXAMPLES = ['Which drivers picked up a load today?', 'Who is close to running out of drive hours?', 'Any trailer changes in the last 24 hours?'];

const conversations = ref([]);
const conversationId = ref(null);
const messages = ref([]);
const draft = ref('');
const isAsking = ref(false);
const errorMessage = ref('');
const elapsed = ref(0);
const scrollRef = ref(null);
const inputRef = ref(null);
let ticker = null;

async function loadConversations() {
  try {
    conversations.value = await listConversations();
  } catch (e) {
    errorMessage.value = `Could not load conversations. ${e.message}`;
  }
}

function scrollDown() {
  nextTick(() => { if (scrollRef.value) scrollRef.value.scrollTop = scrollRef.value.scrollHeight; });
}

async function open(id) {
  errorMessage.value = '';
  try {
    const c = await getConversation(id);
    conversationId.value = c.id;
    messages.value = (c.messages || []).map(m => ({ role: m.role, content: m.content }));
    scrollDown();
  } catch (e) {
    errorMessage.value = `Could not open this conversation. ${e.message}`;
  }
}

function newConversation() {
  conversationId.value = null;
  messages.value = [];
  errorMessage.value = '';
  inputRef.value?.focus();
}

async function ask(text) {
  const question = (text || '').trim();
  if (!question || isAsking.value) return;
  draft.value = '';
  errorMessage.value = '';
  messages.value.push({ role: 'user', content: question });
  isAsking.value = true;
  elapsed.value = 0;
  ticker = setInterval(() => { elapsed.value += 1; }, 1000);
  scrollDown();
  try {
    const r = await askAssistant(question, conversationId.value);
    conversationId.value = r.conversation_id ?? conversationId.value;
    messages.value.push({ role: 'assistant', content: r.answer || '(no answer)' });
    loadConversations();
  } catch (e) {
    errorMessage.value = `No answer. ${e.message}`;
    // Put the question back so it can be sent again
    messages.value.pop();
    draft.value = question;
  } finally {
    clearInterval(ticker);
    isAsking.value = false;
    scrollDown();
    nextTick(() => inputRef.value?.focus());
  }
}

onMounted(loadConversations);
onUnmounted(() => clearInterval(ticker));
defineExpose({ ask });
</script>

<style scoped>
.assistant { display: flex; gap: 14px; align-items: stretch; min-height: 0; flex: 1; height: min(72vh, 760px); }
.convs { flex: 0 0 260px; display: flex; flex-direction: column; min-height: 0; }
.convs-head { display: flex; align-items: center; padding: 8px 8px 8px 12px; border-bottom: 1px solid var(--color-divider); }
.convs-list { overflow: auto; flex: 1; display: flex; flex-direction: column; }
.conv {
  display: flex; flex-direction: column; gap: 1px; text-align: left; padding: 8px 12px; cursor: pointer;
  font: inherit; font-size: 13px; background: transparent; border: 0; border-bottom: 1px solid var(--color-hairline); color: var(--color-text);
}
.conv:hover:not(:disabled) { background: var(--color-bg); }
.conv.is-on { background: var(--color-accent-100); box-shadow: inset 3px 0 0 var(--color-accent); }
.conv-title { font-weight: 500; }
.empty { padding: 12px; }
.chat { flex: 1; min-width: 0; display: flex; flex-direction: column; min-height: 0; }
.chat-scroll { flex: 1; overflow: auto; padding: 14px; display: flex; flex-direction: column; gap: 12px; }
.bubble { max-width: 820px; display: flex; flex-direction: column; gap: 3px; }
.bubble.is-user { align-self: flex-end; text-align: right; }
.bubble.is-user .text { background: var(--color-accent-100); border: 1px solid var(--color-accent-200); padding: 8px 12px; white-space: pre-wrap; text-align: left; }
.bubble.is-bot .text { padding: 2px 0; }
.text { font-size: 14px; word-break: break-word; }
.md :deep(ul) { margin: 4px 0; padding-left: 20px; }
.md :deep(code) { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 13px; background: var(--color-neutral-200); padding: 0 3px; }
.md :deep(a) { color: var(--color-accent-700); }
.examples { display: flex; flex-wrap: wrap; gap: 8px; justify-content: center; margin-top: 8px; }
.composer { display: flex; gap: 8px; align-items: flex-end; padding: 10px; border-top: 1px solid var(--color-divider); }
.composer .input { flex: 1; min-height: 44px; resize: none; }
.chat-error { margin: 0 10px; }
.small { font-size: 12px; }
@media (max-width: 800px) {
  .assistant { flex-direction: column; height: auto; }
  .convs { flex-basis: auto; max-height: 180px; }
  .chat { min-height: 60vh; }
}
</style>
