import { ref } from 'vue'
import {
  createTrabajador,
  deleteTrabajador,
  getTrabajador,
  listPagos,
  listTrabajadores,
  registrarPago,
  updateTrabajador,
} from '../api/trabajadores'
import type { ListPagosParams } from '../api/trabajadores'
import { ApiError } from '../api/client'
import type {
  Gasto,
  PagoCreate,
  Trabajador,
  TrabajadorCreate,
  TrabajadorUpdate,
} from '../api/types'

export function useTrabajadores() {
  const trabajadores = ref<Trabajador[]>([])
  const isLoading = ref(false)
  const loadError = ref('')

  async function load(): Promise<void> {
    isLoading.value = true
    loadError.value = ''
    try {
      trabajadores.value = await listTrabajadores(true)
    } catch (err) {
      loadError.value = messageFor(err, 'No fue posible cargar los trabajadores. Intenta de nuevo.')
    } finally {
      isLoading.value = false
    }
  }

  function getById(id: number): Promise<Trabajador> {
    return getTrabajador(id)
  }

  function create(payload: TrabajadorCreate): Promise<Trabajador> {
    return createTrabajador(payload)
  }

  function update(id: number, payload: TrabajadorUpdate): Promise<Trabajador> {
    return updateTrabajador(id, payload)
  }

  function remove(id: number): Promise<void> {
    return deleteTrabajador(id)
  }

  function pagar(id: number, payload: PagoCreate): Promise<Gasto> {
    return registrarPago(id, payload)
  }

  function loadPagos(id: number, params: ListPagosParams = {}): Promise<Gasto[]> {
    return listPagos(id, params)
  }

  function messageFor(err: unknown, fallback: string): string {
    if (err instanceof ApiError && typeof err.message === 'string' && err.message) {
      return err.message
    }
    return fallback
  }

  return {
    trabajadores,
    isLoading,
    loadError,
    load,
    getById,
    create,
    update,
    remove,
    pagar,
    loadPagos,
    messageFor,
  }
}
