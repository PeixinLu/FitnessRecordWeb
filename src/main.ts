import { createApp } from 'vue'
import { createPinia } from 'pinia'
import router from './router'
import App from './App.vue'

// Vant 组件
import vant from 'vant'
import 'vant/lib/index.css'

// 样式
import './style.css'

// 自定义指令
import { vSmoothCorners } from './directives/smoothCorners'
import { vPullToDismiss } from './directives/pullToDismiss'

const app = createApp(App)

app.use(createPinia())
app.use(router)
app.use(vant)

app.directive('smooth-corners', vSmoothCorners)
app.directive('pull-to-dismiss', vPullToDismiss)

app.mount('#app')
