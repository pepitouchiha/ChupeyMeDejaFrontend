<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue'

withDefaults(defineProps<{ wide?: boolean }>(), { wide: false })

const emit = defineEmits<{ close: [] }>()

function onOverlayClick() {
  emit('close')
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    emit('close')
  }
}

onMounted(() => {
  window.addEventListener('keydown', onKeydown)
})

onUnmounted(() => {
  window.removeEventListener('keydown', onKeydown)
})
</script>

<template>
  <Teleport to="body">
    <div class="modal-overlay" @click.self="onOverlayClick">
      <div class="modal-card" :class="{ 'modal-card--wide': wide }" role="dialog" aria-modal="true">
        <slot />
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(4, 1, 8, 0.72);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  z-index: 100;
}

.modal-card {
  width: min(440px, 92vw);
  max-height: 90vh;
  overflow-y: auto;
  padding: 24px;
  border-radius: var(--radius-lg);
  background: var(--color-surface);
  border: 1px solid var(--color-border-soft);
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
}
.modal-card--wide {
  width: min(720px, 94vw);
}

/* Celular: el modal sube desde abajo y ocupa el ancho completo. */
@media (max-width: 600px) {
  .modal-overlay {
    align-items: flex-end;
    padding: 0;
  }

  .modal-card,
  .modal-card--wide {
    width: 100%;
    max-height: 92dvh;
    border-radius: 16px 16px 0 0;
    padding: 20px 16px calc(20px + env(safe-area-inset-bottom));
  }
}
</style>
