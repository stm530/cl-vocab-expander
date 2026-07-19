<template>
  <div class="review-view">
    <h2>ステージングレビュー</h2>
    <p v-if="!store.zpdcReady" class="notice">先に「辞書」タブでZPDCファイルをアップロードしてください。</p>

    <div class="button-row" v-if="store.zpdcReady">
      <button @click="refreshEntries">一覧を更新</button>
      <button @click="exportStagingFile">ステージングをJSONダウンロード</button>
      <input type="file" accept=".json" @change="importStagingFile" ref="importInputRef" style="display:none" />
      <button @click="triggerImport">ステージングをJSONから読み込み</button>
      <button @click="clearAllStaging" class="warning">全ステージング消去</button>
    </div>

    <div v-if="entries.length === 0 && !store.reviewLoading" class="notice">
      ステージングに登録された項目はありません。
    </div>

    <table v-if="entries.length > 0" class="review-table">
      <thead>
        <tr>
          <th>承認</th>
          <th>種別</th>
          <th>綴り</th>
          <th>品詞</th>
          <th>意味</th>
          <th>出典</th>
          <th>日時</th>
          <th>操作</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="e in entries" :key="e.id" :class="{ approved: e.approved }">
          <td>
            <label class="appr-check">
              <input type="checkbox" :checked="e.approved" @change="toggleApproved(e)" />
            </label>
          </td>
          <td><span :class="['type-badge', e.type === 'new_word' ? 'badge-new' : 'badge-add']">{{ e.type === 'new_word' ? '新語' : '意味追加' }}</span></td>
          <td><span class="mono">{{ e.spelling }}</span></td>
          <td><span class="mono">{{ (e.pos || []).join(', ') }}</span></td>
          <td><span class="mono">{{ (e.meanings || []).join(', ') }}</span></td>
          <td class="source-col">
            <span v-if="e.source?.kind === 'new'">語新規登録</span>
            <span v-else-if="e.source?.kind === 'hypernym'">親概念</span>
            <span v-else-if="e.source?.kind === 'similar'">類似語登録</span>
            <span v-else-if="e.source?.kind === 'similar-sense'">類似語意味追加</span>
            <span v-else-if="e.source?.kind === 'sense-add'">意味追加モード</span>
            <span v-else>{{ e.source?.kind || '' }}</span>
          </td>
          <td class="date-col">{{ fmtDate(e.createdAt) }}</td>
          <td>
            <button @click="removeEntry(e.id)" class="btn-sm">削除</button>
          </td>
        </tr>
      </tbody>
    </table>

    <div class="export-section" v-if="approvedCount > 0">
      <h3>承認済み反映（ダウンロード）</h3>
      <p>承認された {{ approvedCount }} 件をZpDICデータにマージして、更新済みファイルをダウンロードします。</p>
      <button @click="downloadZpdc">更新済みZpDICファイルをダウンロード (JSON)</button>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { store } from '../store.js'
import { listStaging, exportStagingJSON, importStagingJSON, setApproved, deleteStaging, clearStaging } from '../db/staging.js'
import { exportZpdcJSON } from '../store.js'

const entries = ref([])
const importInputRef = ref(null)

const approvedCount = computed(() => entries.value.filter(e => e.approved).length)

async function refreshEntries() {
  entries.value = await listStaging()
  entries.value.forEach(e => e.approved = e.approved === 1)
}

function fmtDate(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  return d.toLocaleString('ja-JP', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
}

async function toggleApproved(e) {
  e.approved = e.approved ? 0 : 1
  await setApproved(e.id, e.approved === 1)
}

async function removeEntry(id) {
  await deleteStaging(id)
  await refreshEntries()
}

async function clearAllStaging() {
  await clearStaging()
  await refreshEntries()
}

async function exportStagingFile() {
  const json = await exportStagingJSON()
  downloadBlob(json, 'staging-backup.json', 'application/json')
}

function triggerImport() {
  if (importInputRef.value) importInputRef.value.click()
}

async function importStagingFile(e) {
  const file = e.target.files[0]
  if (!file) return
  const text = await file.text()
  try {
    await importStagingJSON(text)
    await refreshEntries()
  } catch (err) {
    alert('読み込みエラー: ' + err.message)
  }
  if (importInputRef.value) importInputRef.value.value = ''
}

async function downloadZpdc() {
  const mergedJson = await exportZpdcJSON()
  const text = JSON.stringify(mergedJson, null, 2)
  const filename = (store.zpdcFilename || 'updated').replace(/\.(json|zpdc)$/, '') + '-updated.zpdc'
  downloadBlob(text, filename, 'application/json')
}

function downloadBlob(text, filename, mime) {
  const blob = new Blob([text], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

refreshEntries()
</script>

<style scope>
.review-view {
  padding: 8px 0;
}
.button-row {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  margin-bottom: 8px;
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
button.warning:hover {
  background: #fdd;
}
.btn-sm {
  padding: 1px 6px;
  font-size: 12px;
}
.review-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}
.review-table th, .review-table td {
  border: 1px solid #ccc;
  padding: 4px 6px;
  text-align: left;
  vertical-align: top;
}
.review-table th {
  background: #eee;
  font-weight: bold;
}
.approved {
  background: #f8fff8;
}
.appr-check {
  display: block;
  text-align: center;
}
.mono {
  font-family: monospace;
  font-size: 13px;
}
.date-col {
  white-space: nowrap;
  color: #888;
  font-size: 12px;
}
.source-col {
  color: #666;
  font-size: 12px;
}
.badge-add {
  color: #666;
}
.export-section {
  margin-top: 16px;
  border: 1px solid #2a2a2a;
  padding: 12px;
}
.export-section h3 {
  margin: 0 0 4px 0;
}
.export-section button {
  font-size: 14px;
  padding: 8px 16px;
  font-weight: bold;
}
</style>