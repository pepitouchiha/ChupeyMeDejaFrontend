<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import {
  createSede,
  createUsuario,
  deleteUsuario,
  getSesion,
  listSedes,
  listUsuarios,
  restablecerPassword,
  updateSede,
  updateUsuario,
} from '../api/auth'
import { ApiError } from '../api/client'
import type { RolAsignable, SedeResumen, UsuarioSesion } from '../api/types'
import BaseModal from '../components/common/BaseModal.vue'
import ConfirmModal from '../components/common/ConfirmModal.vue'
import { guardarSesion, useAuth } from '../composables/useAuth'
import { useToast } from '../composables/useToast'

/*
 * Quién gestiona qué cuentas (lo valida el backend; aquí solo se adapta la pantalla):
 * - Super admin: sedes, dueños, administradores y cajeros.
 * - Dueño: cajeros de cualquier sede.
 * - Administrador: cajeros de su sede.
 */

const { push: pushToast } = useToast()
const { usuario: yo, esSuperadmin, esGlobal, sedes: sedesSesion } = useAuth()

const usuarios = ref<UsuarioSesion[]>([])
const sedes = ref<SedeResumen[]>([])
const cargando = ref(true)
const errorCarga = ref('')
const filtroSede = ref<number | 'todas'>('todas')

const ROLES: { valor: RolAsignable; etiqueta: string; descripcion: string }[] = [
  {
    valor: 'dueno',
    etiqueta: 'Dueño',
    descripcion: 'Ve y opera todas las sedes, y puede crear cajeros en cualquiera.',
  },
  {
    valor: 'administrador',
    etiqueta: 'Administrador',
    descripcion: 'Maneja todo en su sede: menú, inventario, gastos, personal y contabilidad. Crea cajeros de su sede.',
  },
  {
    valor: 'cajero',
    etiqueta: 'Cajero',
    descripcion: 'Vende, atiende mesas, abre y cierra la caja. No ve contabilidad ni edita el menú.',
  },
]
const ROL_ETIQUETA: Record<string, string> = {
  superadmin: 'Super admin',
  dueno: 'Dueño',
  administrador: 'Administrador',
  cajero: 'Cajero',
}

const rolesPermitidos = computed(() =>
  esSuperadmin.value ? ROLES : ROLES.filter((r) => r.valor === 'cajero'),
)

function puedeGestionar(u: UsuarioSesion): boolean {
  if (!yo.value || u.rol === 'superadmin' || u.id === yo.value.id) return false
  if (esSuperadmin.value) return true
  if (u.rol !== 'cajero') return false
  if (yo.value.rol === 'dueno') return true
  return yo.value.rol === 'administrador' && u.sede_id === yo.value.sede_id
}

const titulo = computed(() => (esSuperadmin.value ? 'Usuarios y sedes' : 'Usuarios'))
const subtitulo = computed(() => {
  if (esSuperadmin.value) return 'Crea las sedes y las cuentas de dueños, administradores y cajeros.'
  if (yo.value?.rol === 'dueno') return 'Crea y administra los cajeros de cualquier sede.'
  return `Crea y administra los cajeros de ${yo.value?.sede_nombre ?? 'tu sede'}.`
})

function mensaje(err: unknown, porDefecto: string): string {
  return err instanceof ApiError && err.status !== 0 ? err.message : porDefecto
}

async function cargar() {
  cargando.value = true
  errorCarga.value = ''
  try {
    const [u, s] = await Promise.all([
      listUsuarios(),
      esGlobal.value ? listSedes() : Promise.resolve(sedesSesion.value),
    ])
    usuarios.value = u
    sedes.value = s
  } catch (err) {
    errorCarga.value = mensaje(err, 'No fue posible cargar los usuarios.')
  } finally {
    cargando.value = false
  }
}

onMounted(cargar)

