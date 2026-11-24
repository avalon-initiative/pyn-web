import { createPynApp } from './app'
import { configureHost } from './state/host-config.state'
import '@avalon-initiative/pyn-common-ui/tokens.css'
import '@avalon-initiative/pyn-common-ui/fonts.css'
import '@avalon-initiative/pyn-common-ui/global.css'
import '@avalon-initiative/pyn-common-ui/style.css'

const app = createPynApp()
void configureHost(app).then(() => app.mount('#app'))
