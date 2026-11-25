import { cerrarSesion, getSedeActivaId, getToken } from '../composables/useAuth'

const API_BASE_URL = import.meta.env.VITE_API_URL as string | undefined

if (!API_BASE_URL) {
  console.warn(
    'VITE_API_URL no está definida. Configúrala en un archivo .env (ver .env.example).',
  )
}

export class ApiError extends Error {
  status: number
  body: unknown

  constructor(status: number, message: string, body?: unknown) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.body = body
  }
}

export interface ApiRequestOptions extends Omit<RequestInit, 'body'> {
  body?: unknown
  auth?: boolean
}

// FastAPI devuelve `detail` como string en los HTTPException, pero como lista
// de errores `{loc, msg}` en las validaciones 422 de Pydantic.
function detailToMessage(detail: unknown): string {
  if (Array.isArray(detail)) {
    const msgs = detail
      .map((err) => (err && typeof err === 'object' && 'msg' in err ? String(err.msg) : ''))
      .filter(Boolean)
    return msgs.length ? msgs.join(' · ') : 'Datos inválidos.'
  }
  return String(detail)
}

async function request<TResponse>(
  path: string,
  { body, auth = true, headers, ...rest }: ApiRequestOptions = {},
): Promise<TResponse> {
  const finalHeaders = new Headers(headers)
  finalHeaders.set('Accept', 'application/json')

  let finalBody: BodyInit | undefined
  if (body !== undefined) {
    finalHeaders.set('Content-Type', 'application/json')
    finalBody = JSON.stringify(body)
  }

  if (auth) {
    const token = getToken()
    if (token) {
      finalHeaders.set('Authorization', `Bearer ${token}`)
    }
    const sedeId = getSedeActivaId()
    if (sedeId !== null) {
      finalHeaders.set('X-Sede-Id', String(sedeId))
    }
  }

  let response: Response
  try {
    response = await fetch(`${API_BASE_URL ?? ''}${path}`, {
      ...rest,
      headers: finalHeaders,
      body: finalBody,
    })
  } catch {
    throw new ApiError(0, 'No fue posible conectar con el servidor.')
  }

  const contentType = response.headers.get('content-type') ?? ''
  const isJson = contentType.includes('application/json')
  const data = isJson ? await response.json().catch(() => undefined) : undefined

  // Token vencido, revocado, usuario desactivado o sede desactivada: volver al login.
  const sedeDesactivada =
    response.status === 403 &&
    isJson &&
    !!data &&
    typeof data === 'object' &&
    (data as { detail?: unknown }).detail === 'Tu sede está desactivada.'
  if ((response.status === 401 || sedeDesactivada) && auth && getToken()) {
    cerrarSesion()
    const destino = window.location.pathname + window.location.search
    window.location.assign(`/login?redirect=${encodeURIComponent(destino)}`)
  }

  if (!response.ok) {
    const message =
      (isJson && data && typeof data === 'object' && 'detail' in data
        ? detailToMessage((data as { detail: unknown }).detail)
        : undefined) ?? `Error ${response.status} al llamar a ${path}`
    throw new ApiError(response.status, message, data)
  }

  return data as TResponse
}

export const apiClient = {
  get: <TResponse>(path: string, options?: ApiRequestOptions) =>
    request<TResponse>(path, { ...options, method: 'GET' }),
  post: <TResponse>(path: string, body?: unknown, options?: ApiRequestOptions) =>
    request<TResponse>(path, { ...options, method: 'POST', body }),
  put: <TResponse>(path: string, body?: unknown, options?: ApiRequestOptions) =>
    request<TResponse>(path, { ...options, method: 'PUT', body }),
  patch: <TResponse>(path: string, body?: unknown, options?: ApiRequestOptions) =>
    request<TResponse>(path, { ...options, method: 'PATCH', body }),
  delete: <TResponse>(path: string, options?: ApiRequestOptions) =>
    request<TResponse>(path, { ...options, method: 'DELETE' }),
}
