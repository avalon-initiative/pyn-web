import { createApp } from 'vue'
import App from './App.vue'
import { makeRouter } from './router'
import '@avalon-initiative/pyn-common-ui/tokens.css'
import '@avalon-initiative/pyn-common-ui/global.css'

createApp(App).use(makeRouter()).mount('#app')