const usuariosFiltrados = computed(() =>
  usuarios.value.filter(
    (u) => filtroSede.value === 'todas' || u.sede_id === filtroSede.value || u.sede_id === null,
  ),
)
const hayPersonal = computed(() => usuarios.value.some((u) => u.id !== yo.value?.id))

function nombreSede(id: number | null): string {
  if (id === null) return 'Todas las sedes'
  return sedes.value.find((s) => s.id === id)?.nombre ?? '—'
}

// ---------- Crear / editar usuario

const formAbierto = ref(false)
const editando = ref<UsuarioSesion | null>(null)
const form = reactive({
  nombre: '',
  email: '',
  password: '',
  rol: 'cajero' as RolAsignable,
  sede_id: 0,
  activo: true,
})
const formError = ref('')
const guardando = ref(false)

/** El administrador solo puede usar su propia sede. */
const sedeFija = computed(() => yo.value?.rol === 'administrador')

function sedeInicial(): number {
  if (sedeFija.value) return yo.value?.sede_id ?? 0
  return sedes.value.find((s) => s.activa)?.id ?? sedes.value[0]?.id ?? 0
}

function abrirCrear() {
  editando.value = null
  Object.assign(form, {
    nombre: '',
    email: '',
    password: '',
    rol: 'cajero',
    sede_id: sedeInicial(),
    activo: true,
  })
  formError.value = ''
  formAbierto.value = true
}

function abrirEditar(u: UsuarioSesion) {
  editando.value = u
  Object.assign(form, {
    nombre: u.nombre,
    email: u.email,
    password: '',
    rol: u.rol === 'superadmin' ? 'dueno' : u.rol,
    sede_id: u.sede_id ?? sedeInicial(),
    activo: u.activo,
  })
  formError.value = ''
  formAbierto.value = true
}

function passwordValida(p: string): boolean {
  return p.length >= 8 && /[a-zA-Z]/.test(p) && /\d/.test(p)
}

async function guardarUsuario() {
  formError.value = ''
  if (!form.nombre.trim()) {
    formError.value = 'Escribe el nombre.'
    return
  }
  const necesitaSede = form.rol !== 'dueno'
  if (necesitaSede && !form.sede_id) {
    formError.value = 'Elige la sede.'
    return
  }
  const sedeId = necesitaSede ? form.sede_id : null
  guardando.value = true
  try {
    if (editando.value) {
      const actualizado = await updateUsuario(editando.value.id, {
        nombre: form.nombre.trim(),
        rol: form.rol,
        sede_id: sedeId,
        activo: form.activo,
      })
      usuarios.value = usuarios.value.map((u) => (u.id === actualizado.id ? actualizado : u))
      pushToast('Usuario actualizado')
    } else {
      if (!form.email.includes('@')) {
        formError.value = 'Escribe un correo válido.'
        return
      }
      if (!passwordValida(form.password)) {
        formError.value = 'La contraseña debe tener al menos 8 caracteres, con letras y números.'
        return
      }
      const nuevo = await createUsuario({
        nombre: form.nombre.trim(),
        email: form.email.trim(),
        password: form.password,
        rol: form.rol,
        sede_id: sedeId,
      })
      usuarios.value = [...usuarios.value, nuevo]
      pushToast('Cuenta creada. Compártele su correo y contraseña.')
    }
    formAbierto.value = false
  } catch (err) {
    formError.value = mensaje(err, 'No fue posible guardar el usuario.')
  } finally {
    guardando.value = false
  }
}

// ---------- Restablecer contraseña

const resetUsuario = ref<UsuarioSesion | null>(null)
const resetPassword = ref('')
const resetError = ref('')

function abrirReset(u: UsuarioSesion) {
  resetUsuario.value = u
  resetPassword.value = ''
  resetError.value = ''
}

