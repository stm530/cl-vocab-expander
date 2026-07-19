// ステージング内容を ZPDC 内部表現にマージし、更新済みファイルを生成する（仕様書v2 8.4節）。
//
// 0.2節「4項目（単語・品詞・意味・関連語）以外は元データを保持」のため、
// ここでは新規語の追加・既存語への equivalents 追記・relations 追記だけを行い、
// 発音記号・informations・phrases・variations・tags は元のまま残す。

import { StagingRecordType } from '@/db/staging'

// 24桁16進の疑似 ObjectId（新規語に割り当てるため）。
// 衝突を極力避けるため、日時ベース + UUID風ランダムで生成する。
function makeObjectId() {
  const hex = '0123456789abcdef'
  let s = ''
  // 4bytes(8hex): タイムスタンプ下位（日時を16進に）
  s += (Math.floor(Date.now() / 1000) % 0xffffffff).toString(16).padStart(8, '0')
  // 5bytes(10hex): 擬似乱数
  for (let i = 0; i < 10; i++) s += hex[Math.floor(Math.random() * 16)]
  // 3bytes(6hex): 擬似乱数
  for (let i = 0; i < 6; i++) s += hex[Math.floor(Math.random() * 16)]
  return s.slice(0, 24)
}

// 既存単語の number の最大値。新規語には最大+1を割り当てる。
function maxWordNumber(internal) {
  let max = 0
  for (const w of internal.words) if (typeof w.number === 'number' && w.number > max) max = w.number
  return max
}

// ZPDC内部表現の側で、指定wordNumberの単語を取得。無ければnull。
function findWordByNumber(internal, number) {
  return (internal.words || []).find((w) => w.number === number) || null
}

// 同じ titles の既存 equivalent があればそれに terms を追記、無ければ新規 equivalent 追加。
function appendEquivalentToSection(section, pos, meaningTexts) {
  // pos は titles 配列
  const titles = Array.isArray(pos) ? [...pos] : []
  const titlesKey = JSON.stringify(titles)
  let eq = (section.equivalents || []).find((e) => JSON.stringify(e.titles || []) === titlesKey)
  if (!eq) {
    eq = {
      titles,
      terms: [],
      termString: '',
      ignoredPattern: '',
      hidden: false
    }
    section.equivalents = section.equivalents || []
    section.equivalents.push(eq)
  }
  for (const t of meaningTexts) {
    if (t && t.trim()) eq.terms.push(t.trim())
  }
  // termString を再構築（既存の ignoredPattern は無視する、安全側）
  eq.termString = eq.terms.join(', ')
  return eq
}

// approved なステージングエントリ一覧を受け取り、ZPDC内部表現にマージした
// 新しい内部表現を返す（非破壊：引数 internal は変更されない）。
// exportForDownload: この戻り値をそのまま serializeFromInternal して書き出す前提。
export function mergeApprovedStagingIntoZpdc(internal, stagingEntries) {
  const clone = JSON.parse(JSON.stringify(internal))
  delete clone._raw // 再帰コピーから生データを外す（メモリ節約）

  let nextNumber = maxWordNumber(clone) + 1
  // 新規語を先にすべて追加（後に既存語の relations に追加する際に number を参照するため）
  const新建語BySpelling = new Map()
  const newWordsBuffer = []

  // 1) 新規語
  for (const e of stagingEntries) {
    if (e.type !== StagingRecordType.NEW_WORD) continue
    const w = {
      id: makeObjectId(),
      number: nextNumber++,
      spelling: e.spelling || '',
      pronunciation: '', // 0.2節：新規語はZpDIC既定値
      tags: [],
      sections: [
        {
          equivalents: [],
          informations: [],
          phrases: [],
          variations: [],
          relations: []
        }
      ]
    }
    // 1つの新規語エントリは「1つの品詞グループ、N個の意味」相当（8.2節）。
    // 複数品詞を登録する場合は、同一綴りに対する新規語エントリが複数できる。
    appendEquivalentToSection(w.sections[0], e.pos || [], e.meanings || [])
    newWordsBuffer.push({ w, source: e.source, spelling: e.spelling })
    新建語BySpelling.set(e.spelling, w)
  }

  // 2) 既存語への意味追加（add_sense）
  for (const e of stagingEntries) {
    if (e.type !== StagingRecordType.ADD_SENSE) continue
    const target = findWordByNumber(clone, e.wordNumber)
    if (!target) continue
    // 1単語は通常1セクション。複数ある場合は最初のセクションに追記。
    const section = target.sections[0] || { equivalents: [], informations: [], phrases: [], variations: [], relations: [] }
    appendEquivalentToSection(section, e.pos || [], e.meanings || [])
    if (!target.sections.includes(section)) target.sections.unshift(section)
  }

  // 3) 新規語を clone.words に追加
  for (const item of newWordsBuffer) clone.words.push(item.w)

  // 4) relations（新規語同士・新規語と既存語）は、「新語」と「親概念」「類似語」を
  //    双方向リンクとして張るには元情報が必要なため、ここでは安全側の最低限として、
  //    新規語が source.parentSynset 等を持つ場合は対応既存語への relation を張る。
  //    （初版では本格的な relation 構築は省き、作者が ZpDIC 側で手動結線できる余地を残す。
  //     仕様書8.4節で「0.2節4項目のうち関連語も編集対象」と明示されているため、
  //     少なくとも新規語の relations に著者自身が入力した関連語綴りを反映する。）
  for (const e of stagingEntries) {
    if (e.type !== StagingRecordType.NEW_WORD) continue
    const w = 新建語BySpelling.get(e.spelling)
    if (!w) continue
    const rels = Array.isArray(e.relations) ? e.relations : []
    if (rels.length === 0) continue
    const section = w.sections[0]
    for (const r of rels) {
      if (!r || !r.spelling) continue
      // number 解決：既存語に同名があればその number、新規語ならそれ
      const existing = (clone.words || []).find(
        (x) => (x.spelling || '').toLowerCase() === (r.spelling || '').toLowerCase() && x !== w
      )
      const ref = existing || 新建語BySpelling.get(r.spelling)
      const number = ref?.number ?? null
      const titles = Array.isArray(r.titles) ? r.titles : r.titles ? [r.titles] : ['関連語']
      section.relations = section.relations || []
      section.relations.push({ titles, number, spelling: r.spelling })
    }
  }

  return clone
}

// 指定した綴りが新規語エントリの名前として登録されていれば、その number を返す。
// （マージ結果を検査する際のテスト用ヘルパだが公開しておく）
export function findNewWordNumber(merged, spelling) {
  const w = (merged.words || []).find((x) => (x.spelling || '').toLowerCase() === (spelling || '').toLowerCase())
  return w ? w.number : null
}
