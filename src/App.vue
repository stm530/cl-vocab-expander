<template>
  <div class="app-root">
    <nav class="nav-bar" v-if="store.zpdcReady">
      <router-link to="/upload" class="nav-link">辞書</router-link>
      <router-link to="/quiz" class="nav-link">出題</router-link>
      <router-link to="/sense-add" class="nav-link">意味追加</router-link>
      <router-link to="/review" class="nav-link">レビュー</router-link>
      <router-link to="/settings" class="nav-link">設定</router-link>
    </nav>
    <main class="main-area">
      <router-view />
    </main>
  </div>
</template>

<script setup>
import { onMounted } from 'vue'
import { store, initWordNet, tryLoadZpdcFromIndexedDB } from './store.js'

onMounted(() => {
  tryLoadZpdcFromIndexedDB()
  initWordNet()
})
</script>

<style>
html, body {
  margin: 0;
  padding: 0;
  font-family: system-ui, sans-serif;
  font-size: 14px;
  color: #2a2a2a;
  background: #fff;
  line-height: 1.4;
}
textarea, input, button, select {
  font-family: inherit;
  font-size: inherit;
}
input[type="text"], textarea {
  font-family: monospace;
}
.app-root {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
}
.nav-bar {
  display: flex;
  gap: 0;
  background: #eee;
  padding: 0 8px;
  border-bottom: 1px solid #ccc;
}
.nav-link {
  display: inline-block;
  padding: 6px 12px;
  text-decoration: none;
  color: #2a2a2a;
  font-size: 13px;
  border-right: 1px solid #ccc;
}
.nav-link:hover {
  background: #ddd;
}
.nav-link.router-link-active {
  background: #fafafa;
  font-weight: bold;
}
.main-area {
  flex: 1;
  padding: 8px 12px;
  max-width: 960px;
  margin: 0 auto;
  width: 100%;
  box-sizing: border-box;
}
</style>