import initSqlJs from 'sql.js'

// sql.js の wasm を public/ 配下から読み込む。
// viteのbase pathが '/cl-vocab-expander/' でも確実に解決できるように
// import.meta.env.BASE_URL を使う（末尾スラッシュあり）。
const WASM_URL = (import.meta.env.BASE_URL || '/') + 'sql-wasm.wasm'
const DB_URL = (import.meta.env.BASE_URL || '/') + 'wnjpn.db'

let SQL = null
let db = null
let loadPromise = null

// sql.js の Statement には .all()/.get(params) が無いため、
// プレースホルダ付きSQLから全行/1行を取得するヘルパー。
function runAll(sql, params = []) {
  const stmt = db.prepare(sql)
  stmt.bind(params)
  const rows = []
  while (stmt.step()) rows.push(stmt.getAsObject())
  stmt.free()
  return rows
}

function runOne(sql, params = []) {
  const stmt = db.prepare(sql)
  stmt.bind(params)
  const row = stmt.step() ? stmt.getAsObject() : null
  stmt.free()
  return row
}

// WordNetの品詞文字 → 人間可読の表示名（日本語WordNetのpos_defテーブル互換）
const POS_LABELS = {
  n: '名詞',
  v: '動詞',
  a: '形容詞',
  r: '副詞',
  s: '形容詞' // "satellite adjective" は形容詞にまとめる
}

export function wordnetPosLabel(pos) {
  return POS_LABELS[pos] || pos || ''
}

// WordNetをブラウザ内にロードする。初回は数十〜数百MBのDBダウンロードが発生する。
// 既にロード済みならキャッシュを返す（複数回呼ばれても1回だけ読み込む）。
export async function loadWordNet({ onProgress } = {}) {
  if (db) return db
  if (loadPromise) return loadPromise
  loadPromise = (async () => {
    // 1) sql.js 本体と wasm を初期化
    SQL = await initSqlJs({ locateFile: () => WASM_URL })

    // 2) DBファイルを fetch で取得（進捗コールバック対応）
    const resp = await fetch(DB_URL)
    if (!resp.ok) throw new Error(`wnjpn.db の取得に失敗: ${resp.status}`)
    const contentEncoding = resp.headers.get('Content-Encoding') || ''
    const total = Number(resp.headers.get('Content-Length') || 0)
    const hasProgress = resp.body && total && onProgress && !contentEncoding
    if (!hasProgress) {
      const buf = await resp.arrayBuffer()
      db = new SQL.Database(new Uint8Array(buf))
      return db
    }
    // ストリーム読み込み＋進捗
    const reader = resp.body.getReader()
    const chunks = []
    let received = 0
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      chunks.push(value)
      received += value.length
      onProgress({ received, total, ratio: received / total })
    }
    const merged = new Uint8Array(received)
    let offset = 0
    for (const c of chunks) {
      merged.set(c, offset)
      offset += c.length
    }
    db = new SQL.Database(merged)
    return db
  })()
  return loadPromise
}

export function isWordNetLoaded() {
  return !!db
}

// --- 検索API ---------------------------------------------------------------

// まだ出題していないsynsetをランダムに1件取得（3章）。
// excludeSynsets: 出題済みsynset ID の Set。
// allowReissue: trueなら出題済みでも再出題する（3章オプション）。
// requireJapanese: trueなら日本語 lemma が最低1つ存在する synset のみを候補にする。
//   （デフォルト true。wnjpn は英語 synset を全て内包しているが、未翻訳のものは
//   ja lemma を持たずフォールバックの英語ラベルしか表示できないため除外する。）
export function pickRandomSynset(excludeSynsets, allowReissue = false, requireJapanese = true) {
  if (!db) throw new Error('WordNet が未ロード')
  const conds = []
  const params = []
  if (!allowReissue && excludeSynsets && excludeSynsets.size > 0) {
    // null/undefined/非文字列が混じっていると NOT IN が全件マッチを返すので除外する
    const valid = [...excludeSynsets].filter((v) => v !== null && v !== undefined && v !== '')
    if (valid.length > 0) {
      conds.push(`s.synset NOT IN (${valid.map(() => '?').join(',')})`)
      params.push(...valid)
    }
  }
  if (requireJapanese) {
    // 日本語 lemma が空白以外で最低1つ紐づいている synset のみ。
    // EXISTS で先頭ヒットで打ち切るのでコストも軽い。
    conds.push(`EXISTS (
      SELECT 1 FROM sense sj
        JOIN word wj ON sj.wordid = wj.wordid
       WHERE sj.synset = s.synset
         AND sj.lang = 'jpn'
         AND TRIM(wj.lemma) <> ''
    )`)
  }
  let sql = `SELECT s.synset, s.pos, s.name FROM synset s`
  if (conds.length > 0) sql += ` WHERE ` + conds.join(' AND ')
  sql += ` ORDER BY RANDOM() LIMIT 1`
  const row = db && runOne(sql, params)
  return row || null
}

// synset の見出し語（日本語優先、無ければ英語）の一覧を取得。
export function getSynsetWords(synset) {
  const rows = runAll(
    `SELECT w.lemma, s.lang, w.pos
       FROM sense s JOIN word w ON s.wordid = w.wordid
       WHERE s.synset = ? ORDER BY s.lang ASC, s.rank ASC`,
    [synset],
  )
  const ja = rows.filter((r) => r.lang === 'jpn').map((r) => (r.lemma || '').trim())
  const en = rows.filter((r) => r.lang === 'eng').map((r) => (r.lemma || '').trim())
  return { ja, en, all: rows }
}

// synset の定義文（gloss）を取得。日本語優先。
export function getSynsetDef(synset) {
  return runAll(
    `SELECT lang, def FROM synset_def WHERE synset = ? ORDER BY CASE WHEN lang='jpn' THEN 0 ELSE 1 END, sid ASC`,
    [synset],
  )
}

// synset の直接の上位語（hypernym）を取得。複数ある場合はすべて返す（3章）。
export function getHypernyms(synset) {
  return runAll(
    `SELECT s2.synset, s2.pos, s2.name
       FROM synlink l JOIN synset s2 ON l.synset2 = s2.synset
       WHERE l.synset1 = ? AND l.link = 'hypernym'`,
    [synset],
  )
}

// synset の下位語（hyponym）。任意の追加関連語取得用（2.1節、3章6項目）。
export function getHyponyms(synset) {
  return runAll(
    `SELECT s2.synset, s2.pos, s2.name
       FROM synlink l JOIN synset s2 ON l.synset2 = s2.synset
       WHERE l.synset1 = ? AND l.link = 'hyponym'`,
    [synset],
  )
}

// synset の反意語（antonym）。
export function getAntonyms(synset) {
  return runAll(
    `SELECT s2.synset, s2.pos, s2.name
       FROM synlink l JOIN synset s2 ON l.synset2 = s2.synset
       WHERE l.synset1 = ? AND l.link = 'antonym'`,
    [synset],
  )
}

// 任意の link 種別で synset を辿る汎用API（2.1節の柔軟検索）。
export function getLinkedSynsets(synset, link) {
  return runAll(
    `SELECT s2.synset, s2.pos, s2.name, ? AS link
       FROM synlink l JOIN synset s2 ON l.synset2 = s2.synset
       WHERE l.synset1 = ? AND l.link = ?`,
    [link, synset, link],
  )
}

// 全 synset 数（Settings画面や動作確認用）。
export function countSynsets() {
  return (runOne('SELECT COUNT(*) c FROM synset') || {}).c || 0
}
