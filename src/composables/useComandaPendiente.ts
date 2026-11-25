import { computed, reactive } from 'vue'
import type { ItemComanda } from '../utils/imprimir'

interface EstadoPedido {
  items: Map<number, ItemComanda>
  comandaEnviada: boolean
}

// En memoria por venta_id: se pierde al recargar la página.
const pedidos = reactive(new Map<number, EstadoPedido>())

function estadoParaEscribir(ventaId: number): EstadoPedido {
  let estado = pedidos.get(ventaId)
  if (!estado) {
    estado = { items: new Map(), comandaEnviada: false }
    pedidos.set(ventaId, estado)
  }
  return estado
}

export function useComandaPendiente(ventaId: number) {
  const items = computed<ItemComanda[]>(() => [...(pedidos.get(ventaId)?.items.values() ?? [])])
  const cantidadPendiente = computed(() => items.value.reduce((acc, i) => acc + i.cantidad, 0))
  const comandaEnviada = computed(() => pedidos.get(ventaId)?.comandaEnviada ?? false)

  /** `delta` > 0 suma al pendiente; `delta` < 0 descuenta (sin bajar de 0). */
  function registrarCambio(productoId: number, nombre: string, delta: number): void {
    const mapa = estadoParaEscribir(ventaId).items
    const actual = mapa.get(productoId)?.cantidad ?? 0
    const nueva = actual + delta
    if (nueva <= 0) {
      mapa.delete(productoId)
    } else {
      mapa.set(productoId, { producto_id: productoId, nombre_producto: nombre, cantidad: nueva })
    }
  }

  /** Descuenta del pendiente lo que se imprimió (lo agregado durante la impresión se conserva). */
  function marcarEnviada(enviados: ItemComanda[]): void {
    const estado = pedidos.get(ventaId)
    if (!estado) return
    for (const enviado of enviados) {
      const actual = estado.items.get(enviado.producto_id)
      if (!actual) continue
      const resto = actual.cantidad - enviado.cantidad
      if (resto <= 0) estado.items.delete(enviado.producto_id)
      else estado.items.set(enviado.producto_id, { ...actual, cantidad: resto })
    }
    estado.comandaEnviada = true
  }

  function limpiar(): void {
    pedidos.delete(ventaId)
  }

  return { items, cantidadPendiente, comandaEnviada, registrarCambio, marcarEnviada, limpiar }
}
