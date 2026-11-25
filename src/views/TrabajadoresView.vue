<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useRoute } from 'vue-router'
import { ApiError } from '../api/client'
import { useCaja } from '../composables/useCaja'
import { useGastos } from '../composables/useGastos'
import { useToast } from '../composables/useToast'
import { useTrabajadores } from '../composables/useTrabajadores'
import BaseModal from '../components/common/BaseModal.vue'
import ConfirmModal from '../components/common/ConfirmModal.vue'
import NumberInput from '../components/common/NumberInput.vue'
import ToggleSwitch from '../components/common/ToggleSwitch.vue'
import GastoFormModal from '../components/GastoFormModal.vue'
import IconPencil from '../components/icons/IconPencil.vue'
import IconTrash from '../components/icons/IconTrash.vue'
import { formatCOP } from '../utils/currency'
import { formatDiaCorto, hoyNegocio } from '../utils/fecha'
import type { Gasto, TipoPago, Trabajador } from '../api/types'

const route = useRoute()
const { trabajadores, isLoading, loadError, load, getById, create, update, remove, pagar, loadPagos, messageFor } =
  useTrabajadores()
const { remove: removeGasto } = useGastos()
const { cerrada: cajaCerrada, cargarActual: cargarCaja } = useCaja()
const { push: pushToast } = useToast()

const TIPOS_PAGO: { value: TipoPago; label: string }[] = [
  { value: 'mensual', label: 'Mensual' },
  { value: 'quincenal', label: 'Quincenal' },
  { value: 'semanal', label: 'Semanal' },
  { value: 'diario', label: 'Diario' },
  { value: 'por_turno', label: 'Por turno' },
]

function tipoPagoLabel(tipo: TipoPago): string {
  return TIPOS_PAGO.find((t) => t.value === tipo)?.label ?? tipo
}

const mostrarInactivos = ref(false)
const visibles = computed(() =>
  trabajadores.value.filter((t) => mostrarInactivos.value || t.activo),
)
const inactivosCount = computed(() => trabajadores.value.filter((t) => !t.activo).length)

onMounted(async () => {
  void cargarCaja()
  await load()
  const raw = Array.isArray(route.query.id) ? route.query.id[0] : route.query.id
  const id = raw ? Number(raw) : NaN
  if (!Number.isNaN(id)) {
    const t = trabajadores.value.find((x) => x.id === id)
    if (t) {
      if (!t.activo) mostrarInactivos.value = true
      void openDetalle(t)
    }
  }
})

/* ---------- Crear / editar ---------- */
const isFormOpen = ref(false)
const editingId = ref<number | null>(null)
const form = reactive({
  nombre: '',
  cargo: '',
  telefono: '',
  documento: '',
  tipo_pago: 'mensual' as TipoPago,
  monto_pago: '' as number | '',
  fecha_ingreso: '',
  activo: true,
})
const formError = ref('')
const isSaving = ref(false)

function openCreate() {
  editingId.value = null
  form.nombre = ''
  form.cargo = ''
  form.telefono = ''
  form.documento = ''
  form.tipo_pago = 'mensual'
  form.monto_pago = ''
  form.fecha_ingreso = ''
  form.activo = true
  formError.value = ''
  isFormOpen.value = true
}

function openEdit(t: Trabajador) {
  editingId.value = t.id
  form.nombre = t.nombre
  form.cargo = t.cargo ?? ''
  form.telefono = t.telefono ?? ''
  form.documento = t.documento ?? ''
  form.tipo_pago = t.tipo_pago
  form.monto_pago = t.monto_pago
  form.fecha_ingreso = t.fecha_ingreso ?? ''
  form.activo = t.activo
  formError.value = ''
  isFormOpen.value = true
}

function closeForm() {
  if (isSaving.value) return
  isFormOpen.value = false
  editingId.value = null
}

