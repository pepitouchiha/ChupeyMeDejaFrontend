<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { ApiError } from '../api/client'
import { useCaja } from '../composables/useCaja'
import { useImpresion } from '../composables/useImpresion'
import { useToast } from '../composables/useToast'
import BaseModal from '../components/common/BaseModal.vue'
import NumberInput from '../components/common/NumberInput.vue'
import { formatCOP } from '../utils/currency'
import {
  formatDiaCorto,
  formatFecha,
  formatFechaHora,
  formatHora,
  hoyNegocio,
  sumarDias,
} from '../utils/fecha'
import type { CajaSesion, CajaSesionDetalle } from '../api/types'

const {
  actual,
  abierta,
  isLoadingActual,
  actualError,
  cargarActual,
  abrir,
  cerrar,
  loadSesiones,
  loadSesion,
  messageFor,
} = useCaja()
const { imprimirCierreCaja } = useImpresion()
const { push: pushToast } = useToast()

/* ---------- Estado actual ---------- */
const hasLoadedOnce = ref(false)

async function refrescar(): Promise<void> {
  await cargarActual()
  hasLoadedOnce.value = true
}

/* ---------- Abrir ---------- */
const aperturaBase = ref<number | ''>('')
const aperturaNotas = ref('')
const aperturaError = ref('')
const isAbriendo = ref(false)

function precargarApertura() {
  aperturaBase.value = actual.value?.base_sugerida ?? 0
  aperturaNotas.value = ''
  aperturaError.value = ''
}

async function onAbrir() {
  if (aperturaBase.value === '' || Number(aperturaBase.value) < 0) {
    aperturaError.value = 'Indica la base con la que abres la caja (0 o más).'
    return
  }
  isAbriendo.value = true
  aperturaError.value = ''
  try {
    await abrir({
      base_inicial: Math.round(Number(aperturaBase.value)),
      notas: aperturaNotas.value.trim() || null,
    })
    pushToast('Caja abierta')
    await cargarHistorial()
  } catch (err) {
    aperturaError.value = messageFor(err, 'No fue posible abrir la caja.')
    if (err instanceof ApiError && err.status === 409) await refrescar()
  } finally {
    isAbriendo.value = false
  }
}

/* ---------- Cerrar ---------- */
const isCierreOpen = ref(false)
const cierre = reactive({
  contado: '' as number | '',
  base_siguiente: '' as number | '',
  notas: '',
})
const cierreError = ref('')
const cierreEsConflicto = ref(false)
const isCerrando = ref(false)

const esperado = computed(() => actual.value?.efectivo_esperado ?? 0)
const cierreDiferencia = computed<number | null>(() =>
  cierre.contado === '' ? null : Math.round(Number(cierre.contado)) - esperado.value,
)
const cierreRetiro = computed<number | null>(() =>
  cierre.contado === '' || cierre.base_siguiente === ''
    ? null
    : Math.round(Number(cierre.contado)) - Math.round(Number(cierre.base_siguiente)),
)
const cierreBaseExcede = computed(
  () => cierreRetiro.value !== null && cierreRetiro.value < 0,
)

function openCierre() {
  if ((actual.value?.pedidos_abiertos ?? 0) > 0) return
  cierre.contado = ''
  cierre.base_siguiente = actual.value?.base_inicial ?? 0
  cierre.notas = ''
  cierreError.value = ''
  cierreEsConflicto.value = false
  isCierreOpen.value = true
  // Otro dispositivo pudo vender o gastar desde la última carga: el
  // esperado del modal debe ser el mismo que el backend usará al cerrar.
  void cargarActual()
}

function closeCierre() {
  if (isCerrando.value) return
  isCierreOpen.value = false
}

