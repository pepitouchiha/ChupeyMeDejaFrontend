import { computed, ref } from 'vue'
import { abrirCaja, cerrarCaja, getCajaActual, getSesion, listSesiones } from '../api/caja'
import type { ListSesionesParams } from '../api/caja'
import { ApiError } from '../api/client'
import type {
  CajaAbrir,
  CajaActual,
  CajaCerrar,
  CajaSesion,
  CajaSesionDetalle,
} from '../api/types'

// Estado compartido por toda la app (sidebar, Ventas, cobro de mesa y pantalla de Caja).
const actual = ref<CajaActual | null>(null)
const isLoadingActual = ref(false)
const actualError = ref('')

async function cargarActual(): Promise<void> {
  isLoadingActual.value = true
  actualError.value = ''
  try {
    actual.value = await getCajaActual()
  } catch {
    actualError.value = 'No fue posible consultar el estado de la caja.'
  } finally {
    isLoadingActual.value = false
  }
}

export function useCaja() {
  /** `null` mientras no se conoce el estado; evita mostrar avisos de "caja cerrada" por error. */
  const abierta = computed<boolean | null>(() => (actual.value ? actual.value.abierta : null))
  const cerrada = computed(() => abierta.value === false)

  async function abrir(payload: CajaAbrir): Promise<void> {
    actual.value = await abrirCaja(payload)
  }

  async function cerrar(payload: CajaCerrar): Promise<CajaSesion> {
    const sesion = await cerrarCaja(payload)
    await cargarActual()
    return sesion
  }

  function loadSesiones(params: ListSesionesParams = {}): Promise<CajaSesion[]> {
    return listSesiones(params)
  }

  function loadSesion(id: number): Promise<CajaSesionDetalle> {
    return getSesion(id)
  }

  function messageFor(err: unknown, fallback: string): string {
    if (err instanceof ApiError && typeof err.message === 'string' && err.message) {
      return err.message
    }
    return fallback
  }

  return {
    actual,
    abierta,
    cerrada,
    isLoadingActual,
    actualError,
    cargarActual,
    abrir,
    cerrar,
    loadSesiones,
    loadSesion,
    messageFor,
  }
}
