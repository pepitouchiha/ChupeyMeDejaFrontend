<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { ApiError } from '../api/client'
import { useInsumos } from '../composables/useInsumos'
import { useToast } from '../composables/useToast'
import BaseModal from '../components/common/BaseModal.vue'
import ConfirmModal from '../components/common/ConfirmModal.vue'
import NumberInput from '../components/common/NumberInput.vue'
import ToggleSwitch from '../components/common/ToggleSwitch.vue'
import IconPencil from '../components/icons/IconPencil.vue'
import IconTrash from '../components/icons/IconTrash.vue'
import { formatCOP } from '../utils/currency'
import { formatFechaHora } from '../utils/fecha'
import type { Insumo, MovimientoInsumo, TipoInsumo, TipoInsumoItem } from '../api/types'
import { listTiposInsumo } from '../api/insumos'
import TiposInsumoModal from '../components/TiposInsumoModal.vue'

const {
  insumos,
  isLoading,
  loadError,
  load,
  create,
  update,
  registrarEntrada,
  contar,
  loadMovimientos,
  remove,
  messageFor,
} = useInsumos()
const { push: pushToast } = useToast()

// Tipos de insumo de la sede: se administran con el botón "Tipos".
const tipos = ref<TipoInsumoItem[]>([])
const tiposAbierto = ref(false)
// Filtros: tipos activos y cualquier tipo desactivado que todavía tenga insumos.
const tiposFiltro = computed(() => tipos.value.filter((t) => t.activo || t.num_insumos > 0))
// Formulario: solo tipos activos, más el actual del insumo si fue desactivado.
const tiposFormulario = computed(() =>
  tipos.value.filter((t) => t.activo || (editingId.value !== null && t.clave === form.tipo)),
)

async function cargarTipos() {
  try {
    tipos.value = await listTiposInsumo()
  } catch {
    /* el error de carga general ya se muestra con los insumos */
  }
}

function onTiposCambio(nuevos: TipoInsumoItem[]) {
  tipos.value = nuevos
  // Un renombre cambia el nombre visible de los insumos de ese tipo.
  void refresh()
}

const tipoFiltro = ref<TipoInsumo | ''>('')
const mostrarInactivos = ref(false)

const visibles = computed(() =>
  insumos.value.filter(
    (i) =>
      (mostrarInactivos.value || i.activo) && (tipoFiltro.value === '' || i.tipo === tipoFiltro.value),
  ),
)
const baseParaConteo = computed(() => insumos.value.filter((i) => mostrarInactivos.value || i.activo))
const countByTipo = computed(() => {
  const counts: Record<string, number> = { '': baseParaConteo.value.length }
  for (const t of tipos.value) counts[t.clave] = baseParaConteo.value.filter((i) => i.tipo === t.clave).length
  return counts
})
const alertCount = computed(
  () => insumos.value.filter((i) => i.activo && i.estado !== 'OK').length,
)
const inactivosCount = computed(() => insumos.value.filter((i) => !i.activo).length)

function refresh(): Promise<void> {
  return load({ incluirInactivos: true })
}

onMounted(() => {
  void refresh()
  void cargarTipos()
})

const numberFormatter = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 3 })
function fmt(n: number): string {
  return numberFormatter.format(n)
}
function fmtSigned(n: number): string {
  return `${n > 0 ? '+' : ''}${fmt(n)}`
}
function tipoLabel(insumo: Insumo): string {
  return insumo.tipo_nombre || insumo.tipo
}
function estadoClass(insumo: Insumo): string {
  return insumo.estado === 'OK' ? 'ok' : insumo.estado === 'Bajo' ? 'bajo' : 'critico'
}

/* ---------- Crear / editar ---------- */
const isFormOpen = ref(false)
const editingId = ref<number | null>(null)
const editingWasActive = ref(true)
const form = reactive({
  nombre: '',
  tipo: '' as TipoInsumo | '',
  unidad: 'unidad',
  stock: '' as number | '',
  stock_minimo: '' as number | '',
  costo_unitario: '' as number | '',
  activo: true,
})
const formError = ref('')
const isSaving = ref(false)
const pendingDeactivate = ref(false)

