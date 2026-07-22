import { reactive, computed } from 'vue'
import { normalizeToInternal, serializeFromInternal, collectPosChoices, emptyWordTree, wordToTree, hasNewNode, collectMeaningTexts, defaultPosForWordnet, newId } from './lib/zpdc.js'
import { loadWordNet, isWordNetLoaded, pickRandomSynset, getSynsetWords, getSynsetDef, getHypernyms } from './db/wordnet.js'
import { SpellingIndex } from './lib/spellcheck.js'
import { TfidfSimilarityEngine } from './lib/similarity.js'
import { addStaging, listStaging, listApprovedStaging, exportStagingJSON, importStagingJSON, getIssuedSynsets, addIssuedSynset, clearIssuedSynsets, getAllowReissue, setAllowReissue, saveUploadedZpdc, loadUploadedZpdc, getUploadedFilename, clearUploadedZpdc } from './db/staging.js'
import { mergeApprovedStagingIntoZpdc } from './lib/merge.js'

export const store = reactive({
  zpdcReady: false,
  zpdcFilename: '',
  internalRoot: null,
  posChoices: [],

  wordnetReady: false,
  wordnetLoading: false,
  wordnetLoadProgress: 0,
  wordnetLoadError: '',

  spellIndex: null,
  simEngine: null,

  reissueAllowed: false,

  currentQuiz: null,

  senseAddSearchText: '',
  senseAddFound: [],

  reviewEntries: [],
  reviewLoading: false,
})

export function resetStore() {
  store.zpdcReady = false
  store.zpdcFilename = ''
  store.internalRoot = null
  store.posChoices = []
  store.spellIndex = null
  store.simEngine = null
  store.currentQuiz = null
  store.senseAddSearchText = ''
  store.senseAddFound = []
  store.reviewEntries = []
}

export async function initWordNet(onProgress) {
  if (isWordNetLoaded()) {
    store.wordnetReady = true
    store.wordnetLoading = false
    return
  }
  store.wordnetLoading = true
  store.wordnetLoadError = ''
  try {
    await loadWordNet({
      onProgress: ({ ratio }) => {
        store.wordnetLoadProgress = ratio
      }
    })
    store.wordnetReady = true
    store.wordnetLoading = false
  } catch (e) {
    store.wordnetReady = false
    store.wordnetLoading = false
    store.wordnetLoadError = e.message || 'WordNet の読み込みに失敗しました'
  }
  store.reissueAllowed = await getAllowReissue()
}

export async function loadZpdcFromUpload(file) {
  const text = await file.text()
  let raw
  try {
    raw = JSON.parse(text)
  } catch {
    throw new Error('ZPDCファイルのJSON解析に失敗しました')
  }
  const internal = normalizeToInternal(raw)
  store.internalRoot = internal
  store.posChoices = collectPosChoices(internal)
  store.spellIndex = new SpellingIndex()
  store.spellIndex.buildFromInternal(internal)
  store.simEngine = new TfidfSimilarityEngine()
  store.simEngine.buildFromInternal(internal)
  store.zpdcFilename = file.name
  store.zpdcReady = true
  await saveUploadedZpdc(internal, file.name)
}

export async function tryLoadZpdcFromIndexedDB() {
  const internal = await loadUploadedZpdc()
  if (!internal) return false
  store.internalRoot = internal
  store.posChoices = collectPosChoices(internal)
  store.spellIndex = new SpellingIndex()
  store.spellIndex.buildFromInternal(internal)
  store.simEngine = new TfidfSimilarityEngine()
  store.simEngine.buildFromInternal(internal)
  store.zpdcFilename = await getUploadedFilename()
  store.zpdcReady = true
  return true
}

