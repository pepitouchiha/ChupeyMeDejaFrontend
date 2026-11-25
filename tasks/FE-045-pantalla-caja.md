---
id: FE-045
title: Pantalla de Caja — abrir con base, resumen en vivo y cierre manual
area: frontend
status: done
priority: high
depends_on: [BE-034]
created_by: planner
---

## Objetivo

Que quien atiende abra la caja con la base al empezar la jornada, vea en todo
momento cuánto efectivo debería haber, y la cierre manualmente al cerrar el
local, contando el efectivo y dejando la base para el día siguiente.

## Alcance

**Incluye:**

- Tipos y cliente `src/api/caja.ts` + composable `useCaja` según BE-034. El
  estado de la caja (abierta/cerrada) se comparte en toda la app.
- Ruta `/caja` + link en el sidebar (arriba, junto a Ventas).
- **Caja cerrada:** tarjeta "Abrir caja" con la base precargada en `base_sugerida` (editable) y nota opcional.
- **Caja abierta:** hora de apertura, base, ventas en efectivo, ventas por
  transferencia, número de ventas, gastos pagados desde caja y
  **efectivo esperado** destacado. Se refresca al entrar y con botón "Actualizar".
- **Cerrar caja** (modal): efectivo contado, base que se deja (precargada con
  la base inicial), notas. Mostrar en vivo **diferencia** (sobrante/faltante
  en verde/rojo) y **retiro** (contado − base). Si hay pedidos abiertos, el
  backend responde 409: mostrar el mensaje y un link a Mesas.
- **Historial de cierres:** tabla (fecha, apertura–cierre, esperado, contado,
  diferencia, retiro) y detalle de una sesión con sus ventas y gastos.
- **Bloqueo en ventas:** en `VentasView` y en "Cobrar" del pedido de mesa,
  si la caja está cerrada mostrar un aviso con botón "Abrir caja" en lugar de
  dejar que falle; si igual llega un 409, mostrar el mensaje del backend.
- Indicador en el sidebar o el header: "Caja abierta desde 10:05" / "Caja cerrada".
- El ticket de cierre es opcional (se puede imprimir con el formato de FE-049 si está listo).

## Criterios de aceptación

- [ ] Abrir caja con la base sugerida y verla como abierta en toda la app sin recargar.
- [ ] El efectivo esperado coincide con el de `GET /caja/actual`.
- [ ] Al cerrar, diferencia y retiro se calculan en vivo y coinciden con lo que guarda el backend.
- [ ] Con caja cerrada, Ventas y Cobrar muestran el aviso en vez de intentar la venta.
- [ ] El historial muestra los cierres anteriores con su detalle.
- [ ] `npm run build` sin errores de tipos.

## Notas de implementación

**Archivos nuevos:** `src/api/caja.ts`, `src/composables/useCaja.ts`, `src/views/CajaView.vue`, `src/components/common/CajaCerradaAviso.vue`. Tipos de caja/gasto/trabajador agregados a `src/api/types.ts` (más `caja_sesion_id?` opcional en `Venta`).
**Modificados:** `router/index.ts` (`/caja`), `AppSidebar.vue`, `VentasView.vue`, `PedidoEnCursoModal.vue`, `utils/fecha.ts` (`formatFecha`, `formatDiaCorto`, `inicioMesNegocio`), `utils/imprimir.ts` (`construirCierreCaja`), `composables/useImpresion.ts` (`imprimirCierreCaja`).

