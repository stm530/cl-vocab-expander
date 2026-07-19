<template>
  <div class="pos-group-node" :class="{ 'existing-node': group.origin === 'existing' }">
    <div class="pos-row">
      <span class="btn-group">
        <button class="node-btn" @click="addPosSibling" title="品詞追加">+</button>
        <button class="node-btn" :class="{ disabled: group.origin === 'existing' && rootOrigin === 'existing' }" :disabled="group.origin === 'existing' && rootOrigin === 'existing'" @click="$emit('remove')" title="品詞削除">-</button>
      </span>
      <span class="pos-checkboxes" v-if="editing">
        <label v-for="c in posChoices" :key="c" class="pos-check">
          <input type="checkbox" :value="c" v-model="group.titles" />
          {{ c }}
        </label>
      </span>
      <span class="pos-text" v-else>
        {{ group.titles.join(', ') || '(未選択)' }}
      </span>
      <button class="toggle-edit-btn" @click="editing = !editing" title="編集切替">
        {{ editing ? '確定' : '編集' }}
      </button>
    </div>
    <div class="children">
      <MeaningNode
        v-for="(m, i) in group.meanings"
        :key="m.id"
        :meaning="m"
        :group-origin="group.origin"
        @remove="removeMeaning(i)"
        @addMeaing="addMeaning"
      />
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import MeaningNode from './MeaningNode.vue'
import { newId, newMeaningNode } from '../lib/zpdc.js'

const props = defineProps({
  group: { type: Object, required: true },
  posChoices: { type: Array, default: () => [] },
  rootOrigin: { type: String, default: 'new' },
})
const emit = defineEmits(['remove', 'addPos'])

const editing = ref(props.group.titles.length === 0)

function addPosSibling() {
  emit('addPos')
}

function limitLogs(i) {
  if (props.group.meanings.length <= 1) return
  props.group.meanings.splice(i, 1)
}

function addMeaning() {
  props.group.meanings.push(newMeaningNode('', 'new'))
}
</script>

<style scoped>
.pos-group-node {
  margin-bottom: 2px;
}
.existing-node .pos-row {
  background: #f8f8f6;
}
.pos-row {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 2px 0;
}
.pos-checkboxes {
  display: inline-flex;
  flex-wrap: wrap;
  gap: 2px 6px;
}
.pos-check {
  display: inline-flex;
  gap: 2px;
  align-items: center;
  font-size: 13px;
  white-space: nowrap;
}
.pos-text {
  font-family: monospace;
  font-size: 14px;
  color: #444;
}
.toggle-edit-btn {
  padding: 1px 6px;
  font-size: 12px;
  border: 1px solid #bbb;
  background: #eee;
  cursor: pointer;
}
.toggle-edit-btn:hover {
  background: #ddd;
}
.children {
  padding-left: 16px;
}
</style>