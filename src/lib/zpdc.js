// ZPDC(OTM-JSON) 形式のパース・正規化・マージ・単語ツリー変換を行う。
//
// 対象バージョン:
//   version=1 (ZpDIC形式) … サンプル辞書 .zpdc で使用
//   version=2 (OTM-JSON)  … ZpDIC Online からエクスポートした .json
//
// 内部では「version=1相当の平坦構造」を共通表現として扱い、出力時は
// 入力と同じ version を維持する（0.2節「4項目以外は元データを保持」のため）。

export function detectVersion(root) {
  if (!root || typeof root !== 'object') return null
  if (root.version === 1) return 1
  if (root.version === 2) return 2
  return null
}

// version=2 (OTM-JSON) の1語を version=1 (ZpDIC) 構造に変換する。
// sections 化・titles配列化・termString 補完を行う。
function v2WordToV1(w) {
  const sections = []
  const section = {
    equivalents: [],
    informations: [],
    phrases: [],
    variations: [],
    relations: []
  }
  for (const t of w.translations || []) {
    section.equivalents.push({
      titles: Array.isArray(t.title) ? t.title : t.title ? [t.title] : [],
      terms: Array.isArray(t.forms) ? [...t.forms] : [],
      // termString は terms を ", " で結合（zpdicOnline.punctuations 取得手段が
      // ファイルに含まれていない場合があるため、安全側の既定値）
      termString: Array.isArray(t.forms) ? t.forms.join(', ') : '',
      ignoredPattern: '',
      hidden: false
    })
  }
  for (const c of w.contents || []) {
    section.informations.push({
      title: c.title || '',
      text: c.text || '',
      hidden: false
    })
  }
  for (const v of w.variations || []) {
    section.variations.push({
      title: v.title || '',
      spelling: v.form || '',
      pronunciation: ''
    })
  }
  for (const r of w.relations || []) {
    section.relations.push({
      titles: r.title ? [r.title] : [],
      number: r.entry?.id,
      spelling: r.entry?.form || ''
    })
  }
  sections.push(section)
  return {
    id: null,
    number: w.entry?.id ?? 0,
    spelling: w.entry?.form || '',
    pronunciation: '',
    tags: Array.isArray(w.tags) ? [...w.tags] : [],
    sections
  }
}

// version=1 構造を version=2 (OTM-JSON) に変換する。
// 複数セクションのマージ方針は reference/zpdic-api/05-otm-json-mapping.md
// 「ZpDIC → OTM-JSON」の推奨に従う（順に連結）。
function v1WordToV2(w) {
  const translations = []
  const contents = []
  const variations = []
  const relations = []
  for (const sec of w.sections || []) {
    for (const e of sec.equivalents || []) {
      translations.push({
        title: e.titles?.[0] || '',
        forms: [...(e.terms || [])]
      })
    }
    for (const i of sec.informations || []) {
      contents.push({ title: i.title || '', text: i.text || '' })
    }
    for (const v of sec.variations || []) {
      variations.push({ title: v.title || '', form: v.spelling || '' })
    }
    for (const r of sec.relations || []) {
      relations.push({
        title: r.titles?.[0] || '',
        entry: { id: r.number, form: r.spelling || '' }
      })
    }
  }
  return {
    entry: { id: w.number, form: w.spelling || '' },
    tags: [...(w.tags || [])],
    translations,
    contents,
    variations,
    relations
  }
}

// 任意バージョンのルートを「内部共通表現（version=1相当）」に正規化する。
//
// 内部共通表現では各単語に次を保証する:
//   id, number, spelling, pronunciation, tags, sections[{equivalents,informations,phrases,variations,relations}]
// equivalents 各要素は: titles, terms, termString, ignoredPattern, hidden
export function normalizeToInternal(root) {
  const v = detectVersion(root)
  if (!v) throw new Error('未知のZPDC形式です (versionが1でも2でもありません)')
  if (v === 1) {
    // version=1 は見た目そのままでよいが、欠損キーを補完する
    const words = (root.words || []).map((w) => ({
      id: w.id || null,
      number: w.number ?? 0,
      spelling: w.spelling || '',
      pronunciation: w.pronunciation || '',
      tags: Array.isArray(w.tags) ? [...w.tags] : [],
      sections: (w.sections || []).map((sec) => ({
        equivalents: (sec.equivalents || []).map(e => ({
          titles: Array.isArray(e.titles) ? [...e.titles] : [],
          terms: Array.isArray(e.terms) ? [...e.terms] : [],
          termString: e.termString ?? (Array.isArray(e.terms) ? e.terms.join(', ') : ''),
          ignoredPattern: e.ignoredPattern || '',
          hidden: !!e.hidden
        })),
        informations: (sec.informations || []).map(i => ({
          title: i.title || '',
          text: i.text || '',
          hidden: !!i.hidden
        })),
        phrases: (sec.phrases || []).slice(),
        variations: (sec.variations || []).map(va => ({
          title: va.title || '',
          spelling: va.spelling || '',
          pronunciation: va.pronunciation || ''
        })),
        relations: (sec.relations || []).map(r => ({
          titles: Array.isArray(r.titles) ? [...r.titles] : [],
          number: r.number,
          spelling: r.spelling || ''
        }))
      }))
    }))
    const examples = (root.examples || []).slice()
    return { version: 1, words, examples, _raw: root }
  }
  // version=2 → version=1 内部表現
  const words = (root.words || []).map(v2WordToV1)
  const examples = (root.examples || []).map((e) => ({
    id: e.id ?? null,
    number: e.id, // OTM-JSON の id が OTM 上の番号
    tags: e.tags || [],
    words: (e.words || []).map((w) => ({ number: w.id })),
    sentence: e.sentence || '',
    translation: e.translation || '',
    supplement: e.supplement || '',
    offer: e.offer ?? null
  }))
  return { version: 1, words, examples, _sourceVersion: 2, _raw: root }
}

