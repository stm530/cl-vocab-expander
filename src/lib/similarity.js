// 「近そうな単語」検索（仕様書v2 4章）。
// 外部API不使用・ローカル完結の要件（4章）を満たすため、TF-IDF + コサイン類似度
// で純JS実装する。
//
// 仕様書11章の「埋め込みモデルの具体選定」は未確定事項だが、初版は
// トレンドの外部APIではなく「差し替えやすいIFにおく純JS簡易実装」を採用。
// 後から transformers.js 等の本格的な選定に移行できるよう、ここでは
// `SimilarityEngine` という薄いIFで括る。

// --- トークン化（簡易。日本語はN文字のcharacter n-gram、英語は空白区切り） ---
function tokenize(text) {
  const norm = (text || '').toLowerCase().replace(/\s+/g, ' ').trim()
  if (!norm) return []
  const tokens = new Set()
  // 英語っぽいトークン（ASCII英字・数字）
  const ascii = norm.match(/[a-z0-9]+/g) || []
  for (const t of ascii) tokens.add(t)
  // 日本語：2-gram（文字単位）
  const stripped = norm.replace(/[a-z0-9]/g, '')
  for (let i = 0; i + 2 <= stripped.length; i++) {
    tokens.add(stripped.slice(i, i + 2))
  }
  // 1文字残りも残す（短い見出し語対応）
  if (stripped.length === 1) tokens.add(stripped)
  return [...tokens]
}

export class TfidfSimilarityEngine {
  constructor() {
    this.docs = [] // [{ wordNumber, spelling, tokens:Set, tf:Map, vec:Map }]
    this.df = new Map() // token -> 出現文書数
    this.idf = new Map()
    this.docCount = 0
  }

  // 1語の「語義説明 + 訳語」テキストを結合して文書とする（4章）。
  buildFromInternal(internal) {
    this.docs = []
    this.df = new Map()
    this.docCount = 0
    for (const w of internal?.words || []) {
      const parts = []
      for (const sec of w.sections || []) {
        for (const e of sec.equivalents || []) {
          parts.push((e.terms || []).join(' '))
          parts.push(e.termString || '')
        }
        for (const info of sec.informations || []) {
          parts.push(info.title || '', info.text || '')
        }
      }
      const text = parts.join(' ')
      const tokens = tokenize(text)
      if (tokens.length === 0) continue
      const tf = new Map()
      for (const t of tokens) tf.set(t, (tf.get(t) || 0) + 1)
      this.docs.push({ wordNumber: w.number, spelling: w.spelling, tokens: new Set(tokens), tf })
      for (const t of new Set(tokens)) this.df.set(t, (this.df.get(t) || 0) + 1)
      this.docCount += 1
    }
    // idf = log( N / (1+df) )（ゼロ除算回避のため +1 を乗じる）
    for (const [t, df] of this.df.entries()) {
      this.idf.set(t, Math.log(1 + this.docCount / (1 + df)))
    }
    // 各文書のベクトルを事前計算
    for (const d of this.docs) {
      const vec = new Map()
      for (const [t, tfVal] of d.tf.entries()) {
        vec.set(t, tfVal * (this.idf.get(t) || 0))
      }
      d.vec = vec
      d.norm = Math.sqrt([...vec.values()].reduce((s, v) => s + v * v, 0))
    }
  }

  // queryText に類似する語を上位k件返す。
  // 戻り値: [{ wordNumber, spelling, score, meanings }]
  search(queryText, k = 5, internal = null) {
    if (!queryText || !queryText.trim()) return []
    const qTokens = tokenize(queryText)
    const qVec = new Map()
    for (const t of qTokens) {
      const idf = this.idf.get(t) || Math.log(1 + this.docCount / (1 + 0))
      qVec.set(t, (qVec.get(t) || 0) + idf)
    }
    const qNorm = Math.sqrt([...qVec.values()].reduce((s, v) => s + v * v, 0))
    if (qNorm === 0) return []
    const scored = []
    for (const d of this.docs) {
      if (d.norm === 0) continue
      let dot = 0
      // 小さい方を走査（コサイン類似度のための内積）
      for (const [t, qw] of qVec.entries()) {
        const dw = d.vec.get(t)
        if (dw !== undefined) dot += qw * dw
      }
      const score = dot / (qNorm * d.norm)
      if (score > 0) scored.push({ wordNumber: d.wordNumber, spelling: d.spelling, score })
    }
    scored.sort((a, b) => b.score - a.score)
    const top = scored.slice(0, k)
    if (internal) {
      for (const r of top) {
        const w = internal.words.find((x) => x.number === r.wordNumber)
        if (w) {
          const meanings = []
          for (const sec of w.sections || []) {
            for (const e of sec.equivalents || []) {
              meanings.push({ pos: e.titles || [], text: e.termString || (e.terms || []).join(', ') })
            }
          }
          r.meanings = meanings
          r.word = w
        }
      }
    }
    return top
  }

  size() {
    return this.docs.length
  }
}

// 4章「埋め込みは辞書データが更新されるたびに再計算が必要」に対応するため、
// エンジンのインスタンスと「最終構築元データのハッシュ」を保持する。
export class SimilarityRepository {
  constructor() {
    this.engine = new TfidfSimilarityEngine()
    this.builtFor = null // 任意の識別子（要件に応じて差し替え可）
  }

  build(internal, fingerprint) {
    this.engine.buildFromInternal(internal)
    this.builtFor = fingerprint || null
  }

  isBuiltFor(fingerprint) {
    return this.builtFor === fingerprint
  }

  search(queryText, k, internal) {
    return this.engine.search(queryText, k, internal)
  }

  size() {
    return this.engine.size()
  }
}