function openCreateForm() {
  editingId.value = null
  editingWasActive.value = true
  form.nombre = ''
  form.tipo = tipoFiltro.value
  form.unidad = 'unidad'
  form.stock = ''
  form.stock_minimo = ''
  form.costo_unitario = ''
  form.activo = true
  formError.value = ''
  isFormOpen.value = true
}

function openEditForm(insumo: Insumo) {
  editingId.value = insumo.id
  editingWasActive.value = insumo.activo
  form.nombre = insumo.nombre
  form.tipo = insumo.tipo
  form.unidad = insumo.unidad
  form.stock = ''
  form.stock_minimo = insumo.stock_minimo
  form.costo_unitario = insumo.costo_unitario ?? ''
  form.activo = insumo.activo
  formError.value = ''
  isFormOpen.value = true
}

function closeForm() {
  isFormOpen.value = false
  pendingDeactivate.value = false
  editingId.value = null
  formError.value = ''
}

function onSubmit() {
  if (!form.nombre.trim()) {
    formError.value = 'El nombre es obligatorio.'
    return
  }
  if (form.tipo === '') {
    formError.value = 'Selecciona un tipo.'
    return
  }
  if (!form.unidad.trim()) {
    formError.value = 'La unidad es obligatoria.'
    return
  }
  if (editingId.value === null && form.stock !== '' && Number(form.stock) < 0) {
    formError.value = 'El stock inicial no puede ser negativo.'
    return
  }
  if (form.stock_minimo !== '' && Number(form.stock_minimo) < 0) {
    formError.value = 'El stock mínimo debe ser 0 o mayor.'
    return
  }
  if (form.costo_unitario !== '' && Number(form.costo_unitario) < 0) {
    formError.value = 'El costo unitario no puede ser negativo.'
    return
  }
  if (editingId.value !== null && editingWasActive.value && !form.activo) {
    pendingDeactivate.value = true
    return
  }
  void save()
}

async function save() {
  pendingDeactivate.value = false
  if (form.tipo === '') return
  isSaving.value = true
  formError.value = ''
  try {
    const costo = form.costo_unitario === '' ? null : Number(form.costo_unitario)
    if (editingId.value === null) {
      await create({
        nombre: form.nombre.trim(),
        tipo: form.tipo,
        unidad: form.unidad.trim(),
        stock: form.stock === '' ? 0 : Number(form.stock),
        stock_minimo: form.stock_minimo === '' ? 0 : Number(form.stock_minimo),
        costo_unitario: costo,
      })
      pushToast('Insumo creado')
    } else {
      await update(editingId.value, {
        nombre: form.nombre.trim(),
        tipo: form.tipo,
        unidad: form.unidad.trim(),
        stock_minimo: form.stock_minimo === '' ? 0 : Number(form.stock_minimo),
        costo_unitario: costo,
        activo: form.activo,
      })
      pushToast('Insumo actualizado')
    }
    closeForm()
    await refresh()
  } catch (err) {
    formError.value = messageFor(err, 'No fue posible guardar el insumo.')
  } finally {
    isSaving.value = false
  }
}

/* ---------- Eliminar ---------- */
const deletingId = ref<number | null>(null)
const pendingDelete = ref<Insumo | null>(null)

async function deactivateFromToast(insumo: Insumo) {
  try {
    await update(insumo.id, { activo: false })
    pushToast('Insumo desactivado')
  } catch (err) {
    pushToast(messageFor(err, 'No fue posible desactivar el insumo.'), 'error')
  }
}

async function confirmDelete() {
  const insumo = pendingDelete.value
  if (!insumo) return
  deletingId.value = insumo.id
  try {
    await remove(insumo.id)
    pendingDelete.value = null
    pushToast('Insumo eliminado')
    await refresh()
  } catch (err) {
    pendingDelete.value = null
    if (err instanceof ApiError && err.status === 409) {
      pushToast(
        `${err.message}`,
        'error',
        insumo.activo ? { label: 'Desactivar', handler: () => deactivateFromToast(insumo) } : undefined,
      )
    } else {
      pushToast(messageFor(err, 'No fue posible eliminar el insumo.'), 'error')
    }
  } finally {
    deletingId.value = null
  }
}

