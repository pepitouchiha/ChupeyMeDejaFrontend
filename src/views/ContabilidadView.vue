<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useReportes } from '../composables/useReportes'
import { formatCOP } from '../utils/currency'
import { hoyNegocio, sumarDias } from '../utils/fecha'

const {
  contabilidad,
  isLoadingContabilidad,
  errorContabilidad,
  loadContabilidad,
  reporteMensual,
  isLoadingMensual,
  errorMensual,
  loadMensual,
} = useReportes()

const mesesSeleccionados = ref(12)

type Periodo = 'hoy' | 'semana' | 'mes' | 'mes-anterior' | 'rango'

const periodos: { value: Periodo; label: string }[] = [
  { value: 'hoy', label: 'Hoy' },
  { value: 'semana', label: 'Esta semana' },
  { value: 'mes', label: 'Este mes' },
  { value: 'mes-anterior', label: 'Mes anterior' },
  { value: 'rango', label: 'Rango personalizado' },
]

const periodo = ref<Periodo>('mes')
const rangoDesde = ref(sumarDias(hoyNegocio(), -6))
const rangoHasta = ref(hoyNegocio())

const rangoInvalido = computed(
  () =>
    periodo.value === 'rango' &&
    (!rangoDesde.value || !rangoHasta.value || rangoDesde.value > rangoHasta.value),
)

function calcularRango(): { desde: string; hasta: string } {
  const hoy = hoyNegocio()
  const [anio, mes, dia] = hoy.split('-').map(Number)
  switch (periodo.value) {
    case 'hoy':
      return { desde: hoy, hasta: hoy }
    case 'semana': {
      const dow = new Date(Date.UTC(anio, mes - 1, dia)).getUTCDay()
      return { desde: sumarDias(hoy, -((dow + 6) % 7)), hasta: hoy }
    }
    case 'mes':
      return { desde: `${hoy.slice(0, 7)}-01`, hasta: hoy }
    case 'mes-anterior': {
      const ultimo = sumarDias(`${hoy.slice(0, 7)}-01`, -1)
      return { desde: `${ultimo.slice(0, 7)}-01`, hasta: ultimo }
    }
    default:
      return { desde: rangoDesde.value, hasta: rangoHasta.value }
  }
}

function cargarContabilidad() {
  if (rangoInvalido.value) return
  const { desde, hasta } = calcularRango()
  loadContabilidad(desde, hasta)
}

watch([periodo, rangoDesde, rangoHasta], cargarContabilidad)

const gananciaNegativa = computed(() => (contabilidad.value?.ganancia_neta ?? 0) < 0)

function formatCOPConSigno(valor: number): string {
  return valor > 0 ? `+${formatCOP(valor)}` : formatCOP(valor)
}

const categoriasConMonto = computed(() =>
  (contabilidad.value?.invertido_por_categoria ?? []).filter((c) => c.total > 0),
)

function porcentajeCategoria(total: number): number {
  const t = contabilidad.value?.invertido_total ?? 0
  return t > 0 ? (total / t) * 100 : 0
}

const porDia = computed(() => contabilidad.value?.por_dia ?? [])
const maxDia = computed(() => Math.max(1, ...porDia.value.flatMap((d) => [d.ventas, d.invertido])))

function formatDiaCorto(fecha: string): string {
  const [, mes, dia] = fecha.split('-')
  return `${dia}/${mes}`
}

function mostrarEtiquetaDia(index: number): boolean {
  const n = porDia.value.length
  const paso = n <= 14 ? 1 : Math.ceil(n / 12)
  return index % paso === 0
}

function tituloDia(d: { fecha: string; ventas: number; invertido: number; ganancia_neta: number }): string {
  return `${formatDiaCorto(d.fecha)} · Ventas ${formatCOP(d.ventas)} · Invertido ${formatCOP(d.invertido)} · Ganancia neta ${formatCOPConSigno(d.ganancia_neta)}`
}

onMounted(() => {
  cargarContabilidad()
  loadMensual(mesesSeleccionados.value)
})

watch(mesesSeleccionados, (meses) => {
  loadMensual(meses)
})

const mesFormatter = new Intl.DateTimeFormat('es-CO', { month: 'short', year: 'numeric' })
function formatMes(anio: number, mes: number): string {
  return mesFormatter.format(new Date(anio, mes - 1, 1))
}
</script>

