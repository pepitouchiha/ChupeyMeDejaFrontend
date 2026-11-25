import { ref } from 'vue'
import {
  contarInsumo,
  createInsumo,
  deleteInsumo,
  listInsumos,
  listMovimientosInsumo,
  registrarEntradaInsumo,
  updateInsumo,
} from '../api/insumos'
import { ApiError } from '../api/client'
import type {
  ConteoInsumo,
  EntradaInsumo,
  Insumo,
  InsumoCreate,
  InsumoUpdate,
  MovimientoInsumo,
} from '../api/types'

export function useInsumos() {
  const insumos = ref<Insumo[]>([])
  const isLoading = ref(false)
  const loadError = ref('')

  async function load(options: { incluirInactivos?: boolean } = {}): Promise<void> {
    isLoading.value = true
    loadError.value = ''
    try {
      insumos.value = await listInsumos({ incluir_inactivos: options.incluirInactivos })
    } catch {
      loadError.value = 'No fue posible cargar el inventario. Intenta de nuevo.'
    } finally {
      isLoading.value = false
    }
  }

  function replaceInList(actualizado: Insumo): Insumo {
    insumos.value = insumos.value.map((i) => (i.id === actualizado.id ? actualizado : i))
    return actualizado
  }

  function create(payload: InsumoCreate): Promise<Insumo> {
    return createInsumo(payload)
  }

  async function update(id: number, payload: InsumoUpdate): Promise<Insumo> {
    return replaceInList(await updateInsumo(id, payload))
  }

  async function registrarEntrada(id: number, payload: EntradaInsumo): Promise<Insumo> {
    return replaceInList(await registrarEntradaInsumo(id, payload))
  }

  async function contar(id: number, payload: ConteoInsumo): Promise<Insumo> {
    return replaceInList(await contarInsumo(id, payload))
  }

  function loadMovimientos(id: number): Promise<MovimientoInsumo[]> {
    return listMovimientosInsumo(id)
  }

  function remove(id: number): Promise<void> {
    return deleteInsumo(id)
  }

  function messageFor(err: unknown, fallback: string): string {
    if (err instanceof ApiError && typeof err.message === 'string' && err.message) {
      return err.message
    }
    return fallback
  }

  return {
    insumos,
    isLoading,
    loadError,
    load,
    create,
    update,
    registrarEntrada,
    contar,
    loadMovimientos,
    remove,
    messageFor,
  }
}