/* ---------- Registrar compra ---------- */
const compraTarget = ref<Insumo | null>(null)
const compra = reactive({
  cantidad: '' as number | '',
  costo_total: '' as number | '',
  nota: '',
  registrar_gasto: true,
  pagado_desde_caja: false,
})
const compraError = ref('')
const isSavingCompra = ref(false)

const costoUnitarioCompra = computed<number | null>(() => {
  if (compra.cantidad === '' || compra.costo_total === '' || Number(compra.cantidad) <= 0) return null
  return Math.round(Number(compra.costo_total) / Number(compra.cantidad))
})

function openCompra(insumo: Insumo) {
  compraTarget.value = insumo
  compra.cantidad = ''
  compra.costo_total = ''
  compra.nota = ''
  compra.registrar_gasto = true
  compra.pagado_desde_caja = false
  compraError.value = ''
}

function closeCompra() {
  compraTarget.value = null
  compraError.value = ''
}

function onToggleRegistrarGasto(value: boolean) {
  compra.registrar_gasto = value
  if (!value) compra.pagado_desde_caja = false
}

async function onSubmitCompra() {
  const insumo = compraTarget.value
  if (!insumo) return
  if (compra.cantidad === '' || Number(compra.cantidad) <= 0) {
    compraError.value = 'La cantidad debe ser mayor a 0.'
    return
  }
  if (compra.costo_total !== '' && Number(compra.costo_total) < 0) {
    compraError.value = 'El costo total no puede ser negativo.'
    return
  }
  const tieneCosto = compra.costo_total !== ''
  if (compra.registrar_gasto && !tieneCosto) {
    compraError.value = 'Indica el costo total para registrar la compra como gasto, o desactiva esa opción.'
    return
  }

  isSavingCompra.value = true
  compraError.value = ''
  try {
    await registrarEntrada(insumo.id, {
      cantidad: Number(compra.cantidad),
      costo_total: tieneCosto ? Math.round(Number(compra.costo_total)) : null,
      nota: compra.nota.trim() || null,
      registrar_gasto: compra.registrar_gasto && tieneCosto,
      pagado_desde_caja: compra.registrar_gasto && tieneCosto && compra.pagado_desde_caja,
    })
    pushToast('Compra registrada')
    closeCompra()
  } catch (err) {
    const msg = messageFor(err, 'No fue posible registrar la compra.')
    if (err instanceof ApiError && err.status === 409) {
      pushToast(msg, 'error')
    }
    compraError.value = msg
  } finally {
    isSavingCompra.value = false
  }
}

/* ---------- Conteo ---------- */
const conteoTarget = ref<Insumo | null>(null)
const conteo = reactive({ contado: '' as number | '', nota: '' })
const conteoError = ref('')
const isSavingConteo = ref(false)

const conteoDiferencia = computed<number | null>(() => {
  if (!conteoTarget.value || conteo.contado === '') return null
  return Math.round((Number(conteo.contado) - conteoTarget.value.stock) * 1000) / 1000
})

function openConteo(insumo: Insumo) {
  conteoTarget.value = insumo
  conteo.contado = ''
  conteo.nota = ''
  conteoError.value = ''
}

function closeConteo() {
  conteoTarget.value = null
  conteoError.value = ''
}

async function onSubmitConteo() {
  const insumo = conteoTarget.value
  if (!insumo) return
  if (conteo.contado === '' || Number(conteo.contado) < 0) {
    conteoError.value = 'Ingresa lo contado (0 o más).'
    return
  }
  isSavingConteo.value = true
  conteoError.value = ''
  try {
    await contar(insumo.id, { stock_contado: Number(conteo.contado), nota: conteo.nota.trim() || null })
    pushToast(conteoDiferencia.value === 0 ? 'Conteo sin diferencias' : 'Conteo registrado')
    closeConteo()
  } catch (err) {
    conteoError.value = messageFor(err, 'No fue posible registrar el conteo.')
  } finally {
    isSavingConteo.value = false
  }
}

/* ---------- Movimientos ---------- */
const movimientosTarget = ref<Insumo | null>(null)
const movimientos = ref<MovimientoInsumo[]>([])
const isLoadingMovs = ref(false)
const movsError = ref('')

