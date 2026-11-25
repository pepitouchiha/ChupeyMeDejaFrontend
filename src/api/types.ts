/**
 * Contrato de POST /auth/login confirmado contra el backend real
 * (backend/app/schemas/auth.py).
 */
export interface LoginRequest {
  email: string
  password: string
}

export type Rol = 'superadmin' | 'dueno' | 'administrador' | 'cajero'
/** Roles que se pueden asignar desde la app (el super admin se crea por comando). */
export type RolAsignable = 'dueno' | 'administrador' | 'cajero'

export interface SedeResumen {
  id: number
  nombre: string
  direccion: string | null
  activa: boolean
}

export interface UsuarioSesion {
  id: number
  email: string
  nombre: string
  rol: Rol
  sede_id: number | null
  sede_nombre: string | null
  activo: boolean
}

/** Respuesta de /auth/login, /auth/me y /auth/cambiar-password. */
export interface SesionResponse {
  access_token: string
  token_type: string
  usuario: UsuarioSesion
  sedes: SedeResumen[]
}

export interface CambiarPasswordRequest {
  password_actual: string
  password_nueva: string
}

export interface UsuarioCreate {
  nombre: string
  email: string
  password: string
  rol: RolAsignable
  /** Obligatoria para administrador y cajero; null para dueño. */
  sede_id: number | null
}

export interface UsuarioUpdate {
  nombre?: string
  rol?: RolAsignable
  sede_id?: number | null
  activo?: boolean
}

export interface SedeUpsert {
  nombre?: string
  direccion?: string | null
  activa?: boolean
}

/**
 * Contrato de /categorias confirmado contra el backend real
 * (backend/app/schemas/categoria.py).
 */
export interface Categoria {
  id: number
  nombre: string
  color: string
  productos_count: number
}

export interface CategoriaCreate {
  nombre: string
  color?: string
}

export interface CategoriaUpdate {
  nombre?: string
  color?: string
}

/**
 * Contrato de /mesas confirmado contra el backend real
 * (backend/app/schemas/mesa.py).
 */
export type EstadoMesa = 'libre' | 'ocupada'

export interface Mesa {
  id: number
  nombre_o_numero: string
  estado: EstadoMesa
}

export interface MesaCreate {
  nombre_o_numero: string
}

export interface MesaUpdate {
  nombre_o_numero: string
}

/**
 * Contrato de /productos confirmado contra el backend real
 * (backend/app/schemas/producto.py).
 */
export type EstadoProducto = 'disponible' | 'agotado'

export interface Producto {
  id: number
  nombre: string
  categoria_id: number
  precio: number
  costo: number | null
  estado: EstadoProducto
  sabor: string | null
  tamano: string | null
  imagen_base64: string | null
  creado_en: string
  insumos: ProductoInsumo[]
}

export interface ProductoCreate {
  nombre: string
  categoria_id: number
  precio: number
  costo?: number | null
  estado?: EstadoProducto
  sabor?: string | null
  tamano?: string | null
  imagen_base64?: string | null
}

export interface ProductoUpdate {
  nombre?: string
  categoria_id?: number
  precio?: number
  costo?: number | null
  estado?: EstadoProducto
  sabor?: string | null
  tamano?: string | null
  imagen_base64?: string | null
}

/**
 * Contrato de /insumos confirmado contra el backend real
 * (backend/app/schemas/insumo.py). `estado` se calcula siempre en backend
 * a partir de stock/stock_minimo, nunca se envía como input.
 */
export type EstadoInsumo = 'Crítico' | 'Bajo' | 'OK'

/** Clave de un tipo de insumo de la sede (se administran en Inventario > Tipos). */
export type TipoInsumo = string

export interface TipoInsumoItem {
  id: number
  clave: string
  nombre: string
  activo: boolean
  num_insumos: number
}

export interface Insumo {
  id: number
  nombre: string
  tipo: TipoInsumo
  tipo_nombre: string
  unidad: string
  stock: number
  stock_minimo: number
  costo_unitario: number | null
  activo: boolean
  estado: EstadoInsumo
}

export interface InsumoCreate {
  nombre: string
  tipo: TipoInsumo
  unidad?: string
  stock?: number
  stock_minimo?: number
  costo_unitario?: number | null
}

export interface InsumoUpdate {
  nombre?: string
  tipo?: TipoInsumo
  unidad?: string
  stock_minimo?: number
  costo_unitario?: number | null
  activo?: boolean
}

export interface AjusteStock {
  cantidad: number
  nota?: string | null
}

/** Payload de `POST /insumos/{id}/entradas` (BE-030/BE-032). */
export interface EntradaInsumo {
  cantidad: number
  costo_total?: number | null
  nota?: string | null
  registrar_gasto?: boolean
  pagado_desde_caja?: boolean
}

