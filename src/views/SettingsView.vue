<template>
  <div class="settings-view">
    <h2>設定</h2>

    <section class="setting-section">
      <h3>出題オプション</h3>
      <label class="setting-row">
        <input type="checkbox" v-model="reissue" @change="saveReissue" />
        出題済みsynsetを再出題する
      </label>
      <div class="setting-row">
        <button @click="clearIssued" class="btn-gray">出題済みリストをリセット</button>
        <span class="info-text">現在 {{ issuedCount }} 件出題済み</span>
      </div>
    </section>

    <section class="setting-section">
      <h3>ステージングJSONエクスポート</h3>
      <button @click="exportStaging">ステージングをダウンロード</button>
      <button @click="triggerImport">JSONから復元</button>
      <input type="file" accept=".json" @change="importStaging" ref="importRef" style="display:none" />
    </section>

    <section class="setting-section" v-if="store.zpdcReady">
      <h3>ZPDCデータ管理</h3>
      <div class="info-row">
        <span class="info-label">辞書ファイル:</span>
        <span>{{ store.zpdcFilename }}</span>
      </div>
      <div class="info-row">
        <span class="info-label">単語数:</span>
        <span>{{ store.internalRoot?.words?.length || 0 }}</span>
      </div>
      <div class="info-row">
        <span class="info-label">綴りインデックス:</span>
        <span>{{ store.spellIndex?.size?.() || 0 }}</span>
      </div>
      <div class="info-row">
        <span class="info-label">類似度エンジン:</span>
        <span>{{ store.simEngine?.size?.() || 0 }}</span>
      </div>
    </section>

    <section class="setting-section">
      <h3>WordNet</h3>
      <div v-if="store.wordnetLoading">
        <div class="progress-bar">
          <div class="progress-fill" :style="{ width: (store.wordnetLoadProgress * 100) + '%' }"></div>
          <span class="progress-text">{{ Math.round(store.wordnetLoadProgress * 100) }}%</span>
        </div>
      </div>
      <p v-if="store.wordnetReady">読み込み完了 ({{ wordnetCount }} synsets)</p>
      <p v-if="store.wordnetLoadError" class="error-text">{{ store.wordnetLoadError }}</p>
      <button @click="reloadWordNet" v-if="!store.wordnetReady && !store.wordnetLoading" class="btn-gray">再読み込み</button>
    </section>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { store, initWordNet } from '../store.js'
import { getAllowReissue, setAllowReissue, getIssuedSynsets, clearIssuedSynsets, exportStagingJSON, importStagingJSON, listStaging } from '../db/staging.js'
import { countSynsets } from '../db/wordnet.js'

const reissue = ref(false)
const issuedCount = ref(0)
const importRef = ref(null)

const wordnetCount = computed(() => {
  try { return countSynsets() } catch { return 0 }
})

async function loadReissue() {
  reissue.value = await getAllowReissue()
}

async function saveReissue() {
  await setAllowReissue(reissue.value)
}

async function loadIssued() {
  const s = await getIssuedSynsets()
  issuedCount.value = s.size
}

async function clearIssued() {
  await clearIssuedSynsets()
  await loadIssued()
}

async function exportStaging() {
  const json = await exportStagingJSON()
  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'staging-backup.json'
  a.click()
  URL.revokeObjectURL(url)
}

function triggerImport() {
  importRef.value?.click()
}

async function importStaging(e) {
  const file = e.target.files[0]
  if (!file) return
  const text = await file.text()
  try {
    await importStagingJSON(text)
    const count = (await listStaging()).length
    alert('インポート完了 (' + count + '件)')
  } catch (err) {
    alert('読み込みエラー: ' + err.message)
  }
}

async function reloadWordNet() {
  await initWordNet()
}

onMounted(async () => { await loadReissue(); await loadIssued() })
</script>

<style scoped>
.settings-view {
  padding: 8px 0;
}
.setting-section {
  margin-bottom: 16px;
  border: 1px solid #ccc;
  padding: 8px 12px;
}
.setting-section h3 {
  margin: 0 0 6px 0;
  font-size: 14px;
  color: #444;
}
.setting-row {
  display: flex;
  gap: 8px;
  align-items: center;
  padding: 2px 0;
  font-size: 13px;
}
.info-row {
  display: flex;
  gap: 8px;
  padding: 2px 0;
}
.info-label {
  min-width: 100px;
  color: #666;
}
</style>