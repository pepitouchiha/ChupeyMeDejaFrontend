---
id: FE-043
title: Nueva pantalla de Inventario (vasos, bebidas, licores, implementos)
area: frontend
status: done
priority: high
depends_on: [BE-030, BE-032]
created_by: planner
---

## Objetivo

Reactivar Inventario con el enfoque nuevo (reemplaza el backlog FE-039): solo
lo que se cuenta por unidad, con stock que se descuenta solo al vender
(BE-031). El trabajo manual se limita a **registrar compras** y **hacer conteos**.

## Alcance

**Incluye:**

- Tipos y cliente API en `src/api/types.ts` / `src/api/insumos.ts` según el
  contrato de BE-030 (`tipo`, `unidad`, `costo_unitario`, `activo`, entradas,
  conteo, ajuste, movimientos). Actualizar `useInsumos`.
- Reactivar ruta `/inventario` (vista `InventarioView.vue`, reescribir lo necesario) y el link en `AppSidebar.vue`.
- Listado agrupado o filtrable por `tipo` (chips: Vasos, Bebidas, Licores,
  Implementos, Otros) con: nombre, stock + unidad, mínimo, estado (badge
  OK/Bajo/Crítico, Crítico también si es negativo), costo unitario.
- Crear/editar insumo en modal (`BaseModal`): nombre, tipo, unidad, stock
  inicial (solo al crear), stock mínimo, costo unitario, activo.
- Acción **"Registrar compra"** por insumo: cantidad, costo total, nota,
  check "Registrar como gasto" (default sí) y "Pagado con efectivo de la
  caja" (default no). Si el backend responde 409 por caja cerrada, mostrar el mensaje en toast.