**Decisiones**
- `useCaja` guarda el estado de `GET /caja/actual` a nivel de módulo (compartido sin recargar). `abierta` es `null` mientras no se conoce el estado, para no mostrar el aviso de caja cerrada por error; `cerrada` solo es `true` con respuesta explícita `abierta=false`. Tipado del objeto plano con campos `null` cuando está cerrada.
- Caja cerrada: tarjeta "Abrir caja" con la base precargada en `base_sugerida` y nota opcional. Caja abierta: "Efectivo esperado" destacado + base, ventas efectivo/transferencia, n.º de ventas y gastos desde caja; botón "Actualizar" (refresca estado e historial); aviso con link a Mesas si hay `pedidos_abiertos`.
- Modal de cierre: contado, base que se deja (precargada con la base inicial) y notas. Diferencia (verde sobrante / rojo faltante) y retiro se calculan en vivo con las mismas fórmulas del backend (`contado - esperado`, `contado - base`); se valida en cliente que la base no supere lo contado (el backend responde 422). Un 409 (pedidos abiertos) muestra el mensaje del backend con link a Mesas. Tras cerrar, toast con acción "Imprimir cierre".
- Historial: filtro desde/hasta (por defecto últimos 30 días), tabla con fecha, apertura–cierre, esperado, contado, diferencia, retiro (la sesión abierta aparece como "En curso") y modal de detalle (resumen, ventas y gastos de la sesión, botón imprimir).
- Ticket de cierre (opcional) hecho con el sistema de FE-049: `construirCierreCaja` en `utils/imprimir.ts` y `imprimirCierreCaja` en `useImpresion` (cola e iframe existentes). Solo se agregaron funciones; no se tocó la lógica de comanda/factura.
- Bloqueo: `VentasView` y el cobro de `PedidoEnCursoModal` muestran `CajaCerradaAviso` (mensaje + botón "Abrir caja" que lleva a `/caja`) y deshabilitan "Confirmar venta" / "Cobrar / Cerrar mesa". Ambos refrescan el estado al montarse y también tras un error (si llega un 409 se muestra el mensaje del backend y se actualiza el aviso). En el modal, "Reimprimir comanda" e "Imprimir cuenta" no se bloquean (siguen dependiendo solo de que haya items). Agregar items a un pedido no consulta la caja (el backend tampoco).
- Sidebar: indicador "Caja abierta desde HH:MM" / "Caja cerrada" (pill clicable a `/caja`) bajo el logo; se carga al montar el sidebar. Al ser 12 enlaces, se agruparon con etiquetas: Dashboard / Operación (Caja, Ventas, Mesas, Órdenes) / Catálogo (Productos, Inventario, Categorías) / Negocio (Gastos, Trabajadores, Historial, Contabilidad); Configuración sigue abajo. El `nav` tiene scroll por si la pantalla es baja.
- Sin librerías nuevas.

**Cómo probar:** `npm run dev`. Con caja cerrada: ir a Ventas y Mesas > Cobrar (aviso y botones deshabilitados) > "Abrir caja" > abrir con base sugerida; vender en efectivo y por transferencia, volver a Caja y "Actualizar"; cerrar con un contado distinto del esperado y verificar diferencia/retiro e historial; con un pedido abierto intentar cerrar (409 + link a Mesas).

## Revisión

**Veredicto: done.** Revisado por el reviewer.

Verificado:
- `npm run build` (vue-tsc + vite) sin errores.
- Integración contra backend con BD temporal: `GET /caja/actual` (plano, con `null` al estar cerrada), `POST /caja/abrir` (201, devuelve el mismo objeto plano que `/actual`), `POST /caja/cerrar` (200, 422 si base > contado, 422 con `detail` lista para negativos) y `GET /caja/sesiones`. Los tipos `CajaActual`, `CajaSesion`, `CajaSesionDetalle`, `CajaAbrir`, `CajaCerrar` coinciden exactamente con `schemas/caja.py` (nombres, nullables).
- Diferencia (`contado - esperado`) y retiro (`contado - base`) en `CajaView.vue:91-98` son las mismas fórmulas de `routers/caja.py` (comprobado con esperado negativo: -40000, contado 0 -> diferencia 40000, retiro 0).
- Estado compartido a nivel de módulo (`useCaja.ts:14-16`): abrir actualiza `actual` desde la respuesta del POST, cerrar recarga; el sidebar (pill) y los avisos reaccionan sin recargar. `abierta` es `null` hasta conocerse, así que no hay falso aviso.
- Bloqueo: `VentasView.vue:94,141,281` y `PedidoEnCursoModal.vue:177,380,410` deshabilitan confirmar/cobrar y muestran `CajaCerradaAviso`; el backend exige caja abierta solo en `POST /ventas` y `PATCH cerrar` (ventas.py:96,456), igual que el front (abrir pedido y agregar items no se bloquean). Un 409 muestra el mensaje y refresca el estado. Diff de `PedidoEnCursoModal`/`VentasView` confirma que la lógica de FE-049 (comanda pendiente, `facturaAutoOToast`, reimprimir/imprimir cuenta) se conserva.
- 409 al cerrar con pedidos abiertos: mensaje + link a Mesas (`CajaView.vue:153`). 422 evitado en cliente (`cierreBaseExcede`).

Observaciones menores (no bloquean):
- `CajaView.vue:103-110` (`openCierre`): el "esperado" y la diferencia en vivo usan el `actual` en caché; si hubo ventas/gastos desde otro dispositivo desde la última carga, la vista previa puede diferir de lo que guarda el backend (que recalcula). Sugerencia: llamar `cargarActual()` al abrir el modal de cierre.
- `api/client.ts:58`: un 422 de Pydantic trae `detail` como lista y se mostraría como "[object Object]". Previo a esta tarea y mitigado por las validaciones de cliente; conviene arreglarlo aparte.
