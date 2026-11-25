<script setup lang="ts">
import { reactive, ref } from 'vue'
import { cambiarPassword } from '../api/auth'
import { ApiError } from '../api/client'
import { guardarSesion } from '../composables/useAuth'
import { useToast } from '../composables/useToast'
import BaseModal from './common/BaseModal.vue'

const emit = defineEmits<{ close: [] }>()
const { push: pushToast } = useToast()

const form = reactive({ actual: '', nueva: '', confirmar: '' })
const error = ref('')
const guardando = ref(false)

async function onSubmit() {
  error.value = ''
  if (!form.actual || !form.nueva) {
    error.value = 'Completa todos los campos.'
    return
  }
  if (form.nueva.length < 8 || !/[a-zA-Z]/.test(form.nueva) || !/\d/.test(form.nueva)) {
    error.value = 'La nueva contraseña debe tener al menos 8 caracteres, con letras y números.'
    return
  }
  if (form.nueva !== form.confirmar) {
    error.value = 'Las contraseñas nuevas no coinciden.'
    return
  }
  guardando.value = true
  try {
    // El backend cierra las demás sesiones y devuelve un token nuevo para esta.
    guardarSesion(await cambiarPassword({ password_actual: form.actual, password_nueva: form.nueva }))
    pushToast('Contraseña actualizada')
    emit('close')
  } catch (err) {
    error.value = err instanceof ApiError ? err.message : 'No fue posible cambiar la contraseña.'
  } finally {
    guardando.value = false
  }
}
</script>

<template>
  <BaseModal @close="emit('close')">
    <form class="pass-form" @submit.prevent="onSubmit">
      <h2>Cambiar contraseña</h2>
      <p class="hint">Se cerrará tu sesión en los demás dispositivos.</p>
      <label for="pass-actual">Contraseña actual</label>
      <input id="pass-actual" v-model="form.actual" type="password" autocomplete="current-password" />
      <label for="pass-nueva">Nueva contraseña</label>
      <input id="pass-nueva" v-model="form.nueva" type="password" autocomplete="new-password" />
      <label for="pass-confirmar">Repite la nueva contraseña</label>
      <input id="pass-confirmar" v-model="form.confirmar" type="password" autocomplete="new-password" />
      <p v-if="error" class="error" role="alert">{{ error }}</p>
      <div class="acciones">
        <button type="button" class="btn-secondary" :disabled="guardando" @click="emit('close')">Cancelar</button>
        <button type="submit" class="btn-primary" :disabled="guardando">
          {{ guardando ? 'Guardando…' : 'Guardar' }}
        </button>
      </div>
    </form>
  </BaseModal>
</template>

<style scoped>
.pass-form {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

h2 {
  margin: 0;
  font-size: 18px;
}

.hint {
  margin: 0 0 8px;
  font-size: 12.5px;
  color: var(--color-text-muted);
}

label {
  font-size: 12.5px;
  color: var(--color-text-muted);
  margin-top: 6px;
}

input {
  min-height: 44px;
  padding: 10px 12px;
  border-radius: var(--radius-md);
  border: 1px solid var(--color-border);
  background: var(--color-surface-alt);
  font-size: 16px;
}

input:focus {
  outline: none;
  border-color: var(--color-cyan);
}

.error {
  margin: 6px 0 0;
  font-size: 13px;
  color: var(--color-danger);
}

.acciones {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 14px;
}

.btn-primary,
.btn-secondary {
  min-height: 44px;
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

button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
</style>
