import { computed, ref } from 'vue'
import type { Rol, SedeResumen, SesionResponse, UsuarioSesion } from '../api/types'

/**
 * Sesión del usuario: token JWT, datos del usuario, sedes a las que tiene
 * acceso y sede activa. Se guarda en localStorage para sobrevivir recargas;
 * el backend vuelve a validar todo en cada petición.
 */

const TOKEN_KEY = 'cmd_token'
const USUARIO_KEY = 'cmd_usuario'
const SEDES_KEY = 'cmd_sedes'
const SEDE_ACTIVA_KEY = 'cmd_sede_activa'

function leer<T>(clave: string): T | null {
  try {
    const valor = localStorage.getItem(clave)
    return valor ? (JSON.parse(valor) as T) : null
  } catch {
    return null
  }
}

function escribir(clave: string, valor: unknown): void {
  try {
    if (valor === null || valor === undefined) localStorage.removeItem(clave)
    else localStorage.setItem(clave, JSON.stringify(valor))
  } catch {
    // Almacenamiento no disponible (modo privado): la sesión dura hasta recargar.
  }
}

// Limpia la sesión guardada por la versión anterior de la app (claves bf_*).
try {
  localStorage.removeItem('bf_token')
  localStorage.removeItem('bf_user_email')
} catch {
  /* sin almacenamiento */
}

const token = ref<string | null>(leer<string>(TOKEN_KEY))
const usuario = ref<UsuarioSesion | null>(leer<UsuarioSesion>(USUARIO_KEY))
const sedes = ref<SedeResumen[]>(leer<SedeResumen[]>(SEDES_KEY) ?? [])
const sedeActivaId = ref<number | null>(leer<number>(SEDE_ACTIVA_KEY))

/** Super admin y dueño no pertenecen a una sede: eligen cuál operar. */
const esGlobal = computed(() => usuario.value?.rol === 'superadmin' || usuario.value?.rol === 'dueno')
const esSuperadmin = computed(() => usuario.value?.rol === 'superadmin')
const esAdmin = computed(
  () => esGlobal.value || usuario.value?.rol === 'administrador',
)
const sedeActiva = computed(() => sedes.value.find((s) => s.id === sedeActivaId.value) ?? null)

function elegirSedeInicial(): void {
  const u = usuario.value
  if (!u) {
    sedeActivaId.value = null
  } else if (u.rol !== 'superadmin' && u.rol !== 'dueno') {
    // Los empleados solo tienen su sede.
    sedeActivaId.value = u.sede_id
  } else if (!sedes.value.some((s) => s.id === sedeActivaId.value)) {
    sedeActivaId.value = sedes.value.find((s) => s.activa)?.id ?? sedes.value[0]?.id ?? null
  }
  escribir(SEDE_ACTIVA_KEY, sedeActivaId.value)
}

export function getToken(): string | null {
  return token.value
}

export function getSedeActivaId(): number | null {
  return sedeActivaId.value
}

export function guardarSesion(sesion: SesionResponse): void {
  token.value = sesion.access_token
  usuario.value = sesion.usuario
  sedes.value = sesion.sedes
  escribir(TOKEN_KEY, sesion.access_token)
  escribir(USUARIO_KEY, sesion.usuario)
  escribir(SEDES_KEY, sesion.sedes)
  elegirSedeInicial()
}

export function cerrarSesion(): void {
  token.value = null
  usuario.value = null
  sedes.value = []
  escribir(TOKEN_KEY, null)
  escribir(USUARIO_KEY, null)
  escribir(SEDES_KEY, null)
  // La sede activa se recuerda para el próximo ingreso.
}

/**
 * Cambia la sede activa (super admin y dueño). Recarga la app para que ninguna
 * pantalla muestre datos en caché de la sede anterior.
 */
export function cambiarSede(id: number): void {
  if (!esGlobal.value || id === sedeActivaId.value) return
  if (!sedes.value.some((s) => s.id === id)) return
  sedeActivaId.value = id
  escribir(SEDE_ACTIVA_KEY, id)
  window.location.assign('/dashboard')
}

export function tieneRol(...roles: Rol[]): boolean {
  return !!usuario.value && roles.includes(usuario.value.rol)
}

export function useAuth() {
  return {
    token,
    usuario,
    sedes,
    sedeActiva,
    sedeActivaId,
    esGlobal,
    esSuperadmin,
    esAdmin,
    isAuthenticated: () => token.value !== null && usuario.value !== null,
    guardarSesion,
    cerrarSesion,
    cambiarSede,
    tieneRol,
  }
}