export async function nextQuiz() {
  if (!store.zpdcReady || !store.wordnetReady) return null
  const allowReissue = await getAllowReissue()
  const issued = await getIssuedSynsets()
  const row = pickRandomSynset(issued, allowReissue, true)
  if (!row) return null
  await addIssuedSynset(row.synset)

  const words = getSynsetWords(row.synset)
  const defs = getSynsetDef(row.synset)
  const hyperRows = getHypernyms(row.synset)

  const targetLabel = words.ja.join(' / ') || words.en.join(' / ') || row.name || '(見出し語なし)'
  const defText = defs.map(d => `[${d.lang}] ${d.def}`).join(' / ')

  const hypernymCandidates = hyperRows.map((h) => {
    const hWords = getSynsetWords(h.synset)
    return {
      synset: h.synset,
      pos: h.pos,
      label: hWords.ja.join(' / ') || hWords.en.join(' / ') || h.name || '',
      def: getSynsetDef(h.synset).map(d => d.def).join(' / ')
    }
  })

  const targetTree = emptyWordTree('')
  if (targetTree.posGroups.length > 0) {
    targetTree.posGroups[0].titles = defaultPosForWordnet(row.pos, store.posChoices)
  }

  const hyperTrees = hypernymCandidates.map(() => emptyWordTree(''))
  if (hyperTrees.length === 0) {
    hyperTrees.push(emptyWordTree(''))
  }

  const targetMeaningTexts = words.ja.concat(words.en).filter(Boolean).map(s => String(s || '').trim()).filter(Boolean)
  const defTexts = defs.map(d => String(d.def || '').trim()).filter(Boolean)
  const queryText = targetMeaningTexts.join(' ') + ' ' + defTexts.join(' ')
  const similarResults = store.simEngine ? store.simEngine.search(queryText, 5, store.internalRoot) : []

  const similarTrees = similarResults.map((r) => {
    const t = wordToTree(r.word)
    if (!hasNewNode(t)) {
      const pg = t.posGroups.find(g => g.origin === 'existing')
      if (pg) {
        pg.meanings = pg.meanings.filter(m => m.text && m.text.trim())
        if (pg.meanings.length === 0) pg.meanings.push({ id: newId('m'), origin: 'existing', text: '', _srcEquivalentIndex: null })
      }
    }
    return t
  })

  const q = {
    synset: row.synset,
    pos: row.pos,
    targetLabel,
    targetTree,
    hyperTrees,
    hypernymCandidates,
    similarTrees,
    similarResults,
    submitted: false,
  }

  store.currentQuiz = q
  return q
}

export async function submitQuiz() {
  const q = store.currentQuiz
  if (!q) return

  if (hasNewNode(q.targetTree)) {
    for (const pg of q.targetTree.posGroups) {
      const meanings = pg.meanings.filter(m => m.origin === 'new' && m.text && m.text.trim()).map(m => m.text.trim())
      if (meanings.length > 0) {
        await addStaging({
          type: 'new_word',
          spelling: q.targetTree.spelling.trim(),
          pos: pg.titles || [],
          meanings,
          source: { kind: 'new', synset: q.synset, gloss: q.targetLabel }
        })
      }
    }
  }

  for (const ht of q.hyperTrees) {
    if (!hasNewNode(ht)) continue
    for (const pg of ht.posGroups) {
      const meanings = pg.meanings.filter(m => m.origin === 'new' && m.text && m.text.trim()).map(m => m.text.trim())
      if (meanings.length > 0) {
        await addStaging({
          type: 'new_word',
          spelling: ht.spelling.trim(),
          pos: pg.titles || [],
          meanings,
          source: { kind: 'hypernym', synset: q.synset, gloss: q.targetLabel }
        })
      }
    }
  }

  for (const st of q.similarTrees) {
    if (st.origin === 'new' && hasNewNode(st)) {
      for (const pg of st.posGroups) {
        const meanings = pg.meanings.filter(m => m.origin === 'new' && m.text && m.text.trim()).map(m => m.text.trim())
        if (meanings.length > 0) {
          await addStaging({
            type: 'new_word',
            spelling: st.spelling.trim(),
            pos: pg.titles || [],
            meanings,
            source: { kind: 'similar', synset: q.synset, gloss: q.targetLabel }
          })
        }
      }
    } else if (st._wordNumber) {
      const newMeanings = []
      for (const pg of st.posGroups) {
        for (const m of pg.meanings) {
          if (m.origin === 'new' && m.text && m.text.trim()) {
            newMeanings.push({ text: m.text.trim(), pos: pg.titles || [] })
          }
        }
      }
      for (const nm of newMeanings) {
        await addStaging({
          type: 'add_sense',
          wordNumber: st._wordNumber,
          spelling: st.spelling,
          pos: nm.pos,
          meanings: [nm.text],
          source: { kind: 'similar-sense', synset: q.synset, gloss: q.targetLabel }
        })
      }
    }
  }

  q.submitted = true
}

export async function submitSenseAdd(word, newMeanings) {
  for (const nm of newMeanings) {
    await addStaging({
      type: 'add_sense',
      wordNumber: word.number,
      spelling: word.spelling,
      pos: nm.pos || [],
      meanings: [nm.text],
      source: { kind: 'sense-add' }
    })
  }
}

export async function loadReviewEntries() {
  store.reviewLoading = true
  store.reviewEntries = await listStaging()
  store.reviewLoading = false
}

export async function exportZpdcJSON() {
  if (!store.internalRoot) throw new Error('辞書データが読み込まれていません')
  const approved = await listApprovedStaging()
  const merged = mergeApprovedStagingIntoZpdc(store.internalRoot, approved)
  return serializeFromInternal(merged)
}

export function spellCheck(input) {
  if (!store.spellIndex) return []
  return store.spellIndex.search(input)
}

export function similarSearch(query, k = 5) {
  if (!store.simEngine) return []
  return store.simEngine.search(query, k, store.internalRoot)
}