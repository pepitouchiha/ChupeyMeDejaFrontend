<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { ApiError } from '../api/client'
import type { CategoriaGastoItem } from '../api/types'
import { useCategoriasGasto } from '../composables/useCategoriasGasto'
import { useToast } from '../composables/useToast'
import { chipStyle } from '../utils/gastos'
import BaseModal from './common/BaseModal.vue'
import IconPencil from './icons/IconPencil.vue'
import IconTrash from './icons/IconTrash.vue'
import ToggleSwitch from './common/ToggleSwitch.vue'

const emit = defineEmits<{ close: [] }>()

const { categorias, isLoading, loadError, load, create, update, remove } = useCategoriasGasto()
const { push: pushToast } = useToast()

const COLOR_NUEVA = '#00e5ff'

const form = reactive({ nombre: '', color: COLOR_NUEVA })
const editingId = ref<number | null>(null)
const isSaving = ref(false)
const busyId = ref<number | null>(null)
const pendingDeleteId = ref<number | null>(null)
const error = ref('')

onMounted(() => {
  void load()
})

function messageFor(err: unknown, fallback: string): string {
  return err instanceof ApiError && err.message ? err.message : fallback
}

function resetForm() {
  editingId.value = null
  form.nombre = ''
  form.color = COLOR_NUEVA
  error.value = ''
}

function startEdit(c: CategoriaGastoItem) {
  editingId.value = c.id
  form.nombre = c.nombre
  form.color = c.color
  error.value = ''
  pendingDeleteId.value = null
}

async function onSubmit() {
  const nombre = form.nombre.trim()
  if (!nombre) {
    error.value = 'Escribe un nombre para la categoría.'
    return
  }
  isSaving.value = true
  error.value = ''
  try {
    if (editingId.value === null) {
      await create({ nombre, color: form.color })
      pushToast('Categoría creada')
    } else {
      await update(editingId.value, { nombre, color: form.color })
      pushToast('Categoría actualizada')
    }
    resetForm()
  } catch (err) {
    error.value = messageFor(err, 'No fue posible guardar la categoría.')
  } finally {
    isSaving.value = false
  }
}

async function toggleActiva(c: CategoriaGastoItem, activa: boolean) {
  busyId.value = c.id
  try {
    await update(c.id, { activa })
    pushToast(activa ? 'Categoría activada' : 'Categoría desactivada')
  } catch (err) {
    pushToast(messageFor(err, 'No fue posible cambiar la categoría.'), 'error')
  } finally {
    busyId.value = null
  }
}

async function confirmDelete(c: CategoriaGastoItem) {
  busyId.value = c.id
  try {
    await remove(c.id)
    pendingDeleteId.value = null
    if (editingId.value === c.id) resetForm()
    pushToast('Categoría eliminada')
  } catch (err) {
    pendingDeleteId.value = null
    pushToast(messageFor(err, 'No fue posible eliminar la categoría.'), 'error')
  } finally {
    busyId.value = null
  }
}
</script>

