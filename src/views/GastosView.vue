<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { useCategoriasGasto } from '../composables/useCategoriasGasto'
import { useGastos } from '../composables/useGastos'
import { useToast } from '../composables/useToast'
import ConfirmModal from '../components/common/ConfirmModal.vue'
import CategoriasGastoModal from '../components/CategoriasGastoModal.vue'
import GastoFormModal from '../components/GastoFormModal.vue'
import IconPencil from '../components/icons/IconPencil.vue'
import IconTrash from '../components/icons/IconTrash.vue'
import { formatCOP } from '../utils/currency'
import { formatDiaCorto, hoyNegocio, inicioMesNegocio } from '../utils/fecha'
import { ORIGEN_LABEL, chipStyle } from '../utils/gastos'
import type { CategoriaGasto, Gasto } from '../api/types'

const { gastos, total, isLoading, loadError, load, remove, messageFor } = useGastos()
const { push: pushToast } = useToast()
const { categorias, load: cargarCategorias } = useCategoriasGasto()

const desde = ref(inicioMesNegocio())
const hasta = ref(hoyNegocio())
const categoria = ref<CategoriaGasto | ''>('')

function refresh(): Promise<void> {
  return load({
    desde: desde.value || undefined,
    hasta: hasta.value || undefined,
    categoria: categoria.value || undefined,
  })
}

onMounted(() => {
  void cargarCategorias()
  void refresh()
})

const isCategoriasOpen = ref(false)

async function onCategoriasClose() {
  isCategoriasOpen.value = false
  // Un renombre o cambio de color se refleja en los chips de la tabla.
  await refresh()
}

const isFormOpen = ref(false)
const editing = ref<Gasto | null>(null)

function openCreate() {
  editing.value = null
  isFormOpen.value = true
}

function openEdit(gasto: Gasto) {
  editing.value = gasto
  isFormOpen.value = true
}

function closeForm() {
  isFormOpen.value = false
  editing.value = null
}

async function onSaved() {
  closeForm()
  await refresh()
}

const pendingDelete = ref<Gasto | null>(null)
const deletingId = ref<number | null>(null)

function deleteMessage(gasto: Gasto): string {
  const base = `¿Eliminar el gasto «${gasto.descripcion}» por ${formatCOP(gasto.monto)}? Esta acción no se puede deshacer.`
  if (gasto.origen === 'inventario') {
    return `${base} Viene de una compra de inventario: el stock del insumo no cambia, solo se quita el gasto.`
  }
  if (gasto.origen === 'nomina') {
    return `${base} Es un pago de nómina: se quita el pago del historial del trabajador.`
  }
  return base
}

async function confirmDelete() {
  const gasto = pendingDelete.value
  if (!gasto) return
  deletingId.value = gasto.id
  try {
    await remove(gasto.id)
    pendingDelete.value = null
    pushToast('Gasto eliminado')
    await refresh()
  } catch (err) {
    pendingDelete.value = null
    pushToast(messageFor(err, 'No fue posible eliminar el gasto.'), 'error')
  } finally {
    deletingId.value = null
  }
}
</script>