// 内部表現を元の version に戻す（ダウンロード用）。
// _sourceVersion が set されていれば version=2 として出力、
// それ以外は version=1 として出力。
export function serializeFromInternal(internal) {
  if (internal._sourceVersion === 2) {
    return {
      version: 2,
      words: internal.words.map(v1WordToV2),
      examples: (internal.examples || []).map((e) => ({
        id: e.number,
        tags: e.tags || [],
        words: (e.words || []).map((w) => ({ id: w.number })),
        sentence: e.sentence || '',
        translation: e.translation || ''
      })),
      zpdicOnline: internal._raw?.zpdicOnline || {
        explanation: '',
        punctuations: [',', '、', '。'],
        ignoredPattern: '',
        pronunciationTitle: 'Pronunciation',
        enableMarkdown: false
      }
    }
  }
  return {
    version: 1,
    words: internal.words.map((w) => ({
      id: w.id,
      number: w.number,
      spelling: w.spelling,
      pronunciation: w.pronunciation,
      tags: w.tags,
      sections: w.sections
    })),
    examples: internal.examples
  }
}

// --- 単語ツリー（6章）の内部データ構造 -----------------------------------
//
//   WordNode → PosGroupNode → MeaningNode
//   各ノードは { origin: 'existing' | 'new', ... } を持つ。
//   UI側（WordNode.vue 等）とステージング（8章）とで同じ形を使う。

let _seq = 0
export function newId(prefix = 'id') {
  _seq += 1
  return `${prefix}_${Date.now().toString(36)}_${_seq}`
}

function newMeaningNode(text, origin = 'new') {
  return {
    id: newId('m'),
    origin,
    text: text || '',
    // 既存データ由来のときだけ意味追加元の equivalent インデックスを持つ
    _srcEquivalentIndex: null
  }
}

function newPosGroupNode(titles, origin = 'new') {
  return {
    id: newId('p'),
    origin,
    titles: titles || [],
    meanings: [newMeaningNode('', origin)]
  }
}

function newWordNode(spelling, origin = 'new') {
  return {
    id: newId('w'),
    origin,
    spelling: spelling || '',
    posGroups: [newPosGroupNode([], origin)]
  }
}

// ZPDCの1語（version=1内部表現）を単語ツリー1本に変換する。
// 0.2節の「編集対象4項目（単語・品詞・意味・関連語）」のうち、
// 単語ツリーは「単語・品詞・意味」を表現する。関連語は別途管理。
//
// equivalents の grouping ルール:
//   titles の結合文字列をキーに「同じ品詞グループ」にまとめる。
//   1つの equivalent に含まれる複数の terms は「同じ品詞グループの別々の意味」
//   （bia muinの実例：titles=名詞, terms=[9,多くのもの] → 品詞=名詞, 意味×2）とする。
export function wordToTree(word) {
  const root = newWordNode(word.spelling || '', 'existing')
  root._wordNumber = word.number
  root._wordId = word.id
  // 1つの単語は複数 section を持てるが、ツリー上は sections を平坦に扱う
  const titleKeyOrder = []
  const titleKeyToGroup = new Map()
  for (const sec of word.sections || []) {
    sec.equivalents?.forEach((eq, eqIdx) => {
      const key = JSON.stringify(eq.titles || [])
      if (!titleKeyToGroup.has(key)) {
        const g = newPosGroupNode(eq.titles || [], 'existing')
        titleKeyToGroup.set(key, g)
        titleKeyOrder.push(key)
        root.posGroups.push(g)
      } else {
        // 既にある品詞グループ：意味だけ追記
      }
      const g = titleKeyToGroup.get(key)
      // 末尾の自動生成された空意味ノードを削除して詰め替える
      if (g.meanings.length === 1 && g.meanings[0].text === '' && g.meanings[0]._srcEquivalentIndex === null) {
        g.meanings = []
      }
      for (const term of eq.terms || []) {
        const m = newMeaningNode(term, 'existing')
        m._srcEquivalentIndex = eqIdx
        g.meanings.push(m)
      }
      if (g.meanings.length === 0) {
        g.meanings.push(newMeaningNode('', 'existing'))
      }
    })
  }
  // 初期化時に自動挿入した空の品詞グループを捨てる
  if (root.posGroups.length > 1 || (root.posGroups.length === 1 && root.posGroups[0].meanings.length > 0 && (root.posGroups[0].meanings[0].text !== '' || root.posGroups[0].meanings[0]._srcEquivalentIndex !== null))) {
    root.posGroups = root.posGroups.filter((g) => titleKeyOrder.length > 0 ? titleKeyToGroup.has(JSON.stringify(g.titles)) : true)
  }
  return root
}

