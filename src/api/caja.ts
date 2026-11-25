import { apiClient } from './client'
import type {
  CajaAbrir,
  CajaActual,
  CajaCerrar,
  CajaSesion,
  CajaSesionDetalle,
} from './types'

export function getCajaActual(): Promise<CajaActual> {
  return apiClient.get<CajaActual>('/caja/actual')
}

export function abrirCaja(payload: CajaAbrir): Promise<CajaActual> {
  return apiClient.post<CajaActual>('/caja/abrir', payload)
}

export function cerrarCaja(payload: CajaCerrar): Promise<CajaSesion> {
  return apiClient.post<CajaSesion>('/caja/cerrar', payload)
}

export interface ListSesionesParams {
  desde?: string
  hasta?: string
}

export function listSesiones(params: ListSesionesParams = {}): Promise<CajaSesion[]> {
  const query = new URLSearchParams()
  if (params.desde) query.set('desde', params.desde)
  if (params.hasta) query.set('hasta', params.hasta)
  const qs = query.toString()
  return apiClient.get<CajaSesion[]>(`/caja/sesiones${qs ? `?${qs}` : ''}`)
}

export function getSesion(id: number): Promise<CajaSesionDetalle> {
  return apiClient.get<CajaSesionDetalle>(`/caja/sesiones/${id}`)
}
