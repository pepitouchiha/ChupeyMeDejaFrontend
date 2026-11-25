<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { ApiError } from '../api/client'
import { useCaja } from '../composables/useCaja'
import { useCategoriasGasto } from '../composables/useCategoriasGasto'
import { useGastos } from '../composables/useGastos'
import { useToast } from '../composables/useToast'
import BaseModal from './common/BaseModal.vue'
import NumberInput from './common/NumberInput.vue'
import ToggleSwitch from './common/ToggleSwitch.vue'
import { hoyNegocio } from '../utils/fecha'
import type { CategoriaGasto, Gasto } from '../api/types'

const props = defineProps<{
  gasto: Gasto | null
}>()

const emit = defineEmits<{
  close: []
  saved: []
}>()

const { create, update, messageFor } = useGastos()
const { cerrada: cajaCerrada, cargarActual: cargarCaja } = useCaja()
const { push: pushToast } = useToast()
const { categorias, seleccionables, load: cargarCategorias } = useCategoriasGasto()

const esNomina = computed(() => props.gasto?.origen === 'nomina')
const esEdicion = computed(() => props.gasto !== null)

const form = reactive({
  fecha: props.gasto?.fecha ?? hoyNegocio(),
  categoria: (props.gasto?.categoria ?? '') as CategoriaGasto | '',
  descripcion: props.gasto?.descripcion ?? '',
  monto: (props.gasto?.monto ?? '') as number | '',
  pagado_desde_caja: props.gasto?.pagado_desde_caja ?? false,
})
const error = ref('')
const isSaving = ref(false)

onMounted(() => {
  void cargarCaja()
  if (categorias.value.length === 0) void cargarCategorias()
})

/** Activas + la actual del gasto aunque esté desactivada (para no perderla al editar). */
const opcionesCategoria = computed(() => {
  const actual = props.gasto?.categoria
  const lista = [...seleccionables.value]
  if (actual && !lista.some((c) => c.clave === actual)) {
    const existente = categorias.value.find((c) => c.clave === actual)
    lista.push(
      existente ?? {
        id: -1,
        clave: actual,
        nombre: props.gasto?.categoria_nombre ?? actual,
        color: props.gasto?.categoria_color ?? '#00e5ff',
        activa: false,
        sistema: false,
        seleccionable: true,
        num_gastos: 0,
      },
    )
  }
  return lista
})

async function onSubmit() {
  if (!form.fecha) {
    error.value = 'Indica la fecha del gasto.'
    return
  }
  if (!esNomina.value && form.categoria === '') {
    error.value = 'Selecciona una categoría.'
    return
  }
  if (!form.descripcion.trim()) {
    error.value = 'La descripción es obligatoria.'
    return
  }
  if (form.monto === '' || Number(form.monto) <= 0) {
    error.value = 'El monto debe ser mayor a 0.'
    return
  }

  isSaving.value = true
  error.value = ''
  try {
    const monto = Math.round(Number(form.monto))
    if (props.gasto === null) {
      await create({
        fecha: form.fecha,
        categoria: form.categoria as CategoriaGasto,
        descripcion: form.descripcion.trim(),
        monto,
        pagado_desde_caja: form.pagado_desde_caja,
      })
      pushToast('Gasto registrado')
    } else {
      await update(props.gasto.id, {
        fecha: form.fecha,
        ...(esNomina.value ? {} : { categoria: form.categoria as CategoriaGasto }),
        descripcion: form.descripcion.trim(),
        monto,
        pagado_desde_caja: form.pagado_desde_caja,
      })
      pushToast(esNomina.value ? 'Pago actualizado' : 'Gasto actualizado')
    }
    emit('saved')
  } catch (err) {
    const msg = messageFor(err, 'No fue posible guardar el gasto.')
    error.value = msg
    if (err instanceof ApiError && err.status === 409) {
      pushToast(msg, 'error')
      void cargarCaja()
    }
  } finally {
    isSaving.value = false
  }
}
</script>

<template>
  <BaseModal @close="!isSaving && emit('close')">
    <form class="gasto-form" @submit.prevent="onSubmit">
      <h2>{{ esNomina ? 'Editar pago' : esEdicion ? 'Editar gasto' : 'Nuevo gasto' }}</h2>

      <div class="form-grid">
        <div class="form-row">
          <label for="gasto-fecha">Fecha</label>
          <input id="gasto-fecha" v-model="form.fecha" type="date" :disabled="isSaving" />
        </div>
        <div v-if="!esNomina" class="form-row">
          <label for="gasto-categoria">Categoría</label>
          <select id="gasto-categoria" v-model="form.categoria" :disabled="isSaving">
            <option value="" disabled>Selecciona una categoría</option>
            <option v-for="c in opcionesCategoria" :key="c.clave" :value="c.clave">
              {{ c.nombre }}{{ c.activa ? '' : ' (desactivada)' }}
            </option>
          </select>
        </div>
      </div>

      <div class="form-row">
        <label for="gasto-descripcion">Descripción</label>
        <input
          id="gasto-descripcion"
          v-model="form.descripcion"
          type="text"
          maxlength="255"
          placeholder="Ej. Bolsas para granizado"
          :disabled="isSaving"
        />
      </div>

      <div class="form-row">
        <label for="gasto-monto">Monto (COP)</label>
        <NumberInput
          id="gasto-monto"
          v-model="form.monto"
          :min="1"
          :step="1000"
          placeholder="Ej. 25000"
          :disabled="isSaving"
        />
      </div>

      <div class="switch-line">
        <ToggleSwitch
          v-model="form.pagado_desde_caja"
          :disabled="isSaving"
          aria-label="Pagado con efectivo de la caja"
        />
        <span class="switch-line__label">Pagado con efectivo de la caja</span>
      </div>
      <p v-if="form.pagado_desde_caja && cajaCerrada" class="hint hint--warn">
        La caja está cerrada: para registrar un pago desde caja primero ábrela en la sección Caja.
      </p>

      <p v-if="error" class="error" role="alert">{{ error }}</p>

      <div class="form-actions">
        <button type="button" class="btn-secondary" :disabled="isSaving" @click="emit('close')">
          Cancelar
        </button>
        <button type="submit" class="btn-primary" :disabled="isSaving">
          {{ isSaving ? 'Guardando…' : 'Guardar' }}
        </button>
      </div>
    </form>
  </BaseModal>
</template>

<style scoped>
.gasto-form {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.gasto-form h2 {
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

.form-row :deep(.number-input__field) {
  padding: 10px 12px;
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

.hint {
  margin: 0;
  font-size: 12px;
  color: var(--color-text-muted);
}

.hint--warn {
  color: var(--color-orange);
}

.error {
  margin: 0;
  font-size: 13px;
  color: var(--color-danger);
}

.form-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
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
</style>
