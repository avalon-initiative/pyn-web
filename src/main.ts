import { createApp } from 'vue'
import App from './App.vue'
import { makeRouter } from './router'
import './styles/global.scss'

createApp(App).use(makeRouter()).mount('#app')
