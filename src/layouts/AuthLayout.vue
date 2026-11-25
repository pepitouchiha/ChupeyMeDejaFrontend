<template>
  <div class="auth-shell">
    <RouterView />
  </div>
</template>

<style scoped>
.auth-shell {
  min-height: 100svh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px max(16px, env(safe-area-inset-right)) 24px max(16px, env(safe-area-inset-left));
  background: var(--color-bg);
}
</style>