<template>
  <section class="view">
    <header class="view-header">
      <h1>Gastos</h1>
      <div class="header-actions">
        <button type="button" class="btn-secondary" @click="isCategoriasOpen = true">Categorías</button>
        <button type="button" class="btn-primary" @click="openCreate">+ Nuevo gasto</button>
      </div>
    </header>

    <div class="toolbar">
      <div class="filtros">
        <div class="form-row">
          <label for="gastos-desde">Desde</label>
          <input id="gastos-desde" v-model="desde" type="date" :max="hasta || undefined" />
        </div>
        <div class="form-row">
          <label for="gastos-hasta">Hasta</label>
          <input id="gastos-hasta" v-model="hasta" type="date" :min="desde || undefined" />
        </div>
        <div class="form-row">
          <label for="gastos-categoria">Categoría</label>
          <select id="gastos-categoria" v-model="categoria">
            <option value="">Todas</option>
            <option v-for="c in categorias" :key="c.clave" :value="c.clave">
              {{ c.nombre }}{{ c.activa ? '' : ' (desactivada)' }}
            </option>
          </select>
        </div>
        <button type="button" class="btn-secondary" :disabled="isLoading" @click="refresh">Filtrar</button>
      </div>

      <div class="total-card">
        <span class="total-label">Total del filtro</span>
        <span class="total-valor">{{ formatCOP(total) }}</span>
        <span class="total-count">{{ gastos.length }} gasto{{ gastos.length === 1 ? '' : 's' }}</span>
      </div>
    </div>

    <p v-if="isLoading" class="status">Cargando gastos…</p>
    <div v-else-if="loadError" class="error-block">
      <p class="error" role="alert">{{ loadError }}</p>
      <button type="button" class="btn-secondary" @click="refresh">Reintentar</button>
    </div>
    <p v-else-if="gastos.length === 0" class="status">No hay gastos con estos filtros.</p>

    <div v-else class="table-wrap">
      <table class="tabla">
        <thead>
          <tr>
            <th>Fecha</th>
            <th>Categoría</th>
            <th>Descripción</th>
            <th class="num">Monto</th>
            <th>Desde caja</th>
            <th>Origen</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="g in gastos" :key="g.id">
            <td class="nowrap">{{ formatDiaCorto(g.fecha) }}</td>
            <td>
              <span class="chip" :style="chipStyle(g.categoria_color)">{{ g.categoria_nombre }}</span>
            </td>
            <td>{{ g.descripcion }}</td>
            <td class="num">{{ formatCOP(g.monto) }}</td>
            <td>
              <span class="tag" :class="g.pagado_desde_caja ? 'tag--si' : 'tag--no'">
                {{ g.pagado_desde_caja ? 'Sí' : 'No' }}
              </span>
            </td>
            <td class="nowrap">
              <RouterLink
                v-if="g.origen === 'nomina' && g.trabajador_id !== null"
                :to="{ path: '/trabajadores', query: { id: String(g.trabajador_id) } }"
                class="link"
              >
                {{ ORIGEN_LABEL.nomina }}
              </RouterLink>
              <RouterLink v-else-if="g.origen === 'inventario'" to="/inventario" class="link">
                {{ ORIGEN_LABEL.inventario }}
              </RouterLink>
              <span v-else>{{ ORIGEN_LABEL[g.origen] }}</span>
            </td>
            <td class="actions-cell">
              <div class="actions-inner">
                <button
                  type="button"
                  class="btn-link"
                  aria-label="Editar gasto"
                  title="Editar gasto"
                  @click="openEdit(g)"
                >
                  <IconPencil />
                </button>
                <button
                  type="button"
                  class="btn-link btn-link--danger"
                  :disabled="deletingId === g.id"
                  aria-label="Eliminar gasto"
                  title="Eliminar gasto"
                  @click="pendingDelete = g"
                >
                  <IconTrash />
                </button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <CategoriasGastoModal v-if="isCategoriasOpen" @close="onCategoriasClose" />

    <GastoFormModal v-if="isFormOpen" :gasto="editing" @close="closeForm" @saved="onSaved" />

    <ConfirmModal
      v-if="pendingDelete"
      title="Eliminar gasto"
      :message="deleteMessage(pendingDelete)"
      :is-confirming="deletingId === pendingDelete.id"
      @confirm="confirmDelete"
      @cancel="pendingDelete = null"
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

.header-actions {
  display: flex;
  gap: 10px;
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

.toolbar {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 16px;
}

.filtros {
  display: flex;
  align-items: flex-end;
  flex-wrap: wrap;
  gap: 10px;
}

.form-row {
  display: flex;
  flex-direction: column;
  gap: 6px;
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
  padding: 9px 10px;
  font-size: 13.5px;
  color: var(--color-text);
  color-scheme: dark;
}

.total-card {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 12px 18px;
  min-width: 190px;
  border-radius: var(--radius-lg);
  background: var(--color-surface);
  border: 1px solid rgba(255, 0, 127, 0.45);
}

.total-label {
  font-size: 11.5px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--color-text-muted);
}

.total-valor {
  font-size: 22px;
  font-weight: 700;
  color: var(--color-magenta);
  font-variant-numeric: tabular-nums;
}

.total-count {
  font-size: 12px;
  color: var(--color-text-muted);
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
  font-weight: 600;
}

.nowrap {
  white-space: nowrap;
}

.link {
  color: var(--color-cyan);
  text-decoration: none;
  font-weight: 600;
}

.link:hover {
  text-decoration: underline;
}

.chip {
  display: inline-block;
  font-size: 12px;
  font-weight: 600;
  padding: 3px 10px;
  border-radius: 999px;
  white-space: nowrap;
  color: var(--color-cyan);
  background: rgba(0, 229, 255, 0.12);
  border: 1px solid rgba(0, 229, 255, 0.4);
}

.tag {
  font-size: 12px;
  font-weight: 600;
}

.tag--si {
  color: var(--color-lime);
}

.tag--no {
  color: var(--color-text-muted);
}

.actions-inner {
  display: flex;
  align-items: center;
  gap: 4px;
}

.btn-link {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: transparent;
  color: var(--color-cyan);
  cursor: pointer;
  padding: 6px 10px;
  border-radius: var(--radius-sm);
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
  opacity: 0.6;
  cursor: not-allowed;
}
</style>
