<template>
  <div class="word-node" :class="{ 'existing-node': tree.origin === 'existing' }">
    <div class="word-row">
      <span class="btn-group">
        <button class="node-btn" @click="addWordSibling" title="単語追加">+</button>
        <button class="node-btn" :class="{ disabled: tree.origin === 'existing' }" :disabled="tree.origin === 'existing'" @click="$emit('remove')" title="単語削除">-</button>
      </span>
      <input
        type="text"
        class="word-input"
        v-model="tree.spelling"
        :disabled="tree.origin === 'existing'"
        placeholder="綴り"
        @blur="onSpellingBlur"
      />
      <SpellSuggestion :spelling="tree.spelling" />
    </div>
    <div class="children">
      <PosGroupNode
        v-for="(pg, i) in tree.posGroups"
        :key="pg.id"
        :group="pg"
        :pos-choices="posChoices"
        :root-origin="tree.origin"
        @remove="removePosGroup(i)"
      />
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import PosGroupNode from './PosGroupNode.vue'
import SpellSuggestion from './SpellSuggestion.vue'
import { newId, newPosGroupNode } from '../lib/zpdc.js'

const props = defineProps({
  tree: { type: Object, required: true },
  posChoices: { type: Array, default: () => [] },
  variant: { type: String, default: '' },
})
const emit = defineEmits(['remove'])

function addWordSibling() {
  emit('addWord')
}

function onSpellingBlur() {
}

function removePosGroup(i) {
  if (props.tree.posGroups.length <= 1) return
  props.tree.posGroups.splice(i, 1)
}

function getSiblingWords() {
  return []
}
</script>

<style scoped>
.word-node {
  margin-bottom: 2px;
}
.existing-node .word-row {
  background: #f6f6f6;
}
.word-row {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 2px 0;
}
.btn-group {
  display: inline-flex;
  gap: 0;
}
.node-btn {
  width: 24px;
  height: 24px;
  padding: 0;
  border: 1px solid #bbb;
  background: #eee;
  cursor: pointer;
  font-size: 16px;
  line-height: 22px;
  text-align: center;
}
.node-btn:hover {
  background: #ddd;
}
.node-btn.disabled, .node-btn:disabled {
  color: #ccc;
  border-color: #ddd;
  cursor: default;
  background: #f6f6f6;
}
.word-input {
  flex: 1;
  min-width: 120px;
  padding: 2px 4px;
  border: 1px solid #ccc;
  font-family: monospace;
  font-size: 14px;
}
.word-input:disabled {
  background: #f6f6f6;
  color: #555;
}
.children {
  padding-left: 16px;
}
</style>