<template>
  <section class="view">
    <header class="view-header">
      <h1>Contabilidad</h1>
    </header>

    <div class="panel">
      <header class="panel-header">
        <h2>Resumen del periodo</h2>
        <div class="panel-controls">
          <label for="periodo-select">Periodo</label>
          <select id="periodo-select" v-model="periodo">
            <option v-for="p in periodos" :key="p.value" :value="p.value">{{ p.label }}</option>
          </select>
        </div>
      </header>

      <div v-if="periodo === 'rango'" class="rango">
        <label>
          Desde
          <input v-model="rangoDesde" type="date" :max="rangoHasta || undefined" />
        </label>
        <label>
          Hasta
          <input v-model="rangoHasta" type="date" :min="rangoDesde || undefined" />
        </label>
      </div>
      <p v-if="rangoInvalido" class="error" role="alert">
        Elige un rango válido: la fecha inicial no puede ser posterior a la final.
      </p>

      <p v-if="isLoadingContabilidad" class="status">Cargando contabilidad…</p>
      <p v-else-if="errorContabilidad" class="error" role="alert">{{ errorContabilidad }}</p>

      <template v-else-if="contabilidad && !rangoInvalido">
        <div class="kpis">
          <article class="kpi">
            <span class="kpi-label">Ventas</span>
            <strong class="kpi-value kpi-value--ventas">{{ formatCOP(contabilidad.ventas_total) }}</strong>
            <span class="kpi-sub">
              {{ contabilidad.num_ventas }} ventas · Efectivo {{ formatCOP(contabilidad.ventas_efectivo) }} ·
              Transferencia {{ formatCOP(contabilidad.ventas_transferencia) }}
            </span>
          </article>
          <article class="kpi">
            <span class="kpi-label">Invertido</span>
            <strong class="kpi-value kpi-value--invertido">{{ formatCOP(contabilidad.invertido_total) }}</strong>
            <span class="kpi-sub">Gastos del periodo</span>
          </article>
          <article class="kpi" :class="gananciaNegativa ? 'kpi--neg' : 'kpi--pos'">
            <span class="kpi-label">Ganancia neta</span>
            <strong class="kpi-value" :class="gananciaNegativa ? 'is-neg' : 'is-pos'">
              {{ formatCOPConSigno(contabilidad.ganancia_neta) }}
            </strong>
            <span class="kpi-sub">Ventas − invertido</span>
          </article>
        </div>

        <div class="kpis">
          <article class="kpi">
            <span class="kpi-label">Margen de productos</span>
            <strong class="kpi-value kpi-value--small">{{ formatCOP(contabilidad.margen_productos) }}</strong>
            <span
              v-if="contabilidad.margen_incompleto"
              class="tag tag--parcial kpi-tag"
              title="Estimado parcial: algunos productos vendidos no tienen costo definido, así que el margen real es mayor al mostrado."
            >
              Estimado parcial
            </span>
          </article>
          <article class="kpi">
            <span class="kpi-label">Valor actual del inventario</span>
            <strong class="kpi-value kpi-value--small">{{ formatCOP(contabilidad.valor_inventario_actual) }}</strong>
          </article>
        </div>

        <section class="bloque">
          <h3>Invertido por categoría</h3>
          <p v-if="!categoriasConMonto.length" class="status">Sin gastos en este periodo.</p>
          <ul v-else class="cat-list">
            <li v-for="c in categoriasConMonto" :key="c.categoria" class="cat-row">
              <span class="cat-name">{{ c.etiqueta }}</span>
              <div class="cat-track">
                <div class="cat-fill" :style="{ width: `${porcentajeCategoria(c.total)}%` }"></div>
              </div>
              <span class="cat-amount">
                {{ formatCOP(c.total) }}
                <small>{{ porcentajeCategoria(c.total).toFixed(1) }}%</small>
              </span>
            </li>
          </ul>
        </section>

        <section class="bloque">
          <h3>Ventas vs invertido por día</h3>
          <div class="leyenda">
            <span class="leyenda-item"><i class="dot dot--ventas"></i>Ventas</span>
            <span class="leyenda-item"><i class="dot dot--invertido"></i>Invertido</span>
            <span class="leyenda-item"><i class="dot dot--pos"></i>Ganancia neta ≥ 0</span>
            <span class="leyenda-item"><i class="dot dot--neg"></i>Ganancia neta &lt; 0</span>
          </div>
          <div class="dia-scroll">
            <div class="dia-chart" :style="{ minWidth: `${porDia.length * 22}px` }">
              <div v-for="(d, i) in porDia" :key="d.fecha" class="dia-col" :title="tituloDia(d)">
                <div class="dia-bars">
                  <div class="dia-bar dia-bar--ventas" :style="{ height: `${(d.ventas / maxDia) * 100}%` }"></div>
                  <div class="dia-bar dia-bar--invertido" :style="{ height: `${(d.invertido / maxDia) * 100}%` }"></div>
                </div>
                <span class="dia-neto" :class="d.ganancia_neta < 0 ? 'dia-neto--neg' : 'dia-neto--pos'"></span>
                <span class="dia-label">{{ mostrarEtiquetaDia(i) ? formatDiaCorto(d.fecha) : '' }}</span>
              </div>
            </div>
          </div>
        </section>

        <p class="nota">
          La ganancia neta es ventas − gastos del periodo (todo lo invertido, no solo el costo de los productos vendidos).
        </p>
      </template>
    </div>

    <div class="panel">
      <header class="panel-header">
        <h2>Ventas mensuales</h2>
        <div class="panel-controls">
          <label for="meses-select">Rango</label>
          <select id="meses-select" v-model.number="mesesSeleccionados">
            <option :value="6">Últimos 6 meses</option>
            <option :value="12">Últimos 12 meses</option>
            <option :value="24">Últimos 24 meses</option>
          </select>
        </div>
      </header>

      <p v-if="reporteMensual" class="ytd">
        Total acumulado del año en curso: <strong>{{ formatCOP(reporteMensual.ytd_total) }}</strong>
        · Ganancia estimada: <strong>{{ formatCOP(reporteMensual.ytd_margen) }}</strong>
        <span
          v-if="reporteMensual.ytd_margen_incompleto"
          class="tag tag--parcial"
          title="Estimado parcial: algunos productos vendidos este año no tienen costo definido, así que la ganancia real es mayor a la mostrada."
        >
          Estimado parcial
        </span>
      </p>

      <p v-if="isLoadingMensual" class="status">Cargando reporte mensual…</p>
      <p v-else-if="errorMensual" class="error" role="alert">{{ errorMensual }}</p>

      <table v-else-if="reporteMensual" class="mensual-table">
        <thead>
          <tr>
            <th>Mes</th>
            <th>Total</th>
            <th>Tickets</th>
            <th>Ticket promedio</th>
            <th>Margen</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="fila in reporteMensual.meses" :key="`${fila.anio}-${fila.mes}`">
            <td>{{ formatMes(fila.anio, fila.mes) }}</td>
            <td>{{ formatCOP(fila.total) }}</td>
            <td>{{ fila.num_ventas }}</td>
            <td>{{ formatCOP(fila.ticket_promedio) }}</td>
            <td>
              <span class="margen-cell">
                {{ formatCOP(fila.margen) }}
                <span
                  v-if="fila.margen_incompleto"
                  class="tag tag--parcial"
                  title="Estimado parcial: algunos productos vendidos este mes no tienen costo definido, así que la ganancia real es mayor a la mostrada."
                >
                  Parcial
                </span>
              </span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>
