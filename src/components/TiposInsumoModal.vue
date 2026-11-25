<script setup lang="ts">
import { ref } from 'vue'
import { createTipoInsumo, deleteTipoInsumo, updateTipoInsumo } from '../api/insumos'
import { ApiError } from '../api/client'
import type { TipoInsumoItem } from '../api/types'
import BaseModal from './common/BaseModal.vue'
import { useToast } from '../composables/useToast'

/**
 * Administra la lista de tipos de insumo de la sede activa (Vaso, Bebida,
 * Licor...). Emite `cambio` con la lista actualizada para que Inventario
 * refresque sus filtros y el formulario.
 */
const props = defineProps<{ tipos: TipoInsumoItem[] }>()
const emit = defineEmits<{ close: []; cambio: [tipos: TipoInsumoItem[]] }>()
const { push: pushToast } = useToast()

const nuevoNombre = ref('')
const editandoId = ref<number | null>(null)
const editandoNombre = ref('')
const ocupadoId = ref<number | 'nuevo' | null>(null)
const error = ref('')

function mensaje(err: unknown, porDefecto: string): string {
  return err instanceof ApiError && err.status !== 0 ? err.message : porDefecto
}

function reemplazar(tipo: TipoInsumoItem) {
  emit('cambio', props.tipos.map((t) => (t.id === tipo.id ? tipo : t)))
}

async function agregar() {
  error.value = ''
  const nombre = nuevoNombre.value.trim()
  if (!nombre) {
    error.value = 'Escribe el nombre del tipo.'
    return
  }
  ocupadoId.value = 'nuevo'
  try {
    const tipo = await createTipoInsumo(nombre)
    emit('cambio', [...props.tipos, tipo])
    nuevoNombre.value = ''
    pushToast('Tipo agregado')
  } catch (err) {
    error.value = mensaje(err, 'No fue posible agregar el tipo.')
  } finally {
    ocupadoId.value = null
  }
}

function empezarEdicion(tipo: TipoInsumoItem) {
  editandoId.value = tipo.id
  editandoNombre.value = tipo.nombre
  error.value = ''
}

async function guardarNombre(tipo: TipoInsumoItem) {
  const nombre = editandoNombre.value.trim()
  if (!nombre || nombre === tipo.nombre) {
    editandoId.value = null
    return
  }
  ocupadoId.value = tipo.id
  try {
    reemplazar(await updateTipoInsumo(tipo.id, { nombre }))
    editandoId.value = null
  } catch (err) {
    error.value = mensaje(err, 'No fue posible renombrar el tipo.')
  } finally {
    ocupadoId.value = null
  }
}

async function alternarActivo(tipo: TipoInsumoItem) {
  error.value = ''
  ocupadoId.value = tipo.id
  try {
    reemplazar(await updateTipoInsumo(tipo.id, { activo: !tipo.activo }))
  } catch (err) {
    error.value = mensaje(err, 'No fue posible actualizar el tipo.')
  } finally {
    ocupadoId.value = null
  }
}

async function eliminar(tipo: TipoInsumoItem) {
  error.value = ''
  ocupadoId.value = tipo.id
  try {
    await deleteTipoInsumo(tipo.id)
    emit('cambio', props.tipos.filter((t) => t.id !== tipo.id))
    pushToast('Tipo eliminado')
  } catch (err) {
    error.value = mensaje(err, 'No fue posible eliminar el tipo.')
  } finally {
    ocupadoId.value = null
  }
}
</script>

