import { createApp } from 'vue'
import { createPinia } from 'pinia'
import router from './router'
import App from './App.vue'

// Vant 组件
import vant from 'vant'
import 'vant/lib/index.css'

// 样式
import './style.css'

const app = createApp(App)

app.use(createPinia())
app.use(router)
app.use(vant)

app.mount('#app')