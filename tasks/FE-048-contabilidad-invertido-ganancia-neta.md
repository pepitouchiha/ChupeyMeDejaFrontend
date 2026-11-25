---
id: FE-048
title: Contabilidad — ventas, invertido y ganancia neta
area: frontend
status: done
priority: medium
depends_on: [BE-035]
created_by: planner
---

## Objetivo

Que el dueño vea de un vistazo, para un periodo, cuánto vendió, cuánto
invirtió y cuánto ganó realmente.

## Alcance

**Incluye:**

- Tipos y cliente para `GET /reportes/contabilidad`.
- En `ContabilidadView.vue`, sección nueva arriba del contenido actual:
  - Selector de periodo: Hoy, Esta semana, Este mes (default), Mes anterior, Rango personalizado.
  - Tarjetas KPI: **Ventas**, **Invertido**, **Ganancia neta** (verde si ≥ 0,
    rojo si < 0), y secundarias: margen de productos (con aviso si
    `margen_incompleto`) y valor actual del inventario.
  - Desglose de lo invertido por categoría (barras horizontales o lista con %), omitiendo categorías en 0.
  - Gráfico por día: ventas vs invertido, con la ganancia neta.
  - Nota corta explicando que la ganancia neta es ventas − gastos del periodo.
- Lo existente de la vista (mensual/YTD) se mantiene debajo, sin romperse.

## Criterios de aceptación

- [ ] Los números coinciden con la respuesta del backend para cada periodo.
- [ ] Cambiar de periodo recarga los datos con estado de carga y error.
- [ ] Ganancia negativa se muestra en rojo con signo.
- [ ] `npm run build` sin errores de tipos.

## Notas de implementación

- Tipos `ContabilidadOut`, `ContabilidadDia`, `InvertidoCategoria` al final de `src/api/types.ts`; `getContabilidad()` en `src/api/reportes.ts`; `contabilidad/isLoadingContabilidad/errorContabilidad/loadContabilidad` en `useReportes` (ignora respuestas obsoletas si se cambia de periodo rápido).
- `ContabilidadView.vue`: panel nuevo arriba con selector de periodo (Hoy, Esta semana [lunes a hoy], Este mes [default], Mes anterior, Rango personalizado). Las fechas se calculan con `hoyNegocio()`/`sumarDias()` (hora Bogotá). El rango inválido (desde > hasta) no llama al backend y muestra aviso.
- KPIs Ventas / Invertido / Ganancia neta (verde si >= 0, rojo si < 0, con signo "+" en positivos y "-" nativo de formatCOP en negativos), margen de productos con tag "Estimado parcial", valor del inventario, desglose por categoría con barras y % (omite categorías en 0), gráfico por día en CSS puro (barras ventas/invertido y franja verde/roja de ganancia neta; tooltip con los tres valores; scroll horizontal en periodos largos) y nota de ventas − gastos. Sin librerías nuevas.
- Prueba: `npm run dev`, ir a Contabilidad y cambiar el periodo; revisar estados de carga/error (backend apagado).
- `npm run build` falla actualmente solo porque `router/index.ts` (otro agente) importa `GastosView.vue` y `TrabajadoresView.vue`, que aún no existen. `vue-tsc` no reporta errores en mis archivos.

## Revisión

**Veredicto: done.** Revisado por el reviewer.

Verificado:
- `npm run build` ahora pasa (las vistas faltantes ya existen; el aviso de la nota de implementación está obsoleto).
- `ContabilidadOut`, `ContabilidadDia`, `InvertidoCategoria` coinciden con `ReporteContabilidadOut` (comprobado con `GET /reportes/contabilidad?desde=2026-11-01&hasta=2026-11-18`: todas las categorías vienen con total 0 y la vista las omite; `por_dia` es contiguo; ganancia -90000 se pinta en rojo con signo "-" nativo de `formatCOP`).
- Periodos en `ContabilidadView.vue:42-61` con `hoyNegocio()`/`sumarDias()` (hora Bogotá): semana = lunes a hoy (`(dow+6)%7`), mes anterior = primer a último día del mes previo (correcto en cambio de año). Rango inválido no llama al backend y muestra aviso.
- Cambio de periodo recarga con estado de carga y error; `useReportes.ts:22-40` descarta respuestas obsoletas. La sección mensual/YTD existente permanece debajo.
- Nota "ventas − gastos del periodo" presente; tag "Estimado parcial" para `margen_incompleto`.

Observaciones menores (no bloquean):
- `ContabilidadView.vue:84-86`: `formatDiaCorto` local duplica el de `utils/fecha.ts` (que devuelve DD/MM/YYYY); es intencional (DD/MM) pero con el mismo nombre puede confundir. Considera renombrarlo.
- Con el rango inválido, una petición previa en vuelo podría seguir pintando datos antes de que se oculten (`v-else-if="contabilidad && !rangoInvalido"` lo oculta correctamente, así que solo cosmético).