async function openMovimientos(insumo: Insumo) {
  movimientosTarget.value = insumo
  movimientos.value = []
  movsError.value = ''
  isLoadingMovs.value = true
  try {
    movimientos.value = await loadMovimientos(insumo.id)
  } catch (err) {
    movsError.value = messageFor(err, 'No fue posible cargar los movimientos.')
  } finally {
    isLoadingMovs.value = false
  }
}

function closeMovimientos() {
  movimientosTarget.value = null
}

function movimientoLabel(m: MovimientoInsumo): string {
  switch (m.tipo) {
    case 'entrada':
      return 'Compra'
    case 'ajuste':
      return 'Ajuste'
    case 'venta':
      return m.venta_id !== null ? `Venta #${m.venta_id}` : 'Venta'
    case 'reverso_venta':
      return m.venta_id !== null ? `Reverso venta #${m.venta_id}` : 'Reverso venta'
  }
}
</script>

<template>
  <section class="view">
    <header class="view-header">
      <h1>Inventario</h1>
      <div class="header-actions">
        <button type="button" class="btn-secondary" @click="tiposAbierto = true">Tipos</button>
        <button type="button" class="btn-primary" @click="openCreateForm">+ Nuevo insumo</button>
      </div>
    </header>

    <div class="toolbar">
      <div class="chips" role="group" aria-label="Filtrar por tipo">
        <button
          type="button"
          class="chip"
          :class="{ 'chip--active': tipoFiltro === '' }"
          :aria-pressed="tipoFiltro === ''"
          @click="tipoFiltro = ''"
        >
          Todos <span class="chip-count">{{ countByTipo[''] }}</span>
        </button>
        <button
          v-for="t in tiposFiltro"
          :key="t.clave"
          type="button"
          class="chip"
          :class="{ 'chip--active': tipoFiltro === t.clave }"
          :aria-pressed="tipoFiltro === t.clave"
          @click="tipoFiltro = t.clave"
        >
          {{ t.nombre }} <span class="chip-count">{{ countByTipo[t.clave] ?? 0 }}</span>
        </button>
      </div>
      <label v-if="inactivosCount > 0" class="inactivos-toggle">
        <ToggleSwitch v-model="mostrarInactivos" aria-label="Mostrar insumos inactivos" />
        <span>Mostrar inactivos ({{ inactivosCount }})</span>
      </label>
    </div>

    <TiposInsumoModal
      v-if="tiposAbierto"
      :tipos="tipos"
      @cambio="onTiposCambio"
      @close="tiposAbierto = false"
    />

    <p class="counter">{{ visibles.length }} referencias · {{ alertCount }} con stock bajo o crítico</p>

    <BaseModal v-if="isFormOpen" @close="closeForm">
      <form class="insumo-form" @submit.prevent="onSubmit">
        <h2>{{ editingId === null ? 'Nuevo insumo' : 'Editar insumo' }}</h2>

        <div class="form-row">
          <label for="insumo-nombre">Nombre</label>
          <input
            id="insumo-nombre"
            v-model="form.nombre"
            type="text"
            placeholder="Ej. Vaso 16oz"
            :disabled="isSaving"
          />
        </div>

        <div class="form-grid">
          <div class="form-row">
            <label for="insumo-tipo">Tipo</label>
            <select id="insumo-tipo" v-model="form.tipo" :disabled="isSaving">
              <option value="" disabled>Selecciona un tipo</option>
              <option v-for="t in tiposFormulario" :key="t.clave" :value="t.clave">
                {{ t.activo ? t.nombre : `${t.nombre} (desactivado)` }}
              </option>
            </select>
          </div>
          <div class="form-row">
            <label for="insumo-unidad">Unidad</label>
            <input
              id="insumo-unidad"
              v-model="form.unidad"
              type="text"
              maxlength="20"
              placeholder="Ej. unidad, botella"
              :disabled="isSaving"
            />
          </div>
        </div>

        <div class="form-grid">
          <div v-if="editingId === null" class="form-row">
            <label for="insumo-stock">Stock inicial</label>
            <NumberInput
              id="insumo-stock"
              v-model="form.stock"
              :min="0"
              step="any"
              placeholder="0"
              :disabled="isSaving"
            />
          </div>
          <div class="form-row">
            <label for="insumo-minimo">Stock mínimo</label>
            <NumberInput
              id="insumo-minimo"
              v-model="form.stock_minimo"
              :min="0"
              step="any"
              placeholder="Ej. 10"
              :disabled="isSaving"
            />
          </div>
          <div class="form-row">
            <label for="insumo-costo">Costo unitario (opcional)</label>
            <NumberInput
              id="insumo-costo"
              v-model="form.costo_unitario"
              :min="0"
              :step="1"
              placeholder="Ej. 500"
              :disabled="isSaving"
            />
          </div>
        </div>

        <div v-if="editingId !== null" class="form-row">
          <label for="insumo-activo">Estado</label>
          <div class="switch-line">
            <ToggleSwitch id="insumo-activo" v-model="form.activo" :disabled="isSaving" aria-label="Insumo activo" />
            <span class="switch-line__label">{{ form.activo ? 'Activo' : 'Inactivo' }}</span>
          </div>
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

    <BaseModal v-if="compraTarget" @close="closeCompra">
      <form class="insumo-form" @submit.prevent="onSubmitCompra">
        <h2>Registrar compra</h2>
        <p class="modal-sub">
          {{ compraTarget.nombre }} · stock actual {{ fmt(compraTarget.stock) }} {{ compraTarget.unidad }}
        </p>

        <div class="form-grid">
          <div class="form-row">
            <label for="compra-cantidad">Cantidad comprada</label>
            <NumberInput
              id="compra-cantidad"
              v-model="compra.cantidad"
              :min="0"
              step="any"
              placeholder="Ej. 50"
              :disabled="isSavingCompra"
            />
          </div>
          <div class="form-row">
            <label for="compra-costo">Costo total (COP)</label>
            <NumberInput
              id="compra-costo"
              v-model="compra.costo_total"
              :min="0"
              :step="1"
              placeholder="Ej. 25000"
              :disabled="isSavingCompra"
            />
          </div>
        </div>

        <p v-if="costoUnitarioCompra !== null" class="hint">
          Costo unitario resultante: {{ formatCOP(costoUnitarioCompra) }} por {{ compraTarget.unidad }}.
        </p>

        <div class="form-row">
          <label for="compra-nota">Nota (opcional)</label>
          <input
            id="compra-nota"
            v-model="compra.nota"
            type="text"
            maxlength="255"
            placeholder="Ej. Proveedor, factura…"
            :disabled="isSavingCompra"
          />
        </div>

        <div class="switch-line">
          <ToggleSwitch
            :model-value="compra.registrar_gasto"
            :disabled="isSavingCompra"
            aria-label="Registrar como gasto"
            @update:model-value="onToggleRegistrarGasto"
          />
          <span class="switch-line__label">Registrar como gasto</span>
        </div>
        <div class="switch-line">
          <ToggleSwitch
            v-model="compra.pagado_desde_caja"
            :disabled="isSavingCompra || !compra.registrar_gasto"
            aria-label="Pagado con efectivo de la caja"
          />
          <span class="switch-line__label" :class="{ 'switch-line__label--off': !compra.registrar_gasto }">
            Pagado con efectivo de la caja
          </span>
        </div>

        <p v-if="compraError" class="error" role="alert">{{ compraError }}</p>

        <div class="form-actions">
          <button type="button" class="btn-secondary" :disabled="isSavingCompra" @click="closeCompra">
            Cancelar
          </button>
          <button type="submit" class="btn-primary" :disabled="isSavingCompra">
            {{ isSavingCompra ? 'Registrando…' : 'Registrar compra' }}
          </button>
        </div>
      </form>
    </BaseModal>

    <BaseModal v-if="conteoTarget" @close="closeConteo">
      <form class="insumo-form" @submit.prevent="onSubmitConteo">
        <h2>Conteo de inventario</h2>
        <p class="modal-sub">{{ conteoTarget.nombre }}</p>

        <dl class="conteo-resumen">
          <div>
            <dt>En sistema</dt>
            <dd>{{ fmt(conteoTarget.stock) }} {{ conteoTarget.unidad }}</dd>
          </div>
          <div>
            <dt>Diferencia</dt>
            <dd
              :class="{
                'diff--pos': conteoDiferencia !== null && conteoDiferencia > 0,
                'diff--neg': conteoDiferencia !== null && conteoDiferencia < 0,
              }"
            >
              {{ conteoDiferencia === null ? '—' : conteoDiferencia === 0 ? 'Sin diferencia' : fmtSigned(conteoDiferencia) }}
            </dd>
          </div>
        </dl>

        <div class="form-row">
          <label for="conteo-contado">Cantidad contada</label>
          <NumberInput
            id="conteo-contado"
            v-model="conteo.contado"
            :min="0"
            step="any"
            placeholder="Lo que hay físicamente"
            :disabled="isSavingConteo"
          />
        </div>

        <div class="form-row">
          <label for="conteo-nota">Nota (opcional)</label>
          <input
            id="conteo-nota"
            v-model="conteo.nota"
            type="text"
            maxlength="255"
            placeholder="Ej. Conteo de cierre"
            :disabled="isSavingConteo"
          />
        </div>

        <p v-if="conteoError" class="error" role="alert">{{ conteoError }}</p>

        <div class="form-actions">
          <button type="button" class="btn-secondary" :disabled="isSavingConteo" @click="closeConteo">
            Cancelar
          </button>
          <button type="submit" class="btn-primary" :disabled="isSavingConteo || conteo.contado === ''">
            {{ isSavingConteo ? 'Guardando…' : conteoDiferencia === 0 ? 'Confirmar (sin cambios)' : 'Confirmar conteo' }}
          </button>
        </div>
      </form>
    </BaseModal>

    <BaseModal v-if="movimientosTarget" wide @close="closeMovimientos">
      <div class="insumo-form">
        <h2>Movimientos</h2>
        <p class="modal-sub">
          {{ movimientosTarget.nombre }} · stock actual {{ fmt(movimientosTarget.stock) }}
          {{ movimientosTarget.unidad }}
        </p>

        <p v-if="isLoadingMovs" class="status">Cargando movimientos…</p>
        <p v-else-if="movsError" class="error" role="alert">{{ movsError }}</p>
        <p v-else-if="movimientos.length === 0" class="status">Este insumo todavía no tiene movimientos.</p>
        <div v-else class="movs-scroll">
          <table class="movs-table">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Tipo</th>
                <th class="num">Cantidad</th>
                <th class="num">Stock</th>
                <th>Nota</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="m in movimientos" :key="m.id">
                <td class="nowrap">{{ formatFechaHora(m.creado_en) }}</td>
                <td>
                  <span class="mov-tipo" :class="`mov-tipo--${m.tipo}`">{{ movimientoLabel(m) }}</span>
                </td>
                <td class="num" :class="m.cantidad < 0 ? 'diff--neg' : 'diff--pos'">{{ fmtSigned(m.cantidad) }}</td>
                <td class="num">{{ fmt(m.stock_resultante) }}</td>
                <td class="nota">
                  {{ m.nota ?? '' }}
                  <span v-if="m.costo_total !== null" class="nota-costo">{{ formatCOP(m.costo_total) }}</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="form-actions">
          <button type="button" class="btn-secondary" @click="closeMovimientos">Cerrar</button>
        </div>
      </div>
    </BaseModal>

    <p v-if="isLoading" class="status">Cargando inventario…</p>
    <p v-else-if="loadError" class="error" role="alert">{{ loadError }}</p>
    <p v-else-if="insumos.length === 0" class="status">Todavía no hay insumos registrados.</p>
    <p v-else-if="visibles.length === 0" class="status">No hay insumos en este filtro.</p>

    <div v-else class="table-wrap">
      <table class="insumo-table tabla-tarjetas">
        <thead>
          <tr>
            <th>Nombre</th>
            <th>Tipo</th>
            <th class="num">Stock</th>
            <th class="num">Mínimo</th>
            <th>Estado</th>
            <th class="num">Costo unit.</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="insumo in visibles" :key="insumo.id" :class="{ 'row--inactivo': !insumo.activo }">
            <td class="celda-titulo">
              {{ insumo.nombre }}
              <span v-if="!insumo.activo" class="tag tag--inactivo">Inactivo</span>
            </td>
            <td data-label="Tipo">{{ tipoLabel(insumo) }}</td>
            <td data-label="Stock" class="num" :class="{ 'diff--neg': insumo.stock < 0 }">
              {{ fmt(insumo.stock) }} <span class="unidad">{{ insumo.unidad }}</span>
            </td>
            <td data-label="Mínimo" class="num">{{ fmt(insumo.stock_minimo) }}</td>
            <td data-label="Estado">
              <span class="tag" :class="`tag--${estadoClass(insumo)}`">{{ insumo.estado }}</span>
            </td>
            <td data-label="Costo unit." class="num">
              <template v-if="insumo.costo_unitario !== null">{{ formatCOP(insumo.costo_unitario) }}</template>
              <span v-else class="sin-dato">N/D</span>
            </td>
            <td class="actions-cell">
              <div class="actions-inner">
                <button type="button" class="btn-link" @click="openCompra(insumo)">Registrar compra</button>
                <button type="button" class="btn-link" @click="openConteo(insumo)">Conteo</button>
                <button type="button" class="btn-link" @click="openMovimientos(insumo)">Movimientos</button>
                <button
                  type="button"
                  class="btn-link"
                  aria-label="Editar insumo"
                  title="Editar insumo"
                  @click="openEditForm(insumo)"
                >
                  <IconPencil />
                </button>
                <button
                  type="button"
                  class="btn-link btn-link--danger"
                  :disabled="deletingId === insumo.id"
                  :aria-label="deletingId === insumo.id ? 'Eliminando insumo…' : 'Eliminar insumo'"
                  :title="deletingId === insumo.id ? 'Eliminando insumo…' : 'Eliminar insumo'"
                  :aria-busy="deletingId === insumo.id"
                  @click="pendingDelete = insumo"
                >
                  <IconTrash />
                </button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <ConfirmModal
      v-if="pendingDelete"
      title="Eliminar insumo"
      :message="`¿Eliminar el insumo «${pendingDelete.nombre}»? Esta acción no se puede deshacer.`"
      :is-confirming="deletingId === pendingDelete.id"
      @confirm="confirmDelete"
      @cancel="pendingDelete = null"
    />

    <ConfirmModal
      v-if="pendingDeactivate"
      title="Desactivar insumo"
      :message="`«${form.nombre}» dejará de aparecer en el listado y en el selector de productos. Si está en la receta de algún producto, seguirá descontándose al vender.`"
      confirm-text="Desactivar"
      confirming-text="Guardando…"
      variant="primary"
      :is-confirming="isSaving"
      @confirm="save"
      @cancel="pendingDeactivate = false"
    />
  </section>
