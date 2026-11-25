import { apiClient } from './client'
import type { Gasto, PagoCreate, Trabajador, TrabajadorCreate, TrabajadorUpdate } from './types'

export function listTrabajadores(incluirInactivos = false): Promise<Trabajador[]> {
  return apiClient.get<Trabajador[]>(`/trabajadores${incluirInactivos ? '?incluir_inactivos=true' : ''}`)
}

export function getTrabajador(id: number): Promise<Trabajador> {
  return apiClient.get<Trabajador>(`/trabajadores/${id}`)
}

export function createTrabajador(payload: TrabajadorCreate): Promise<Trabajador> {
  return apiClient.post<Trabajador>('/trabajadores', payload)
}

export function updateTrabajador(id: number, payload: TrabajadorUpdate): Promise<Trabajador> {
  return apiClient.patch<Trabajador>(`/trabajadores/${id}`, payload)
}

export function deleteTrabajador(id: number): Promise<void> {
  return apiClient.delete<void>(`/trabajadores/${id}`)
}

export function registrarPago(id: number, payload: PagoCreate): Promise<Gasto> {
  return apiClient.post<Gasto>(`/trabajadores/${id}/pagos`, payload)
}

export interface ListPagosParams {
  desde?: string
  hasta?: string
}

export function listPagos(id: number, params: ListPagosParams = {}): Promise<Gasto[]> {
  const query = new URLSearchParams()
  if (params.desde) query.set('desde', params.desde)
  if (params.hasta) query.set('hasta', params.hasta)
  const qs = query.toString()
  return apiClient.get<Gasto[]>(`/trabajadores/${id}/pagos${qs ? `?${qs}` : ''}`)
}
