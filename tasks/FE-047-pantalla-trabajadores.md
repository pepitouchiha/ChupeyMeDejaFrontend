---
id: FE-047
title: Pantalla de Trabajadores y pagos
area: frontend
status: done
priority: medium
depends_on: [BE-033, FE-046]
created_by: planner
---

## Objetivo

Llevar la lista de trabajadores y registrar lo que se les paga (cuenta como gasto de nómina).

## Alcance

**Incluye:**

- Tipos, cliente `src/api/trabajadores.ts` y composable según BE-033.
- Ruta `/trabajadores` + link en el sidebar.
- Listado: nombre, cargo, teléfono, tipo y valor de pago, pagado este mes,
  estado activo; toggle "Mostrar inactivos".
- Crear/editar en modal (nombre, cargo, teléfono, documento, tipo de pago,
  valor, fecha de ingreso, activo). Eliminar con confirmación; 409 → sugerir desactivar.
- **"Registrar pago"**: monto precargado con `monto_pago` (editable), fecha,
  descripción, "Pagado con efectivo de la caja".
- Detalle de un trabajador: historial de pagos (fecha, descripción, monto) con
  filtro de fechas; editar/borrar un pago reutiliza los endpoints de gastos.

## Criterios de aceptación

- [ ] CRUD de trabajadores y desactivación funcionan con toasts.
- [ ] Registrar un pago actualiza "pagado este mes" y aparece en Gastos como Nómina.
- [ ] Historial de pagos por trabajador con filtro de fechas.
- [ ] `npm run build` sin errores de tipos.

## Notas de implementación

**Archivos nuevos:** `src/api/trabajadores.ts`, `src/composables/useTrabajadores.ts`, `src/views/TrabajadoresView.vue`. Ruta `/trabajadores` y link en el sidebar (grupo Negocio). Tipos en `src/api/types.ts`.

**Decisiones**
- Listado: nombre, cargo, teléfono, tipo y valor de pago, pagado este mes (`total_pagado_mes_actual`), estado; toggle "Mostrar inactivos" (se carga con `incluir_inactivos=true` y se filtra en cliente, igual que Inventario). Acciones: Registrar pago (deshabilitado si está inactivo), Pagos, editar, Activar/Desactivar rápido y eliminar.
- Crear/editar en modal (nombre, cargo, teléfono, documento, tipo de pago, valor, fecha de ingreso, activo al editar). Los campos opcionales vacíos se envían como `null` (PATCH los limpia). Eliminar con confirmación; un 409 se muestra en toast con el mensaje del backend y, si el trabajador está activo, con la acción "Desactivar".
- Registrar pago: monto precargado con `monto_pago` (editable), fecha (hoy), descripción opcional (el backend usa "Pago a <nombre>" si va vacía) y "Pagado con efectivo de la caja" (hint y toast si la caja está cerrada o llega un 409). Al registrar se recargan listado y detalle.
- Detalle ("Pagos"): historial con filtro desde/hasta (por defecto sin filtro = todo), total del filtro, y editar/borrar pago reutilizando `GastoFormModal` y `DELETE /gastos/{id}`. También se abre desde `/trabajadores?id=N` (enlace de Gastos).
- Sin librerías nuevas.

**Cómo probar:** `npm run dev` > Trabajadores: crear uno, "Registrar pago" (con y sin caja), ver "Pagado este mes" subir y el pago en Gastos como Nómina; abrir "Pagos", filtrar fechas, editar y borrar un pago; intentar eliminar uno con pagos (409 + Desactivar); desactivarlo y usar "Mostrar inactivos".

## Revisión

**Veredicto: done.** Revisado por el reviewer.

Verificado:
- `npm run build` sin errores. Tipos `Trabajador`, `TrabajadorCreate/Update`, `TipoPago`, `PagoCreate` coinciden con `schemas/trabajador.py`.
- Integración: `POST /trabajadores`, `POST /trabajadores/{id}/pagos` (crea gasto `nomina`, `pagado_desde_caja` asigna `caja_sesion_id`), `GET /gastos` lo lista como Nómina. Tras pagar, la vista recarga listado y detalle (`TrabajadoresView.vue:235-236`), por lo que "pagado este mes" se actualiza.
- Edición de pagos reutiliza `GastoFormModal` con `origen: nomina`: no envía categoría (probado que el backend la rechaza con 422) y PATCH de fecha/descripcion/monto/pagado_desde_caja responde 200.
- Eliminar: 409 -> toast con mensaje del backend y acción "Desactivar" si está activo. Toggle de inactivos, filtro de fechas del historial con total, pago precargado con `monto_pago`, hint con caja cerrada y toast en 409.
- Campos opcionales vacíos se envían como `null` (PATCH los limpia).

Observaciones menores (no bloquean):
- `TrabajadoresView.vue:172-174` y similares: `load()` activa `isLoading` y reemplaza la tabla en cada acción rápida (activar/desactivar), con parpadeo; cosmético.
- El toggle "Mostrar inactivos" solo aparece si hay al menos un inactivo (`v-if="inactivosCount > 0"`); aceptable, pero puede confundir al buscarlo.