<template>
  <BaseModal @close="emit('close')">
    <div class="tipos">
      <h2>Tipos de insumo</h2>
      <p class="hint">
        Sirven para agrupar y filtrar el inventario de esta sede. Un tipo con insumos no se puede eliminar,
        pero sí desactivar: deja de aparecer al crear insumos nuevos.
      </p>

      <ul class="lista">
        <li v-for="tipo in tipos" :key="tipo.id" class="fila" :class="{ 'fila--inactiva': !tipo.activo }">
          <form v-if="editandoId === tipo.id" class="renombrar" @submit.prevent="guardarNombre(tipo)">
            <label :for="`tipo-nombre-${tipo.id}`" class="sr-only">Nombre del tipo</label>
            <input :id="`tipo-nombre-${tipo.id}`" v-model="editandoNombre" type="text" maxlength="60" />
            <button type="submit" class="btn-link" :disabled="ocupadoId === tipo.id">Guardar</button>
            <button type="button" class="btn-link btn-link--muted" @click="editandoId = null">Cancelar</button>
          </form>
          <template v-else>
            <div class="info">
              <strong>{{ tipo.nombre }}</strong>
              <span>
                {{ tipo.num_insumos }} {{ tipo.num_insumos === 1 ? 'insumo' : 'insumos' }}
                <template v-if="!tipo.activo"> · desactivado</template>
              </span>
            </div>
            <div class="acciones">
              <button type="button" class="btn-link" @click="empezarEdicion(tipo)">Renombrar</button>
              <button
                type="button"
                class="btn-link"
                :disabled="ocupadoId === tipo.id"
                @click="alternarActivo(tipo)"
              >
                {{ tipo.activo ? 'Desactivar' : 'Activar' }}
              </button>
              <button
                type="button"
                class="btn-link btn-link--danger"
                :disabled="ocupadoId === tipo.id || tipo.num_insumos > 0"
                :title="tipo.num_insumos > 0 ? 'Tiene insumos: desactívalo en su lugar' : undefined"
                @click="eliminar(tipo)"
              >
                Eliminar
              </button>
            </div>
          </template>
        </li>
      </ul>

      <form class="agregar" @submit.prevent="agregar">
        <label for="tipo-nuevo">Nuevo tipo</label>
        <div class="agregar-fila">
          <input id="tipo-nuevo" v-model="nuevoNombre" type="text" maxlength="60" placeholder="Ej. Topping" />
          <button type="submit" class="btn-primary" :disabled="ocupadoId === 'nuevo'">Agregar</button>
        </div>
      </form>

      <p v-if="error" class="error" role="alert">{{ error }}</p>

      <div class="pie">
        <button type="button" class="btn-secondary" @click="emit('close')">Cerrar</button>
      </div>
    </div>
  </BaseModal>
</template>

<style scoped>
.tipos {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

h2 {
  margin: 0;
  font-size: 18px;
}

.hint {
  margin: 0;
  font-size: 12.5px;
  line-height: 1.5;
  color: var(--color-text-muted);
}

.lista {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  border: 1px solid var(--color-border-soft);
  border-radius: var(--radius-md);
}

.fila {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 6px 12px;
  padding: 10px 12px;
  border-bottom: 1px solid var(--color-border-soft);
}

.fila:last-child {
  border-bottom: none;
}

.fila--inactiva .info {
  opacity: 0.55;
}

.info {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.info span {
  font-size: 12px;
  color: var(--color-text-muted);
}

.acciones {
  display: flex;
  flex-wrap: wrap;
  gap: 2px;
}

.renombrar,
.agregar-fila {
  display: flex;
  gap: 8px;
  flex: 1;
  min-width: 0;
}

.renombrar input,
.agregar-fila input {
  flex: 1;
  min-width: 0;
  min-height: 40px;
  padding: 8px 12px;
  border-radius: var(--radius-md);
  border: 1px solid var(--color-border);
  background: var(--color-surface-alt);
  font-size: 15px;
}

.agregar {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.agregar label {
  font-size: 12.5px;
  color: var(--color-text-muted);
}

.error {
  margin: 0;
  font-size: 13px;
  color: var(--color-danger);
}

.pie {
  display: flex;
  justify-content: flex-end;
}

.btn-primary,
.btn-secondary {
  min-height: 40px;
  padding: 0 16px;
  border-radius: var(--radius-md);
  font-size: 14px;
  cursor: pointer;
}

.btn-primary {
  border: none;
  font-weight: 600;
  color: #fff;
  background: linear-gradient(90deg, var(--color-purple), var(--color-purple-deep));
}

.btn-secondary {
  background: transparent;
  border: 1px solid var(--color-border);
  color: var(--color-text);
}

.btn-link {
  min-height: 36px;
  border: none;
  background: transparent;
  color: var(--color-cyan);
  cursor: pointer;
  font-size: 13px;
  padding: 6px 8px;
  border-radius: var(--radius-sm);
}

.btn-link:hover:not(:disabled) {
  background: rgba(0, 229, 255, 0.12);
}

.btn-link--danger {
  color: var(--color-danger);
}

.btn-link--muted {
  color: var(--color-text-muted);
}

button:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

button:focus-visible,
input:focus-visible {
  outline: 2px solid var(--color-cyan);
  outline-offset: 2px;
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
}
</style>
