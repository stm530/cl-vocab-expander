import Dexie from 'dexie'

// ステージング永続化（仕様書v2 8章）。
// IndexedDB + Dexie.js で「作業中の自動保存」を担う。
// 二重化のため、手動でJSONエクスポート/インポートも可能（8.3節）。

export const StagingRecordType = Object.freeze({
  NEW_WORD: 'new_word', // 新規語（6章の新語登録ツリー）
  ADD_SENSE: 'add_sense' // 既存語への意味追加（7章）
})

class StagingDB extends Dexie {
  constructor() {
    super('cl-vocab-expander')
    this.version(1).stores({
      // 主キーは自採番ID、インデックスは日時と approved / type / wordNumber
      staging: 'id, createdAt, approved, type, wordNumber',
      // StagingApplyState: 今のところ最後に適用した ID を記録する等の補助情報
      meta: 'key'
    })
  }
}

export const db = new StagingDB()

// ステージングエントリ1件を追加する。shape:
//   {
//     id, type, wordNumber(optional, add_senseの場合は必須),
//     spelling, pos (titlesの配列), meanings (string[]),
//     origin source info (synset, kind, ...),
//     createdAt, approved=false
//   }
export async function addStaging(record) {
  const id = record.id || `stg_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
  const row = {
    id,
    type: record.type,
    wordNumber: record.wordNumber ?? null,
    wordId: record.wordId ?? null,
    spelling: record.spelling || '',
    pos: Array.isArray(record.pos) ? record.pos : [],
    meanings: Array.isArray(record.meanings) ? record.meanings : [],
    relations: Array.isArray(record.relations) ? record.relations : [],
    source: record.source || null, // { kind: 'new'|'hypernym'|'similar', synset, gloss }
    createdAt: record.createdAt ?? new Date().toISOString(),
    approved: false
  }
  await db.staging.add(row)
  return row
}

export async function listStaging() {
  return db.staging.orderBy('createdAt').toArray()
}

export async function listApprovedStaging() {
  return db.staging.where('approved').equals(1).toArray()
}

export async function setApproved(id, approved) {
  await db.staging.update(id, { approved: approved ? 1 : 0 })
}

export async function setApprovedMany(ids, approved) {
  for (const id of ids) {
    await db.staging.update(id, { approved: approved ? 1 : 0 })
  }
}

export async function deleteStaging(id) {
  await db.staging.delete(id)
}

export async function clearStaging() {
  await db.staging.clear()
}

// 全ステージング内容を JSON にシリアライズしてダウンロード（8.3節）。
export async function exportStagingJSON() {
  const all = await listStaging()
  return JSON.stringify(
    {
      app: 'cl-vocab-expander',
      kind: 'staging-backup',
      exportedAt: new Date().toISOString(),
      entries: all
    },
    null,
    2
  )
}

// JSONテキストからステージングをインポート（8.3節）。
// 既存エントリは一旦全クリアしてから置き換える（シンプルさのため）。
export async function importStagingJSON(jsonText) {
  const data = JSON.parse(jsonText)
  if (data?.app !== 'cl-vocab-expander' || data?.kind !== 'staging-backup') {
    throw new Error('ステージングバックアップファイルではありません')
  }
  await db.staging.clear()
  const entries = (data.entries || []).map((e) => ({ ...e, approved: e.approved ? 1 : 0 }))
  if (entries.length) await db.staging.bulkAdd(entries)
  return entries.length
}

// --- 出題済み synset の記録（3章） ----------------------------------------
// 3章の「出題済みsynset IDメモ」と再出題オプションを同じIndexedDBで管理する。
// metaテーブルのキー:
//   issuedSynsets        … JSON配列文字列
//   allowReissue         … '1' / '0'
//   posMapping           … WordNetのpos → ZPDCのtitles配列 JSON
export async function getMeta(key, fallback = null) {
  const row = await db.meta.get(key)
  return row ? row.value : fallback
}

export async function setMeta(key, value) {
  await db.meta.put({ key, value })
}

export async function getIssuedSynsets() {
  const raw = await getMeta('issuedSynsets', '[]')
  try {
    const arr = JSON.parse(raw)
    if (!Array.isArray(arr)) return new Set()
    const filtered = arr.filter((v) => v !== null && v !== undefined && v !== '')
    if (filtered.length !== arr.length) {
      await setMeta('issuedSynsets', JSON.stringify(filtered))
    }
    return new Set(filtered)
  } catch {
    return new Set()
  }
}

export async function addIssuedSynset(synset) {
  const cur = await getIssuedSynsets()
  if (!cur.has(synset)) {
    cur.add(synset)
    await setMeta('issuedSynsets', JSON.stringify([...cur]))
  }
}

export async function clearIssuedSynsets() {
  await setMeta('issuedSynsets', '[]')
}

export async function getAllowReissue() {
  return (await getMeta('allowReissue', '0')) === '1'
}

export async function setAllowReissue(flag) {
  await setMeta('allowReissue', flag ? '1' : '0')
}

export async function getPosMapping() {
  const raw = await getMeta('posMapping', 'null')
  try {
    const o = JSON.parse(raw)
    return o && typeof o === 'object' ? o : null
  } catch {
    return null
  }
}

export async function setPosMapping(mapping) {
  await setMeta('posMapping', JSON.stringify(mapping || {}))
}

// --- ZPDCデータ本体のメタ管理 ----------------------------------------------
// アップロードした元データもIndexedDBに保持する（ブラウザ閉じても再利用可）。
//   uploadedZpdc     … 内部表現JSON文字列（normalizeToInternalの結果）
//   uploadedFilename
export async function saveUploadedZpdc(internal, filename) {
  await setMeta('uploadedZpdc', JSON.stringify(internal))
  await setMeta('uploadedFilename', filename || '')
}

export async function loadUploadedZpdc() {
  const raw = await getMeta('uploadedZpdc', null)
  if (!raw) return null
  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}

export async function getUploadedFilename() {
  return getMeta('uploadedFilename', '')
}

export async function clearUploadedZpdc() {
  await setMeta('uploadedZpdc', null)
  await setMeta('uploadedFilename', '')
}
