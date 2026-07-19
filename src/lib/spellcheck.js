// 綴り衝突検出（部分一致サジェスト）（仕様書v2 5章・UI設計4章）。
//
// 入力欄からフォーカスが外れた / 一定文字数を超えたタイミングで、
// 既存の見出し語の綴りと部分一致するものを列挙する。
// サーバーを介さず、ZPDCアップロード直後に、ブラウザ内で軽量インデックスを構築する。

export class SpellingIndex {
  constructor() {
    // 綴り → { wordNumber, meanings: [{pos:[], text}] } の配列
    this.entries = []
    // 単純な線形探索だが、見出し語数が数百〜数千程度なら実用十分（仕様書想定）
  }

  // ZPDC内部表現からインデックスを構築
  buildFromInternal(internal) {
    this.entries = []
    for (const w of internal?.words || []) {
      const meanings = []
      for (const sec of w.sections || []) {
        for (const e of sec.equivalents || []) {
          meanings.push({ pos: e.titles || [], text: e.termString || (e.terms || []).join(', ') })
        }
      }
      this.entries.push({ spelling: w.spelling, wordNumber: w.number, meanings })
    }
  }

  // 部分一致する既存語を列挙（5.2節）。
  //   input が既存語の綴りを部分文字列として含む
  //   既存語の綴りが input を部分文字列として含む
  // 空文字・1文字未満の場合は空を返す（5.2節「一定文字数以上」相当）。
  search(input) {
    const q = (input || '').trim()
    if (q.length < 1) return []
    const qLower = q.toLowerCase()
    const out = []
    for (const e of this.entries) {
      const s = (e.spelling || '').toLowerCase()
      if (!s) continue
      if (s.includes(qLower) || qLower.includes(s)) {
        out.push(e)
      }
    }
    return out
  }

  // 綴り完全一致で既存1語を取得
  findBySpelling(spelling) {
    const s = (spelling || '').toLowerCase()
    return this.entries.find((e) => (e.spelling || '').toLowerCase() === s) || null
  }

  size() {
    return this.entries.length
  }
}
