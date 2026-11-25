<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import {
  CONFIGURACION_POR_DEFECTO,
  useConfiguracionNegocio,
} from '../composables/useConfiguracionNegocio'
import { useImpresion } from '../composables/useImpresion'
import { useToast } from '../composables/useToast'
import ToggleSwitch from '../components/common/ToggleSwitch.vue'
import IconPrinter from '../components/icons/IconPrinter.vue'
import type { AnchoPapelMm, ConfiguracionNegocio } from '../api/types'

const { configuracion, isLoading, isSaving, loadError, load, save, messageFor } =
  useConfiguracionNegocio()
const { imprimirPrueba } = useImpresion()
const { push: pushToast } = useToast()

const anchosPapel: AnchoPapelMm[] = [58, 80]

interface FormState {
  nombre_negocio: string
  nit: string
  direccion: string
  telefono: string
  mensaje_pie: string
  imprimir_comanda_auto: boolean
  imprimir_factura_auto: boolean
  ancho_papel_mm: AnchoPapelMm
}

const form = reactive<FormState>({
  nombre_negocio: CONFIGURACION_POR_DEFECTO.nombre_negocio,
  nit: '',
  direccion: '',
  telefono: '',
  mensaje_pie: '',
  imprimir_comanda_auto: true,
  imprimir_factura_auto: false,
  ancho_papel_mm: 80,
})
const formError = ref('')
const loaded = ref(false)

function aplicar(config: ConfiguracionNegocio) {
  form.nombre_negocio = config.nombre_negocio
  form.nit = config.nit ?? ''
  form.direccion = config.direccion ?? ''
  form.telefono = config.telefono ?? ''
  form.mensaje_pie = config.mensaje_pie ?? ''
  form.imprimir_comanda_auto = config.imprimir_comanda_auto
  form.imprimir_factura_auto = config.imprimir_factura_auto
  form.ancho_papel_mm = config.ancho_papel_mm
}

function aPayload(): ConfiguracionNegocio {
  const opcional = (v: string): string | null => v.trim() || null
  return {
    nombre_negocio: form.nombre_negocio.trim(),
    nit: opcional(form.nit),
    direccion: opcional(form.direccion),
    telefono: opcional(form.telefono),
    mensaje_pie: opcional(form.mensaje_pie),
    imprimir_comanda_auto: form.imprimir_comanda_auto,
    imprimir_factura_auto: form.imprimir_factura_auto,
    ancho_papel_mm: form.ancho_papel_mm,
  }
}

async function cargar() {
  await load()
  if (configuracion.value) {
    aplicar(configuracion.value)
    loaded.value = true
  }
}

onMounted(cargar)

async function onSubmit() {
  formError.value = ''
  if (!form.nombre_negocio.trim()) {
    formError.value = 'El nombre del negocio es obligatorio.'
    return
  }
  try {
    const guardada = await save(aPayload())
    aplicar(guardada)
    pushToast('Configuración guardada')
  } catch (err) {
    formError.value = messageFor(err, 'No fue posible guardar la configuración.')
  }
}

function onImprimirPrueba() {
  void imprimirPrueba(aPayload())
}
</script>

