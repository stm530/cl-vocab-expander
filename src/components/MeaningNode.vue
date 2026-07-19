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
      />
    </div>
  </div>
</template>

<script setup>
const props = defineProps({
  meaning: { type: Object, required: true },
  groupOrigin: { type: String, default: 'new' },
})
const emit = defineEmits(['remove', 'addMeaning'])
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
</style>