async function onSubmitCierre() {
  if (cierre.contado === '' || Number(cierre.contado) < 0) {
    cierreError.value = 'Indica el efectivo contado (0 o más).'
    cierreEsConflicto.value = false
    return
  }
  if (cierre.base_siguiente === '' || Number(cierre.base_siguiente) < 0) {
    cierreError.value = 'Indica la base que se deja para la próxima apertura (0 o más).'
    cierreEsConflicto.value = false
    return
  }
  if (cierreBaseExcede.value) {
    cierreError.value = 'La base que dejas no puede superar el efectivo contado.'
    cierreEsConflicto.value = false
    return
  }
  isCerrando.value = true
  cierreError.value = ''
  cierreEsConflicto.value = false
  try {
    const sesion = await cerrar({
      efectivo_contado: Math.round(Number(cierre.contado)),
      base_siguiente: Math.round(Number(cierre.base_siguiente)),
      notas: cierre.notas.trim() || null,
    })
    isCierreOpen.value = false
    pushToast('Caja cerrada', 'success', {
      label: 'Imprimir cierre',
      handler: () => {
        void imprimirCierreCaja(sesion)
      },
    })
    precargarApertura()
    await cargarHistorial()
  } catch (err) {
    cierreError.value = messageFor(err, 'No fue posible cerrar la caja.')
    cierreEsConflicto.value = err instanceof ApiError && err.status === 409
  } finally {
    isCerrando.value = false
  }
}

/* ---------- Historial ---------- */
const hoy = hoyNegocio()
const filtroDesde = ref(sumarDias(hoy, -30))
const filtroHasta = ref(hoy)
const sesiones = ref<CajaSesion[]>([])
const isLoadingHistorial = ref(false)
const historialError = ref('')

async function cargarHistorial(): Promise<void> {
  isLoadingHistorial.value = true
  historialError.value = ''
  try {
    sesiones.value = await loadSesiones({
      desde: filtroDesde.value || undefined,
      hasta: filtroHasta.value || undefined,
    })
  } catch (err) {
    historialError.value = messageFor(err, 'No fue posible cargar el historial de cierres.')
  } finally {
    isLoadingHistorial.value = false
  }
}

function diffClass(valor: number | null): string {
  if (valor === null || valor === 0) return ''
  return valor > 0 ? 'diff--pos' : 'diff--neg'
}

function fmtDiff(valor: number | null): string {
  if (valor === null) return '—'
  if (valor === 0) return formatCOP(0)
  return `${valor > 0 ? '+' : '−'}${formatCOP(Math.abs(valor))}`
}

function diffLabel(valor: number | null): string {
  if (valor === null || valor === 0) return 'Sin diferencia'
  return valor > 0 ? 'Sobrante' : 'Faltante'
}

/* ---------- Detalle de una sesión ---------- */
const detalle = ref<CajaSesionDetalle | null>(null)
const detalleLoadingId = ref<number | null>(null)
const detalleOpen = ref(false)
const detalleError = ref('')

async function openDetalle(sesion: CajaSesion) {
  detalle.value = null
  detalleError.value = ''
  detalleOpen.value = true
  detalleLoadingId.value = sesion.id
  try {
    const respuesta = await loadSesion(sesion.id)
    if (detalleLoadingId.value === sesion.id) detalle.value = respuesta
  } catch (err) {
    if (detalleLoadingId.value === sesion.id) {
      detalleError.value = messageFor(err, 'No fue posible cargar el detalle de la sesión.')
    }
  } finally {
    if (detalleLoadingId.value === sesion.id) detalleLoadingId.value = null
  }
}

function closeDetalle() {
  detalleOpen.value = false
  detalle.value = null
  detalleLoadingId.value = null
}

function metodoLabel(m: string | null): string {
  if (m === 'efectivo') return 'Efectivo'
  if (m === 'transferencia') return 'Transferencia'
  return '—'
}

onMounted(async () => {
  await Promise.all([refrescar(), cargarHistorial()])
  if (abierta.value === false) precargarApertura()
})

async function onActualizar() {
  await Promise.all([refrescar(), cargarHistorial()])
  if (abierta.value === false && aperturaBase.value === '') precargarApertura()
}
</script>