<template>
  <section class="view">
    <header class="view-header">
      <h1>Configuración</h1>
    </header>

    <p v-if="isLoading" class="status">Cargando configuración…</p>
    <div v-else-if="loadError" class="error-block">
      <p class="error" role="alert">{{ loadError }}</p>
      <button type="button" class="btn-secondary" @click="cargar">Reintentar</button>
    </div>

    <form v-else-if="loaded" class="config-form" @submit.prevent="onSubmit">
      <section class="card">
        <h2>Datos del negocio</h2>
        <p class="hint">Aparecen en el encabezado y pie de la factura.</p>

        <div class="form-row">
          <label for="cfg-nombre">Nombre del negocio</label>
          <input id="cfg-nombre" v-model="form.nombre_negocio" type="text" maxlength="100" required />
        </div>
        <div class="form-grid">
          <div class="form-row">
            <label for="cfg-nit">NIT</label>
            <input id="cfg-nit" v-model="form.nit" type="text" maxlength="30" />
          </div>
          <div class="form-row">
            <label for="cfg-telefono">Teléfono</label>
            <input id="cfg-telefono" v-model="form.telefono" type="text" maxlength="30" />
          </div>
        </div>
        <div class="form-row">
          <label for="cfg-direccion">Dirección</label>
          <input id="cfg-direccion" v-model="form.direccion" type="text" maxlength="200" />
        </div>
        <div class="form-row">
          <label for="cfg-pie">Mensaje de pie</label>
          <input id="cfg-pie" v-model="form.mensaje_pie" type="text" maxlength="200" />
        </div>
      </section>

      <section class="card">
        <h2>Impresión</h2>

        <div class="form-row">
          <label>Ancho del papel</label>
          <div class="segmented" role="radiogroup" aria-label="Ancho del papel">
            <button
              v-for="ancho in anchosPapel"
              :key="ancho"
              type="button"
              role="radio"
              class="segmented-option"
              :aria-checked="form.ancho_papel_mm === ancho"
              :class="{ 'segmented-option--active': form.ancho_papel_mm === ancho }"
              @click="form.ancho_papel_mm = ancho"
            >
              {{ ancho }} mm
            </button>
          </div>
        </div>

        <div class="toggle-row">
          <div>
            <span class="toggle-title">Imprimir comanda automáticamente</span>
            <span class="hint">En ventas directas, al confirmar. En pedidos de mesa, al enviar la comanda o al cerrar el panel con productos pendientes.</span>
          </div>
          <ToggleSwitch v-model="form.imprimir_comanda_auto" aria-label="Imprimir comanda automáticamente" />
        </div>
        <div class="toggle-row">
          <div>
            <span class="toggle-title">Imprimir factura automáticamente</span>
            <span class="hint">Al cobrar. Si está apagado, se ofrece un botón para imprimirla.</span>
          </div>
          <ToggleSwitch v-model="form.imprimir_factura_auto" aria-label="Imprimir factura automáticamente" />
        </div>
      </section>

      <p v-if="formError" class="error" role="alert">{{ formError }}</p>

      <div class="actions">
        <button type="button" class="btn-secondary btn-with-icon" @click="onImprimirPrueba">
          <IconPrinter />
          Imprimir prueba
        </button>
        <button type="submit" class="btn-primary" :disabled="isSaving">
          {{ isSaving ? 'Guardando…' : 'Guardar cambios' }}
        </button>
      </div>
    </form>
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

.config-form {
  display: flex;
  flex-direction: column;
  gap: 16px;
  max-width: 680px;
}

.card {
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 18px;
  background: var(--color-surface);
  border: 1px solid var(--color-border-soft);
  border-radius: var(--radius-lg);
}

.card h2 {
  margin: 0;
  font-size: 15px;
  color: var(--color-text);
}

.hint {
  display: block;
  margin: 0;
  font-size: 12.5px;
  color: var(--color-text-muted);
}

.form-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px;
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

.form-row input {
  background: var(--color-bg);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  padding: 10px 12px;
  font-size: 14px;
  color: var(--color-text);
}

.form-row input:focus-visible {
  outline: 2px solid var(--color-cyan);
  outline-offset: 1px;
}

.segmented {
  display: inline-flex;
  align-self: flex-start;
  gap: 4px;
  padding: 4px;
  background: var(--color-bg);
  border: 1px solid var(--color-border-soft);
  border-radius: var(--radius-md);
}

.segmented-option {
  padding: 8px 18px;
  border: 1px solid transparent;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--color-text-muted);
  font-size: 13.5px;
  cursor: pointer;
}

.segmented-option--active {
  color: var(--color-cyan);
  background: rgba(0, 229, 255, 0.12);
  border-color: var(--color-cyan);
}

.toggle-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding-top: 12px;
  border-top: 1px solid var(--color-border-soft);
}

.toggle-title {
  display: block;
  font-size: 14px;
  color: var(--color-text);
}

.actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}

.error-block {
  display: flex;
  flex-direction: column;
  gap: 10px;
  align-items: flex-start;
}

.error {
  color: var(--color-danger);
  font-size: 13px;
  margin: 0;
}

.status {
  color: var(--color-text-muted);
  font-size: 14px;
  margin: 0;
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

.btn-with-icon {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

@media (max-width: 600px) {
  .form-grid {
    grid-template-columns: 1fr;
  }
}
</style>