</template>

<style scoped>
.view {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.view-header h1 {
  margin: 0;
  font-size: 22px;
  color: var(--color-text);
}

.panel {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 20px;
  border-radius: var(--radius-lg);
  background: var(--color-surface);
  border: 1px solid var(--color-border-soft);
}

.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 8px;
}

.panel-header h2 {
  margin: 0;
  font-size: 16px;
  color: var(--color-text);
}

.panel-summary {
  font-size: 13px;
  color: var(--color-text-muted);
}

.panel-controls {
  display: flex;
  align-items: center;
  gap: 8px;
}

.panel-controls label {
  font-size: 12.5px;
  color: var(--color-text-muted);
}

.panel-controls select {
  background: var(--color-bg);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  padding: 8px 10px;
  font-size: 13px;
  color: var(--color-text);
}

.rango {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
}

.rango label {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 12.5px;
  color: var(--color-text-muted);
}

.rango input {
  background: var(--color-bg);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  padding: 8px 10px;
  font-size: 13px;
  color: var(--color-text);
}

.kpis {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 12px;
}

.kpi {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 6px;
  padding: 16px;
  border-radius: var(--radius-lg);
  background: var(--color-bg);
  border: 1px solid var(--color-border-soft);
}

.kpi--pos {
  border-color: rgba(178, 255, 5, 0.45);
}

