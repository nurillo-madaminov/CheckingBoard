<template>
  <div class="cb-page cb-scroll">
    <div class="cb-page-head">
      <div class="title-block">
        <h2 class="cb-title">Extensions</h2>
        <span class="cb-sub">Browser extensions for this team. Download and set them up on any computer.</span>
      </div>
      <div class="cb-spacer"></div>
      <button v-if="isManager" class="btn btn-primary" @click="showForm = !showForm">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M5 12h14" /><path d="M12 5v14" /></svg>
        {{ showForm ? 'Close' : 'Publish extension' }}
      </button>
    </div>

    <div v-if="errorMessage" class="cb-error">{{ errorMessage }}</div>

    <!-- Publish (managers) -->
    <form v-if="isManager && showForm" class="cb-panel publish" @submit.prevent="publish">
      <span class="section-title">Publish an extension</span>
      <div class="row">
        <div class="field grow">
          <label for="ext-name">Name</label>
          <input id="ext-name" v-model="form.name" class="input" required maxlength="80" placeholder="e.g. Leader ELD Logger" />
        </div>
        <div class="field version">
          <label for="ext-version">Version</label>
          <input id="ext-version" v-model="form.version" class="input" maxlength="20" placeholder="e.g. 1.0.0" />
        </div>
      </div>
      <div class="field">
        <label for="ext-desc">What it does</label>
        <input id="ext-desc" v-model="form.description" class="input" maxlength="300" placeholder="e.g. Logs Leader ELD actions to CheckingBoard automatically" />
      </div>
      <div class="field">
        <label for="ext-steps">Setup steps · one per line</label>
        <textarea id="ext-steps" v-model="form.setupSteps" class="input steps-input"></textarea>
      </div>
      <div class="field">
        <label for="ext-file">Extension file (.zip, up to 50 MB)</label>
        <input id="ext-file" ref="fileRef" class="input file" type="file" accept=".zip,.crx,application/zip" required @change="onFile" />
      </div>
      <div class="form-actions">
        <span v-if="form.file" class="cb-sub">{{ form.file.name }} · {{ formatFileSize(form.file.size) }}</span>
        <span class="cb-spacer"></span>
        <button type="button" class="btn btn-secondary" @click="resetForm">Cancel</button>
        <button type="submit" class="btn btn-primary" :disabled="isPublishing">{{ isPublishing ? 'Uploading…' : 'Publish' }}</button>
      </div>
    </form>

    <!-- Published -->
    <div v-if="isLoading" class="cb-panel empty">Loading extensions…</div>
    <div v-else-if="!latest.length" class="cb-panel empty">
      {{ isManager ? 'No extensions yet. Publish one so your team can install it.' : 'No extensions published yet.' }}
    </div>

    <div v-for="ext in latest" :key="ext.id" class="cb-panel card">
      <div class="card-head">
        <div class="card-title-block">
          <div class="card-title-row">
            <span class="card-title">{{ ext.name }}</span>
            <span v-if="ext.version" class="tag tag-outline">v{{ ext.version }}</span>
          </div>
          <span class="cb-sub">Published by {{ ext.publisher_name || 'a manager' }} · {{ formatDate(ext.published_at) }}</span>
        </div>
        <div class="card-actions">
          <button class="btn btn-primary" :disabled="downloadingId === ext.id" @click="download(ext)">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 15V3" /><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><path d="m7 10 5 5 5-5" /></svg>
            Download
          </button>
          <button v-if="isManager" class="btn btn-ghost btn-icon remove" title="Remove this version" @click="confirmTarget = ext">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18" /><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" /><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" /></svg>
          </button>
        </div>
      </div>
      <p v-if="ext.description" class="desc">{{ ext.description }}</p>
      <div class="file-line cb-sub">{{ ext.file_name }} · {{ formatFileSize(ext.file_size) }}</div>

      <div v-if="stepsOf(ext).length" class="steps">
        <span class="cb-label">How to set it up</span>
        <ol>
          <li v-for="(step, i) in stepsOf(ext)" :key="i"><span class="step-num">{{ i + 1 }}</span><span>{{ step }}</span></li>
        </ol>
      </div>

      <details v-if="olderVersions(ext).length" class="older">
        <summary>Earlier versions · {{ olderVersions(ext).length }}</summary>
        <div v-for="old in olderVersions(ext)" :key="old.id" class="older-row">
          <span>{{ old.version ? `v${old.version}` : old.file_name }} · {{ formatDate(old.published_at) }}</span>
          <span class="cb-spacer"></span>
          <button class="btn btn-ghost" @click="download(old)">Download</button>
          <button v-if="isManager" class="btn btn-ghost btn-danger" @click="confirmTarget = old">Remove</button>
        </div>
      </details>
    </div>

    <ConfirmDialog
      v-if="confirmTarget"
      :title="`Remove ${confirmTarget.name}${confirmTarget.version ? ` v${confirmTarget.version}` : ''}?`"
      body="The file is deleted and the team can no longer download this version. Computers that already installed it are not affected."
      okLabel="Remove"
      @confirm="remove"
      @cancel="confirmTarget = null"
    />
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue';
import ConfirmDialog from './ConfirmDialog.vue';
import {
  fetchExtensions,
  publishExtension,
  getDownloadUrl,
  deleteExtension,
  formatFileSize,
  MAX_FILE_BYTES
} from '../services/extensionService';