<template>
  <section class="view">
    <header class="view-header">
      <div class="title-block">
        <h1>Caja</h1>
        <span v-if="abierta === true && actual?.abierta_en" class="estado estado--abierta">
          Abierta desde {{ formatHora(actual.abierta_en) }}
        </span>
        <span v-else-if="abierta === false" class="estado estado--cerrada">Cerrada</span>
      </div>
      <button type="button" class="btn-secondary" :disabled="isLoadingActual" @click="onActualizar">
        {{ isLoadingActual ? 'Actualizando…' : 'Actualizar' }}
      </button>
    </header>

    <p v-if="!hasLoadedOnce && isLoadingActual" class="status">Consultando la caja…</p>
    <div v-else-if="actualError && !actual" class="error-block">
      <p class="error" role="alert">{{ actualError }}</p>
      <button type="button" class="btn-secondary" @click="refrescar">Reintentar</button>
    </div>

    <template v-else-if="actual">
      <p v-if="actualError" class="error" role="alert">{{ actualError }}</p>

      <!-- Caja cerrada: abrir -->
      <form v-if="!actual.abierta" class="card abrir-card" @submit.prevent="onAbrir">
        <h2>Abrir caja</h2>
        <p class="hint">
          Cuenta el efectivo con el que empiezas. La base sugerida es la que quedó en el último
          cierre ({{ formatCOP(actual.base_sugerida) }}).
        </p>

        <div class="form-row">
          <label for="apertura-base">Base inicial (COP)</label>
          <NumberInput
            id="apertura-base"
            v-model="aperturaBase"
            :min="0"
            :step="1000"
            placeholder="Ej. 100000"
            :disabled="isAbriendo"
          />
        </div>

        <div class="form-row">
          <label for="apertura-notas">Nota (opcional)</label>
          <input
            id="apertura-notas"
            v-model="aperturaNotas"
            type="text"
            maxlength="255"
            placeholder="Ej. Turno de la mañana"
            :disabled="isAbriendo"
          />
        </div>

        <p v-if="aperturaError" class="error" role="alert">{{ aperturaError }}</p>

        <div class="form-actions">
          <button type="submit" class="btn-primary" :disabled="isAbriendo">
            {{ isAbriendo ? 'Abriendo…' : 'Abrir caja' }}
          </button>
        </div>
      </form>

      <!-- Caja abierta: resumen -->
      <template v-else>
        <div class="resumen">
          <div class="esperado-card">
            <span class="esperado-label">Efectivo esperado en caja</span>
            <span class="esperado-valor">{{ formatCOP(actual.efectivo_esperado ?? 0) }}</span>
            <span class="esperado-formula">
              base + ventas en efectivo − gastos pagados desde caja
            </span>
          </div>

          <dl class="stats">
            <div class="stat">
              <dt>Base inicial</dt>
              <dd>{{ formatCOP(actual.base_inicial ?? 0) }}</dd>
            </div>
            <div class="stat">
              <dt>Ventas en efectivo</dt>
              <dd class="stat--lime">{{ formatCOP(actual.ventas_efectivo ?? 0) }}</dd>
            </div>
            <div class="stat">
              <dt>Ventas por transferencia</dt>
              <dd class="stat--orange">{{ formatCOP(actual.ventas_transferencia ?? 0) }}</dd>
            </div>
            <div class="stat">
              <dt>N.º de ventas</dt>
              <dd>{{ actual.num_ventas ?? 0 }}</dd>
            </div>
            <div class="stat">
              <dt>Gastos desde caja</dt>
              <dd class="stat--danger">{{ formatCOP(actual.gastos_desde_caja ?? 0) }}</dd>
            </div>
          </dl>
        </div>

        <p v-if="actual.notas_apertura" class="hint">Nota de apertura: {{ actual.notas_apertura }}</p>

        <div v-if="(actual.pedidos_abiertos ?? 0) > 0" class="pendientes" role="alert">
          Hay {{ actual.pedidos_abiertos }} pedido{{ actual.pedidos_abiertos === 1 ? '' : 's' }}
          abierto{{ actual.pedidos_abiertos === 1 ? '' : 's' }}: cóbralos o descártalos antes de cerrar
          la caja.
          <RouterLink to="/mesas" class="link">Ir a Mesas</RouterLink>
        </div>

        <div class="cerrar-row">
          <button
            type="button"
            class="btn-primary"
            :disabled="(actual.pedidos_abiertos ?? 0) > 0"
            :title="(actual.pedidos_abiertos ?? 0) > 0 ? 'Cobra o descarta los pedidos abiertos para poder cerrar la caja' : undefined"
            @click="openCierre"
          >
            Cerrar caja
          </button>
        </div>
      </template>
    </template>

    <!-- Historial -->
    <section class="historial">
      <header class="historial-header">
        <h2>Historial de cierres</h2>
        <div class="filtros">
          <div class="form-row form-row--inline">
            <label for="hist-desde">Desde</label>
            <input id="hist-desde" v-model="filtroDesde" type="date" :max="filtroHasta || undefined" />
          </div>
          <div class="form-row form-row--inline">
            <label for="hist-hasta">Hasta</label>
            <input id="hist-hasta" v-model="filtroHasta" type="date" :min="filtroDesde || undefined" />
          </div>
          <button type="button" class="btn-secondary" :disabled="isLoadingHistorial" @click="cargarHistorial">
            Filtrar
          </button>
        </div>
      </header>

      <p v-if="isLoadingHistorial" class="status">Cargando historial…</p>
      <p v-else-if="historialError" class="error" role="alert">{{ historialError }}</p>
      <p v-else-if="sesiones.length === 0" class="status">No hay sesiones de caja en este rango.</p>

      <div v-else class="table-wrap">
        <table class="tabla">
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Apertura – cierre</th>
              <th class="num">Esperado</th>
              <th class="num">Contado</th>
              <th class="num">Diferencia</th>
              <th class="num">Retiro</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="s in sesiones" :key="s.id">
              <td class="nowrap">{{ formatFecha(s.abierta_en) }}</td>
              <td class="nowrap">
                {{ formatHora(s.abierta_en) }} –
                <template v-if="s.cerrada_en">{{ formatHora(s.cerrada_en) }}</template>
                <span v-else class="tag tag--abierta">En curso</span>
              </td>
              <td class="num">{{ formatCOP(s.efectivo_esperado) }}</td>
              <td class="num">{{ s.efectivo_contado === null ? '—' : formatCOP(s.efectivo_contado) }}</td>
              <td class="num" :class="diffClass(s.diferencia)">{{ fmtDiff(s.diferencia) }}</td>
              <td class="num">{{ s.retiro === null ? '—' : formatCOP(s.retiro) }}</td>
              <td class="actions-cell">
                <button type="button" class="btn-link" @click="openDetalle(s)">Ver detalle</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <!-- Modal de cierre -->
    <BaseModal v-if="isCierreOpen" @close="closeCierre">
      <form class="modal-form" @submit.prevent="onSubmitCierre">
        <h2>Cerrar caja</h2>
        <p class="modal-sub">Cuenta el efectivo físico que hay en la caja.</p>

        <dl class="mini-resumen">
          <div>
            <dt>Efectivo esperado</dt>
            <dd>{{ formatCOP(esperado) }}</dd>
          </div>
          <div>
            <dt>{{ cierreDiferencia === null ? 'Diferencia' : diffLabel(cierreDiferencia) }}</dt>
            <dd :class="diffClass(cierreDiferencia)">
              {{ cierreDiferencia === null ? '—' : fmtDiff(cierreDiferencia) }}
            </dd>
          </div>
        </dl>

        <div class="form-row">
          <label for="cierre-contado">Efectivo contado (COP)</label>
          <NumberInput
            id="cierre-contado"
            v-model="cierre.contado"
            :min="0"
            :step="1000"
            placeholder="Lo que hay físicamente"
            :disabled="isCerrando"
          />
        </div>

        <div class="form-row">
          <label for="cierre-base">Base que se deja para mañana (COP)</label>
          <NumberInput
            id="cierre-base"
            v-model="cierre.base_siguiente"
            :min="0"
            :step="1000"
            :disabled="isCerrando"
          />
        </div>

        <div class="retiro" :class="{ 'retiro--error': cierreBaseExcede }">
          <span>Retiro (contado − base)</span>
          <strong>{{ cierreRetiro === null ? '—' : formatCOP(cierreRetiro) }}</strong>
        </div>

        <div class="form-row">
          <label for="cierre-notas">Notas (opcional)</label>
          <input
            id="cierre-notas"
            v-model="cierre.notas"
            type="text"
            maxlength="255"
            placeholder="Ej. Faltante por cambio mal dado"
            :disabled="isCerrando"
          />
        </div>

        <div v-if="cierreError" class="error" role="alert">
          {{ cierreError }}
          <RouterLink v-if="cierreEsConflicto" to="/mesas" class="link">Ir a Mesas</RouterLink>
        </div>

        <div class="form-actions">
          <button type="button" class="btn-secondary" :disabled="isCerrando" @click="closeCierre">
            Cancelar
          </button>
          <button type="submit" class="btn-primary" :disabled="isCerrando || cierre.contado === ''">
            {{ isCerrando ? 'Cerrando…' : 'Cerrar caja' }}
          </button>
        </div>
      </form>
    </BaseModal>

    <!-- Modal de detalle -->
    <BaseModal v-if="detalleOpen" wide @close="closeDetalle">
      <div class="modal-form">
        <h2>Detalle de caja</h2>
        <p v-if="detalleLoadingId !== null" class="status">Cargando detalle…</p>
        <p v-else-if="detalleError" class="error" role="alert">{{ detalleError }}</p>

        <template v-else-if="detalle">
          <p class="modal-sub">
            {{ formatFechaHora(detalle.abierta_en) }} –
            {{ detalle.cerrada_en ? formatFechaHora(detalle.cerrada_en) : 'en curso' }}
          </p>

          <dl class="detalle-grid">
            <div><dt>Base inicial</dt><dd>{{ formatCOP(detalle.base_inicial) }}</dd></div>
            <div><dt>Ventas efectivo</dt><dd>{{ formatCOP(detalle.ventas_efectivo) }}</dd></div>
            <div><dt>Ventas transferencia</dt><dd>{{ formatCOP(detalle.ventas_transferencia) }}</dd></div>
            <div><dt>Gastos desde caja</dt><dd>{{ formatCOP(detalle.gastos_desde_caja) }}</dd></div>
            <div><dt>Esperado</dt><dd>{{ formatCOP(detalle.efectivo_esperado) }}</dd></div>
            <div>
              <dt>Contado</dt>
              <dd>{{ detalle.efectivo_contado === null ? '—' : formatCOP(detalle.efectivo_contado) }}</dd>
            </div>
            <div>
              <dt>{{ diffLabel(detalle.diferencia) }}</dt>
              <dd :class="diffClass(detalle.diferencia)">{{ fmtDiff(detalle.diferencia) }}</dd>
            </div>
            <div>
              <dt>Base siguiente</dt>
              <dd>{{ detalle.base_siguiente === null ? '—' : formatCOP(detalle.base_siguiente) }}</dd>
            </div>
            <div>
              <dt>Retiro</dt>
              <dd>{{ detalle.retiro === null ? '—' : formatCOP(detalle.retiro) }}</dd>
            </div>
          </dl>

          <p v-if="detalle.notas_apertura" class="hint">Apertura: {{ detalle.notas_apertura }}</p>
          <p v-if="detalle.notas_cierre" class="hint">Cierre: {{ detalle.notas_cierre }}</p>

          <h3>Ventas ({{ detalle.ventas.length }})</h3>
          <p v-if="detalle.ventas.length === 0" class="status">Sin ventas en esta sesión.</p>
          <div v-else class="scroll">
            <table class="tabla tabla--compact">
              <thead>
                <tr>
                  <th>Hora</th>
                  <th>Venta</th>
                  <th>Mesa</th>
                  <th>Pago</th>
                  <th>Estado</th>
                  <th class="num">Total</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="v in detalle.ventas" :key="v.id" :class="{ 'row--cancelada': v.estado === 'cancelada' }">
                  <td class="nowrap">{{ formatHora(v.creado_en) }}</td>
                  <td>#{{ v.id }}</td>
                  <td>{{ v.mesa_nombre ?? 'Para llevar' }}</td>
                  <td>{{ metodoLabel(v.metodo_pago) }}</td>
                  <td>{{ v.estado === 'cancelada' ? 'Cancelada' : v.estado === 'abierta' ? 'Abierta' : 'Activa' }}</td>
                  <td class="num">{{ formatCOP(v.total) }}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <h3>Gastos desde caja ({{ detalle.gastos.length }})</h3>
          <p v-if="detalle.gastos.length === 0" class="status">Sin gastos desde caja en esta sesión.</p>
          <div v-else class="scroll">
            <table class="tabla tabla--compact">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Categoría</th>
                  <th>Descripción</th>
                  <th class="num">Monto</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="g in detalle.gastos" :key="g.id">
                  <td class="nowrap">{{ formatDiaCorto(g.fecha) }}</td>
                  <td>{{ g.categoria_nombre }}</td>
                  <td>{{ g.descripcion }}</td>
                  <td class="num">{{ formatCOP(g.monto) }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </template>

        <div class="form-actions">
          <button
            v-if="detalle && detalle.cerrada_en"
            type="button"
            class="btn-secondary"
            @click="imprimirCierreCaja(detalle)"
          >
            Imprimir cierre
          </button>
          <button type="button" class="btn-secondary" @click="closeDetalle">Cerrar</button>
        </div>
      </div>
    </BaseModal>
  </section>
</template>

<style scoped>
.view {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.view-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.title-block {
  display: flex;
  align-items: center;
  gap: 14px;
}

.view-header h1 {
  margin: 0;
  font-size: 22px;
  color: var(--color-text);
}

.estado {
  font-size: 12px;
  font-weight: 600;
  padding: 4px 12px;
  border-radius: 999px;
}

.estado--abierta {
  color: var(--color-lime);
  background: rgba(178, 255, 5, 0.14);
  border: 1px solid rgba(178, 255, 5, 0.4);
}

.estado--cerrada {
  color: var(--color-orange);
  background: rgba(255, 138, 30, 0.14);
  border: 1px solid rgba(255, 138, 30, 0.4);
}

.btn-primary {
  padding: 10px 16px;
  border: none;
  border-radius: var(--radius-md);
  cursor: pointer;
  font-weight: 600;
  font-size: 13.5px;
  color: #fff;
  background: linear-gradient(90deg, var(--color-purple), var(--color-purple-deep));
}

.btn-primary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-secondary {
  padding: 10px 16px;
  border-radius: var(--radius-md);
  cursor: pointer;
  font-size: 13.5px;
  color: var(--color-text);
  background: transparent;
  border: 1px solid var(--color-border);
}

.btn-secondary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-link {
  border: none;
  background: transparent;
  color: var(--color-cyan);
  cursor: pointer;
  font-size: 13px;
  padding: 6px 10px;
  border-radius: var(--radius-sm);
  white-space: nowrap;
}

.btn-link:hover {
  background: rgba(0, 229, 255, 0.12);
}

.btn-link:focus-visible {
  outline: 2px solid var(--color-cyan);
  outline-offset: 2px;
}

.link {
  color: var(--color-cyan);
  font-weight: 600;
  margin-left: 6px;
}

.status {
  color: var(--color-text-muted);
  font-size: 14px;
  margin: 0;
}

.error {
  color: var(--color-danger);
  font-size: 13px;
  margin: 0;
}

.error-block {
  display: flex;
  align-items: center;
  gap: 12px;
}

.hint {
  margin: 0;
  font-size: 12.5px;
  color: var(--color-text-muted);
}

.card {
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 20px;
  border-radius: var(--radius-lg);
  background: var(--color-surface);
  border: 1px solid var(--color-border-soft);
}

.abrir-card {
  max-width: 460px;
}

.abrir-card h2 {
  margin: 0;
  font-size: 16px;
  color: var(--color-text);
}

.form-row {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
}

.form-row label {
  font-size: 12.5px;
  color: var(--color-text-muted);
}

.form-row input[type='text'],
.form-row input[type='date'] {
  background: var(--color-bg);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  padding: 10px 12px;
  font-size: 14px;
  color: var(--color-text);
  width: 100%;
}

.form-row--inline input[type='date'] {
  width: auto;
  padding: 8px 10px;
  color-scheme: dark;
}

.form-row :deep(.number-input__field) {
  padding: 10px 12px;
}

.form-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}

.resumen {
  display: grid;
  grid-template-columns: minmax(260px, 1fr) minmax(0, 2fr);
  gap: 16px;
  align-items: stretch;
}

.esperado-card {
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 8px;
  padding: 22px;
  border-radius: var(--radius-lg);
  background: var(--color-surface);
  border: 1px solid rgba(178, 255, 5, 0.45);
  box-shadow: 0 0 24px rgba(178, 255, 5, 0.08);
}

.esperado-label {
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--color-text-muted);
}