- Acción **"Conteo"**: ingresar lo contado; mostrar la diferencia antes de confirmar.
- Panel/modal **"Movimientos"** por insumo: fecha/hora local, tipo (Compra,
  Ajuste, Venta #id, Reverso venta #id), cantidad con signo, stock resultante, nota.
- Toasts en éxito/error (`useToast`), confirmación al desactivar/eliminar (`ConfirmModal`), 409 de eliminar → sugerir desactivar.
- Restaurar en el Dashboard la tarjeta "Insumos en alerta" enlazando a `/inventario`.

**No incluye:** asignar insumos a productos (FE-044).

## Criterios de aceptación

- [ ] `/inventario` visible en el sidebar y funcional; filtro por tipo funciona.
- [ ] Registrar compra actualiza stock y costo unitario en pantalla sin recargar.
- [ ] Conteo muestra la diferencia y, al confirmar, el stock queda en lo contado.
- [ ] Movimientos muestran ventas y reversos con el número de venta.
- [ ] Stock negativo se ve como Crítico.
- [ ] `npm run build` sin errores de tipos.

## Notas de implementación

**Archivos**
- `src/api/types.ts`: `Insumo` ahora con `tipo/unidad/costo_unitario/activo` (sin `categoria_id`); nuevos `TipoInsumo`, `EntradaInsumo`, `ConteoInsumo`, `AjusteStock` (+nota), `TipoMovimiento`, `MovimientoInsumo`.
- `src/api/insumos.ts`: `listInsumos` (tipo/solo_alertas/incluir_inactivos), `registrarEntradaInsumo`, `contarInsumo`, `listMovimientosInsumo`, `ajustarStockInsumo` (queda en el cliente; la UI usa conteo).
- `src/composables/useInsumos.ts`: `load({incluirInactivos})`, `registrarEntrada`, `contar`, `update` reemplazan el insumo en la lista (stock/costo se actualizan sin recargar), `loadMovimientos`.
- `src/views/InventarioView.vue`: reescrita. Chips por tipo con contador, toggle "Mostrar inactivos", tabla (stock+unidad, mínimo, badge de estado del backend -que ya marca Crítico con stock <= 0, incluido negativo-, costo unitario), modales de crear/editar, Registrar compra, Conteo y Movimientos.
- `src/router/index.ts`: `/inventario` vuelve a ser ruta real (antes redirigía a dashboard). `src/components/layout/AppSidebar.vue`: item "Inventario".
- `src/views/DashboardView.vue`: tarjeta "Insumos en alerta" (usa `GET /reportes/alertas-stock`) que enlaza a `/inventario`.
- `src/components/common/BaseModal.vue`: prop opcional `wide` (720px) para el modal de movimientos.
- `src/views/OrdenesView.vue`: solo se agregó `insumos: []` al Producto de respaldo para que compile con el nuevo tipo.

**Decisiones**
- Compra: "Registrar como gasto" (default sí) exige costo total; si no hay costo se pide ingresarlo o apagar el check. "Pagado con efectivo de la caja" (default no) se deshabilita si no se registra gasto. Muestra el costo unitario resultante. Un 409 (p. ej. caja cerrada) se muestra en toast con el mensaje del backend y el modal queda abierto (también inline). No hay UI de caja.
- Conteo: muestra "En sistema" y la diferencia (verde/rojo) en vivo antes de confirmar; diferencia 0 no crea movimiento (lo decide el backend).
- Desactivar: se hace desde el modal de edición (toggle Activo); al guardar con activo=false se pide confirmación (`ConfirmModal`). Eliminar con 409 muestra el mensaje del backend en un toast con acción "Desactivar".
- Movimientos: fecha/hora local (`formatFechaHora`), "Compra", "Ajuste", "Venta #id", "Reverso venta #id", cantidad con signo, stock resultante, nota y costo si lo hay.
- Los insumos inactivos se cargan (`incluir_inactivos`) pero se ocultan por defecto; el contador "stock bajo o crítico" solo cuenta activos.

**Cómo probar**
- `npm run build` pasa sin errores de tipos. Manual: `npm run dev` con el backend arriba, ir a `/inventario`: crear insumo con stock inicial, filtrar por chips, registrar compra (stock y costo unitario cambian en la fila), hacer un conteo, abrir Movimientos tras una venta/cancelación, desactivar y eliminar (409 si tiene movimientos), y ver la tarjeta en `/dashboard`.

## Revisión

**Veredicto: done** (revisión estática + `npm run build` OK sin errores de tipos; no probado en navegador).

Contrato verificado contra `backend/app/schemas/insumo.py` y `routers/insumos.py`: `Insumo`, `InsumoCreate/Update`, `EntradaInsumo`, `ConteoInsumo`, `AjusteStock`, `MovimientoInsumo`, `TipoInsumo`, `TipoMovimiento` y `EstadoInsumo` coinciden en nombres, nullables y enums. Query params (`tipo`, `solo_alertas`, `incluir_inactivos`) y endpoints (`/entradas`, `/conteo`, `/ajustar-stock`, `/movimientos`, PATCH) existen.

Criterios:
- `/inventario` en sidebar y router; filtro por chips con contadores (`InventarioView.vue:42-53`). OK.
- Compra: `registrarEntrada` reemplaza el insumo en la lista con la respuesta (stock y costo unitario actualizados sin recargar; el backend recalcula `costo_unitario`). 409 por caja cerrada: toast + mensaje inline, el modal queda abierto (`:304-309`). Validaciones coherentes con el backend (cantidad > 0, costo requerido si hay gasto). OK.
- Conteo: diferencia en vivo (`:321-324`), confirma con `stock_contado`. OK.
- Movimientos: "Venta #id" / "Reverso venta #id" con `venta_id`, fecha local, cantidad con signo, stock resultante, nota y costo. OK.
- Stock negativo: el backend devuelve "Crítico" para `stock <= 0` y la celda se marca en rojo (`:736`). OK.
- Desactivar con `ConfirmModal`, eliminar con 409 -> toast con acción "Desactivar". Tarjeta del Dashboard enlaza a `/inventario` (`alertas-stock` excluye inactivos, coherente).

Observaciones menores (no bloqueantes): el toast de éxito de crear/editar se muestra antes del `refresh()`, sin impacto funcional. `ajustarStockInsumo` queda en el cliente sin uso en UI (documentado).
