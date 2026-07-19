import { createRouter, createWebHashHistory } from 'vue-router'

import UploadView from './views/UploadView.vue'
import QuizView from './views/QuizView.vue'
import SenseAddView from './views/SenseAddView.vue'
import ReviewView from './views/ReviewView.vue'
import SettingsView from './views/SettingsView.vue'

const routes = [
  { path: '/', name: 'home', redirect: '/upload' },
  { path: '/upload', name: 'upload', component: UploadView },
  { path: '/quiz', name: 'quiz', component: QuizView },
  { path: '/sense-add', name: 'sense-add', component: SenseAddView },
  { path: '/review', name: 'review', component: ReviewView },
  { path: '/settings', name: 'settings', component: SettingsView },
]

export const router = createRouter({
  history: createWebHashHistory(),
  routes,
})