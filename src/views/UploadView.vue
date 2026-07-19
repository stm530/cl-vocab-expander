<template>
  <div class="upload-view">
    <h2>辞書データの読み込み</h2>

    <section class="upload-section" v-if="!store.zpdcReady">
      <p>ZpDICからエクスポートしたZPDCファイル（OTM-JSON, .jsonまたは.zpdc）をアップロードしてください。</p>
      <input type="file" accept=".json,.zpdc" @change="handleFile" ref="fileInput" />
      <p v-if="loadError" class="error-text">{{ loadError }}</p>
    </section>

    <section class="upload-section" v-if="store.zpdcReady">
      <div class="info-row">
        <span class="info-label">読み込み済み辞書:</span>
        <span class="info-value">{{ store.zpdcFilename }}</span>
      </div>
      <div class="info-row">
        <span class="info-label">単語数:</span>
        <span class="info-value">{{ store.internalRoot?.words?.length || 0 }}</span>
      </div>
      <div class="info-row">
        <span class="info-label">品詞種別:</span>
        <span class="info-value">{{ store.posChoices.join(', ') || '(なし)' }}</span>
      </div>
      <div class="info-row">
        <span class="info-label">綴りインデックス:</span>
        <span class="info-value">{{ store.spellIndex?.size() || 0 }} 語</span>
      </div>
      <div class="info-row">
        <span class="info-label">類似度エンジン:</span>
        <span class="info-value">{{ store.simEngine?.size() || 0 }} 語</span>
      </div>

      <div class="button-row">
        <button @click="reUpload" class="btn-gray">別の辞書を読み込む</button>
        <button @click="removeZpdc" class="btn-gray">辞書データを削除</button>
      </div>
    </section>

    <section class="wordnet-section">
      <h3>日本語WordNet</h3>
      <p>意味ネットワークデータベース（日本語WordNet）をブラウザ内に読み込みます（初回のみ時間がかかります）。</p>
      <div v-if="store.wordnetLoading" class="progress-bar">
        <div class="progress-fill" :style="{ width: (store.wordnetLoadProgress * 100) + '%' }"></div>
        <span class="progress-text">{{ Math.round(store.wordnetLoadProgress * 100) }}%</span>
      </div>
      <p v-if="store.wordnetReady">WordNet読み込み完了（{{ wordnetCount }} synsets）</p>
      <p v-if="store.wordnetReady && store.zpdcReady" class="ready-message">準備完了です。「出題」タブから作業を開始できます。</p>
    </section>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { store, initWordNet, loadZpdcFromUpload } from '../store.js'
import { countSynsets } from '../db/wordnet.js'

const fileInput = ref(null)
const loadError = ref('')

const wordnetCount = computed(() => {
  if (!store.wordnetReady) return 0
  try {
    return countSynsets()
  } catch {
    return 0
  }
})

async function handleFile(e) {
  const file = e.target.files[0]
  if (!file) return
  loadError.value = ''
  try {
    await loadZpdcFromUpload(file)
  } catch (err) {
    loadError.value = err.message || '読み込みに失敗しました'
  }
}

async function reload() {
  loadError.value = ''
  store.zpdcReady = false
  store.zpdcFilename = ''
  store.internalRoot = null
  store.posChoices = []
  store.spellIndex = null
  store.simEngine = null
  if (fileInput.value) fileInput.value.value = ''
}

async function removeZpdc() {
  await import('../db/staging.js').then(m => m.clearUploadedZpdc())
  reload()
}
</script>

<style scoped>
.upload-view {
  padding: 8px 0;
}
.upload-section, .wordnet-section {
  margin-bottom: 16px;
}
.info-row {
  display: flex;
  gap: 8px;
  padding: 2px 0;
}
.info-label {
  font-weight: bold;
  min-width: 120px;
  color: #666;
}
.info-value {
  font-family: monospace;
}
.button-row {
  display: flex;
  gap: 8px;
  margin-top: 8px;
}
button {
  padding: 4px 12px;
  border: 1px solid #999;
  background: #eee;
  cursor: pointer;
}
button:hover {
  background: #ddd;
}
button.warning {
  border-color: #c66;
  color: #a33;
}
.progress-bar {
  background: #eee;
  height: 18px;
  position: relative;
  margin: 4px 0;
  overflow: hidden;
}
.progress-fill {
  background: #aaa;
  height: 100%;
  transition: width 0.1s;
}
.progress-text {
  position: absolute;
  top: 0;
  left: 4px;
  line-height: 18px;
  font-size: 11px;
}
.error-text {
  color: #a33;
}
.ready-message {
  color: #2a6a2a;
}
</style>