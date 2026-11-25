<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import { useAuth } from '../../composables/useAuth'
import { useCaja } from '../../composables/useCaja'
import CambiarPasswordModal from '../CambiarPasswordModal.vue'
import { formatHora } from '../../utils/fecha'
import logoChupeyMeDeja from '../../assets/brand/logo-chupeymedeja.png'

type NavAccent = 'cyan' | 'lime' | 'magenta' | 'purple'

interface NavItem {
  to: string
  label: string
  accent: NavAccent
  icon: string
}

interface NavGroup {
  label: string
  items: NavItem[]
}

const navGroups: NavGroup[] = [
  {
    label: '',
    items: [
  {
    to: '/dashboard',
    label: 'Dashboard',
    accent: 'cyan',
    icon: '<rect x="3" y="3" width="7" height="9" rx="1"></rect><rect x="14" y="3" width="7" height="5" rx="1"></rect><rect x="14" y="12" width="7" height="9" rx="1"></rect><rect x="3" y="16" width="7" height="5" rx="1"></rect>',
  },
    ],
  },
  {
    label: 'Operación',
    items: [
  {
    to: '/caja',
    label: 'Caja',
    accent: 'lime',
    icon: '<rect x="2" y="6" width="20" height="12" rx="2"></rect><circle cx="12" cy="12" r="2.5"></circle><path d="M6 10v.01"></path><path d="M18 14v.01"></path>',
  },
  {
    to: '/ventas',
    label: 'Ventas',
    accent: 'cyan',
    icon: '<circle cx="9" cy="20" r="1"></circle><circle cx="18" cy="20" r="1"></circle><path d="M2.5 3h2l2.4 12.4a2 2 0 0 0 2 1.6h8.2a2 2 0 0 0 2-1.6L21 8H6"></path>',
  },
  {
    to: '/mesas',
    label: 'Mesas',
    accent: 'purple',
    icon: '<rect x="2" y="5" width="20" height="4" rx="1"></rect><path d="M5 9v10"></path><path d="M19 9v10"></path>',
  },
  {
    to: '/ordenes',
    label: 'Órdenes',
    accent: 'magenta',
    icon: '<path d="M6 2h12v19l-3-2-3 2-3-2-3 2V2z"></path><path d="M9 7h6"></path><path d="M9 11h6"></path><path d="M9 15h4"></path>',
  },
    ],
  },
  {
    label: 'Catálogo',
    items: [
  {
    to: '/productos',
    label: 'Productos',
    accent: 'magenta',
    icon: '<path d="M20.59 13.41 11 3.83A2 2 0 0 0 9.59 3.24L4 3v5.59a2 2 0 0 0 .59 1.41l9.59 9.59a2 2 0 0 0 2.82 0l3.59-3.59a2 2 0 0 0 0-2.59z"></path><circle cx="7.5" cy="7.5" r="1.5"></circle>',
  },
  {
    to: '/inventario',
    label: 'Inventario',
    accent: 'lime',
    icon: '<path d="M21 8 12 3 3 8v8l9 5 9-5V8z"></path><path d="M3 8l9 5 9-5"></path><path d="M12 13v8"></path>',
  },
  {
    to: '/categorias',
    label: 'Categorías',
    accent: 'magenta',
    icon: '<path d="M12 2 2 7l10 5 10-5-10-5z"></path><path d="M2 17l10 5 10-5"></path><path d="M2 12l10 5 10-5"></path>',
  },
    ],
  },
  {
    label: 'Negocio',
    items: [
  {
    to: '/gastos',
    label: 'Gastos',
    accent: 'magenta',
    icon: '<path d="M12 2v20"></path><path d="M17 6H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>',
  },
  {
    to: '/trabajadores',
    label: 'Trabajadores',
    accent: 'purple',
    icon: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path>',
  },
  {
    to: '/historial',
    label: 'Historial',
    accent: 'cyan',
    icon: '<rect x="3" y="4" width="18" height="18" rx="2"></rect><path d="M16 2v4"></path><path d="M8 2v4"></path><path d="M3 10h18"></path><path d="M8 14h2"></path><path d="M14 14h2"></path><path d="M8 18h2"></path>',
  },
  {
    to: '/usuarios',
    label: 'Usuarios',
    accent: 'cyan',
    icon: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M22 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path>',
  },
  {
    to: '/contabilidad',
    label: 'Contabilidad',
    accent: 'lime',
    icon: '<rect x="3" y="10" width="4" height="10"></rect><rect x="10" y="6" width="4" height="14"></rect><rect x="17" y="3" width="4" height="17"></rect>',
  },
    ],
  },
]

