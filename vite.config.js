import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// GitHub Pagesプロジェクトサイト配信（https://stm530.github.io/cl-vocab-expander/）
// のため、base path をサブパスに設定（仕様書v2 1.1節）。
// 誤るとローカルでは動くが公開後にCSS/JS/静的アセットが404になる。
export default defineConfig({
  base: '/cl-vocab-expander/',
  plugins: [vue()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    }
  },
  // public/wnjpn.db はビルド成果物にそのままコピーされる。
  // AssetsIncludeLimit未満のファイルはインライン化される仕様だが、
  // DBは数十〜数百MBのため明示的にインライン化対象外にするための上限設定。
  build: {
    assetsInlineLimit: 0
  }
})