.esperado-valor {
  font-size: 32px;
  font-weight: 700;
  color: var(--color-lime);
  font-variant-numeric: tabular-nums;
}

.esperado-formula {
  font-size: 12px;
  color: var(--color-text-muted);
}

.stats {
  margin: 0;
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  gap: 12px;
}

.stat {
  padding: 14px 16px;
  border-radius: var(--radius-lg);
  background: var(--color-surface);
  border: 1px solid var(--color-border-soft);
}

.stat dt {
  font-size: 11.5px;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--color-text-muted);
}

.stat dd {
  margin: 6px 0 0;
  font-size: 18px;
  font-weight: 700;
  color: var(--color-text);
  font-variant-numeric: tabular-nums;
}

.stat .stat--lime {
  color: var(--color-lime);
}

.stat .stat--orange {
  color: var(--color-orange);
}

.stat .stat--danger {
  color: var(--color-danger);
}

.pendientes {
  padding: 10px 14px;
  border-radius: var(--radius-md);
  border: 1px solid var(--color-orange);
  background: rgba(255, 138, 30, 0.08);
  font-size: 13px;
  color: var(--color-text);
}

.cerrar-row {
  display: flex;
  justify-content: flex-start;
}

.historial {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.historial-header {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 12px;
}

.historial-header h2 {
  margin: 0;
  font-size: 16px;
  color: var(--color-text);
}

.filtros {
  display: flex;
  align-items: flex-end;
  flex-wrap: wrap;
  gap: 10px;
}

.table-wrap {
  overflow-x: auto;
  border-radius: var(--radius-lg);
}

.tabla {
  width: 100%;
  border-collapse: collapse;
  background: var(--color-surface);
  border: 1px solid var(--color-border-soft);
}

.tabla th,
.tabla td {
  text-align: left;
  padding: 12px 16px;
  font-size: 13.5px;
  color: var(--color-text);
  border-bottom: 1px solid var(--color-border-soft);
}

.tabla--compact th,
.tabla--compact td {
  padding: 8px 12px;
  font-size: 13px;
}

.tabla th {
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--color-text-muted);
  font-weight: 600;
}

