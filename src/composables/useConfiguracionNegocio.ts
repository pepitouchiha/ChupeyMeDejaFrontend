import { ref } from 'vue'
import { guardarConfiguracionNegocio, obtenerConfiguracionNegocio } from '../api/configuracion'
import { ApiError } from '../api/client'
import type { ConfiguracionNegocio } from '../api/types'

export const CONFIGURACION_POR_DEFECTO: ConfiguracionNegocio = {
  nombre_negocio: 'ChupeyMeDeja',
  nit: null,
  direccion: null,
  telefono: null,
  mensaje_pie: '¡Gracias por su compra!',
  imprimir_comanda_auto: true,
  imprimir_factura_auto: false,
  ancho_papel_mm: 80,
}

// Estado compartido entre vistas: una sola copia de la configuración en memoria.
const configuracion = ref<ConfiguracionNegocio | null>(null)

/** Devuelve la configuración vigente (la pide al backend si aún no se cargó o `forzar`). */
let enVuelo: Promise<ConfiguracionNegocio> | null = null

export function cargarConfiguracionNegocio(forzar = false): Promise<ConfiguracionNegocio> {
  if (configuracion.value && !forzar) return Promise.resolve(configuracion.value)
  if (enVuelo) return enVuelo
  enVuelo = obtenerConfiguracionNegocio()
    .then((data) => {
      configuracion.value = data
      return data
    })
    .finally(() => {
      enVuelo = null
    })
  return enVuelo
}

export function useConfiguracionNegocio() {
  const isLoading = ref(false)
  const isSaving = ref(false)
  const loadError = ref('')

  async function load(): Promise<void> {
    isLoading.value = true
    loadError.value = ''
    try {
      await cargarConfiguracionNegocio(true)
    } catch {
      loadError.value = 'No fue posible cargar la configuración. Intenta de nuevo.'
    } finally {
      isLoading.value = false
    }
  }

  async function save(payload: ConfiguracionNegocio): Promise<ConfiguracionNegocio> {
    isSaving.value = true
    try {
      const data = await guardarConfiguracionNegocio(payload)
      configuracion.value = data
      return data
    } finally {
      isSaving.value = false
    }
  }

  function messageFor(err: unknown, fallback: string): string {
    if (err instanceof ApiError && typeof err.message === 'string' && err.message) return err.message
    return fallback
  }

  return { configuracion, isLoading, isSaving, loadError, load, save, messageFor }
}
