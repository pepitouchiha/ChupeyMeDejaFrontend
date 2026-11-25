---
id: FE-049
title: Imprimir comandas y facturas en térmica de 80mm
area: frontend
status: done
priority: high
depends_on: [BE-036]
created_by: planner
---

## Objetivo

Imprimir la **comanda** (lo que hay que preparar) al tomar un pedido y la
**factura / recibo** al cobrar, en una impresora térmica de 80mm, desde el navegador.

## Alcance

**Incluye:**

- Cliente y tipos de `GET/PUT /configuracion/negocio`.
- Servicio `src/utils/imprimir.ts`: renderiza el ticket en un `iframe` oculto
  y llama `print()`; CSS de impresión con `@page { size: 80mm auto; margin: 0 }`
  (o 58mm según `ancho_papel_mm`), fuente monoespaciada, texto negro, sin colores ni sombras.
- Componentes/plantillas de ticket:
  - **Comanda:** "COMANDA", mesa (o "Para llevar"), pedido #id, fecha/hora
    local, items con cantidad en grande y nombre (incluir sabor/tamaño si el
    producto los tiene). Sin precios. Si son items agregados a un pedido ya
    abierto, solo los nuevos y la marca "ADICIONAL".
  - **Factura:** datos del negocio (nombre, NIT, dirección, teléfono),
    "Factura de venta #id", fecha/hora, mesa, items (cant × nombre, valor),
    total, método de pago, mensaje de pie. Formato COP con `formatCOP`.
- Disparadores:
  - Venta directa (`VentasView`): al confirmar → comanda si `imprimir_comanda_auto`;
    factura si `imprimir_factura_auto`, si no, el toast de confirmación ofrece botón "Imprimir factura".
  - Pedido de mesa: al abrirlo y al agregar items → comanda de lo nuevo (si
    `imprimir_comanda_auto`), y botón "Reimprimir comanda" (pedido completo) en el panel del pedido.
  - Al cobrar el pedido → factura (auto o botón, igual que arriba).
  - En Órdenes: botón "Imprimir factura" por venta.
- Pantalla `/configuracion` (link en el sidebar, abajo): datos del negocio,
  ancho de papel, toggles de impresión automática y botón "Imprimir prueba".
- Documentar en las notas cómo evitar el diálogo de impresión en el equipo de
  caja (Chrome con `--kiosk-printing` y la térmica como impresora predeterminada).

**No incluye:** ESC/POS directo, apertura del cajón monedero, factura electrónica DIAN.

## Criterios de aceptación

- [ ] La comanda y la factura se ven bien en vista previa a 80mm (sin cortes laterales ni páginas en blanco extra).
- [ ] Agregar items a un pedido abierto imprime solo los items nuevos como ADICIONAL.
- [ ] Con impresión automática desactivada, el botón de imprimir sigue disponible.
- [ ] Los datos del negocio editados en Configuración aparecen en la siguiente factura.
- [ ] `npm run build` sin errores de tipos.

## Notas de implementación

**Archivos nuevos:** `src/api/configuracion.ts`, `src/composables/useConfiguracionNegocio.ts` (estado compartido + cache de la config), `src/composables/useImpresion.ts` (comanda/factura/prueba, cola de impresión, auto-impresión), `src/utils/imprimir.ts` (plantillas HTML de ticket + iframe oculto + `print()`), `src/views/ConfiguracionView.vue`, `src/components/icons/IconPrinter.vue`.
**Editados:** `api/types.ts` (`mesa_nombre`, `nombre_producto`, `ConfiguracionNegocio`), `useToast.ts` + `ToastContainer.vue` (toast con botón de acción, dura 10 s), `VentasView.vue`, `PedidoEnCursoModal.vue`, `OrdenesView.vue`, `router/index.ts` (`/configuracion`), `AppSidebar.vue` (link abajo, sobre el usuario).

