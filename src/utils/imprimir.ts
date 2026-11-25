import type {
  AnchoPapelMm,
  CajaSesion,
  ConfiguracionNegocio,
  Producto,
  Venta,
  VentaItem,
} from '../api/types'
import { formatCOP } from './currency'
import { formatFechaHora, ZONA_NEGOCIO } from './fecha'

export interface ItemComanda {
  producto_id: number
  nombre_producto: string
  cantidad: number
}

export interface OpcionesComanda {
  items?: ItemComanda[]
  adicional?: boolean
}

type DetallesProducto = Map<number, Pick<Producto, 'sabor' | 'tamano'>>

function esc(texto: string): string {
  return texto
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function estilos(ancho: AnchoPapelMm): string {
  const contenido = ancho === 58 ? 48 : 72
  return `
@page { size: ${ancho}mm auto; margin: 0 }
* { box-sizing: border-box; margin: 0; padding: 0; color: #000 !important; background: transparent !important; box-shadow: none !important; text-shadow: none !important }
html, body { width: ${ancho}mm; background: #fff !important }
body { font-family: 'Courier New', Courier, monospace; font-size: ${ancho === 58 ? 11 : 12}px; line-height: 1.3; padding: 3mm ${(ancho - contenido) / 2}mm 6mm; }
.centro { text-align: center }
.negocio { font-size: 15px; font-weight: bold }
.titulo { font-size: 18px; font-weight: bold; text-align: center; letter-spacing: 1px }
.adicional { font-size: 16px; font-weight: bold; text-align: center; border: 2px solid #000; padding: 2px 0; margin: 4px 0 }
.sep { border: 0; border-top: 1px dashed #000; margin: 6px 0 }
.fila { display: flex; justify-content: space-between; gap: 6px }
.fila > span:first-child { flex: 1; min-width: 0; overflow-wrap: anywhere }
.fila > span:last-child { white-space: nowrap }
.item { margin: 4px 0; break-inside: avoid }
.cmd-item { display: flex; gap: 8px; align-items: baseline; margin: 6px 0; break-inside: avoid }
.cmd-cant { font-size: 22px; font-weight: bold; min-width: 36px }
.cmd-nombre { font-size: 14px; font-weight: bold; overflow-wrap: anywhere }
.cmd-detalle { font-size: 11px; font-weight: normal }
.total { font-size: 15px; font-weight: bold }
.pie { margin-top: 8px; text-align: center }
.logo { display: block; width: 55%; height: auto; margin: 0 auto 4px }
`
}

// Versión en blanco y negro del logo para térmica; URL absoluta porque el
// ticket se renderiza en un iframe `srcdoc` (sin base URL propia).
function logoTicket(): string {
  return `<img class="logo" src="${window.location.origin}/logo-ticket.png" alt="">`
}

function documento(titulo: string, ancho: AnchoPapelMm, cuerpo: string): string {
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>${esc(titulo)}</title><style>${estilos(ancho)}</style></head><body>${cuerpo}</body></html>`
}

function fechaHoraAhora(): string {
  return new Date().toLocaleString('es-CO', {
    timeZone: ZONA_NEGOCIO,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function detalleProducto(id: number, detalles?: DetallesProducto): string {
  const d = detalles?.get(id)
  if (!d) return ''
  return [d.tamano, d.sabor].filter((v): v is string => !!v).join(' · ')
}

export function construirComanda(
  venta: Venta,
  config: ConfiguracionNegocio,
  detalles?: DetallesProducto,
  opciones: OpcionesComanda = {},
): string {
  const items: ItemComanda[] = opciones.items ?? venta.items
  const mesa = venta.mesa_nombre ?? 'Para llevar'
  const lineas = items
    .map((item) => {
      const detalle = detalleProducto(item.producto_id, detalles)
      return `<div class="cmd-item"><span class="cmd-cant">${item.cantidad}x</span><span class="cmd-nombre">${esc(item.nombre_producto)}${
        detalle ? `<br><span class="cmd-detalle">${esc(detalle)}</span>` : ''
      }</span></div>`
    })
    .join('')
  const cuerpo = `
<div class="titulo">COMANDA</div>
${opciones.adicional ? '<div class="adicional">ADICIONAL</div>' : ''}
<hr class="sep">
<div class="negocio centro" style="font-size:16px">${esc(mesa)}</div>
<div class="fila"><span>Pedido #${venta.id}</span><span>${esc(fechaHoraAhora())}</span></div>
<hr class="sep">
${lineas}
<hr class="sep">`
  return documento(`Comanda #${venta.id}`, config.ancho_papel_mm, cuerpo)
}

function lineaFactura(item: VentaItem): string {
  return `<div class="item"><div class="fila"><span>${item.cantidad} x ${esc(item.nombre_producto)}</span><span>${esc(
    formatCOP(item.precio_unitario * item.cantidad),
  )}</span></div>${
    item.cantidad > 1 ? `<div>&nbsp;&nbsp;${esc(formatCOP(item.precio_unitario))} c/u</div>` : ''
  }</div>`
}

export function construirFactura(venta: Venta, config: ConfiguracionNegocio): string {
  const metodo =
    venta.metodo_pago === 'efectivo'
      ? 'Efectivo'
      : venta.metodo_pago === 'transferencia'
        ? 'Transferencia'
        : null
  const cuerpo = `
${logoTicket()}
<div class="negocio centro">${esc(config.nombre_negocio)}</div>
${config.nit ? `<div class="centro">NIT: ${esc(config.nit)}</div>` : ''}
${config.direccion ? `<div class="centro">${esc(config.direccion)}</div>` : ''}
${config.telefono ? `<div class="centro">Tel: ${esc(config.telefono)}</div>` : ''}
<hr class="sep">
<div><strong>Factura de venta #${venta.id}</strong></div>
<div>${esc(formatFechaHora(venta.creado_en))}</div>
<div>${esc(venta.mesa_nombre ?? 'Para llevar')}</div>
<hr class="sep">
${venta.items.map(lineaFactura).join('')}
<hr class="sep">
<div class="fila total"><span>TOTAL</span><span>${esc(formatCOP(venta.total))}</span></div>
${metodo ? `<div class="fila"><span>Pago</span><span>${metodo}</span></div>` : ''}
<hr class="sep">
${config.mensaje_pie ? `<div class="pie">${esc(config.mensaje_pie)}</div>` : ''}`
  return documento(`Factura #${venta.id}`, config.ancho_papel_mm, cuerpo)
}

function filaCierre(etiqueta: string, valor: number, fuerte = false): string {
  return `<div class="fila${fuerte ? ' total' : ''}"><span>${esc(etiqueta)}</span><span>${esc(formatCOP(valor))}</span></div>`
}

export function construirCierreCaja(sesion: CajaSesion, config: ConfiguracionNegocio): string {
  const diferencia = sesion.diferencia ?? 0
  const etiquetaDiferencia =
    diferencia === 0 ? 'Diferencia' : diferencia > 0 ? 'Sobrante' : 'Faltante'
  const cuerpo = `
${logoTicket()}
<div class="negocio centro">${esc(config.nombre_negocio)}</div>
<div class="titulo">CIERRE DE CAJA</div>
<hr class="sep">
<div class="fila"><span>Apertura</span><span>${esc(formatFechaHora(sesion.abierta_en))}</span></div>
${sesion.cerrada_en ? `<div class="fila"><span>Cierre</span><span>${esc(formatFechaHora(sesion.cerrada_en))}</span></div>` : ''}
<hr class="sep">
${filaCierre('Base inicial', sesion.base_inicial)}
${filaCierre('Ventas efectivo', sesion.ventas_efectivo)}
${filaCierre('Ventas transferencia', sesion.ventas_transferencia)}
<div class="fila"><span>N.o de ventas</span><span>${sesion.num_ventas}</span></div>
${filaCierre('Gastos desde caja', sesion.gastos_desde_caja)}
<hr class="sep">
${filaCierre('Efectivo esperado', sesion.efectivo_esperado, true)}
${filaCierre('Efectivo contado', sesion.efectivo_contado ?? 0, true)}
${filaCierre(etiquetaDiferencia, Math.abs(diferencia))}
<hr class="sep">
${filaCierre('Base para mañana', sesion.base_siguiente ?? 0)}
${filaCierre('Retiro', sesion.retiro ?? 0, true)}
${sesion.notas_cierre ? `<hr class="sep"><div>${esc(sesion.notas_cierre)}</div>` : ''}
<hr class="sep">`
  return documento(`Cierre de caja #${sesion.id}`, config.ancho_papel_mm, cuerpo)
}

export function construirPrueba(config: ConfiguracionNegocio): string {
  const venta: Venta = {
    id: 0,
    mesa_id: null,
    mesa_nombre: 'Mesa de prueba',
    metodo_pago: 'efectivo',
    estado: 'activa',
    total: 25000,
    creado_en: new Date().toISOString(),
    items: [
      { id: 1, producto_id: 0, nombre_producto: 'Producto de prueba', cantidad: 2, precio_unitario: 10000 },
      { id: 2, producto_id: 0, nombre_producto: 'Otro producto', cantidad: 1, precio_unitario: 5000 },
    ],
  }
  return construirFactura(venta, config)
}

/** Renderiza el HTML en un iframe oculto y abre el diálogo de impresión del navegador. */
export function imprimirHtml(html: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const iframe = document.createElement('iframe')
    iframe.setAttribute('aria-hidden', 'true')
    iframe.style.cssText =
      'position:fixed;left:-10000px;top:0;width:320px;height:600px;border:0;'

    let limpiado = false
    let respaldo: ReturnType<typeof setTimeout> | undefined
    const limpiar = () => {
      if (limpiado) return
      limpiado = true
      clearTimeout(respaldo)
      iframe.remove()
    }

    iframe.onload = () => {
      const ventana = iframe.contentWindow
      if (!ventana) {
        limpiar()
        reject(new Error('No fue posible preparar la impresión.'))
        return
      }
      ventana.addEventListener('afterprint', limpiar)
      // Respaldo por si el navegador no dispara afterprint.
      respaldo = setTimeout(limpiar, 600_000)
      setTimeout(() => {
        try {
          ventana.focus()
          ventana.print()
          resolve()
        } catch (err) {
          limpiar()
          reject(err instanceof Error ? err : new Error('No fue posible imprimir.'))
        }
      }, 50)
    }

    iframe.srcdoc = html
    document.body.appendChild(iframe)
  })
}
