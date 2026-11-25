---
id: FE-046
title: Pantalla de Gastos
area: frontend
status: done
priority: medium
depends_on: [BE-032, BE-034]
created_by: planner
---

## Objetivo

Registrar y consultar todo lo que se gasta (bolsas de granizado, hielo,
servicios, arriendo, etc.), que alimenta el "invertido" de Contabilidad.

## Alcance

**Incluye:**

- Tipos, cliente `src/api/gastos.ts` y composable `useGastos` según BE-032.
- Ruta `/gastos` + link en el sidebar.
- Filtros: rango de fechas (default mes actual) y categoría. Total del filtro visible arriba.
- Tabla: fecha, categoría (chip), descripción, monto (`formatCOP`), "Desde
  caja" (sí/no), origen (Manual / Inventario / Nómina, con link al trabajador o insumo si aplica).
- Crear/editar en modal: fecha, categoría (sin "Nómina"), descripción, monto,
  "Pagado con efectivo de la caja". 409 por caja cerrada → toast con el mensaje.
- Eliminar con `ConfirmModal`; si el gasto viene de inventario, avisar que el stock no cambia.

## Criterios de aceptación

- [ ] CRUD de gastos manuales con toasts.
- [ ] Filtros por fecha y categoría y total coinciden con el backend.
- [ ] Los gastos de compras y nómina aparecen con su origen.
- [ ] `npm run build` sin errores de tipos.

## Notas de implementación

**Archivos nuevos:** `src/api/gastos.ts`, `src/composables/useGastos.ts`, `src/views/GastosView.vue`, `src/components/GastoFormModal.vue` (modal de crear/editar, reutilizado por FE-047 para editar pagos de nómina), `src/utils/gastos.ts` (categorías, etiquetas y origen). Ruta `/gastos` y link en el sidebar (grupo Negocio).

**Decisiones**
- Filtros: desde (default día 1 del mes), hasta (default hoy), categoría; el total del filtro se calcula sumando los montos devueltos por `GET /gastos` con los mismos filtros.
- Tabla: fecha, chip de categoría (colores por categoría), descripción, monto, "Desde caja" Sí/No, origen. Origen Nómina enlaza a `/trabajadores?id=N` (abre el historial del trabajador); Inventario enlaza a `/inventario` (el gasto solo trae `movimiento_inventario_id`, sin id de insumo, así que no se puede enlazar al insumo concreto).
- Modal: fecha, categoría (sin "Nómina"), descripción, monto, "Pagado con efectivo de la caja". Si el gasto es de nómina al editar, se oculta la categoría y no se envía (el backend la rechaza). Un 409 por caja cerrada se muestra en toast y en el modal, y avisa con un hint si se activa el switch con la caja cerrada.
- Eliminar con `ConfirmModal`; el texto avisa que en gastos de inventario el stock no cambia y en los de nómina que se quita el pago del historial.
- Las categorías están en `utils/gastos.ts` (mismos valores/etiquetas que el backend) en lugar de llamar a `GET /gastos/categorias`, porque también se necesitan sin red en caja y trabajadores; si el backend agrega categorías hay que actualizar ese archivo.

**Cómo probar:** `npm run dev` > Gastos: crear un gasto manual (con y sin caja abierta + "desde caja"), editarlo, filtrar por categoría/fechas y comparar el total; registrar una compra en Inventario con gasto y un pago de nómina y ver su origen; eliminar uno de inventario y leer el aviso.

## Revisión

**Veredicto: done.** Revisado por el reviewer.

Verificado:
- `npm run build` sin errores. Tipos `Gasto`, `GastoCreate`, `GastoUpdate`, `CategoriaGasto` (7 valores) y `OrigenGasto` coinciden con `schemas/gasto.py`; `utils/gastos.ts` replica etiquetas del backend.
- Filtros `desde/hasta/categoria` mapean a los query params reales de `GET /gastos`; el total (`useGastos.ts:12`) suma los montos devueltos con el mismo filtro, por lo que coincide con el backend. Default mes actual en hora Bogotá (`inicioMesNegocio`/`hoyNegocio`).
- Probado: pago de nómina aparece con `origen: nomina` y `trabajador_id` (link a `/trabajadores?id=`); gastos de inventario con link a `/inventario`.
- `GastoFormModal.vue:86-92`: al editar un gasto de nómina no se envía `categoria` (backend responde 422 si se envía: verificado). Nómina excluida del selector (`CATEGORIAS_MANUALES`). 409 por caja cerrada: toast + mensaje en el modal + hint al activar el switch con caja cerrada.
- Eliminar con `ConfirmModal` y aviso de stock para origen inventario.

Observaciones menores (no bloquean):
- `GastosView.vue` en el enlace de inventario no puede apuntar al insumo concreto (el backend solo expone `movimiento_inventario_id`); está documentado en las notas y es aceptable.
- `GastosView.vue:119`: el estado de carga reemplaza la tabla en cada refresco (parpadeo); cosmético.
