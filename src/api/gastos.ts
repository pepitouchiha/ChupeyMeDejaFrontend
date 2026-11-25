import { apiClient } from './client'
import type {
  CategoriaGasto,
  CategoriaGastoCreate,
  CategoriaGastoItem,
  CategoriaGastoUpdate,
  Gasto,
  GastoCreate,
  GastoUpdate,
} from './types'

export interface ListGastosParams {
  desde?: string
  hasta?: string
  categoria?: CategoriaGasto
}

export function listGastos(params: ListGastosParams = {}): Promise<Gasto[]> {
  const query = new URLSearchParams()
  if (params.desde) query.set('desde', params.desde)
  if (params.hasta) query.set('hasta', params.hasta)
  if (params.categoria) query.set('categoria', params.categoria)
  const qs = query.toString()
  return apiClient.get<Gasto[]>(`/gastos${qs ? `?${qs}` : ''}`)
}

export function createGasto(payload: GastoCreate): Promise<Gasto> {
  return apiClient.post<Gasto>('/gastos', payload)
}

export function updateGasto(id: number, payload: GastoUpdate): Promise<Gasto> {
  return apiClient.patch<Gasto>(`/gastos/${id}`, payload)
}

export function deleteGasto(id: number): Promise<void> {
  return apiClient.delete<void>(`/gastos/${id}`)
}

export function listCategoriasGasto(): Promise<CategoriaGastoItem[]> {
  return apiClient.get<CategoriaGastoItem[]>('/gastos/categorias')
}

export function createCategoriaGasto(payload: CategoriaGastoCreate): Promise<CategoriaGastoItem> {
  return apiClient.post<CategoriaGastoItem>('/gastos/categorias', payload)
}

export function updateCategoriaGasto(id: number, payload: CategoriaGastoUpdate): Promise<CategoriaGastoItem> {
  return apiClient.patch<CategoriaGastoItem>(`/gastos/categorias/${id}`, payload)
}

export function deleteCategoriaGasto(id: number): Promise<void> {
  return apiClient.delete<void>(`/gastos/categorias/${id}`)
}