const props = defineProps({
  isManager: { type: Boolean, default: false },
  teamId: { type: String, required: true }
});

const emit = defineEmits(['published']);

// Chrome / Edge install for an unpacked .zip build
const DEFAULT_STEPS = [
  'Download the file and unzip it into a folder you will keep (do not delete it later)',
  'Open chrome://extensions (Edge: edge://extensions)',
  'Turn on Developer mode (top right)',
  'Click "Load unpacked" and choose the unzipped folder',
  'Pin the extension and sign in with your CheckingBoard username'
].join('\n');

const extensions = ref([]);
const isLoading = ref(true);
const errorMessage = ref('');
const showForm = ref(false);
const isPublishing = ref(false);
const downloadingId = ref('');
const confirmTarget = ref(null);
const fileRef = ref(null);
const form = reactive({ name: '', version: '', description: '', setupSteps: DEFAULT_STEPS, file: null });

// Newest build of each extension name; older builds are listed under it
const latest = computed(() => {
  const seen = new Set();
  return extensions.value.filter(e => {
    const key = e.name.trim().toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
});

function olderVersions(ext) {
  const key = ext.name.trim().toLowerCase();
  return extensions.value.filter(e => e.id !== ext.id && e.name.trim().toLowerCase() === key);
}

function stepsOf(ext) {
  return (ext.setup_steps || '').split('\n').map(s => s.trim()).filter(Boolean);
}

function formatDate(iso) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

async function load() {
  isLoading.value = true;
  try {
    extensions.value = await fetchExtensions();
  } catch (err) {
    errorMessage.value = `Could not load extensions: ${err.message || err}`;
  } finally {
    isLoading.value = false;
  }
}

function onFile(e) {
  const file = e.target.files?.[0] || null;
  errorMessage.value = file && file.size > MAX_FILE_BYTES ? 'The file is larger than 50 MB' : '';
  form.file = file;
}

function resetForm() {
  Object.assign(form, { name: '', version: '', description: '', setupSteps: DEFAULT_STEPS, file: null });
  if (fileRef.value) fileRef.value.value = '';
  showForm.value = false;
}

async function publish() {
  isPublishing.value = true;
  errorMessage.value = '';
  try {
    const ext = await publishExtension({ teamId: props.teamId, ...form });
    emit('published', `${ext.name}${ext.version ? ` v${ext.version}` : ''}`);
    resetForm();
    await load();
  } catch (err) {
    errorMessage.value = err.message || 'Could not publish the extension';
  } finally {
    isPublishing.value = false;
  }
}

async function download(ext) {
  downloadingId.value = ext.id;
  errorMessage.value = '';
  try {
    window.location.assign(await getDownloadUrl(ext));
  } catch (err) {
    errorMessage.value = `Could not download: ${err.message || err}`;
  } finally {
    downloadingId.value = '';
  }
}

async function remove() {
  const ext = confirmTarget.value;
  confirmTarget.value = null;
  try {
    await deleteExtension(ext);
    await load();
  } catch (err) {
    errorMessage.value = err.message || 'Could not remove the extension';
  }
}

onMounted(load);
</script>

<style scoped>
.title-block { display: flex; flex-direction: column; gap: 1px; }
.section-title { font-family: var(--font-heading); font-weight: 600; font-size: 20px; text-transform: uppercase; }

.publish { padding: 18px; display: flex; flex-direction: column; gap: 12px; max-width: 760px; }
.row { display: flex; gap: 10px; }
.grow { flex: 1; }
.version { width: 140px; }
.steps-input { min-height: 120px; font-size: 13px; }
.file { padding: 5px 8px; background-color: var(--color-bg); }
.form-actions { display: flex; align-items: center; gap: 8px; }

.empty { padding: 40px; text-align: center; font-size: 14px; color: var(--color-neutral-700); max-width: 760px; }

.card { padding: 18px; display: flex; flex-direction: column; gap: 10px; max-width: 760px; }
.card-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; }
.card-title-block { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.card-title-row { display: flex; align-items: center; gap: 10px; }
.card-title { font-family: var(--font-heading); font-weight: 600; font-size: 22px; line-height: 1.1; }
.card-actions { display: flex; align-items: center; gap: 4px; flex-shrink: 0; }
.remove { color: var(--color-neutral-700); }
.desc { margin: 0; font-size: 14px; color: var(--color-neutral-800); }
.file-line { font-size: 12px; }

.steps { display: flex; flex-direction: column; gap: 8px; padding-top: 10px; border-top: 1px solid var(--color-divider); }
.steps ol { margin: 0; padding: 0; list-style: none; display: flex; flex-direction: column; gap: 6px; }
.steps li { display: flex; gap: 10px; align-items: baseline; font-size: 14px; }
.step-num {
  flex-shrink: 0; width: 22px; height: 22px; display: grid; place-items: center;
  font-family: var(--font-heading); font-weight: 600; font-size: 12px;
  background: var(--color-accent-100); color: var(--color-accent-800); border: 1px solid var(--color-accent-200);
}

.older { border-top: 1px solid var(--color-divider); padding-top: 8px; font-size: 13px; }
.older summary { cursor: pointer; color: var(--color-accent-700); }
.older-row { display: flex; align-items: center; gap: 6px; padding: 4px 0; color: var(--color-neutral-800); }
</style>