async function onSubmit() {
  if (!form.nombre.trim()) {
    formError.value = 'El nombre es obligatorio.'
    return
  }
  if (form.monto_pago !== '' && Number(form.monto_pago) < 0) {
    formError.value = 'El valor de pago no puede ser negativo.'
    return
  }
  isSaving.value = true
  formError.value = ''
  try {
    const monto = form.monto_pago === '' ? 0 : Math.round(Number(form.monto_pago))
    const datos = {
      nombre: form.nombre.trim(),
      cargo: form.cargo.trim() || null,
      telefono: form.telefono.trim() || null,
      documento: form.documento.trim() || null,
      tipo_pago: form.tipo_pago,
      monto_pago: monto,
      fecha_ingreso: form.fecha_ingreso || null,
    }
    if (editingId.value === null) {
      await create(datos)
      pushToast('Trabajador creado')
    } else {
      await update(editingId.value, { ...datos, activo: form.activo })
      pushToast('Trabajador actualizado')
    }
    isFormOpen.value = false
    editingId.value = null
    await load()
    await refrescarDetalle()
  } catch (err) {
    formError.value = messageFor(err, 'No fue posible guardar el trabajador.')
  } finally {
    isSaving.value = false
  }
}

/* ---------- Activar / desactivar ---------- */
async function cambiarActivo(t: Trabajador, activo: boolean) {
  try {
    await update(t.id, { activo })
    pushToast(activo ? 'Trabajador activado' : 'Trabajador desactivado')
    await load()
  } catch (err) {
    pushToast(messageFor(err, 'No fue posible cambiar el estado del trabajador.'), 'error')
  }
}

/* ---------- Eliminar ---------- */
const pendingDelete = ref<Trabajador | null>(null)
const deletingId = ref<number | null>(null)

async function confirmDelete() {
  const t = pendingDelete.value
  if (!t) return
  deletingId.value = t.id
  try {
    await remove(t.id)
    pendingDelete.value = null
    pushToast('Trabajador eliminado')
    await load()
  } catch (err) {
    pendingDelete.value = null
    if (err instanceof ApiError && err.status === 409) {
      pushToast(
        err.message,
        'error',
        t.activo ? { label: 'Desactivar', handler: () => void cambiarActivo(t, false) } : undefined,
      )
    } else {
      pushToast(messageFor(err, 'No fue posible eliminar el trabajador.'), 'error')
    }
  } finally {
    deletingId.value = null
  }
}

/* ---------- Registrar pago ---------- */
const pagoTarget = ref<Trabajador | null>(null)
const pago = reactive({
  monto: '' as number | '',
  fecha: hoyNegocio(),
  descripcion: '',
  pagado_desde_caja: false,
})
const pagoError = ref('')
const isPagando = ref(false)

function openPago(t: Trabajador) {
  pagoTarget.value = t
  pago.monto = t.monto_pago > 0 ? t.monto_pago : ''
  pago.fecha = hoyNegocio()
  pago.descripcion = ''
  pago.pagado_desde_caja = false
  pagoError.value = ''
  void cargarCaja()
}

function closePago() {
  if (isPagando.value) return
  pagoTarget.value = null
}

async function onSubmitPago() {
  const t = pagoTarget.value
  if (!t) return
  if (pago.monto === '' || Number(pago.monto) <= 0) {
    pagoError.value = 'El monto debe ser mayor a 0.'
    return
  }
  if (!pago.fecha) {
    pagoError.value = 'Indica la fecha del pago.'
    return
  }
  isPagando.value = true
  pagoError.value = ''
  try {
    await pagar(t.id, {
      monto: Math.round(Number(pago.monto)),
      fecha: pago.fecha,
      descripcion: pago.descripcion.trim() || null,
      pagado_desde_caja: pago.pagado_desde_caja,
    })
    pushToast(`Pago registrado a ${t.nombre}`)
    pagoTarget.value = null
    await load()
    await refrescarDetalle()
  } catch (err) {
    const msg = messageFor(err, 'No fue posible registrar el pago.')
    pagoError.value = msg
    if (err instanceof ApiError && err.status === 409) {
      pushToast(msg, 'error')
      void cargarCaja()
    }
  } finally {
    isPagando.value = false
  }
}

/* ---------- Detalle / historial de pagos ---------- */
const detalle = ref<Trabajador | null>(null)
const pagos = ref<Gasto[]>([])
const pagosDesde = ref('')
const pagosHasta = ref('')
const isLoadingPagos = ref(false)
const pagosError = ref('')

const totalPagos = computed(() => pagos.value.reduce((acc, p) => acc + p.monto, 0))

