import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'
import type { Rol } from '../api/types'
import { useAuth } from '../composables/useAuth'
import AuthLayout from '../layouts/AuthLayout.vue'
import DefaultLayout from '../layouts/DefaultLayout.vue'

const ADMIN: Rol[] = ['superadmin', 'dueno', 'administrador']

declare module 'vue-router' {
  interface RouteMeta {
    requiresAuth?: boolean
    /** Roles que pueden entrar. Sin `roles`, cualquier usuario autenticado. */
    roles?: Rol[]
  }
}

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    component: AuthLayout,
    meta: { requiresAuth: false },
    children: [{ path: '', redirect: '/login' }],
  },
  {
    path: '/login',
    component: AuthLayout,
    meta: { requiresAuth: false },
    children: [{ path: '', name: 'login', component: () => import('../views/LoginView.vue') }],
  },
  {
    path: '/',
    component: DefaultLayout,
    meta: { requiresAuth: true },
    children: [
      {
        path: 'dashboard',
        name: 'dashboard',
        component: () => import('../views/DashboardView.vue'),
      },
      {
        path: 'inventario',
        name: 'inventario',
        meta: { roles: ADMIN },
        component: () => import('../views/InventarioView.vue'),
      },
      {
        path: 'productos',
        name: 'productos',
        meta: { roles: ADMIN },
        component: () => import('../views/ProductosView.vue'),
      },
      {
        path: 'mesas',
        name: 'mesas',
        component: () => import('../views/MesasView.vue'),
      },
      {
        path: 'ventas',
        name: 'ventas',
        component: () => import('../views/VentasView.vue'),
      },
      {
        path: 'ordenes',
        name: 'ordenes',
        component: () => import('../views/OrdenesView.vue'),
      },
      {
        path: 'historial',
        name: 'historial',
        meta: { roles: ADMIN },
        component: () => import('../views/HistorialView.vue'),
      },
      {
        path: 'contabilidad',
        name: 'contabilidad',
        meta: { roles: ADMIN },
        component: () => import('../views/ContabilidadView.vue'),
      },
      {
        path: 'categorias',
        name: 'categorias',
        meta: { roles: ADMIN },
        component: () => import('../views/CategoriasView.vue'),
      },
      {
        path: 'caja',
        name: 'caja',
        component: () => import('../views/CajaView.vue'),
      },
      {
        path: 'gastos',
        name: 'gastos',
        meta: { roles: ADMIN },
        component: () => import('../views/GastosView.vue'),
      },
      {
        path: 'trabajadores',
        name: 'trabajadores',
        meta: { roles: ADMIN },
        component: () => import('../views/TrabajadoresView.vue'),
      },
      {
        path: 'usuarios',
        name: 'usuarios',
        meta: { roles: ADMIN },
        component: () => import('../views/UsuariosView.vue'),
      },
      {
        path: 'configuracion',
        name: 'configuracion',
        meta: { roles: ADMIN },
        component: () => import('../views/ConfiguracionView.vue'),
      },
    ],
  },
  {
    path: '/:pathMatch(.*)*',
    name: 'not-found',
    component: () => import('../views/NotFoundView.vue'),
  },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
})

router.beforeEach((to) => {
  const { isAuthenticated, tieneRol, esSuperadmin, sedes } = useAuth()
  const requiresAuth = to.matched.some((record) => record.meta.requiresAuth)

  if (requiresAuth && !isAuthenticated()) {
    return { name: 'login', query: { redirect: to.fullPath } }
  }

  if (to.name === 'login' && isAuthenticated()) {
    return { name: 'dashboard' }
  }

  // Super admin recién instalado y sin sedes: lo primero es crearlas.
  if (requiresAuth && esSuperadmin.value && sedes.value.length === 0 && to.name !== 'usuarios') {
    return { name: 'usuarios' }
  }

  const roles = to.meta.roles
  if (roles && !tieneRol(...roles)) {
    return { name: 'dashboard' }
  }

  return true
})

export default router
