<template>
  <div class="spell-suggestion" v-if="matches.length > 0">
    <p class="sug-label">既存語との類似綴り:</p>
    <ul class="sug-list">
      <li v-for="m in matches" :key="m.wordNumber" class="sug-item">
        <span class="sug-spelling">{{ m.spelling }}</span>
        <span class="sug-meanings" v-for="(me, j) in m.meanings" :key="'me' + j">{{ me.text }}</span>
      </li>
    </ul>
  </div>
</template>

<script setup>
import { ref, watch } from 'vue'
import { store } from '../store.js'

const props = defineProps({
  spelling: { type: String, default: '' },
})
const matches = ref([])

watch(() => props.spelling, check, { immediate: true })

function check(val) {
  if (!val || val.length < 2) {
    matches.value = []
    return
  }
  matches.value = (store.spellIndex ? store.spellIndex.search(val) : [])
}
</script>

<style scoped>
.spell-suggestion {
  margin-left: 20px;
  font-size: 12px;
}
.sug-label {
  color: #888;
  margin: 0;
}
.sug-list {
  margin: 0;
  padding: 0 0 0 16px;
  list-style: none;
}
.sug-item {
  padding: 1px 0;
}
.sug-spelling {
  font-family: monospace;
  color: #555;
  margin-right: 8px;
}
.sug-meanings {
  color: #888;
}
</style>