Decisiones:
- Tickets: HTML en strings con `@page { size: {58|80}mm auto; margin: 0 }`, Courier New, todo negro sobre blanco, sin colores/sombras; el texto se escapa. Las plantillas son funciones puras, no componentes Vue.
- Sabor/tamaño de la comanda: `VentaOut` no los trae, así que se obtienen de `GET /productos` (cacheado en memoria) y se muestran bajo el nombre. Si esa llamada falla, la comanda se imprime sin ese detalle.
- Venta directa: al confirmar, comanda si `imprimir_comanda_auto`; factura si `imprimir_factura_auto`, si no el toast trae el botón "Imprimir factura". Comanda y factura pasan por una cola para imprimirse en orden.
- Pedido de mesa (comanda acumulada): nuevo composable `useComandaPendiente(ventaId)` guarda en memoria, por `venta_id`, lo agregado desde la última comanda enviada (por producto; "+" suma, "−" y quitar descuentan del pendiente sin bajar de 0). `PedidoEnCursoModal` muestra "N productos sin enviar a preparación" y el botón principal "Enviar comanda", que imprime SOLO lo pendiente (con marca ADICIONAL si ya se envió una comanda de ese pedido) y lo limpia. Agregar productos ya no imprime nada por clic. "Reimprimir comanda" (pedido completo) e "Imprimir cuenta" se mantienen.
- Al cerrar el panel con pendiente: si `imprimir_comanda_auto` está activo se envía la comanda automáticamente; si no, solo sale un toast de aviso (opción más simple, sin modal de pregunta). Se puede reabrir el pedido y enviar con el botón.
- Al cobrar con pendiente: primero la comanda pendiente (solo si auto) y luego la factura (la cola de impresión garantiza el orden). Al cobrar o descartar se borra el pendiente.
- Limitación: el pendiente vive solo en memoria; se pierde al recargar la página (y la marca ADICIONAL de ese pedido también). No hay respaldo en backend.
- Cobro: usa la venta devuelta por `cerrarPedido` para la factura (auto o botón en el toast). Órdenes: botón de impresora por fila y "Imprimir factura" en el detalle (solo ventas activas).
- Configuración: el PUT envía siempre el objeto completo; "Imprimir prueba" usa los valores del formulario (aunque no estén guardados).
- La comanda usa la hora actual (momento de impresión); la factura usa `creado_en` de la venta.

Cómo probar: `npm run dev`, entrar a `/configuracion`, editar datos y guardar, "Imprimir prueba" (vista previa en el diálogo del navegador, elegir ancho 80 mm / márgenes ninguno). Luego `/ventas` (confirmar venta), `/mesas` (abrir pedido, agregar productos, "Reimprimir comanda", cobrar) y `/ordenes` (icono de impresora). `npm run build` pasa sin errores de tipos. No lo probé contra una impresora real ni en el navegador (solo build).

Evitar el diálogo de impresión en caja: abrir Chrome con `--kiosk-printing` (p. ej. acceso directo `chrome.exe --kiosk-printing --app=http://localhost:5173`, cerrando antes todas las ventanas de Chrome) y dejar la térmica como impresora predeterminada de Windows (con el tamaño de papel 80 mm configurado en sus preferencias). Así `print()` imprime directo sin vista previa.

**Correcciones tras revisión (changes-requested):**
1. `enviarComandaPendiente` imprime con un snapshot y solo si `imprimirComanda` devuelve `true` llama a `marcarEnviada(items)`, que descuenta lo impreso (lo agregado durante la impresión se conserva) y fija `comandaEnviada`. Si falla, el pendiente queda intacto. Guardia `isEnviandoComanda` contra doble envío (también en cierre de panel).
2. `useComandaPendiente`: las lecturas usan `pedidos.get(...)` sin crear entradas; solo `registrarCambio` crea estado; `marcarEnviada` es no-op si ya se limpió.
3. `invalidarDetallesProductos` eliminado; el cache de sabor/tamaño ahora expira a los 30 s (y si el refresco falla se usa el último cache).
4. Hint de "Imprimir comanda automáticamente" actualizado (venta directa al confirmar; pedido de mesa al enviar comanda o cerrar panel con pendiente).
5. `cargarConfiguracionNegocio` comparte la promesa en vuelo, así comanda y factura de la primera venta se encolan en orden.
6. El respaldo del iframe se cancela en `limpiar` y pasó de 2 a 10 minutos.
7. Si falla `GET /configuracion/negocio`, `comandaAuto`/`facturaAutoOToast`/`comandaAutoActiva` muestran un toast de error (no se imprime automático; la factura sigue ofreciendo su botón).
Preventivo: el iframe ya no usa `visibility:hidden`; está fuera de pantalla (`position:fixed; left:-10000px; width:320px; height:600px`).

## Revisión

**Veredicto: changes-requested** (revisión estática + `npm run build` OK, sin errores de tipos; no probado en navegador/impresora).

Verificado y correcto:
- Contrato con BE-036 (campos, límites `maxlength` 100/30/200/30/200, `ancho_papel_mm` 58|80) coincide con `ConfiguracionNegocioUpdate`.
- Escape HTML: todo texto de usuario (negocio, NIT, dirección, teléfono, pie, mesa, nombre producto, sabor/tamaño, título) pasa por `esc()` en `utils/imprimir.ts`; sin `v-html`. Comillas simples no se escapan pero solo se interpolan en contenido de elemento, no en atributos: OK.
- CSS: `@page { size: Nmm auto; margin: 0 }`, body de ancho fijo con `box-sizing`, `overflow-wrap:anywhere`, `break-inside: avoid`, sin colores. Sin alturas fijas que generen página en blanco.
- Iframe: se elimina en `afterprint` con respaldo; cola `encolar` serializa y no se rompe tras un error; errores de impresión/config muestran toast.
- Deltas de pendiente (+, −, quitar con clamp a 0), limpieza al cobrar/descartar, ADICIONAL solo tras una comanda enviada, cierre de panel (auto → envía, no auto → toast): lógica correcta. Ventas/Órdenes/Mesas no se rompen (solo se añaden llamadas).

