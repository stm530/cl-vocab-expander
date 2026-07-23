<template>
  <div class="spell-suggestion" v-if="matches.length > 0">
    <p class="sug-label">既存語との類似綴り:</p>
    <div class="sug-box">
      <ul class="sug-list">
        <li v-for="m in matches" :key="m.wordNumber" class="sug-item">
          <span class="sug-spelling">{{ m.spelling }}</span>
          <template v-for="(me, j) in m.meanings" :key="'me' + j">
            <span class="sug-meanings">
              <span v-if="me.pos && me.pos.length > 0" class="meaning-pos">[{{ me.pos.join(', ') }}]</span>
              {{ me.text }}
            </span>
          </template>
        </li>
      </ul>
    </div>
  </div>
</template>

<script setup>
import { ref, watch, computed } from 'vue'
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

const displayMatches = computed(() => {
  return matches.value.slice(0, 20)
})
</script>

<style scoped>
.spell-suggestion {
  margin-left: 20px;
  font-size: 12px;
}
.sug-label {
  color: #888;
  margin: 0 0 4px 0;
}
.sug-box {
  max-height: 180px;
  overflow-y: auto;
  border: 1px solid #eee;
  background: #fafafa;
  border-radius: 4px;
  padding: 4px 8px;
}
.sug-list {
  margin: 0;
  padding: 0 0 0 16px;
  list-style: none;
}
.sug-item {
  padding: 2px 0;
  line-height: 1.5;
}
.sug-spelling {
  font-family: monospace;
  color: #555;
  margin-right: 8px;
  font-weight: 500;
}
.sug-meanings {
  color: #888;
  margin-right: 12px;
}
.meaning-pos {
  color: #999;
  margin-right: 4px;
  font-size: 11px;
}
</style>