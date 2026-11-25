<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { getSesion } from '../api/auth'
import AppSidebar from '../components/layout/AppSidebar.vue'
import { guardarSesion, useAuth } from '../composables/useAuth'
import { useCaja } from '../composables/useCaja'
import isotipo from '../assets/brand/isotipo-chupeymedeja.png'

const route = useRoute()
const { sedeActiva, usuario } = useAuth()
const { abierta: cajaAbierta } = useCaja()

const menuAbierto = ref(false)

// Al navegar en el celular, el menú se cierra solo.
watch(
  () => route.fullPath,
  () => {
    menuAbierto.value = false
  },
)

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') menuAbierto.value = false
}

onMounted(async () => {
  window.addEventListener('keydown', onKeydown)
  // Refresca usuario, rol y sedes (por si el dueño los cambió) y renueva el token.
  try {
    guardarSesion(await getSesion())
  } catch {
    /* 401 ya redirige al login desde el cliente de la API */
  }
})

onUnmounted(() => window.removeEventListener('keydown', onKeydown))
</script>

<template>
  <div class="app-shell">
    <header class="topbar">
      <button
        type="button"
        class="topbar__menu"
        aria-label="Abrir menú"
        aria-controls="menu-principal"
        :aria-expanded="menuAbierto"
        @click="menuAbierto = true"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
          <path d="M4 7h16M4 12h16M4 17h16" />
        </svg>
      </button>
      <img class="topbar__logo" :src="isotipo" alt="" width="32" height="32" />
      <div class="topbar__sede">
        <strong>{{ sedeActiva?.nombre ?? usuario?.sede_nombre ?? 'Chupe y Me Deja' }}</strong>
      </div>
      <RouterLink
        to="/caja"
        class="topbar__caja"
        :class="cajaAbierta ? 'topbar__caja--abierta' : 'topbar__caja--cerrada'"
        :aria-label="cajaAbierta ? 'Caja abierta' : 'Caja cerrada'"
      >
        <span class="topbar__dot"></span>
        {{ cajaAbierta ? 'Abierta' : cajaAbierta === false ? 'Cerrada' : '…' }}
      </RouterLink>
    </header>

    <div v-if="menuAbierto" class="backdrop" aria-hidden="true" @click="menuAbierto = false"></div>
    <AppSidebar :abierto="menuAbierto" @cerrar="menuAbierto = false" />

    <main class="content">
      <RouterView />
    </main>
  </div>
</template>

<style scoped>
.app-shell {
  display: flex;
  min-height: 100svh;
}

.content {
  flex: 1;
  min-width: 0;
  overflow: auto;
  padding: 28px;
}

.topbar,
.backdrop {
  display: none;
}

@media (max-width: 900px) {
  .app-shell {
    flex-direction: column;
  }

  .topbar {
    position: sticky;
    top: 0;
    z-index: 40;
    display: flex;
    align-items: center;
    gap: 10px;
    padding: calc(8px + env(safe-area-inset-top)) max(12px, env(safe-area-inset-right)) 8px
      max(12px, env(safe-area-inset-left));
    background: var(--color-surface);
    border-bottom: 1px solid var(--color-border-soft);
  }

  .topbar__menu {
    flex-shrink: 0;
    width: 44px;
    height: 44px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: var(--radius-md);
    border: 1px solid var(--color-border-soft);
    background: transparent;
    color: var(--color-text);
    cursor: pointer;
  }

  .topbar__menu svg {
    width: 22px;
    height: 22px;
  }

  .topbar__logo {
    width: 32px;
    height: 32px;
    object-fit: contain;
  }

  .topbar__sede {
    flex: 1;
    min-width: 0;
    font-size: 15px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .topbar__caja {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    gap: 6px;
    min-height: 36px;
    padding: 0 10px;
    border-radius: 999px;
    font-size: 12px;
    font-weight: 600;
    text-decoration: none;
    border: 1px solid var(--color-border-soft);
    color: var(--color-text-muted);
  }

  .topbar__dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: currentColor;
  }

  .topbar__caja--abierta {
    color: var(--color-lime);
    border-color: rgba(178, 255, 5, 0.4);
  }

  .topbar__caja--cerrada {
    color: var(--color-orange);
    border-color: rgba(255, 138, 30, 0.4);
  }

  .backdrop {
    display: block;
    position: fixed;
    inset: 0;
    z-index: 55;
    background: rgba(4, 1, 8, 0.65);
  }

  .content {
    overflow: visible;
    padding: 16px max(12px, env(safe-area-inset-right)) calc(24px + env(safe-area-inset-bottom))
      max(12px, env(safe-area-inset-left));
  }
}

.topbar__menu:focus-visible,
.topbar__caja:focus-visible {
  outline: 2px solid var(--color-cyan);
  outline-offset: 2px;
}
</style>
