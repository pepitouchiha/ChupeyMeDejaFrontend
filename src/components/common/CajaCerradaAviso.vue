<script setup lang="ts">
import { RouterLink } from 'vue-router'
</script>

<template>
  <div class="caja-aviso" role="alert">
    <span class="caja-aviso__texto">
      La caja está cerrada. Ábrela para registrar ventas y cobros.
    </span>
    <RouterLink to="/caja" class="caja-aviso__btn">Abrir caja</RouterLink>
  </div>
</template>

<style scoped>
.caja-aviso {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 10px;
  padding: 10px 14px;
  border-radius: var(--radius-md);
  border: 1px solid var(--color-orange);
  background: rgba(255, 138, 30, 0.1);
}

.caja-aviso__texto {
  font-size: 13px;
  color: var(--color-text);
}

.caja-aviso__btn {
  padding: 8px 14px;
  border-radius: var(--radius-md);
  text-decoration: none;
  font-weight: 600;
  font-size: 13px;
  color: #fff;
  background: linear-gradient(90deg, var(--color-purple), var(--color-purple-deep));
}

.caja-aviso__btn:focus-visible {
  outline: 2px solid var(--color-cyan);
  outline-offset: 2px;
}
</style>