const configItem: NavItem = {
  to: '/configuracion',
  label: 'Configuración',
  accent: 'purple',
  icon: '<circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h0a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51h0a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v0a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"></path>',
}

const accentBg: Record<NavAccent, string> = {
  cyan: 'rgba(0, 229, 255, 0.14)',
  lime: 'rgba(178, 255, 5, 0.14)',
  magenta: 'rgba(255, 0, 127, 0.14)',
  purple: 'rgba(123, 44, 191, 0.22)',
}

function navItemStyle(accent: NavAccent) {
  return {
    '--nav-accent-text': `var(--color-${accent})`,
    '--nav-accent-bg': accentBg[accent],
  }
}

defineProps<{ abierto?: boolean }>()
const emit = defineEmits<{ cerrar: [] }>()

const router = useRouter()
const { usuario, sedes, sedeActiva, sedeActivaId, esGlobal, cerrarSesion, cambiarSede, tieneRol } = useAuth()

const { actual: cajaActual, abierta: cajaAbierta, cargarActual: cargarCaja } = useCaja()
onMounted(cargarCaja)

// Los permisos de cada opción salen de la ruta (router/index.ts, meta.roles).
function puedeVer(to: string): boolean {
  const roles = router.resolve(to).meta.roles
  return !roles || tieneRol(...roles)
}

const gruposVisibles = computed(() =>
  navGroups
    .map((g) => ({ ...g, items: g.items.filter((i) => puedeVer(i.to)) }))
    .filter((g) => g.items.length > 0),
)
const verConfiguracion = computed(() => puedeVer(configItem.to))

const ROL_ETIQUETA = {
  superadmin: 'Super admin',
  dueno: 'Dueño',
  administrador: 'Administrador',
  cajero: 'Cajero',
} as const
const userLabel = computed(() => usuario.value?.nombre || usuario.value?.email || 'Usuario')
const rolLabel = computed(() => (usuario.value ? ROL_ETIQUETA[usuario.value.rol] : ''))
const userInitial = computed(() => userLabel.value.trim().charAt(0).toUpperCase() || 'U')

const passwordAbierto = ref(false)

function onCambiarSede(event: Event) {
  const id = Number((event.target as HTMLSelectElement).value)
  if (Number.isFinite(id)) cambiarSede(id)
}

function onLogout() {
  cerrarSesion()
  router.push({ name: 'login' })
}
</script>