</template>

<style scoped>
.header-actions {
  display: flex;
  align-items: center;
  gap: 10px;
}

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
  transition: background-color 0.15s ease, color 0.15s ease;
  white-space: nowrap;
}

.btn-link:hover:not(:disabled) {
  background: rgba(0, 229, 255, 0.12);
  color: #5df2ff;
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
  color: #ff7d91;
}

.btn-link--danger:focus-visible {
  outline-color: var(--color-danger);
}

.btn-link:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 12px;
}

.chips {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.chip {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 7px 14px;
  border-radius: 999px;
  border: 1px solid var(--color-border);
  background: transparent;
  color: var(--color-text-muted);
  font-size: 13px;
  cursor: pointer;
  transition: background-color 0.15s ease, color 0.15s ease, border-color 0.15s ease;
}

.chip:hover {
  color: var(--color-text);
  background: rgba(123, 44, 191, 0.14);
}

.chip:focus-visible {
  outline: 2px solid var(--color-cyan);
  outline-offset: 2px;
}

.chip--active {
  color: var(--color-cyan);
  border-color: rgba(0, 229, 255, 0.5);
  background: rgba(0, 229, 255, 0.12);
}

.chip-count {
  font-size: 11.5px;
  font-variant-numeric: tabular-nums;
  opacity: 0.8;
}

.inactivos-toggle {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  font-size: 12.5px;
  color: var(--color-text-muted);
  cursor: pointer;
}

.counter {
  margin: 0;
  font-size: 13px;
  color: var(--color-text-muted);
}

.insumo-form {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.insumo-form h2 {
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
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
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
}

.form-row :deep(.number-input__field) {
  padding: 10px 12px;
}

.insumo-form > .form-row > input,
.insumo-form > .form-row > select {
  width: 100%;
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

.switch-line__label--off {
  color: var(--color-text-muted);
}

.hint {
  margin: 0;
  font-size: 12px;
  color: var(--color-text-muted);
}

.form-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
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

.conteo-resumen {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  margin: 0;
  padding: 12px 14px;
  border-radius: var(--radius-md);
  background: var(--color-surface-alt);
  border: 1px solid var(--color-border-soft);
}

.conteo-resumen dt {
  font-size: 11.5px;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--color-text-muted);
}

.conteo-resumen dd {
  margin: 4px 0 0;
  font-size: 18px;
  font-weight: 700;
  color: var(--color-text);
  font-variant-numeric: tabular-nums;
}

.diff--pos {
  color: var(--color-lime);
}

.diff--neg {
  color: var(--color-danger);
}

.conteo-resumen dd.diff--pos {
  color: var(--color-lime);
}

.conteo-resumen dd.diff--neg {
  color: var(--color-danger);
}

.table-wrap {
  overflow-x: auto;
  border-radius: var(--radius-lg);
}

.insumo-table {
  width: 100%;
  border-collapse: collapse;
  background: var(--color-surface);
  border: 1px solid var(--color-border-soft);
  border-radius: var(--radius-lg);
  overflow: hidden;
}

.insumo-table th,
.insumo-table td {
  text-align: left;
  padding: 12px 16px;
  font-size: 13.5px;
  color: var(--color-text);
  border-bottom: 1px solid var(--color-border-soft);
}

.insumo-table th {
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--color-text-muted);
  font-weight: 600;
}

.insumo-table tbody tr:last-child td {
  border-bottom: none;
}

.insumo-table .num,
.movs-table .num {
  text-align: right;
  font-variant-numeric: tabular-nums;
}

.insumo-table td.num.diff--neg {
  color: var(--color-danger);
  font-weight: 600;
}

.row--inactivo td {
  opacity: 0.55;
}

.row--inactivo td.actions-cell {
  opacity: 1;
}

.unidad {
  font-size: 12px;
  color: var(--color-text-muted);
}

.sin-dato {
  color: var(--color-text-muted);
  font-style: italic;
  font-size: 12.5px;
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

.tag--ok {
  color: var(--color-lime);
  background: rgba(178, 255, 5, 0.14);
  border: 1px solid rgba(178, 255, 5, 0.4);
}

.tag--bajo {
  color: var(--color-orange);
  background: rgba(255, 138, 30, 0.14);
  border: 1px solid rgba(255, 138, 30, 0.4);
}

.tag--critico {
  color: var(--color-danger);
  background: rgba(255, 77, 109, 0.14);
  border: 1px solid rgba(255, 77, 109, 0.4);
}

.tag--inactivo {
  margin-left: 8px;
  font-size: 11px;
  padding: 2px 8px;
  color: var(--color-text-muted);
  border: 1px solid var(--color-border);
}

.movs-scroll {
  max-height: 52vh;
  overflow: auto;
  border: 1px solid var(--color-border-soft);
  border-radius: var(--radius-md);
}

.movs-table {
  width: 100%;
  border-collapse: collapse;
}

.movs-table th,
.movs-table td {
  text-align: left;
  padding: 9px 12px;
  font-size: 13px;
  color: var(--color-text);
  border-bottom: 1px solid var(--color-border-soft);
}

.movs-table th {
  position: sticky;
  top: 0;
  background: var(--color-surface-alt);
  font-size: 11.5px;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--color-text-muted);
  font-weight: 600;
}

.movs-table tbody tr:last-child td {
  border-bottom: none;
}

.movs-table td.num {
  font-weight: 600;
}

.nowrap {
  white-space: nowrap;
}

.nota {
  color: var(--color-text-muted);
}

.nota-costo {
  margin-left: 6px;
  color: var(--color-text);
  font-size: 12px;
}

.mov-tipo {
  font-size: 12px;
  font-weight: 600;
  white-space: nowrap;
}

.mov-tipo--entrada {
  color: var(--color-lime);
}

.mov-tipo--ajuste {
  color: var(--color-orange);
}

.mov-tipo--venta {
  color: var(--color-cyan);
}

.mov-tipo--reverso_venta {
  color: var(--color-magenta);
}
</style>