/** Payload de `POST /insumos/{id}/conteo`: fija el stock al valor contado. */
export interface ConteoInsumo {
  stock_contado: number
  nota?: string | null
}

export type TipoMovimiento = 'entrada' | 'ajuste' | 'venta' | 'reverso_venta'

export interface MovimientoInsumo {
  id: number
  insumo_id: number
  tipo: TipoMovimiento
  cantidad: number
  stock_resultante: number
  costo_total: number | null
  venta_id: number | null
  nota: string | null
  creado_en: string
}

/** Línea de receta de un producto (BE-031): insumo que se descuenta por unidad vendida. */
export interface ProductoInsumo {
  insumo_id: number
  nombre: string
  unidad: string
  cantidad: number
}

export interface ProductoInsumoIn {
  insumo_id: number
  cantidad: number
}

/**
 * Contrato de /ventas confirmado contra el backend real
 * (backend/app/schemas/venta.py). El total y el precio_unitario de cada item
 * siempre se calculan en el servidor a partir del precio actual del
 * producto — el cliente nunca envía totales.
 */
export type MetodoPago = 'efectivo' | 'transferencia'

/**
 * Contrato de `estado` agregado por BE-020 (soft-delete de una venta) y
 * BE-025 (`abierta`: pedido en curso en una mesa, todavía sin cobrar).
 */
export type EstadoVenta = 'activa' | 'cancelada' | 'abierta'

export interface VentaItemCreate {
  producto_id: number
  cantidad: number
}

export interface VentaCreate {
  items: VentaItemCreate[]
  metodo_pago: MetodoPago
  mesa_id?: number | null
}

/**
 * Payload de `PUT /ventas/{id}` (BE-021): misma forma que `VentaCreate`
 * (reemplazo completo de items/mesa/método de pago).
 */
export interface VentaUpdate {
  items: VentaItemCreate[]
  metodo_pago: MetodoPago
  mesa_id?: number | null
}

/** Payload de `POST /ventas/abrir` (BE-025): abre un pedido vacío en una mesa. */
export interface VentaAbrir {
  mesa_id: number
}

/** Payload de `POST /ventas/{id}/items` (BE-026): agrega líneas nuevas a un pedido abierto. */
export interface VentaAgregarItems {
  items: VentaItemCreate[]
}

/** Payload de `PATCH /ventas/{id}/items/{itemId}`: nueva cantidad (> 0) de un item de un pedido abierto. */
export interface VentaCambiarCantidadItem {
  cantidad: number
}

/** Payload de `POST /ventas/{id}/cerrar` (BE-027): cobra y cierra un pedido abierto. */
export interface VentaCerrar {
  metodo_pago: MetodoPago
}

export interface VentaItem {
  id: number
  producto_id: number
  nombre_producto: string
  cantidad: number
  precio_unitario: number
}

export interface Venta {
  id: number
  mesa_id: number | null
  mesa_nombre: string | null
  /** `null` mientras la venta está `abierta` (BE-025): se asigna al cerrarla. */
  metodo_pago: MetodoPago | null
  estado: EstadoVenta
  total: number
  caja_sesion_id?: number | null
  creado_en: string
  items: VentaItem[]
}

/**
 * Contrato de /reportes confirmado contra el backend real
 * (backend/app/schemas/reporte.py). Todos los montos vienen sin formatear
 * (enteros COP); el formateo a texto es responsabilidad del frontend.
 */
export interface VentaPorHora {
  hora: number
  total: number
  num_ventas: number
}

export interface ReporteHoyOut {
  fecha: string
  total: number
  num_ventas: number
  por_hora: VentaPorHora[]
  margen: number
  margen_incompleto: boolean
}

export interface VentaPorMes {
  anio: number
  mes: number
  total: number
  num_ventas: number
  ticket_promedio: number
  margen: number
  margen_incompleto: boolean
}

export interface ReporteMensualOut {
  meses: VentaPorMes[]
  ytd_total: number
  ytd_margen: number
  ytd_margen_incompleto: boolean
}

/** Fila de `GET /reportes/diario`: totales de un día calendario local con ventas activas. */
export interface VentaPorDia {
  fecha: string
  total: number
  num_ventas: number
  total_efectivo: number
  total_transferencia: number
  margen: number
  margen_incompleto: boolean
}

/**
 * Contrato de /configuracion/negocio (BE-036). `PUT` reemplaza todos los
 * campos: siempre se envía el objeto completo.
 */
export type AnchoPapelMm = 58 | 80

export interface ConfiguracionNegocio {
  nombre_negocio: string
  nit: string | null
  direccion: string | null
  telefono: string | null
  mensaje_pie: string | null
  imprimir_comanda_auto: boolean
  imprimir_factura_auto: boolean
  ancho_papel_mm: AnchoPapelMm
}

