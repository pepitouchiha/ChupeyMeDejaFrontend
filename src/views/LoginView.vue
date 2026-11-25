<script setup lang="ts">
import { ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { login } from '../api/auth'
import { ApiError } from '../api/client'
import { guardarSesion } from '../composables/useAuth'
import logoChupeyMeDeja from '../assets/brand/logo-chupeymedeja.png'

const route = useRoute()
const router = useRouter()

const email = ref('')
const password = ref('')
const errorMessage = ref('')
const isSubmitting = ref(false)

async function onSubmit() {
  errorMessage.value = ''

  if (!email.value.trim() || !password.value) {
    errorMessage.value = 'Correo y contraseña son obligatorios.'
    return
  }

  isSubmitting.value = true
  try {
    const response = await login({ email: email.value.trim(), password: password.value })
    guardarSesion(response)
    const redirect =
      typeof route.query.redirect === 'string' && route.query.redirect.startsWith('/')
        ? route.query.redirect
        : '/dashboard'
    router.push(redirect)
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) {
      errorMessage.value = 'Correo o contraseña incorrectos.'
    } else if (err instanceof ApiError && (err.status === 403 || err.status === 429)) {
      errorMessage.value = err.message
    } else if (err instanceof ApiError && err.status === 0) {
      errorMessage.value = 'No hay conexión con el servidor. Revisa tu internet e intenta de nuevo.'
    } else {
      errorMessage.value = 'No fue posible iniciar sesión. Intenta de nuevo.'
    }
  } finally {
    isSubmitting.value = false
  }
}
</script>

<template>
  <section class="login-card">
    <img class="brand-logo" :src="logoChupeyMeDeja" alt="Chupe y Me Deja" width="190" height="210" />
    <p class="subtitle">Ingresa con la cuenta que te entregaron</p>

    <form @submit.prevent="onSubmit">
      <div class="field">
        <label for="login-email">Correo electrónico</label>
        <input
          id="login-email"
          v-model="email"
          type="email"
          autocomplete="username"
          placeholder="tucorreo@ejemplo.com"
          inputmode="email"
          autocapitalize="off"
          :disabled="isSubmitting"
        />
      </div>

      <div class="field">
        <label for="login-pass">Contraseña</label>
        <input
          id="login-pass"
          v-model="password"
          type="password"
          autocomplete="current-password"
          placeholder="••••••••"
          :disabled="isSubmitting"
        />
      </div>

      <p v-if="errorMessage" class="error" role="alert">{{ errorMessage }}</p>

      <button type="submit" class="submit" :disabled="isSubmitting">
        {{ isSubmitting ? 'Ingresando…' : 'Iniciar sesión' }}
      </button>
    </form>

    <p class="footer">Chupe y Me Deja · Asunción y Machado, Copacabana</p>
  </section>
</template>

<style scoped>
.login-card {
  width: min(380px, 100%);
  padding: 38px 32px;
  border-radius: 20px;
  background: var(--color-surface-alt);
  border: 1px solid var(--color-border);
  box-shadow: 0 0 50px rgba(123, 44, 191, 0.35), 0 20px 50px rgba(0, 0, 0, 0.5);
}

.brand-logo {
  display: block;
  width: 190px;
  height: auto;
  margin: 0 auto 10px;
}

.subtitle {
  font-size: 13px;
  color: var(--color-text-muted);
  margin: 0 0 26px;
  text-align: center;
}

.field {
  margin-bottom: 14px;
}

.field label {
  display: block;
  font-size: 12.5px;
  color: var(--color-text-muted);
  margin-bottom: 6px;
}

.field input {
  width: 100%;
  min-height: 46px;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  padding: 11px 13px;
  font-size: 16px; /* 16px evita el zoom automático en iPhone */
}

.field input:focus {
  outline: none;
  border-color: var(--color-cyan);
  box-shadow: 0 0 0 3px rgba(0, 229, 255, 0.18);
}

.field input:disabled {
  opacity: 0.6;
}

.error {
  margin: 0 0 14px;
  font-size: 13px;
  color: var(--color-danger);
}

.submit {
  width: 100%;
  padding: 12px;
  border: none;
  border-radius: var(--radius-md);
  cursor: pointer;
  font-weight: 600;
  font-size: 14.5px;
  color: #fff;
  background: linear-gradient(90deg, var(--color-purple), var(--color-purple-deep));
  box-shadow: 0 0 24px rgba(123, 44, 191, 0.55);
}

.submit:disabled {
  cursor: not-allowed;
  opacity: 0.7;
}

.footer {
  font-size: 11.5px;
  text-align: center;
  margin: 16px 0 0;
  color: var(--color-text-muted);
  opacity: 0.7;
}

@media (max-width: 480px) {
  .login-card {
    padding: 28px 20px;
    border-radius: 16px;
  }

  .brand-logo {
    width: 150px;
  }
}
</style>
