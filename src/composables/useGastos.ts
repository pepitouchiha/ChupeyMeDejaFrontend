import { computed, ref } from 'vue'
import { createGasto, deleteGasto, listGastos, updateGasto } from '../api/gastos'
import type { ListGastosParams } from '../api/gastos'
import { ApiError } from '../api/client'
import type { Gasto, GastoCreate, GastoUpdate } from '../api/types'

export function useGastos() {
  const gastos = ref<Gasto[]>([])
  const isLoading = ref(false)
  const loadError = ref('')

  const total = computed(() => gastos.value.reduce((acc, g) => acc + g.monto, 0))

  async function load(params: ListGastosParams = {}): Promise<void> {
    isLoading.value = true
    loadError.value = ''
    try {
      gastos.value = await listGastos(params)
    } catch (err) {
      loadError.value = messageFor(err, 'No fue posible cargar los gastos. Intenta de nuevo.')
    } finally {
      isLoading.value = false
    }
  }

  function create(payload: GastoCreate): Promise<Gasto> {
    return createGasto(payload)
  }

  function update(id: number, payload: GastoUpdate): Promise<Gasto> {
    return updateGasto(id, payload)
  }

  function remove(id: number): Promise<void> {
    return deleteGasto(id)
  }

  function messageFor(err: unknown, fallback: string): string {
    if (err instanceof ApiError && typeof err.message === 'string' && err.message) {
      return err.message
    }
    return fallback
  }

  return { gastos, total, isLoading, loadError, load, create, update, remove, messageFor }
}