// 空の単語ツリー（ターゲット単語・親概念欄の新規入力受け）を作る。
export function emptyWordTree(spelling = '') {
  return newWordNode(spelling, 'new')
}

// 単語ツリー1本からZPDC1語分の sections を構築する。
// 既存データ由来の要素は維持し、新規追加された品詞グループ・意味は
// 既存セクション配下の equivalents に追記する形でマージする。
//
// ※本関数は「1単語ツリー → equivalents 配列」の変換のみを行う。
//   呼び出し元（mergeIntoZpdc）で各種 ID 採番・関連語反映を行う。
export function treeToEquivalents(tree) {
  // 同じ titles キーでまとめる（既存の equivalent と統合できるように）
  const groups = new Map()
  for (const pg of tree.posGroups) {
    const key = JSON.stringify(pg.titles)
    if (!groups.has(key)) groups.set(key, { titles: pg.titles, terms: [], ignoredPattern: '', hidden: false })
    const g = groups.get(key)
    for (const m of pg.meanings) {
      if (m.text && m.text.trim()) g.terms.push(m.text.trim())
    }
  }
  return [...groups.values()].map((g) => ({
    titles: g.titles,
    terms: g.terms,
    termString: g.terms.join(', '),
    ignoredPattern: g.ignoredPattern,
    hidden: g.hidden
  }))
}

// ツリー内に origin==='new' のノードが1件でもあるか（6.3節・UI設計2.5節）。
export function hasNewNode(tree) {
  if (!tree) return false
  if (tree.origin === 'new' && (tree.spelling || treeHasAnyMeaning(tree))) {
    // 根自体が新規なら、意味や品詞が空でも「新語」扱い
    if (tree.spelling && tree.spelling.trim()) return true
  }
  for (const pg of tree.posGroups || []) {
    if (pg.origin === 'new' && pg.titles.length > 0) return true
    for (const m of pg.meanings || []) {
      if (m.origin === 'new' && m.text && m.text.trim()) return true
    }
  }
  return false
}

function treeHasAnyMeaning(tree) {
  for (const pg of tree.posGroups || []) {
    for (const m of pg.meanings || []) {
      if (m.text && m.text.trim()) return true
    }
  }
  return false
}

// 単語ツリー1本から「新規・既存を問わず、意味テキストが入っている意味一覧」を得る。
// 綴り衝突サジェスト（5章）や、類似度検索のクエリ生成（4章）で使う。
export function collectMeaningTexts(tree) {
  const out = []
  for (const pg of tree.posGroups || []) {
    for (const m of pg.meanings || []) {
      if (m.text && m.text.trim()) out.push(m.text.trim())
    }
  }
  return out
}

// ZPDC 全語から equivalents[].titles を集計し、品詞選択肢リストを作る（3.1節）。
export function collectPosChoices(internalRoot) {
  const set = new Set()
  for (const w of internalRoot.words) {
    for (const sec of w.sections || []) {
      for (const e of sec.equivalents || []) {
        for (const t of e.titles || []) set.add(t)
      }
    }
  }
  return [...set].sort((a, b) => a.localeCompare(b, 'ja'))
}

// WordNet品詞(pos文字) → ZPDCのtitles リストのデフォルト推定（3.1節）。
// 名称完全一致があればそれ、見つからなければ標準的な日本語名詞/動詞/形容詞/副詞を推奨。
export function defaultPosForWordnet(pos, posChoices) {
  const std = wordnetPosLabel(pos)
  if (!std) return []
  if (posChoices.includes(std)) return [std]
  return []
}

function wordnetPosLabel(pos) {
  const m = { n: '名詞', v: '動詞', a: '形容詞', s: '形容詞', r: '副詞' }
  return m[pos] || ''
}