Hallazgos a corregir:
1. **Se pierde el pendiente si falla la impresión.** `PedidoEnCursoModal.vue:138-144`: `marcarEnviada()` limpia el pendiente y fija `comandaEnviada=true` ANTES de imprimir y se ignora el `boolean` que devuelve `imprimirComanda`. Si la impresora falla (toast de error) la comanda no sale, el panel dice "Todo enviado a preparación" y el siguiente envío saldrá como ADICIONAL sin que el original exista. Solución: llamar a `marcarEnviada()` solo si `imprimirComanda(...)` devuelve `true` (o restaurar los items si es `false`). Cuidado con el doble envío por doble clic (ya protegido por `isEnviandoComanda`; en `onCerrarPanel` hay que evitar reenviar mientras `await`).
2. **Mutación dentro de un `computed`.** `useComandaPendiente.ts:12-19,22-24`: `estadoDe()` hace `pedidos.set(...)` al leer desde `computed`; tras `limpiar()` (`:44`) cualquier re-evaluación recrea una entrada vacía (fuga menor y efecto lateral en computed, mala práctica en Vue). Solución: que las lecturas usen `pedidos.get(ventaId)?? ` sin crear, y crear solo en `registrarCambio`/`marcarEnviada`.
3. **Código muerto:** `invalidarDetallesProductos` (`useImpresion.ts:27-30`) no se usa en ningún lado, así que el cache de sabor/tamaño no se refresca tras editar productos hasta recargar la página. Llamarla desde la edición de productos (ProductosView) o eliminarla y documentar la limitación.
4. **Texto desactualizado.** `ConfiguracionView.vue:164`: "Al confirmar una venta o agregar productos a un pedido" ya no es cierto; ahora es al enviar la comanda / cerrar el panel. Ajustar el hint.
5. **Menor, orden venta directa.** `VentasView.vue:114-115`: `comandaAuto` y `facturaAutoOToast` piden la configuración en paralelo cuando aún no está en cache (`useConfiguracionNegocio.ts:21-26` no deduplica la petición en curso), por lo que el orden de encolado comanda→factura no está garantizado en la primera venta tras cargar la app. Cachear la promesa en vuelo o hacer `await comandaAuto(venta)` antes de la factura.
6. **Menor, `imprimir.ts:175`:** el `setTimeout(limpiar, 120_000)` puede quitar el iframe con el diálogo de vista previa aún abierto (>2 min) y no se cancela cuando `afterprint` ya limpió. Cancelarlo en `limpiar` y/o ampliar el plazo.
7. **Menor, fallo de config:** si `GET /configuracion/negocio` falla, `comandaAuto` (`useImpresion.ts:72-80`) no imprime y no avisa (silencioso) en venta directa; sugerible mostrar toast de error o usar `CONFIGURACION_POR_DEFECTO` con aviso.

Pendiente de verificación manual (no comprobable estáticamente): que Chrome respete `size: 80mm auto` con la térmica sin página en blanco al final y que un iframe con `visibility:hidden` imprima contenido (si sale en blanco, usar `opacity:0`/posición fuera de pantalla en vez de `visibility:hidden`).

### Re-revisión

**Veredicto: done** (revisión estática + `npm run build` OK sin errores de tipos; no probado en navegador/impresora real).

Los 7 hallazgos anteriores quedaron corregidos:
1. `PedidoEnCursoModal.vue:138-150`: snapshot de items, `marcarEnviada(items)` solo si `imprimirComanda` devuelve `true`; guardia `isEnviandoComanda`. En `confirmarCobro` el snapshot se toma de forma síncrona antes de `pendiente.limpiar()`, así que no se pierde la comanda. OK.
2. `useComandaPendiente.ts`: lecturas con `pedidos.get(...)` sin crear entradas; solo `registrarCambio` crea; `marcarEnviada` es no-op si ya se limpió. OK.
3. `invalidarDetallesProductos` eliminado; cache de sabor/tamaño con TTL de 30 s y fallback al último cache (`useImpresion.ts:12-28`). OK.
4. Hint de `ConfiguracionView.vue:164` actualizado. OK.
5. `cargarConfiguracionNegocio` comparte la promesa en vuelo (`useConfiguracionNegocio.ts:23-36`); el orden comanda->factura en `VentasView.vue:114-115` queda garantizado (misma profundidad de awaits + cola `encolar`). OK.
6. `respaldo` se cancela en `limpiar` y es de 10 min (`imprimir.ts:~155-175`). OK.
7. Fallo de config: `configuracionOAviso` muestra toast de error; la factura sigue ofreciendo su botón. OK.
Preventivo: el iframe ya no usa `visibility:hidden` (posición fuera de pantalla). OK.

Observación menor (no bloqueante): si `GET /configuracion/negocio` falla en venta directa, `comandaAuto` y `facturaAutoOToast` llaman cada una a `configuracionOAviso`, por lo que salen dos toasts de error. Se puede compartir el resultado en `VentasView.vue:114-115`.