async function cargarPagos(): Promise<void> {
  const t = detalle.value
  if (!t) return
  isLoadingPagos.value = true
  pagosError.value = ''
  try {
    pagos.value = await loadPagos(t.id, {
      desde: pagosDesde.value || undefined,
      hasta: pagosHasta.value || undefined,
    })
  } catch (err) {
    pagosError.value = messageFor(err, 'No fue posible cargar el historial de pagos.')
  } finally {
    isLoadingPagos.value = false
  }
}

async function openDetalle(t: Trabajador) {
  detalle.value = t
  pagos.value = []
  pagosDesde.value = ''
  pagosHasta.value = ''
  await cargarPagos()
}

function closeDetalle() {
  detalle.value = null
  pagos.value = []
}

async function refrescarDetalle() {
  const actual = detalle.value
  if (!actual) return
  try {
    detalle.value = await getById(actual.id)
  } catch {
    // Se conserva la última versión conocida; el listado ya se refrescó.
  }
  await cargarPagos()
}

const editingPago = ref<Gasto | null>(null)
const pendingDeletePago = ref<Gasto | null>(null)
const deletingPagoId = ref<number | null>(null)

async function onPagoEditado() {
  editingPago.value = null
  await load()
  await refrescarDetalle()
}

async function confirmDeletePago() {
  const p = pendingDeletePago.value
  if (!p) return
  deletingPagoId.value = p.id
  try {
    await removeGasto(p.id)
    pendingDeletePago.value = null
    pushToast('Pago eliminado')
    await load()
    await refrescarDetalle()
  } catch (err) {
    pendingDeletePago.value = null
    pushToast(messageFor(err, 'No fue posible eliminar el pago.'), 'error')
  } finally {
    deletingPagoId.value = null
  }
}
</script>

