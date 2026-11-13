import { createRouter, createWebHistory } from 'vue-router'
import { getAdminToken } from '../utils/adminApi'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      redirect: '/admin',
    },
    {
      path: '/admin/login',
      name: 'admin-login',
      component: () => import('../views/admin/AdminLoginView.vue'),
      meta: { isAdminLayout: true, standaloneLayout: true },
    },
    {
      path: '/admin',
      name: 'admin',
      component: () => import('../views/AdminView.vue'),
      meta: { isAdminLayout: true, standaloneLayout: true, requiresAdminAuth: true },
    },
  ],
})

router.beforeEach((to, _from, next) => {
  if (to.meta.requiresAdminAuth && !getAdminToken()) {
    next({ path: '/admin/login' })
    return
  }
  next()
})

export default router
