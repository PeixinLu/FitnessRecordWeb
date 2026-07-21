import { createRouter, createWebHashHistory } from 'vue-router'

const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    {
      path: '/',
      name: 'home',
      component: () => import('@/components/PrimaryPageStack.vue'),
    },
    { path: '/calendar', redirect: '/' },
    { path: '/statistics', redirect: '/' },
    { path: '/settings', redirect: '/' },
    {
      path: '/equipment-management',
      name: 'equipment-management',
      component: () => import('@/views/EquipmentManagement.vue'),
    },
    {
      path: '/workout/:date/:exerciseId',
      name: 'workout-detail',
      component: () => import('@/views/WorkoutDetail.vue'),
    },
    {
      path: '/debug/number-wheel',
      name: 'number-wheel-debug',
      component: () => import('@/views/NumberWheelDebug.vue'),
    },
  ],
})

export default router