<template>
  <section class="view">
    <header class="view-header">
      <h1>Trabajadores</h1>
      <button type="button" class="btn-primary" @click="openCreate">+ Nuevo trabajador</button>
    </header>

    <div class="toolbar">
      <p class="counter">{{ visibles.length }} trabajador{{ visibles.length === 1 ? '' : 'es' }}</p>
      <label v-if="inactivosCount > 0" class="inactivos-toggle">
        <ToggleSwitch v-model="mostrarInactivos" aria-label="Mostrar trabajadores inactivos" />
        <span>Mostrar inactivos ({{ inactivosCount }})</span>
      </label>
    </div>

    <p v-if="isLoading" class="status">Cargando trabajadores…</p>
    <div v-else-if="loadError" class="error-block">
      <p class="error" role="alert">{{ loadError }}</p>
      <button type="button" class="btn-secondary" @click="load">Reintentar</button>
    </div>
    <p v-else-if="trabajadores.length === 0" class="status">Todavía no hay trabajadores registrados.</p>
    <p v-else-if="visibles.length === 0" class="status">No hay trabajadores activos.</p>

    <div v-else class="table-wrap">
      <table class="tabla">
        <thead>
          <tr>
            <th>Nombre</th>
            <th>Cargo</th>
            <th>Teléfono</th>
            <th>Tipo de pago</th>
            <th class="num">Valor</th>
            <th class="num">Pagado este mes</th>
            <th>Estado</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="t in visibles" :key="t.id" :class="{ 'row--inactivo': !t.activo }">
            <td>{{ t.nombre }}</td>
            <td>{{ t.cargo ?? '—' }}</td>
            <td class="nowrap">{{ t.telefono ?? '—' }}</td>
            <td>{{ tipoPagoLabel(t.tipo_pago) }}</td>
            <td class="num">{{ formatCOP(t.monto_pago) }}</td>
            <td class="num">{{ formatCOP(t.total_pagado_mes_actual) }}</td>
            <td>
              <span class="tag" :class="t.activo ? 'tag--activo' : 'tag--inactivo'">
                {{ t.activo ? 'Activo' : 'Inactivo' }}
              </span>
            </td>
            <td class="actions-cell">
              <div class="actions-inner">
                <button type="button" class="btn-link" :disabled="!t.activo" @click="openPago(t)">
                  Registrar pago
                </button>
                <button type="button" class="btn-link" @click="openDetalle(t)">Pagos</button>
                <button
                  type="button"
                  class="btn-link"
                  aria-label="Editar trabajador"
                  title="Editar trabajador"
                  @click="openEdit(t)"
                >
                  <IconPencil />
                </button>
                <button
                  v-if="t.activo"
                  type="button"
                  class="btn-link"
                  @click="cambiarActivo(t, false)"
                >
                  Desactivar
                </button>
                <button v-else type="button" class="btn-link" @click="cambiarActivo(t, true)">Activar</button>
                <button
                  type="button"
                  class="btn-link btn-link--danger"
                  :disabled="deletingId === t.id"
                  aria-label="Eliminar trabajador"
                  title="Eliminar trabajador"
                  @click="pendingDelete = t"
                >
                  <IconTrash />
                </button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Crear / editar -->
    <BaseModal v-if="isFormOpen" @close="closeForm">
      <form class="modal-form" @submit.prevent="onSubmit">
        <h2>{{ editingId === null ? 'Nuevo trabajador' : 'Editar trabajador' }}</h2>

        <div class="form-row">
          <label for="trab-nombre">Nombre</label>
          <input id="trab-nombre" v-model="form.nombre" type="text" maxlength="150" :disabled="isSaving" />
        </div>

        <div class="form-grid">
          <div class="form-row">
            <label for="trab-cargo">Cargo (opcional)</label>
            <input id="trab-cargo" v-model="form.cargo" type="text" maxlength="80" :disabled="isSaving" />
          </div>
          <div class="form-row">
            <label for="trab-telefono">Teléfono (opcional)</label>
            <input id="trab-telefono" v-model="form.telefono" type="text" maxlength="30" :disabled="isSaving" />
          </div>
        </div>

        <div class="form-grid">
          <div class="form-row">
            <label for="trab-documento">Documento (opcional)</label>
            <input id="trab-documento" v-model="form.documento" type="text" maxlength="30" :disabled="isSaving" />
          </div>
          <div class="form-row">
            <label for="trab-ingreso">Fecha de ingreso (opcional)</label>
            <input id="trab-ingreso" v-model="form.fecha_ingreso" type="date" :disabled="isSaving" />
          </div>
        </div>

        <div class="form-grid">
          <div class="form-row">
            <label for="trab-tipo">Tipo de pago</label>
            <select id="trab-tipo" v-model="form.tipo_pago" :disabled="isSaving">
              <option v-for="t in TIPOS_PAGO" :key="t.value" :value="t.value">{{ t.label }}</option>
            </select>
          </div>
          <div class="form-row">
            <label for="trab-monto">Valor de pago (COP)</label>
            <NumberInput
              id="trab-monto"
              v-model="form.monto_pago"
              :min="0"
              :step="1000"
              placeholder="Ej. 1300000"
              :disabled="isSaving"
            />
          </div>
        </div>

        <div v-if="editingId !== null" class="switch-line">
          <ToggleSwitch v-model="form.activo" :disabled="isSaving" aria-label="Trabajador activo" />
          <span class="switch-line__label">{{ form.activo ? 'Activo' : 'Inactivo' }}</span>
        </div>

        <p v-if="formError" class="error" role="alert">{{ formError }}</p>

        <div class="form-actions">
          <button type="button" class="btn-secondary" :disabled="isSaving" @click="closeForm">Cancelar</button>
          <button type="submit" class="btn-primary" :disabled="isSaving">
            {{ isSaving ? 'Guardando…' : 'Guardar' }}
          </button>
        </div>
      </form>
    </BaseModal>

    <!-- Registrar pago -->
    <BaseModal v-if="pagoTarget" @close="closePago">
      <form class="modal-form" @submit.prevent="onSubmitPago">
        <h2>Registrar pago</h2>
        <p class="modal-sub">
          {{ pagoTarget.nombre }} · {{ tipoPagoLabel(pagoTarget.tipo_pago) }} ·
          {{ formatCOP(pagoTarget.monto_pago) }}
        </p>

        <div class="form-grid">
          <div class="form-row">
            <label for="pago-monto">Monto (COP)</label>
            <NumberInput
              id="pago-monto"
              v-model="pago.monto"
              :min="1"
              :step="1000"
              :disabled="isPagando"
            />
          </div>
          <div class="form-row">
            <label for="pago-fecha">Fecha</label>
            <input id="pago-fecha" v-model="pago.fecha" type="date" :disabled="isPagando" />
          </div>
        </div>

        <div class="form-row">
          <label for="pago-descripcion">Descripción (opcional)</label>
          <input
            id="pago-descripcion"
            v-model="pago.descripcion"
            type="text"
            maxlength="255"
            :placeholder="`Pago a ${pagoTarget.nombre}`"
            :disabled="isPagando"
          />
        </div>

        <div class="switch-line">
          <ToggleSwitch
            v-model="pago.pagado_desde_caja"
            :disabled="isPagando"
            aria-label="Pagado con efectivo de la caja"
          />
          <span class="switch-line__label">Pagado con efectivo de la caja</span>
        </div>
        <p v-if="pago.pagado_desde_caja && cajaCerrada" class="hint hint--warn">
          La caja está cerrada: para pagar desde caja primero ábrela en la sección Caja.
        </p>

        <p v-if="pagoError" class="error" role="alert">{{ pagoError }}</p>

        <div class="form-actions">
          <button type="button" class="btn-secondary" :disabled="isPagando" @click="closePago">Cancelar</button>
          <button type="submit" class="btn-primary" :disabled="isPagando">
            {{ isPagando ? 'Registrando…' : 'Registrar pago' }}
          </button>
        </div>
      </form>
    </BaseModal>

    <!-- Detalle: historial de pagos -->
    <BaseModal v-if="detalle" wide @close="closeDetalle">
      <div class="modal-form">
        <h2>{{ detalle.nombre }}</h2>
        <p class="modal-sub">
          {{ detalle.cargo ?? 'Sin cargo' }} · {{ tipoPagoLabel(detalle.tipo_pago) }} ·
          {{ formatCOP(detalle.monto_pago) }} · pagado este mes
          {{ formatCOP(detalle.total_pagado_mes_actual) }}
          <template v-if="!detalle.activo"> · Inactivo</template>
        </p>

        <div class="filtros">
          <div class="form-row form-row--inline">
            <label for="pagos-desde">Desde</label>
            <input id="pagos-desde" v-model="pagosDesde" type="date" :max="pagosHasta || undefined" />
          </div>
          <div class="form-row form-row--inline">
            <label for="pagos-hasta">Hasta</label>
            <input id="pagos-hasta" v-model="pagosHasta" type="date" :min="pagosDesde || undefined" />
          </div>
          <button type="button" class="btn-secondary" :disabled="isLoadingPagos" @click="cargarPagos">
            Filtrar
          </button>
          <button
            type="button"
            class="btn-primary"
            :disabled="!detalle.activo"
            @click="openPago(detalle)"
          >
            Registrar pago
          </button>
        </div>

        <p v-if="isLoadingPagos" class="status">Cargando pagos…</p>
        <p v-else-if="pagosError" class="error" role="alert">{{ pagosError }}</p>
        <p v-else-if="pagos.length === 0" class="status">No hay pagos en este rango.</p>
        <div v-else class="scroll">
          <table class="tabla tabla--compact">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Descripción</th>
                <th>Desde caja</th>
                <th class="num">Monto</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="p in pagos" :key="p.id">
                <td class="nowrap">{{ formatDiaCorto(p.fecha) }}</td>
                <td>{{ p.descripcion }}</td>
                <td>{{ p.pagado_desde_caja ? 'Sí' : 'No' }}</td>
                <td class="num">{{ formatCOP(p.monto) }}</td>
                <td class="actions-cell">
                  <div class="actions-inner">
                    <button
                      type="button"
                      class="btn-link"
                      aria-label="Editar pago"
                      title="Editar pago"
                      @click="editingPago = p"
                    >
                      <IconPencil />
                    </button>
                    <button
                      type="button"
                      class="btn-link btn-link--danger"
                      :disabled="deletingPagoId === p.id"
                      aria-label="Eliminar pago"
                      title="Eliminar pago"
                      @click="pendingDeletePago = p"
                    >
                      <IconTrash />
                    </button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <p v-if="!isLoadingPagos && pagos.length > 0" class="total-line">
          Total del filtro: <strong>{{ formatCOP(totalPagos) }}</strong>
        </p>

        <div class="form-actions">
          <button type="button" class="btn-secondary" @click="closeDetalle">Cerrar</button>
        </div>
      </div>
    </BaseModal>

    <GastoFormModal v-if="editingPago" :gasto="editingPago" @close="editingPago = null" @saved="onPagoEditado" />

    <ConfirmModal
      v-if="pendingDelete"
      title="Eliminar trabajador"
      :message="`¿Eliminar a «${pendingDelete.nombre}»? Esta acción no se puede deshacer. Si ya tiene pagos registrados, se sugerirá desactivarlo.`"
      :is-confirming="deletingId === pendingDelete.id"
      @confirm="confirmDelete"
      @cancel="pendingDelete = null"
    />

    <ConfirmModal
      v-if="pendingDeletePago"
      title="Eliminar pago"
      :message="`¿Eliminar el pago de ${formatCOP(pendingDeletePago.monto)} del ${formatDiaCorto(pendingDeletePago.fecha)}? También desaparecerá de Gastos.`"
      :is-confirming="deletingPagoId === pendingDeletePago.id"
      @confirm="confirmDeletePago"
      @cancel="pendingDeletePago = null"
    />
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
}

