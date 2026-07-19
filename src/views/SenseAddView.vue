<template>
  <div class="sense-add-view">
    <div v-if="!store.zpdcReady" class="notice">
      <p>先に「辞書」タブでZPDCファイルをアップロードしてください。</p>
    </div>
    <template v-else>
      <h2>既存語への意味追加</h2>
      <div class="search-row">
        <input
          type="text"
          v-model="searchText"
          placeholder="既存語の綴りを検索..."
          class="search-input"
          @input="onSearch"
        />
        <button @click="clearSearch" class="btn-gray" v-if="searchText">クリア</button>
      </div>

      <div v-if="searchResults.length > 0" class="result-list">
        <div
          v-for="r in searchResults"
          :key="r.wordNumber"
          class="result-item"
          @click="selectWord(r)"
        >
          <span class="rs-spelling">{{ r.spelling }}</span>
          <span class="rs-meanings">{{ r.meanings.map(m => m.text).join(', ') }}</span>
        </div>
      </div>
      <p v-if="searchText && searched && searchResults.length === 0" class="notice">一致する既存語がありません</p>

      <div v-if="selectedWord" class="edit-area">
        <h3>{{ selectedWord.spelling }}</h3>
        <div class="existing-meanings">
          <h4>既存の意味</h4>
          <div v-for="(m, i) in existingMeanings" :key="'em' + i" class="existing-meaning-row">
            <span class="em-pos">{{ m.pos.join(', ') || '(品詞未設定)' }}</span>
            <span class="em-text">{{ m.text }}</span>
          </div>
        </div>

        <div class="add-meanings">
          <h4>新しい意味を追加</h4>
          <div v-for="(nm, i) in newMeanings" :key="'nm' + i" class="add-row">
            <span class="add-pos">
              <label v-for="c in store.posChoices" :key="c" class="pos-check">
                <input type="checkbox" :value="c" v-model="nm.pos" />
                {{ c }}
              </label>
            </span>
            <input type="text" v-model="nm.text" placeholder="日本語意味" class="meaning-input" />
            <button class="node-btn" @click="removeNewMeaning(i)" v-if="newMeanings.length > 1">-</button>
            <button class="node-btn" @click="removeNewMeaning(i)" v-else disabled>-</button>
            <button class="node-btn" @click="addNewMeaning">+</button>
          </div>
        </div>

        <button @click="submitAdd" class="submit-btn" :disabled="!hasAnyNewMeaning">意味追加を提出</button>
        <p v-if="submitted" class="success-msg">ステージングに記録しました。</p>
      </div>
    </template>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { store, submitSenseAdd } from '../store.js'

const searchText = ref('')
const searched = ref(false)
const searchResults = ref([])
const selectedWord = ref(null)
const existingMeanings = ref([])
const newMeanings = ref([{ pos: [], text: '' }])
const submitted = ref(false)

function onSearch() {
  searched.value = false
  searchResults.value = []
  const q = searchText.value.trim()
  if (q.length >= 1) {
    searchResults.value = store.spellIndex ? store.spellIndex.search(q) : []
    searched.value = true
  }
}

function clearSearch() {
  searchText.value = ''
  searchResults.value = []
  searched.value = false
  selectedWord.value = null
}

function selectWord(r) {
  selectedWord.value = r
  existingMeanings.value = r.meanings || []
  newMeanings.value = [{ pos: [], text: '' }]
  submitted.value = false
}

function addNewMeaning() {
  newMeanings.value.push({ pos: [], text: '' })
}

function removeNewMeaning(i) {
  if (newMeanings.value.length > 1) newMeanings.value.splice(i, 1)
}

const hasAnyNewMeaning = computed(() => {
  return newMeanings.value.some(m => m.text && m.text.trim())
})

async function submitAdd() {
  if (!selectedWord.value) return
  const valid = newMeanings.value.filter(m => m.text && m.text.trim())
  if (valid.length === 0) return
  await submitSenseAdd(selectedWord.value, valid)
  submitted.value = true
}
</script>

<style scoped>
.sense-add-view {
  padding: 8px 0;
}
.search-row {
  display: flex;
  gap: 8px;
  margin-bottom: 8px;
}
.search-input {
  flex: 1;
  padding: 4px 8px;
  border: 1px solid #ccc;
  font-family: monospace;
  font-size: 14px;
}
.result-list {
  border: 1px solid #eee;
  max-height: 200px;
  overflow-y: auto;
}
.result-item {
  padding: 4px 8px;
  border-bottom: 1px solid #eee;
  cursor: pointer;
}
.result-item:hover {
  background: #f0f0f0;
}
.rs-spelling {
  font-family: monospace;
  font-weight: bold;
  margin-right: 8px;
}
.rs-meanings {
  color: #666;
  font-size: 13px;
}
.edit-area {
  margin-top: 12px;
  border: 1px solid #ccc;
  padding: 12px;
}
.existing-meanings {
  margin-bottom: 12px;
}
.existing-meaning-row {
  padding: 2px 0;
  background: #f6f6f6;
  display: flex;
  gap: 8px;
}
.em-pos {
  min-width: 80px;
  color: #666;
  font-size: 13px;
}
.em-text {
  font-family: monospace;
  color: #555;
}
.add-meanings {
  margin-bottom: 8px;
}
.add-row {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 2px 0;
}
.add-pos {
  display: inline-flex;
  gap: 2px 4px;
  flex-wrap: wrap;
}
.pos-check {
  display: inline-flex;
  gap: 2px;
  align-items: center;
  font-size: 13px;
  white-space: nowrap;
}
.meaning-input {
  flex: 1;
  min-width: 150px;
  padding: 2px 4px;
  border: 1px solid #ccc;
  font-family: monospace;
  font-size: 14px;
}
.submit-btn {
  padding: 6px 24px;
  border: 1px solid #666;
  background: #ddd;
  cursor: pointer;
  font-weight: bold;
  font-size: 14px;
  margin-top: 8px;
}
.submit-btn:hover:not(:disabled) {
  background: #ccc;
}
.submit-btn:disabled {
  color: #bbb;
  border-color: #ccc;
  cursor: default;
}
.success-msg {
  color: #2a6a2a;
}
</style>