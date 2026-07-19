# 人工言語語彙拡充器 (cl-vocab-expander)

日本語WordNetを刺激（プロンプト）として、人工言語の語彙を拡充するWebアプリケーションです。
作者が個々の語に対してその場で意味範囲の判断を下す、受動的・反復的な語彙獲得プロセスを提供します。

## ライセンス

### コード

本プロジェクトのコード（HTML, JS, Vueコンポーネント, ビルド設定等）は
**MIT License** の下で提供されます。詳細は [LICENSE](./LICENSE) をご覧ください。

### 日本語WordNetデータ

本アプリケーションに同梱される日本語WordNetデータ (`public/wnjpn.db`) は、
以下の権利者による別ライセンスの下で提供されます。

```
Japanese Wordnet © 2009-2011 NICT, 2012-2015 Francis Bond and
2016-2024 Francis Bond, Takayuki Kuribayashi
https://bond-lab.github.io/wnja/index.ja.html
```

ライセンス全文は [THIRD_PARTY_LICENSES/wnja-license.txt](./THIRD_PARTY_LICENSES/wnja-license.txt) をご覧ください。

## 使い方

### 1. 辞書データを取り込む

1. ZpDIC Online から対象辞書を JSON (OTM-JSON) 形式でエクスポートする
2. 「辞書」タブでファイルをアップロードする
3. WordNet データベースの読み込みが完了するのを待つ（初回のみ数十MBのダウンロードがあります）

### 2. 語彙を拡充する

- **出題タブ**: WordNetのsynset（意味概念）がランダムに提示されます。綴り・品詞・訳語を入力して提出してください。
- **意味追加タブ**: 既存辞書のある語に新しい意味（多義）を追加します。
- **レビュータブ**: 追加した内容を一覧・承認し、更新されたZPDCファイルをダウンロードします。
- **設定タブ**: 出題オプション、データのエクスポート/インポートを行います。

### 3. 販売データをZpDICに戻す

1. 「レビュー」タブで収録した内容を承認する
2. 「承認済み反映」ボタンで更新済みZPDCファイルをダウンロード
3. ZpDIC Online のWebインポート機能で手動アップロードする

## 開発

```bash
# 依存パッケージのインストール
npm install

# 開発サーバー起動
npm run dev

# 本番ビルド
npm run build

# ビルド結果のプレビュー
npm run preview
```

## デプロイ

GitHub Pages に GitHub Actions でデプロイするように  `.github/workflows/deploy.yml` が設定されています。
main ブランterにプッシュすると自動でビルド → デプロイが行われます。
GitHub Pages のソースを「GitHub Actions」に設定してください。