<template>
  <BaseModal wide @close="!isSaving && emit('close')">
    <div class="cats">
      <header class="cats-header">
        <h2>Categorías de gasto</h2>
        <p class="hint">
          Las categorías con gastos registrados no se pueden eliminar, pero sí desactivar: dejan de aparecer al
          crear gastos y los gastos que ya tienen la conservan.
        </p>
      </header>

      <form class="cats-form" @submit.prevent="onSubmit">
        <div class="form-row form-row--grow">
          <label for="cat-gasto-nombre">{{ editingId === null ? 'Nueva categoría' : 'Editar categoría' }}</label>
          <input
            id="cat-gasto-nombre"
            v-model="form.nombre"
            type="text"
            maxlength="60"
            placeholder="Ej. Publicidad"
            :disabled="isSaving"
          />
        </div>
        <div class="form-row">
          <label for="cat-gasto-color">Color</label>
          <input id="cat-gasto-color" v-model="form.color" type="color" class="color-input" :disabled="isSaving" />
        </div>
        <div class="form-buttons">
          <button v-if="editingId !== null" type="button" class="btn-secondary" :disabled="isSaving" @click="resetForm">
            Cancelar
          </button>
          <button type="submit" class="btn-primary" :disabled="isSaving">
            {{ isSaving ? 'Guardando…' : editingId === null ? 'Agregar' : 'Guardar' }}
          </button>
        </div>
      </form>
      <p v-if="error" class="error" role="alert">{{ error }}</p>

      <p v-if="isLoading && categorias.length === 0" class="status">Cargando categorías…</p>
      <p v-else-if="loadError" class="error" role="alert">{{ loadError }}</p>

      <ul v-else class="cats-list">
        <li
          v-for="c in categorias"
          :key="c.id"
          class="cat-item"
          :class="{ 'cat-item--inactiva': !c.activa, 'cat-item--editing': editingId === c.id }"
        >
          <span class="chip" :style="chipStyle(c.color)">{{ c.nombre }}</span>
          <span class="meta">
            {{ c.num_gastos }} gasto{{ c.num_gastos === 1 ? '' : 's' }}
            <span v-if="c.sistema" class="badge" title="La usa el sistema automáticamente">sistema</span>
          </span>

          <template v-if="pendingDeleteId === c.id">
            <span class="confirm-text">¿Eliminar?</span>
            <button type="button" class="btn-small btn-small--danger" :disabled="busyId === c.id" @click="confirmDelete(c)">
              Sí, eliminar
            </button>
            <button type="button" class="btn-small" :disabled="busyId === c.id" @click="pendingDeleteId = null">No</button>
          </template>
          <template v-else>
            <label class="activa" :title="c.sistema ? 'Las categorías del sistema siempre están activas' : ''">
              <ToggleSwitch
                :model-value="c.activa"
                :disabled="c.sistema || busyId === c.id"
                :aria-label="`Categoría ${c.nombre} activa`"
                @update:model-value="(v: boolean) => toggleActiva(c, v)"
              />
              <span>{{ c.activa ? 'Activa' : 'Inactiva' }}</span>
            </label>
            <button type="button" class="btn-link" aria-label="Editar categoría" title="Editar" @click="startEdit(c)">
              <IconPencil />
            </button>
            <button
              type="button"
              class="btn-link btn-link--danger"
              :disabled="c.sistema || c.num_gastos > 0 || busyId === c.id"
              :title="
                c.sistema
                  ? 'Las categorías del sistema no se pueden eliminar'
                  : c.num_gastos > 0
                    ? 'Tiene gastos registrados: desactívala en su lugar'
                    : 'Eliminar'
              "
              aria-label="Eliminar categoría"
              @click="pendingDeleteId = c.id"
            >
              <IconTrash />
            </button>
          </template>
        </li>
      </ul>

      <div class="footer">
        <button type="button" class="btn-secondary" :disabled="isSaving" @click="emit('close')">Cerrar</button>
      </div>
    </div>
  </BaseModal>
</template>

<style scoped>
.cats {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.cats-header h2 {
  margin: 0 0 6px;
  font-size: 16px;
  color: var(--color-text);
}

.hint {
  margin: 0;
  font-size: 12.5px;
  color: var(--color-text-muted);
}

.cats-form {
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

.form-row--grow {
  flex: 1 1 200px;
}

.form-row label {
  font-size: 12.5px;
  color: var(--color-text-muted);
}

.form-row input[type='text'] {
  background: var(--color-bg);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  padding: 9px 10px;
  font-size: 13.5px;
  color: var(--color-text);
}

.color-input {
  width: 46px;
  height: 38px;
  padding: 2px;
  background: var(--color-bg);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  cursor: pointer;
}

.form-buttons {
  display: flex;
  gap: 8px;
}

.cats-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  border: 1px solid var(--color-border-soft);
  border-radius: var(--radius-lg);
  max-height: 50vh;
  overflow-y: auto;
}

.cat-item {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 10px;
  padding: 10px 14px;
  border-bottom: 1px solid var(--color-border-soft);
}

.cat-item:last-child {
  border-bottom: none;
}

.cat-item--inactiva .chip {
  opacity: 0.5;
}

.cat-item--editing {
  background: rgba(0, 229, 255, 0.06);
}

.chip {
  display: inline-block;
  font-size: 12px;
  font-weight: 600;
  padding: 3px 10px;
  border-radius: 999px;
  white-space: nowrap;
  border: 1px solid;
}

.meta {
  flex: 1;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: var(--color-text-muted);
}

.badge {
  font-size: 10.5px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  padding: 1px 6px;
  border-radius: 4px;
  border: 1px solid var(--color-border);
}

.activa {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 12.5px;
  color: var(--color-text-muted);
  min-width: 110px;
}

.confirm-text {
  font-size: 12.5px;
  color: var(--color-danger);
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

.footer {
  display: flex;
  justify-content: flex-end;
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

.btn-primary:disabled,
.btn-secondary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-small {
  padding: 5px 10px;
  border-radius: var(--radius-sm);
  font-size: 12.5px;
  cursor: pointer;
  color: var(--color-text);
  background: transparent;
  border: 1px solid var(--color-border);
}

.btn-small--danger {
  color: #fff;
  background: var(--color-danger);
  border-color: var(--color-danger);
}

.btn-link {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: transparent;
  color: var(--color-cyan);
  cursor: pointer;
  padding: 6px 8px;
  border-radius: var(--radius-sm);
}

.btn-link:hover:not(:disabled) {
  background: rgba(0, 229, 255, 0.12);
}

.btn-link--danger {
  color: var(--color-danger);
}

.btn-link--danger:hover:not(:disabled) {
  background: rgba(255, 77, 109, 0.14);
}

.btn-link:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}
</style>
