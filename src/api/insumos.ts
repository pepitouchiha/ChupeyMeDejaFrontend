import { apiClient } from './client'
import type {
  AjusteStock,
  ConteoInsumo,
  EntradaInsumo,
  Insumo,
  InsumoCreate,
  InsumoUpdate,
  MovimientoInsumo,
  TipoInsumo,
  TipoInsumoItem,
} from './types'

export interface ListInsumosParams {
  tipo?: TipoInsumo
  solo_alertas?: boolean
  incluir_inactivos?: boolean
}

export function listInsumos(params: ListInsumosParams = {}): Promise<Insumo[]> {
  const query = new URLSearchParams()
  if (params.tipo) query.set('tipo', params.tipo)
  if (params.solo_alertas) query.set('solo_alertas', 'true')
  if (params.incluir_inactivos) query.set('incluir_inactivos', 'true')
  const qs = query.toString()
  return apiClient.get<Insumo[]>(`/insumos${qs ? `?${qs}` : ''}`)
}

export function createInsumo(payload: InsumoCreate): Promise<Insumo> {
  return apiClient.post<Insumo>('/insumos', payload)
}

export function updateInsumo(id: number, payload: InsumoUpdate): Promise<Insumo> {
  return apiClient.patch<Insumo>(`/insumos/${id}`, payload)
}

export function registrarEntradaInsumo(id: number, payload: EntradaInsumo): Promise<Insumo> {
  return apiClient.post<Insumo>(`/insumos/${id}/entradas`, payload)
}

export function ajustarStockInsumo(id: number, payload: AjusteStock): Promise<Insumo> {
  return apiClient.post<Insumo>(`/insumos/${id}/ajustar-stock`, payload)
}

export function contarInsumo(id: number, payload: ConteoInsumo): Promise<Insumo> {
  return apiClient.post<Insumo>(`/insumos/${id}/conteo`, payload)
}

export function listMovimientosInsumo(id: number): Promise<MovimientoInsumo[]> {
  return apiClient.get<MovimientoInsumo[]>(`/insumos/${id}/movimientos`)
}

export function deleteInsumo(id: number): Promise<void> {
  return apiClient.delete<void>(`/insumos/${id}`)
}

// ---- Tipos de insumo (por sede)

export function listTiposInsumo(): Promise<TipoInsumoItem[]> {
  return apiClient.get<TipoInsumoItem[]>('/insumos/tipos')
}

export function createTipoInsumo(nombre: string): Promise<TipoInsumoItem> {
  return apiClient.post<TipoInsumoItem>('/insumos/tipos', { nombre })
}

export function updateTipoInsumo(
  id: number,
  payload: { nombre?: string; activo?: boolean },
): Promise<TipoInsumoItem> {
  return apiClient.patch<TipoInsumoItem>(`/insumos/tipos/${id}`, payload)
}

export function deleteTipoInsumo(id: number): Promise<void> {
  return apiClient.delete<void>(`/insumos/tipos/${id}`)
}
