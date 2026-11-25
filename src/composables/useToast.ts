import { reactive } from 'vue'

export type ToastType = 'success' | 'error'

export interface ToastAction {
  label: string
  handler: () => void
}

export interface Toast {
  id: number
  message: string
  type: ToastType
  action?: ToastAction
}

const toasts = reactive<Toast[]>([])
const DURATION_MS = 3500
const DURATION_WITH_ACTION_MS = 10000

let nextId = 1

function dismiss(id: number): void {
  const index = toasts.findIndex((toast) => toast.id === id)
  if (index !== -1) {
    toasts.splice(index, 1)
  }
}

function push(message: string, type: ToastType = 'success', action?: ToastAction): number {
  const id = nextId++
  toasts.push({ id, message, type, action })
  setTimeout(() => dismiss(id), action ? DURATION_WITH_ACTION_MS : DURATION_MS)
  return id
}

export function useToast() {
  return { toasts, push, dismiss }
}
