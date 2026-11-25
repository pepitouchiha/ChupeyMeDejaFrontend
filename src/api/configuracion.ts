import { apiClient } from './client'
import type { ConfiguracionNegocio } from './types'

export function obtenerConfiguracionNegocio(): Promise<ConfiguracionNegocio> {
  return apiClient.get<ConfiguracionNegocio>('/configuracion/negocio')
}

export function guardarConfiguracionNegocio(
  payload: ConfiguracionNegocio,
): Promise<ConfiguracionNegocio> {
  return apiClient.put<ConfiguracionNegocio>('/configuracion/negocio', payload)
}