async function guardarReset() {
  if (!resetUsuario.value) return
  if (!passwordValida(resetPassword.value)) {
    resetError.value = 'Mínimo 8 caracteres, con letras y números.'
    return
  }
  guardando.value = true
  try {
    await restablecerPassword(resetUsuario.value.id, resetPassword.value)
    pushToast(`Contraseña de ${resetUsuario.value.nombre} actualizada`)
    resetUsuario.value = null
  } catch (err) {
    resetError.value = mensaje(err, 'No fue posible cambiar la contraseña.')
  } finally {
    guardando.value = false
  }
}

// ---------- Eliminar

const eliminarUsuarioSel = ref<UsuarioSesion | null>(null)
const eliminarError = ref('')

function pedirEliminar(u: UsuarioSesion) {
  eliminarUsuarioSel.value = u
  eliminarError.value = ''
}

async function confirmarEliminar() {
  if (!eliminarUsuarioSel.value) return
  const u = eliminarUsuarioSel.value
  try {
    await deleteUsuario(u.id)
    usuarios.value = usuarios.value.filter((x) => x.id !== u.id)
    pushToast('Usuario eliminado')
    eliminarUsuarioSel.value = null
  } catch (err) {
    eliminarError.value = mensaje(err, 'No fue posible eliminar el usuario.')
  }
}

// ---------- Sedes (solo super admin)

const sedeFormAbierto = ref(false)
const sedeEditando = ref<SedeResumen | null>(null)
const sedeForm = reactive({ nombre: '', direccion: '', activa: true })
const sedeError = ref('')

function abrirSede(s: SedeResumen | null) {
  sedeEditando.value = s
  Object.assign(sedeForm, {
    nombre: s?.nombre ?? '',
    direccion: s?.direccion ?? '',
    activa: s?.activa ?? true,
  })
  sedeError.value = ''
  sedeFormAbierto.value = true
}

async function guardarSede() {
  sedeError.value = ''
  if (!sedeForm.nombre.trim()) {
    sedeError.value = 'Escribe el nombre de la sede.'
    return
  }
  guardando.value = true
  try {
    const payload = { nombre: sedeForm.nombre.trim(), direccion: sedeForm.direccion.trim() || null }
    if (sedeEditando.value) {
      const s = await updateSede(sedeEditando.value.id, { ...payload, activa: sedeForm.activa })
      sedes.value = sedes.value.map((x) => (x.id === s.id ? s : x))
    } else {
      sedes.value = [...sedes.value, await createSede(payload)]
    }
    pushToast('Sede guardada')
    sedeFormAbierto.value = false
  } catch (err) {
    sedeError.value = mensaje(err, 'No fue posible guardar la sede.')
    return
  } finally {
    guardando.value = false
  }
  // Actualiza el selector de sede del menú; si falla, la sede ya quedó guardada.
  try {
    guardarSesion(await getSesion())
  } catch {
    /* se actualizará en la próxima carga de la app */
  }
}
</script>

