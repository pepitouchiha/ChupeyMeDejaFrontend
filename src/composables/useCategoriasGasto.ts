import { computed, ref } from 'vue'
import {
  createCategoriaGasto,
  deleteCategoriaGasto,
  listCategoriasGasto,
  updateCategoriaGasto,
} from '../api/gastos'
import type { CategoriaGastoCreate, CategoriaGastoItem, CategoriaGastoUpdate } from '../api/types'

// Estado compartido: la vista de gastos, el formulario y el modal de
// administración ven la misma lista.
const categorias = ref<CategoriaGastoItem[]>([])
const isLoading = ref(false)
const loadError = ref('')

export function useCategoriasGasto() {
  /** Las que se pueden elegir al crear un gasto manual. */
  const seleccionables = computed(() => categorias.value.filter((c) => c.activa && c.seleccionable))

  async function load(): Promise<void> {
    isLoading.value = true
    loadError.value = ''
    try {
      categorias.value = await listCategoriasGasto()
    } catch {
      loadError.value = 'No fue posible cargar las categorías de gasto.'
    } finally {
      isLoading.value = false
    }
  }

  async function create(payload: CategoriaGastoCreate): Promise<CategoriaGastoItem> {
    const nueva = await createCategoriaGasto(payload)
    await load()
    return nueva
  }

  async function update(id: number, payload: CategoriaGastoUpdate): Promise<CategoriaGastoItem> {
    const actualizada = await updateCategoriaGasto(id, payload)
    await load()
    return actualizada
  }

  async function remove(id: number): Promise<void> {
    await deleteCategoriaGasto(id)
    await load()
  }

  return { categorias, seleccionables, isLoading, loadError, load, create, update, remove }
}
