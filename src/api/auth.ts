import { apiClient } from './client'
import type {
  CambiarPasswordRequest,
  LoginRequest,
  SedeResumen,
  SedeUpsert,
  SesionResponse,
  UsuarioCreate,
  UsuarioSesion,
  UsuarioUpdate,
} from './types'

export function login(payload: LoginRequest): Promise<SesionResponse> {
  return apiClient.post<SesionResponse>('/auth/login', payload, { auth: false })
}

export function getSesion(): Promise<SesionResponse> {
  return apiClient.get<SesionResponse>('/auth/me')
}

export function cambiarPassword(payload: CambiarPasswordRequest): Promise<SesionResponse> {
  return apiClient.post<SesionResponse>('/auth/cambiar-password', payload)
}

// ---- Gestión de cuentas y sedes

export function listUsuarios(): Promise<UsuarioSesion[]> {
  return apiClient.get<UsuarioSesion[]>('/usuarios')
}

export function createUsuario(payload: UsuarioCreate): Promise<UsuarioSesion> {
  return apiClient.post<UsuarioSesion>('/usuarios', payload)
}

export function updateUsuario(id: number, payload: UsuarioUpdate): Promise<UsuarioSesion> {
  return apiClient.patch<UsuarioSesion>(`/usuarios/${id}`, payload)
}

export function restablecerPassword(id: number, password: string): Promise<UsuarioSesion> {
  return apiClient.post<UsuarioSesion>(`/usuarios/${id}/password`, { password })
}

export function deleteUsuario(id: number): Promise<void> {
  return apiClient.delete<void>(`/usuarios/${id}`)
}

export function listSedes(): Promise<SedeResumen[]> {
  return apiClient.get<SedeResumen[]>('/sedes')
}

export function createSede(payload: { nombre: string; direccion: string | null }): Promise<SedeResumen> {
  return apiClient.post<SedeResumen>('/sedes', payload)
}

export function updateSede(id: number, payload: SedeUpsert): Promise<SedeResumen> {
  return apiClient.patch<SedeResumen>(`/sedes/${id}`, payload)
}
