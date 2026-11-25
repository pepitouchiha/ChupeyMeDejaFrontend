---
id: FE-044
title: Definir qué insumos consume cada producto
area: frontend
status: done
priority: high
depends_on: [BE-031, FE-043]
created_by: planner
---

## Objetivo

Desde el formulario de producto, indicar qué se descuenta del inventario por
cada unidad vendida (ej. Granizado 16oz → 1 vaso 16oz + 1 tapa 16oz).

## Alcance

**Incluye:**

- Tipos: `ProductoOut.insumos`; cliente `PUT /productos/{id}/insumos`.
- En el modal de crear/editar producto (`ProductosView.vue`), sección
  **"Descuenta del inventario"**: filas `[selector de insumo activo] [cantidad (NumberInput, >0)] [quitar]`
  y botón "Agregar insumo". Sin insumos repetidos (el selector oculta los ya elegidos).
- Al guardar: primero crear/actualizar el producto y luego `PUT /productos/{id}/insumos`
  (en creación, con el id devuelto). Si falla el segundo paso, toast de error claro sin perder lo ya guardado.
- En la tabla de productos, indicador pequeño (ej. ícono + tooltip con la lista) cuando el producto tiene insumos.

**No incluye:** cálculo automático de costo a partir de insumos.

## Criterios de aceptación

- [ ] Se pueden agregar, cambiar y quitar insumos de un producto y persisten al reabrir el modal.
- [ ] No se puede guardar con cantidad ≤ 0 ni insumos repetidos.
- [ ] Un producto sin insumos guarda una lista vacía.
- [ ] `npm run build` sin errores de tipos.

## Notas de implementación

**Archivos**
- `src/api/types.ts`: `ProductoInsumo {insumo_id, nombre, unidad, cantidad}`, `ProductoInsumoIn`, `Producto.insumos`.
- `src/api/productos.ts`: `setProductoInsumos` (`PUT /productos/{id}/insumos`); `src/composables/useProductos.ts`: `setInsumos`.
- `src/views/ProductosView.vue`: sección "Descuenta del inventario" en el modal (fila = selector de insumo activo + `NumberInput` cantidad > 0 + unidad + quitar; botón "+ Agregar insumo"). El selector de cada fila oculta los insumos ya elegidos en otras filas; si la receta incluye un insumo inactivo se conserva en su fila marcado "(inactivo)". Indicador en la tabla: badge con ícono `IconPackage` (nuevo, `src/components/icons/IconPackage.vue`) y conteo, con tooltip con la lista "cantidad × nombre".

**Decisiones**
- Validación en el cliente antes de guardar: insumo requerido por fila, cantidad > 0, sin repetidos.
- Guardado en dos pasos: crea/actualiza el producto y luego `PUT /insumos`, siempre (lista vacía borra la receta). Si el segundo paso falla: toast de error y mensaje en el modal, el modal queda abierto ya en modo edición con el id del producto recién creado (no se pierde lo guardado ni se duplica al reintentar) y se refresca la tabla.

**Cómo probar**
- `npm run build` sin errores. Manual: en `/productos` editar un producto, agregar 2 insumos, guardar y reabrir (persisten); cambiar/quitar y guardar; comprobar que no se puede dejar cantidad 0 ni repetir insumo; producto sin insumos no muestra badge; vender y revisar Movimientos en Inventario.

## Revisión

**Veredicto: done** (revisión estática + `npm run build` OK sin errores de tipos; no probado en navegador).

Contrato verificado contra `schemas/producto.py` y `PUT /productos/{id}/insumos`: `ProductoInsumoIn {insumo_id, cantidad>0}` (body es un array, el cliente envía array), `ProductoInsumoOut {insumo_id, nombre, unidad, cantidad}` y `ProductoOut.insumos` coinciden. El backend rechaza repetidos con 422 y inexistentes con 404; el cliente valida antes.

Criterios:
- Agregar/cambiar/quitar: `ProductosView.vue` `receta`/`cargarReceta` precarga desde `producto.insumos`; el PUT siempre se envía con la lista completa (lista vacía borra la receta). OK.
- Validación cliente de insumo requerido, cantidad > 0 y sin repetidos (`onSubmit`); el selector oculta los ya elegidos (`opcionesParaLinea`); insumos inactivos de la receta se conservan marcados "(inactivo)". OK.
- Fallo del segundo paso: toast + mensaje inline, `editingId` queda con el id del producto creado (reintento no duplica) y se refresca la tabla. Correcto.
- Badge con ícono y tooltip en la tabla.

Observación menor (no bloqueante): `puedeAgregarInsumo` compara insumos activos con `receta.length`, que puede incluir líneas inactivas o vacías; en casos límite el botón "Agregar insumo" se deshabilita antes de tiempo o se mantiene habilitado sin opciones.