/**
 * Contrato de /caja (BE-034). `GET /caja/actual` devuelve un objeto plano: con
 * `abierta=false` solo trae `base_sugerida`; el resto es `null`.
 */
export interface CajaActual {
  abierta: boolean
  base_sugerida: number
  id: number | null
  abierta_en: string | null
  base_inicial: number | null
  notas_apertura: string | null
  ventas_efectivo: number | null
  ventas_transferencia: number | null
  num_ventas: number | null
  gastos_desde_caja: number | null
  efectivo_esperado: number | null
  pedidos_abiertos: number | null
}

export interface CajaAbrir {
  base_inicial: number
  notas?: string | null
}

export interface CajaCerrar {
  efectivo_contado: number
  base_siguiente: number
  notas?: string | null
}

export interface CajaSesion {
  id: number
  abierta_en: string
  cerrada_en: string | null
  base_inicial: number
  notas_apertura: string | null
  ventas_efectivo: number
  ventas_transferencia: number
  num_ventas: number
  gastos_desde_caja: number
  efectivo_esperado: number
  efectivo_contado: number | null
  diferencia: number | null
  base_siguiente: number | null
  retiro: number | null
  notas_cierre: string | null
}

export interface CajaSesionDetalle extends CajaSesion {
  ventas: Venta[]
  gastos: Gasto[]
}

/**
 * Contrato de /gastos (BE-032). La categoría es la `clave` de una
 * CategoriaGastoItem (administrables desde /gastos/categorias).
 * `nomina` solo se crea desde los pagos a trabajadores.
 */
export type CategoriaGasto = string

export interface CategoriaGastoItem {
  id: number
  clave: string
  nombre: string
  color: string
  activa: boolean
  /** Usada por el sistema (nómina, compra de inventario): no se puede eliminar ni desactivar. */
  sistema: boolean
  /** false solo para nómina: no se puede elegir en un gasto manual. */
  seleccionable: boolean
  num_gastos: number
}

export interface CategoriaGastoCreate {
  nombre: string
  color?: string
}

export interface CategoriaGastoUpdate {
  nombre?: string
  color?: string
  activa?: boolean
}

export type OrigenGasto = 'manual' | 'inventario' | 'nomina'

export interface Gasto {
  id: number
  fecha: string
  categoria: CategoriaGasto
  categoria_nombre: string
  categoria_color: string
  descripcion: string
  monto: number
  pagado_desde_caja: boolean
  caja_sesion_id: number | null
  movimiento_inventario_id: number | null
  trabajador_id: number | null
  creado_en: string
  origen: OrigenGasto
}

export interface GastoCreate {
  fecha?: string | null
  categoria: CategoriaGasto
  descripcion: string
  monto: number
  pagado_desde_caja?: boolean
}

export interface GastoUpdate {
  fecha?: string
  categoria?: CategoriaGasto
  descripcion?: string
  monto?: number
  pagado_desde_caja?: boolean
}

/** Contrato de /trabajadores (BE-033). */
export type TipoPago = 'mensual' | 'quincenal' | 'semanal' | 'diario' | 'por_turno'

export interface Trabajador {
  id: number
  nombre: string
  cargo: string | null
  telefono: string | null
  documento: string | null
  tipo_pago: TipoPago
  monto_pago: number
  activo: boolean
  fecha_ingreso: string | null
  creado_en: string
  total_pagado_mes_actual: number
}

export interface TrabajadorCreate {
  nombre: string
  cargo?: string | null
  telefono?: string | null
  documento?: string | null
  tipo_pago: TipoPago
  monto_pago?: number
  fecha_ingreso?: string | null
}

export interface TrabajadorUpdate {
  nombre?: string
  cargo?: string | null
  telefono?: string | null
  documento?: string | null
  tipo_pago?: TipoPago
  monto_pago?: number
  activo?: boolean
  fecha_ingreso?: string | null
}

export interface PagoCreate {
  monto: number
  fecha?: string | null
  descripcion?: string | null
  pagado_desde_caja?: boolean
}

export interface InvertidoCategoria {
  categoria: string
  etiqueta: string
  total: number
}

export interface ContabilidadDia {
  fecha: string
  ventas: number
  invertido: number
  ganancia_neta: number
}

export interface ContabilidadOut {
  desde: string
  hasta: string
  ventas_total: number
  ventas_efectivo: number
  ventas_transferencia: number
  num_ventas: number
  invertido_total: number
  invertido_por_categoria: InvertidoCategoria[]
  ganancia_neta: number
  margen_productos: number
  margen_incompleto: boolean
  valor_inventario_actual: number
  por_dia: ContabilidadDia[]
}
