<template>
  <div class="quiz-view">
    <div v-if="!store.zpdcReady" class="notice">
      <p>先に「辞書」タブでZPDCファイルをアップロードしてください。</p>
    </div>
    <div v-else-if="!store.wordnetReady" class="notice">
      <p>WordNetの読み込みが完了するまでお待ちください。</p>
    </div>

    <template v-else>
      <div class="quiz-controls" v-if="!quiz || quiz.submitted">
        <button @click="newQuiz" :disabled="loading">次の出題</button>
        <label class="checkbox-inline">
          <input type="checkbox" v-model="reissue" />
          出題済みを再出題する
        </label>
        <span class="issued-info">出題済み: {{ issuedCount }}件</span>
      </div>

      <div v-if="quiz && !quiz.submitted" class="card">
        <div class="card-header">
          <span class="card-title">課題: {{ quiz.targetLabel }}</span>
          <span class="card-pos">(WordNet POS: {{ quiz.pos }})</span>
        </div>

        <section class="tree-section">
          <h4>ターゲット単語（新語登録）</h4>
          <WordNode
            :tree="quiz.targetTree"
            :pos-choices="store.posChoices"
            variant="target"
          />
        </section>

        <section class="tree-section">
          <h4>親概念単語</h4>
          <div v-for="(t, i) in quiz.hyperTrees" :key="'hyper-' + i" class="hyper-block">
            <p class="hyper-label" v-if="quiz.hypernymCandidates[i]">
              上位語（{{ quiz.hypernymCandidates[i].label }}）
            </p>
            <WordNode
              :tree="t"
              :pos-choices="store.posChoices"
              variant="hyper"
            />
    </div>
          <p v-if="quiz.hyperTrees.length === 0" class="notice">上位語なし（最上位概念）</p>
        </section>

        <section class="tree-section">
          <h4>近そうな単語（参考類似語）</h4>
          <div v-for="(t, i) in quiz.similarTrees" :key="'sim-' + i" class="sim-block">
            <p class="sim-score" v-if="quiz.similarResults[i]">
              {{ quiz.similarResults[i].spelling }} (類似度: {{ (quiz.similarResults[i].score * 100).toFixed(1) }}%)
            </p>
            <WordNode
              :tree="t"
              :pos-choices="store.posChoices"
              variant="similar"
            />
          </div>
          <p v-if="quiz.similarTrees.length === 0" class="notice">類似語ヒットなし</p>
        </section>

        <div class="submit-controls">
          <div class="auto-check">
            <span :class="['check-mark', { active: hasTargetNew }]">新語登録</span>
            <span :class="['check-mark', { active: hasHyperNew }]">親概念登録</span>
            <span :class="['check-mark', { active: hasSimilarNew }]">類似語意味登録</span>
          </div>
          <button @click="submitCurrent" class="submit-btn" :disabled="!hasAnyNew">提出</button>
        </div>
      </div>

      <div v-if="quiz?.submitted" class="submitted-notice">
        提出しました。ステージングに記録されました。次の出題へどうぞ。
      </div>
    </template>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { store, nextQuiz, submitQuiz } from '../store.js'
import { hasNewNode } from '../lib/zpdc.js'
import { getIssuedSynsets, getAllowReissue, setAllowReissue } from '../db/staging.js'
import WordNode from '../components/WordNode.vue'

const quiz = computed(() => store.currentQuiz)
const loading = ref(false)
const reissue = ref(false)
const issuedCount = ref(0)

let issuedCache = new Set()
async function refreshIssued() {
  issuedCache = await getIssuedSynsets()
  issuedCount.value = issuedCache.size
}

let hasNew = ref(false)
function refreshAll() {
  hasNew.value = quiz.value ? hasNewNode(quiz.value.targetTree) : false
}
const hasTargetNew = computed(() => quiz.value ? hasNewNode(quiz.value.targetTree) : false)
const hasHyperNew = computed(() => {
  if (!quiz.value) return false
  return quiz.value.hyperTrees.some(t => hasNewNode(t))
})
const hasSimilarNew = computed(() => {
  if (!quiz.value) return false
  return quiz.value.similarTrees.some(t => hasNewNode(t))
})
const hasAnyNew = computed(() => hasTargetNew.value || hasHyperNew.value || hasSimilarNew.value)

async function fetchQuiz() {
  loading.value = true
  const r = await getAllowReissue()
  reissue.value = r
  await nextQuiz()
  await refreshIssued()
  loading.value = false
}

async function submitCurrent() {
  await submitQuiz()
}

watch(reissue, async (val) => {
  await setAllowReissue(val)
})

refreshIssued()
</script>

<style scoped>
.quiz-view {
  padding: 8px 0;
}
.notice {
  color: #888;
}
.card {
  border: 1px solid #ccc;
  padding: 12px;
}
.card-header {
  display: flex;
  gap: 8px;
  padding-bottom: 6px;
  margin-bottom: 8px;
  border-bottom: 1px solid #eee;
}
.card-title {
  font-weight: bold;
  font-size: 15px;
}
.card-pos {
  color: #666;
  font-size: 13px;
}
.tree-section {
  margin-bottom: 12px;
}
.tree-section h4 {
  margin: 0 0 4px 0;
  font-size: 13px;
  color: #444;
}
.hyper-block {
  margin-bottom: 6px;
}
.hyper-label {
  font-size: 12px;
  color: #666;
  margin: 0 0 2px 0;
}
.sim-block {
  margin-bottom: 6px;
}
.sim-score {
  font-size: 12px;
  color: #666;
  margin: 0 0 2px 0;
}
.submit-controls {
  display: flex;
  gap: 8px;
  align-items: center;
  margin-top: 12px;
  padding-top: 8px;
  border-top: 1px solid #ccc;
}
.auto-check {
  display: flex;
  gap: 12px;
  flex: 1;
}
.check-mark {
  font-size: 13px;
  color: #bbb;
}
.check-mark.active {
  color: #2a6a2a;
  font-weight: bold;
}
.submit-btn {
  padding: 6px 24px;
  border: 1px solid #666;
  background: #ddd;
  cursor: pointer;
  font-weight: bold;
  font-size: 14px;
}
.submit-btn:hover:not(:disabled) {
  background: #ccc;
}
.submit-btn:disabled {
  color: #bbb;
  border-color: #ccc;
  cursor: default;
}
.submitted-notice {
  padding: 12px;
  background: #efe;
  border: 1px solid #8c8;
  margin-top: 8px;
}
.checkbox-inline {
  display: inline-flex;
  gap: 4px;
  align-items: center;
  font-size: 13px;
}
</style>