<template>
  <section class="view">
    <header class="view-header">
      <div>
        <h1>{{ titulo }}</h1>
        <p class="subtitle">{{ subtitulo }}</p>
      </div>
      <button type="button" class="btn-primary" :disabled="cargando || !sedes.length" @click="abrirCrear">
        {{ esSuperadmin ? '+ Nuevo usuario' : '+ Nuevo cajero' }}
      </button>
    </header>

    <p v-if="cargando" class="status">Cargando…</p>
    <p v-else-if="errorCarga" class="error" role="alert">{{ errorCarga }}</p>

    <template v-else>
      <section v-if="esSuperadmin" class="bloque">
        <div class="bloque-head">
          <h2>Sedes</h2>
          <button type="button" class="btn-secondary" @click="abrirSede(null)">+ Nueva sede</button>
        </div>
        <p v-if="!sedes.length" class="aviso">
          Todavía no hay sedes. Crea la primera para poder cargar menú, mesas y personal.
        </p>
        <ul class="sedes">
          <li v-for="s in sedes" :key="s.id" class="sede" :class="{ 'sede--inactiva': !s.activa }">
            <div class="sede-info">
              <strong>{{ s.nombre }}</strong>
              <span>{{ s.direccion || 'Sin dirección' }}</span>
            </div>
            <span class="chip" :class="s.activa ? 'chip--ok' : 'chip--off'">
              {{ s.activa ? 'Activa' : 'Inactiva' }}
            </span>
            <button type="button" class="btn-link" @click="abrirSede(s)">Editar</button>
          </li>
        </ul>
      </section>

      <section class="bloque">
        <div class="bloque-head">
          <h2>Cuentas</h2>
          <label v-if="esGlobal && sedes.length > 1" class="filtro">
            <span class="sr-only">Filtrar por sede</span>
            <select v-model="filtroSede">
              <option value="todas">Todas las sedes</option>
              <option v-for="s in sedes" :key="s.id" :value="s.id">{{ s.nombre }}</option>
            </select>
          </label>
        </div>

        <p v-if="!hayPersonal" class="status">
          Todavía no hay otras cuentas. Usa
          <strong>{{ esSuperadmin ? '+ Nuevo usuario' : '+ Nuevo cajero' }}</strong> para crear la primera.
        </p>

        <ul class="usuarios">
          <li
            v-for="u in usuariosFiltrados"
            :key="u.id"
            class="usuario"
            :class="{ 'usuario--inactivo': !u.activo }"
          >
            <div class="usuario-info">
              <strong>
                {{ u.nombre || u.email }}
                <span v-if="u.id === yo?.id" class="tu">(tú)</span>
              </strong>
              <span class="email">{{ u.email }}</span>
            </div>
            <div class="usuario-meta">
              <span class="chip" :class="`chip--${u.rol}`">{{ ROL_ETIQUETA[u.rol] }}</span>
              <span class="sede-nombre">{{ nombreSede(u.sede_id) }}</span>
              <span v-if="!u.activo" class="chip chip--off">Desactivado</span>
            </div>
            <div v-if="puedeGestionar(u)" class="usuario-acciones">
              <button type="button" class="btn-link" @click="abrirEditar(u)">Editar</button>
              <button type="button" class="btn-link" @click="abrirReset(u)">Contraseña</button>
              <button type="button" class="btn-link btn-link--danger" @click="pedirEliminar(u)">Eliminar</button>
            </div>
          </li>
        </ul>
      </section>
    </template>

    <BaseModal v-if="formAbierto" @close="formAbierto = false">
      <form class="form" @submit.prevent="guardarUsuario">
        <h2>{{ editando ? 'Editar cuenta' : esSuperadmin ? 'Nueva cuenta' : 'Nuevo cajero' }}</h2>
        <label for="u-nombre">Nombre</label>
        <input id="u-nombre" v-model="form.nombre" type="text" autocomplete="off" />
        <template v-if="!editando">
          <label for="u-email">Correo (con este inicia sesión)</label>
          <input id="u-email" v-model="form.email" type="email" inputmode="email" autocapitalize="off" autocomplete="off" />
          <label for="u-pass">Contraseña inicial</label>
          <input id="u-pass" v-model="form.password" type="text" autocomplete="off" />
          <p class="hint">Mínimo 8 caracteres, con letras y números. La persona la puede cambiar después.</p>
        </template>
        <p v-else class="hint">Correo: {{ form.email }}</p>

        <template v-if="rolesPermitidos.length > 1">
          <span class="label">Rol</span>
          <div class="roles">
            <label
              v-for="r in rolesPermitidos"
              :key="r.valor"
              class="rol"
              :class="{ 'rol--sel': form.rol === r.valor }"
            >
              <input v-model="form.rol" type="radio" name="rol" :value="r.valor" />
              <span>
                <strong>{{ r.etiqueta }}</strong>
                <small>{{ r.descripcion }}</small>
              </span>
            </label>
          </div>
        </template>

        <template v-if="form.rol !== 'dueno'">
          <label for="u-sede">Sede</label>
          <select id="u-sede" v-model.number="form.sede_id" :disabled="sedeFija">
            <option v-for="s in sedes" :key="s.id" :value="s.id" :disabled="!s.activa">
              {{ s.activa ? s.nombre : `${s.nombre} (inactiva)` }}
            </option>
          </select>
        </template>
        <p v-else class="hint">El dueño ve todas las sedes; no se le asigna una.</p>

        <label v-if="editando" class="check">
          <input v-model="form.activo" type="checkbox" />
          Cuenta activa (si la desactivas, no puede iniciar sesión)
        </label>

        <p v-if="formError" class="error" role="alert">{{ formError }}</p>
        <div class="acciones">
          <button type="button" class="btn-secondary" :disabled="guardando" @click="formAbierto = false">
            Cancelar
          </button>
          <button type="submit" class="btn-primary" :disabled="guardando">
            {{ guardando ? 'Guardando…' : 'Guardar' }}
          </button>
        </div>
      </form>
    </BaseModal>

    <BaseModal v-if="resetUsuario" @close="resetUsuario = null">
      <form class="form" @submit.prevent="guardarReset">
        <h2>Nueva contraseña para {{ resetUsuario.nombre }}</h2>
        <p class="hint">Su sesión abierta se cerrará y tendrá que entrar con la nueva contraseña.</p>
        <label for="reset-pass">Nueva contraseña</label>
        <input id="reset-pass" v-model="resetPassword" type="text" autocomplete="off" />
        <p v-if="resetError" class="error" role="alert">{{ resetError }}</p>
        <div class="acciones">
          <button type="button" class="btn-secondary" @click="resetUsuario = null">Cancelar</button>
          <button type="submit" class="btn-primary" :disabled="guardando">Guardar</button>
        </div>
      </form>
    </BaseModal>

    <BaseModal v-if="sedeFormAbierto" @close="sedeFormAbierto = false">
      <form class="form" @submit.prevent="guardarSede">
        <h2>{{ sedeEditando ? 'Editar sede' : 'Nueva sede' }}</h2>
        <label for="s-nombre">Nombre</label>
        <input id="s-nombre" v-model="sedeForm.nombre" type="text" />
        <label for="s-dir">Dirección o barrio</label>
        <input id="s-dir" v-model="sedeForm.direccion" type="text" />
        <label v-if="sedeEditando" class="check">
          <input v-model="sedeForm.activa" type="checkbox" />
          Sede activa (si la desactivas, su personal no puede entrar)
        </label>
        <p v-if="!sedeEditando" class="hint">
          La sede nueva empieza vacía: hay que cargarle menú, insumos y mesas.
        </p>
        <p v-if="sedeError" class="error" role="alert">{{ sedeError }}</p>
        <div class="acciones">
          <button type="button" class="btn-secondary" @click="sedeFormAbierto = false">Cancelar</button>
          <button type="submit" class="btn-primary" :disabled="guardando">Guardar</button>
        </div>
      </form>
    </BaseModal>

    <ConfirmModal
      v-if="eliminarUsuarioSel"
      title="Eliminar cuenta"
      :message="`¿Eliminar la cuenta de ${eliminarUsuarioSel.nombre}? Si solo quieres quitarle el acceso por un tiempo, mejor desactívala.`"
      confirm-text="Eliminar"
      :error-message="eliminarError"
      @confirm="confirmarEliminar"
      @cancel="eliminarUsuarioSel = null"
    />
  </section>