.tabla tbody tr:last-child td {
  border-bottom: none;
}

.tabla .num {
  text-align: right;
  font-variant-numeric: tabular-nums;
}

.nowrap {
  white-space: nowrap;
}

.diff--pos {
  color: var(--color-lime);
  font-weight: 600;
}

.diff--neg {
  color: var(--color-danger);
  font-weight: 600;
}

.tag {
  font-size: 11.5px;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 999px;
}

.tag--abierta {
  color: var(--color-lime);
  border: 1px solid rgba(178, 255, 5, 0.4);
  background: rgba(178, 255, 5, 0.14);
}

.row--cancelada td {
  opacity: 0.5;
  text-decoration: line-through;
}

.modal-form {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.modal-form h2 {
  margin: 0;
  font-size: 16px;
  color: var(--color-text);
}

.modal-form h3 {
  margin: 4px 0 0;
  font-size: 13px;
  color: var(--color-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.modal-sub {
  margin: -8px 0 0;
  font-size: 13px;
  color: var(--color-text-muted);
}

.mini-resumen {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  margin: 0;
  padding: 12px 14px;
  border-radius: var(--radius-md);
  background: var(--color-surface-alt);
  border: 1px solid var(--color-border-soft);
}

.mini-resumen dt,
.detalle-grid dt {
  font-size: 11.5px;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--color-text-muted);
}

.mini-resumen dd {
  margin: 4px 0 0;
  font-size: 18px;
  font-weight: 700;
  color: var(--color-text);
  font-variant-numeric: tabular-nums;
}

.mini-resumen dd.diff--pos,
.detalle-grid dd.diff--pos {
  color: var(--color-lime);
}

.mini-resumen dd.diff--neg,
.detalle-grid dd.diff--neg {
  color: var(--color-danger);
}

.retiro {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 14px;
  border-radius: var(--radius-md);
  border: 1px solid var(--color-border-soft);
  font-size: 13.5px;
  color: var(--color-text);
}

.retiro strong {
  font-variant-numeric: tabular-nums;
  color: var(--color-cyan);
}

.retiro--error {
  border-color: var(--color-danger);
}

.retiro--error strong {
  color: var(--color-danger);
}

.detalle-grid {
  margin: 0;
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 10px;
  padding: 12px 14px;
  border-radius: var(--radius-md);
  background: var(--color-surface-alt);
  border: 1px solid var(--color-border-soft);
}

.detalle-grid dd {
  margin: 4px 0 0;
  font-size: 15px;
  font-weight: 700;
  color: var(--color-text);
  font-variant-numeric: tabular-nums;
}

.scroll {
  max-height: 220px;
  overflow: auto;
  border: 1px solid var(--color-border-soft);
  border-radius: var(--radius-md);
}

@media (max-width: 860px) {
  .resumen {
    grid-template-columns: 1fr;
  }
}
</style>
