import { createRouter, createWebHashHistory } from 'vue-router'

const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    {
      path: '/',
      name: 'home',
      component: () => import('@/views/Home.vue'),
    },
    {
      path: '/calendar',
      name: 'calendar',
      component: () => import('@/views/Calendar.vue'),
    },
    {
      path: '/statistics',
      name: 'statistics',
      component: () => import('@/views/Statistics.vue'),
    },
    {
      path: '/settings',
      name: 'settings',
      component: () => import('@/views/Settings.vue'),
    },
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