.kpi--neg {
  border-color: rgba(255, 77, 109, 0.5);
}

.kpi-label {
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--color-text-muted);
  font-weight: 600;
}

.kpi-value {
  font-size: 26px;
  color: var(--color-text);
}

.kpi-value--small {
  font-size: 19px;
}

.kpi-value--ventas {
  color: var(--color-cyan);
}

.kpi-value--invertido {
  color: var(--color-orange);
}

.kpi-value.is-pos {
  color: var(--color-lime);
}

.kpi-value.is-neg {
  color: var(--color-danger);
}

.kpi-sub {
  font-size: 12px;
  color: var(--color-text-muted);
}

.bloque {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.bloque h3 {
  margin: 0;
  font-size: 14px;
  color: var(--color-text);
}

.cat-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.cat-row {
  display: grid;
  grid-template-columns: 150px minmax(0, 1fr) 170px;
  align-items: center;
  gap: 12px;
  font-size: 13px;
  color: var(--color-text);
}

.cat-track {
  height: 10px;
  border-radius: 999px;
  background: var(--color-border-soft);
  overflow: hidden;
}

.cat-fill {
  height: 100%;
  border-radius: 999px;
  background: linear-gradient(90deg, var(--color-orange), var(--color-purple-deep));
}

.cat-amount {
  text-align: right;
}

.cat-amount small {
  margin-left: 6px;
  color: var(--color-text-muted);
}

.leyenda {
  display: flex;
  flex-wrap: wrap;
  gap: 14px;
  font-size: 12px;
  color: var(--color-text-muted);
}

.leyenda-item {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.dot {
  width: 10px;
  height: 10px;
  border-radius: 3px;
  display: inline-block;
}

.dot--ventas,
.dia-bar--ventas {
  background: var(--color-cyan);
}

.dot--invertido,
.dia-bar--invertido {
  background: var(--color-orange);
}

.dot--pos,
.dia-neto--pos {
  background: var(--color-lime);
}

.dot--neg,
.dia-neto--neg {
  background: var(--color-danger);
}

.dia-scroll {
  overflow-x: auto;
}

.dia-chart {
  display: flex;
  gap: 4px;
  height: 200px;
}

.dia-col {
  flex: 1 1 0;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
  height: 100%;
}

.dia-bars {
  flex: 1;
  display: flex;
  align-items: flex-end;
  gap: 1px;
}

.dia-bar {
  flex: 1;
  min-height: 2px;
  border-radius: 3px 3px 0 0;
}

.dia-neto {
  height: 4px;
  border-radius: 2px;
}

.dia-label {
  height: 12px;
  font-size: 9.5px;
  color: var(--color-text-muted);
  white-space: nowrap;
}

.nota {
  margin: 0;
  font-size: 12.5px;
  color: var(--color-text-muted);
}

@media (max-width: 640px) {
  .cat-row {
    grid-template-columns: 1fr;
    gap: 4px;
  }

  .cat-amount {
    text-align: left;
  }
}

.status {
  margin: 0;
  color: var(--color-text-muted);
  font-size: 14px;
}

.error {
  margin: 0;
  color: var(--color-danger);
  font-size: 13px;
}

.ytd {
  margin: 0;
  font-size: 14px;
  color: var(--color-text);
}

.ytd strong {
  color: var(--color-lime);
}

.ytd .tag {
  margin-left: 8px;
}

.mensual-table {
  width: 100%;
  border-collapse: collapse;
}

.mensual-table th,
.mensual-table td {
  text-align: left;
  padding: 12px 16px;
  font-size: 13.5px;
  color: var(--color-text);
  border-bottom: 1px solid var(--color-border-soft);
}

.mensual-table th {
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--color-text-muted);
  font-weight: 600;
}

.mensual-table tbody tr:last-child td {
  border-bottom: none;
}

.margen-cell {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.tag {
  font-size: 11.5px;
  font-weight: 600;
  padding: 3px 9px;
  border-radius: 999px;
  white-space: nowrap;
}

.tag--parcial {
  color: var(--color-orange);
  background: rgba(255, 138, 30, 0.14);
  border: 1px solid rgba(255, 138, 30, 0.4);
  cursor: help;
}
</style>