</template>

<style scoped>
.view {
  display: flex;
  flex-direction: column;
  gap: 20px;
  max-width: 960px;
}

.view-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 12px;
}

.view-header h1 {
  margin: 0;
  font-size: 22px;
}

.subtitle {
  margin: 4px 0 0;
  font-size: 13px;
  color: var(--color-text-muted);
}

.status {
  color: var(--color-text-muted);
  font-size: 14px;
}

.error {
  margin: 0;
  font-size: 13px;
  color: var(--color-danger);
}

.bloque {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.bloque-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}

.bloque-head h2 {
  margin: 0;
  font-size: 16px;
}

.sedes,
.usuarios {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 10px;
}

.sedes {
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
}

.sede,
.usuario {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 14px;
  border-radius: var(--radius-md);
  background: var(--color-surface);
  border: 1px solid var(--color-border-soft);
}

.sede--inactiva,
.usuario--inactivo {
  opacity: 0.6;
}

.sede-info,
.usuario-info {
  display: flex;
  flex-direction: column;
  min-width: 0;
  flex: 1;
}

.sede-info span,
.email {
  font-size: 12.5px;
  color: var(--color-text-muted);
  overflow: hidden;
  text-overflow: ellipsis;
}

.tu {
  font-weight: 400;
  font-size: 12px;
  color: var(--color-text-muted);
}