<template>
  <aside id="menu-principal" class="sidebar" :class="{ 'sidebar--abierto': abierto }">
    <div class="brand">
      <img class="brand-logo" :src="logoChupeyMeDeja" alt="Chupe y Me Deja" width="96" height="106" />
      <button type="button" class="cerrar-menu" aria-label="Cerrar menú" @click="emit('cerrar')">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
          <path d="M6 6l12 12M18 6L6 18" />
        </svg>
      </button>
    </div>

    <div class="sede-block">
      <label v-if="esGlobal && sedes.length > 1" class="sede-select">
        <span class="sede-select__label">Sede</span>
        <select :value="sedeActivaId ?? ''" @change="onCambiarSede">
          <option v-for="sede in sedes" :key="sede.id" :value="sede.id">
            {{ sede.activa ? sede.nombre : `${sede.nombre} (inactiva)` }}
          </option>
        </select>
      </label>
      <p v-else class="sede-fija">
        <span class="sede-select__label">Sede</span>
        <strong>{{ sedeActiva?.nombre ?? usuario?.sede_nombre ?? '—' }}</strong>
      </p>
    </div>

    <RouterLink to="/caja" class="caja-pill" :class="cajaAbierta ? 'caja-pill--abierta' : 'caja-pill--cerrada'">
      <span class="caja-pill__dot"></span>
      <span v-if="cajaAbierta === true && cajaActual?.abierta_en">
        Caja abierta desde {{ formatHora(cajaActual.abierta_en) }}
      </span>
      <span v-else-if="cajaAbierta === false">Caja cerrada</span>
      <span v-else>Caja…</span>
    </RouterLink>

    <nav class="nav">
      <div v-for="(group, index) in gruposVisibles" :key="index" class="nav-group">
        <span v-if="group.label" class="nav-group__label">{{ group.label }}</span>
        <RouterLink
          v-for="item in group.items"
          :key="item.to"
          :to="item.to"
          class="nav-item"
          active-class="nav-item--active"
          :style="navItemStyle(item.accent)"
        >
          <svg
            class="nav-icon"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.8"
            stroke-linecap="round"
            stroke-linejoin="round"
            v-html="item.icon"
          ></svg>
          <span>{{ item.label }}</span>
        </RouterLink>
      </div>
    </nav>

    <div class="sidebar-footer">
      <RouterLink
        v-if="verConfiguracion"
        :to="configItem.to"
        class="nav-item"
        active-class="nav-item--active"
        :style="navItemStyle(configItem.accent)"
      >
        <svg
          class="nav-icon"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="1.8"
          stroke-linecap="round"
          stroke-linejoin="round"
          v-html="configItem.icon"
        ></svg>
        <span>{{ configItem.label }}</span>
      </RouterLink>
      <div class="user-block">
        <span class="avatar brand-gradient-bg">{{ userInitial }}</span>
        <span class="user-text">
          <span class="user-label" :title="usuario?.email">{{ userLabel }}</span>
          <span class="user-rol">{{ rolLabel }}</span>
        </span>
      </div>
      <div class="cuenta-acciones">
        <button type="button" class="logout" @click="passwordAbierto = true">Contraseña</button>
        <button type="button" class="logout" @click="onLogout">Salir</button>
      </div>
    </div>
    <CambiarPasswordModal v-if="passwordAbierto" @close="passwordAbierto = false" />
  </aside>
</template>

<style scoped>
.sidebar {
  width: var(--sidebar-width);
  flex-shrink: 0;
  height: 100svh;
  position: sticky;
  top: 0;
  display: flex;
  flex-direction: column;
  padding: 20px 14px;
  background: var(--color-surface);
  border-right: 1px solid var(--color-border-soft);
}

.brand {
  display: flex;
  justify-content: center;
  align-items: flex-start;
  position: relative;
  padding: 0 10px 12px;
}

.cerrar-menu {
  display: none;
  position: absolute;
  top: 0;
  right: 0;
  width: 44px;
  height: 44px;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--color-border-soft);
  border-radius: var(--radius-md);
  background: transparent;
  color: var(--color-text);
  cursor: pointer;
}

.cerrar-menu svg {
  width: 20px;
  height: 20px;
}

.sede-block {
  margin-bottom: 10px;
}

.sede-select,
.sede-fija {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin: 0;
}

.sede-select__label {
  font-size: 10.5px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--color-text-muted);
}

.sede-select select {
  width: 100%;
  min-height: 40px;
  padding: 8px 10px;
  border-radius: var(--radius-md);
  border: 1px solid var(--color-border);
  background: var(--color-surface-alt);
  font-size: 14px;
  font-weight: 600;
  color: var(--color-cyan);
}

.sede-fija strong {
  font-size: 14px;
  color: var(--color-cyan);
}

.brand-logo {
  display: block;
  width: 96px;
  height: auto;
}

