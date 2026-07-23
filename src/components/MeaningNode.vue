<template>
  <div class="meaning-node" :class="{ 'existing-node': meaning.origin === 'existing' }">
    <div class="meaning-row">
      <span class="btn-group">
        <button class="node-btn" @click="$emit('addMeaning')" title="意味追加">+</button>
        <button class="node-btn" :class="{ disabled: meaning.origin === 'existing' }" :disabled="meaning.origin === 'existing'" @click="$emit('remove')" title="意味削除">-</button>
      </span>
      <input
        type="text"
        class="meaning-input"
        v-model="meaning.text"
        :disabled="meaning.origin === 'existing'"
        placeholder="日本語意味"
        @input="onInput"
      />
      <button class="search-btn" @click="searchMeanings" title="既存語の意味を検索">検索</button>
    </div>
    <div v-if="searchResults.length > 0" class="meaning-search-results">
      <p class="search-label">既存語の意味（参考）:</p>
      <ul class="search-list">
        <li v-for="r in searchResults" :key="r.wordNumber + '-' + r.text" class="search-item">
          <span class="search-spelling">{{ r.spelling }}</span>
          <span class="search-pos" v-if="r.pos.length > 0">[{{ r.pos.join(', ') }}]</span>
          <span class="search-text">{{ r.text }}</span>
        </li>
      </ul>
    </div>
  </div>
</template>

<script setup>
import { ref, watch } from 'vue'
import { store, searchMeaningsByText } from '../store.js'

const props = defineProps({
  meaning: { type: Object, required: true },
  groupOrigin: { type: String, default: 'new' },
})
const emit = defineEmits(['remove', 'addMeaning'])

const searchResults = ref([])
let searchTimeout = null

function onInput() {
  // Debounce the search
  if (searchTimeout) clearTimeout(searchTimeout)
  searchTimeout = setTimeout(() => {
    if (props.meaning.text && props.meaning.text.trim().length >= 1) {
      searchResults.value = searchMeaningsByText(props.meaning.text.trim(), 10)
    } else {
      searchResults.value = []
    }
  }, 300)
}

function searchMeanings() {
  if (props.meaning.text && props.meaning.text.trim().length >= 1) {
    searchResults.value = searchMeaningsByText(props.meaning.text.trim(), 10)
  } else {
    searchResults.value = []
  }
}
</script>

<style scoped>
.meaning-node {
  margin-bottom: 1px;
}
.existing-node .meaning-row {
  background: #f6f6f6;
}
.meaning-row {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 1px 0;
}
.meaning-input {
  flex: 1;
  min-width: 200px;
  padding: 2px 4px;
  border: 1px solid #ccc;
  font-family: monospace;
  font-size: 14px;
}
.meaning-input:disabled {
  background: #f6f6f6;
  color: #555;
}
.search-btn {
  padding: 2px 8px;
  font-size: 12px;
  border: 1px solid #999;
  background: #eee;
  cursor: pointer;
  white-space: nowrap;
}
.search-btn:hover {
  background: #ddd;
}
.meaning-search-results {
  margin-top: 4px;
  padding: 8px;
  border: 1px solid #e0e0e0;
  background: #fafafa;
  border-radius: 4px;
  max-height: 200px;
  overflow-y: auto;
  font-size: 12px;
}
.search-label {
  margin: 0 0 6px 0;
  color: #666;
  font-weight: bold;
}
.search-list {
  margin: 0;
  padding: 0 0 0 16px;
  list-style: none;
}
.search-item {
  padding: 2px 0;
  line-height: 1.5;
}
.search-spelling {
  font-family: monospace;
  color: #555;
  margin-right: 8px;
  font-weight: 500;
}
.search-pos {
  color: #999;
  margin-right: 4px;
  font-size: 11px;
}
.search-text {
  color: #666;
}
</style>