.view-header h1 {
  margin: 0;
  font-size: 22px;
  color: var(--color-text);
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
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: transparent;
  color: var(--color-cyan);
  cursor: pointer;
  font-size: 13px;
  padding: 6px 10px;
  border-radius: var(--radius-sm);
  white-space: nowrap;
}

.btn-link:hover:not(:disabled) {
  background: rgba(0, 229, 255, 0.12);
}

.btn-link:focus-visible {
  outline: 2px solid var(--color-cyan);
  outline-offset: 2px;
}

.btn-link--danger {
  color: var(--color-danger);
}

.btn-link--danger:hover:not(:disabled) {
  background: rgba(255, 77, 109, 0.14);
}

.btn-link:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 12px;
}

.counter {
  margin: 0;
  font-size: 13px;
  color: var(--color-text-muted);
}

.inactivos-toggle {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  font-size: 12.5px;
  color: var(--color-text-muted);
  cursor: pointer;
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

.error-block {
  display: flex;
  align-items: center;
  gap: 12px;
}

.hint {
  margin: 0;
  font-size: 12px;
  color: var(--color-text-muted);
}

.hint--warn {
  color: var(--color-orange);
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

.row--inactivo td {
  opacity: 0.55;
}

.row--inactivo td.actions-cell {
  opacity: 1;
}

.actions-inner {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px;
}

.tag {
  font-size: 12px;
  font-weight: 600;
  padding: 4px 10px;
  border-radius: 999px;
  white-space: nowrap;
}

.tag--activo {
  color: var(--color-lime);
  background: rgba(178, 255, 5, 0.14);
  border: 1px solid rgba(178, 255, 5, 0.4);
}

.tag--inactivo {
  color: var(--color-text-muted);
  border: 1px solid var(--color-border);
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

.modal-sub {
  margin: -8px 0 0;
  font-size: 13px;
  color: var(--color-text-muted);
}

.form-row {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
}

.form-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  gap: 14px;
}

.form-row label {
  font-size: 12.5px;
  color: var(--color-text-muted);
}

.form-row input,
.form-row select {
  background: var(--color-bg);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  padding: 10px 12px;
  font-size: 14px;
  color: var(--color-text);
  width: 100%;
  color-scheme: dark;
}

.form-row--inline input {
  width: auto;
  padding: 8px 10px;
}

.form-row :deep(.number-input__field) {
  padding: 10px 12px;
}

.filtros {
  display: flex;
  align-items: flex-end;
  flex-wrap: wrap;
  gap: 10px;
}

.switch-line {
  display: inline-flex;
  align-items: center;
  gap: 10px;
}

.switch-line__label {
  font-size: 13px;
  color: var(--color-text);
}

.form-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}

.scroll {
  max-height: 320px;
  overflow: auto;
  border: 1px solid var(--color-border-soft);
  border-radius: var(--radius-md);
}

.total-line {
  margin: 0;
  text-align: right;
  font-size: 13.5px;
  color: var(--color-text-muted);
}

.total-line strong {
  color: var(--color-magenta);
  font-variant-numeric: tabular-nums;
}
</style>