.nav {
  display: flex;
  flex-direction: column;
  gap: 10px;
  overflow-y: auto;
  min-height: 0;
}

.nav-group {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.nav-group__label {
  padding: 4px 12px;
  font-size: 10.5px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--color-text-muted);
}

.caja-pill {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 14px;
  padding: 8px 12px;
  border-radius: var(--radius-md);
  text-decoration: none;
  font-size: 12px;
  font-weight: 600;
  color: var(--color-text-muted);
  border: 1px solid var(--color-border-soft);
}

.caja-pill__dot {
  flex-shrink: 0;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--color-text-muted);
}

.caja-pill--abierta {
  color: var(--color-lime);
  border-color: rgba(178, 255, 5, 0.4);
  background: rgba(178, 255, 5, 0.08);
}

.caja-pill--abierta .caja-pill__dot {
  background: var(--color-lime);
  box-shadow: 0 0 8px var(--color-lime);
}

.caja-pill--cerrada {
  color: var(--color-orange);
  border-color: rgba(255, 138, 30, 0.4);
  background: rgba(255, 138, 30, 0.08);
}

.caja-pill--cerrada .caja-pill__dot {
  background: var(--color-orange);
}

.nav-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border-radius: var(--radius-md);
  text-decoration: none;
  color: var(--color-text-muted);
  font-size: 14px;
  transition: background 0.15s, color 0.15s;
}

.nav-icon {
  width: 20px;
  height: 20px;
  flex-shrink: 0;
}

.nav-item:hover {
  background: rgba(123, 44, 191, 0.14);
  color: var(--color-text);
}

.nav-item--active {
  background: var(--nav-accent-bg);
  color: var(--nav-accent-text);
}

.sidebar-footer {
  margin-top: auto;
  padding-top: 14px;
  border-top: 1px solid var(--color-border-soft);
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.user-block {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 0 12px;
  min-width: 0;
}

.avatar {
  flex-shrink: 0;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-size: 14px;
  color: #fff;
}

.user-text {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.user-label {
  font-size: 12.5px;
  color: var(--color-text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.user-rol {
  font-size: 11px;
  color: var(--color-text-muted);
}

.cuenta-acciones {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}

.logout {
  padding: 10px 12px;
  background: transparent;
  cursor: pointer;
  border-radius: var(--radius-md);
  text-decoration: none;
  color: var(--color-text-muted);
  font-size: 14px;
  text-align: center;
  border: 1px solid var(--color-border-soft);
}

.logout:hover {
  color: var(--color-magenta);
  border-color: var(--color-magenta);
}

.nav-item:focus-visible,
.logout:focus-visible,
.cerrar-menu:focus-visible,
.sede-select select:focus-visible {
  outline: 2px solid var(--color-cyan);
  outline-offset: 2px;
}

/* Celular y tablet: el menú es un panel que entra desde la izquierda. */
@media (max-width: 900px) {
  .sidebar {
    position: fixed;
    inset: 0 auto 0 0;
    z-index: 60;
    width: min(300px, 86vw);
    height: 100dvh;
    padding: calc(16px + env(safe-area-inset-top)) 14px calc(16px + env(safe-area-inset-bottom))
      max(14px, env(safe-area-inset-left));
    transform: translateX(-100%);
    visibility: hidden;
    transition: transform 0.22s ease, visibility 0.22s;
    box-shadow: 0 0 40px rgba(0, 0, 0, 0.6);
    overflow-y: auto;
  }

  .sidebar--abierto {
    transform: translateX(0);
    visibility: visible;
  }

  .cerrar-menu {
    display: flex;
  }

  .brand-logo {
    width: 72px;
  }

  .nav {
    overflow: visible;
    flex-shrink: 0;
  }

  .sidebar-footer {
    flex-shrink: 0;
    margin-top: 16px;
  }

  .nav-item {
    min-height: 44px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .sidebar {
    transition: none;
  }
}
</style>