.usuario-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.sede-nombre {
  font-size: 13px;
  color: var(--color-text-muted);
}

.usuario-acciones {
  display: flex;
  gap: 4px;
}

.chip {
  padding: 3px 10px;
  border-radius: 999px;
  font-size: 11.5px;
  font-weight: 600;
  border: 1px solid currentColor;
  white-space: nowrap;
}

.chip--ok,
.chip--cajero {
  color: var(--color-lime);
}

.chip--off {
  color: var(--color-text-muted);
}

.chip--superadmin {
  color: var(--color-orange);
}

.chip--dueno {
  color: var(--color-magenta);
}

.aviso {
  margin: 0;
  padding: 10px 14px;
  border-radius: var(--radius-md);
  border: 1px solid var(--color-orange);
  background: rgba(255, 138, 30, 0.08);
  font-size: 13.5px;
}

select:disabled {
  opacity: 0.7;
}

.chip--administrador {
  color: var(--color-cyan);
}

.filtro select,
.form input[type='text'],
.form input[type='email'],
.form select {
  min-height: 44px;
  padding: 8px 12px;
  border-radius: var(--radius-md);
  border: 1px solid var(--color-border);
  background: var(--color-surface-alt);
  font-size: 16px;
}

.form {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.form h2 {
  margin: 0 0 6px;
  font-size: 18px;
}

.form > label,
.label {
  margin-top: 6px;
  font-size: 12.5px;
  color: var(--color-text-muted);
}

.hint {
  margin: 0;
  font-size: 12px;
  color: var(--color-text-muted);
}

.roles {
  display: grid;
  gap: 8px;
}

.rol {
  display: flex;
  gap: 10px;
  align-items: flex-start;
  padding: 10px 12px;
  border-radius: var(--radius-md);
  border: 1px solid var(--color-border-soft);
  cursor: pointer;
}

.rol--sel {
  border-color: var(--color-cyan);
  background: rgba(0, 229, 255, 0.06);
}

.rol input {
  margin-top: 3px;
}

.rol span {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.rol small {
  font-size: 12px;
  color: var(--color-text-muted);
}

.check {
  display: flex !important;
  gap: 8px;
  align-items: center;
  margin-top: 10px !important;
  color: var(--color-text) !important;
  font-size: 13.5px !important;
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

.btn-link {
  min-height: 40px;
  border: none;
  background: transparent;
  color: var(--color-cyan);
  cursor: pointer;
  font-size: 13px;
  padding: 6px 10px;
  border-radius: var(--radius-sm);
}

.btn-link:hover {
  background: rgba(0, 229, 255, 0.12);
}

.btn-link--danger {
  color: var(--color-danger);
}

button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

button:focus-visible,
select:focus-visible,
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

@media (max-width: 700px) {
  .usuario {
    flex-wrap: wrap;
  }

  .usuario-info {
    flex-basis: 100%;
  }

  .usuario-acciones {
    flex-basis: 100%;
    justify-content: flex-start;
    margin-left: -10px;
  }

  .view-header .btn-primary {
    width: 100%;
  }
}
</style>
