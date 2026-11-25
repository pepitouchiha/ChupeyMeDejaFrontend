import { listProductos } from '../api/productos'
import type { CajaSesion, ConfiguracionNegocio, Producto, Venta } from '../api/types'
import { cargarConfiguracionNegocio } from './useConfiguracionNegocio'
import { useToast } from './useToast'
import {
  construirCierreCaja,
  construirComanda,
  construirFactura,
  construirPrueba,
  imprimirHtml,
  type OpcionesComanda,
} from '../utils/imprimir'

type Detalles = Map<number, Pick<Producto, 'sabor' | 'tamano'>>

const DETALLES_TTL_MS = 30_000
let detallesCache: Detalles | null = null
let detallesCargadosEn = 0

async function cargarDetalles(): Promise<Detalles> {
  if (detallesCache && Date.now() - detallesCargadosEn < DETALLES_TTL_MS) return detallesCache
  try {
    const productos = await listProductos()
    detallesCache = new Map(productos.map((p) => [p.id, { sabor: p.sabor, tamano: p.tamano }]))
    detallesCargadosEn = Date.now()
    return detallesCache
  } catch {
    // Sin sabor/tamaño la comanda sigue siendo válida; se usa el último cache conocido si existe.
    return detallesCache ?? new Map()
  }
}

// Cola global: comanda y factura de una misma operación se imprimen una tras otra, en orden.
let cola: Promise<unknown> = Promise.resolve()

function encolar<T>(tarea: () => Promise<T>): Promise<T> {
  const resultado = cola.then(tarea)
  cola = resultado.catch(() => undefined)
  return resultado
}

export function useImpresion() {
  const { push: pushToast } = useToast()

  async function configuracionOAviso(): Promise<ConfiguracionNegocio | null> {
    try {
      return await cargarConfiguracionNegocio()
    } catch {
      pushToast(
        'No se pudo cargar la configuración de impresión; no se imprimió automáticamente. Usa los botones de imprimir.',
        'error',
      )
      return null
    }
  }

  async function ejecutar(generar: (config: ConfiguracionNegocio) => Promise<string> | string): Promise<boolean> {
    return encolar(async () => {
      try {
        const config = await cargarConfiguracionNegocio()
        await imprimirHtml(await generar(config))
        return true
      } catch {
        pushToast('No fue posible imprimir. Revisa la impresora e intenta de nuevo.', 'error')
        return false
      }
    })
  }

  function imprimirComanda(venta: Venta, opciones: OpcionesComanda = {}): Promise<boolean> {
    return ejecutar(async (config) =>
      construirComanda(venta, config, await cargarDetalles(), opciones),
    )
  }

  function imprimirFactura(venta: Venta): Promise<boolean> {
    return ejecutar((config) => construirFactura(venta, config))
  }

  function imprimirCierreCaja(sesion: CajaSesion): Promise<boolean> {
    return ejecutar((config) => construirCierreCaja(sesion, config))
  }

  function imprimirPrueba(config: ConfiguracionNegocio): Promise<boolean> {
    return ejecutar(() => construirPrueba(config))
  }

  /** Comanda automática si está activada en la configuración. */
  async function comandaAuto(venta: Venta, opciones: OpcionesComanda = {}): Promise<void> {
    const config = await configuracionOAviso()
    if (config?.imprimir_comanda_auto) await imprimirComanda(venta, opciones)
  }

  /** Factura automática si está activada; si no, el toast ofrece el botón "Imprimir factura". */
  async function facturaAutoOToast(venta: Venta, mensaje: string): Promise<void> {
    const config = await configuracionOAviso()
    if (config?.imprimir_factura_auto) {
      pushToast(mensaje)
      await imprimirFactura(venta)
      return
    }
    pushToast(mensaje, 'success', {
      label: 'Imprimir factura',
      handler: () => {
        void imprimirFactura(venta)
      },
    })
  }

  async function comandaAutoActiva(): Promise<boolean> {
    return (await configuracionOAviso())?.imprimir_comanda_auto ?? false
  }

  return {
    comandaAutoActiva,
    imprimirComanda,
    imprimirFactura,
    imprimirCierreCaja,
    imprimirPrueba,
    comandaAuto,
    facturaAutoOToast,
  }
}
