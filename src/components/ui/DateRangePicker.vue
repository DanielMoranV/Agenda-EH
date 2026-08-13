<script setup>
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'

// Selector de fechas propio. HTML nativo no tiene <input type="daterange">, así
// que con dos <input type="date"> sueltos el usuario no ve el rango completo ni
// puede evitar poner el fin antes del inicio. Este componente resuelve ambas
// cosas: dos meses a la vista, previsualización al pasar el ratón y corrección
// automática del orden.

const props = defineProps({
  // 'range' = inicio + fin | 'single' = un solo día
  mode: { type: String, default: 'range' },
  start: { type: String, default: '' },
  end: { type: String, default: '' }
})

const emit = defineEmits(['update:start', 'update:end'])

const MONTHS = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']
const MONTHS_SHORT = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
const WEEKDAYS = ['L', 'M', 'X', 'J', 'V', 'S', 'D']

// --- Helpers de fecha (siempre en horario local, nunca ISO/UTC) ---
const toKey = (y, m, d) => `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
const parseKey = (key) => {
  if (!key) return null
  const [y, m, d] = key.split('-').map(Number)
  return { y, m: m - 1, d }
}
const todayKey = () => {
  const n = new Date()
  return toKey(n.getFullYear(), n.getMonth(), n.getDate())
}

const formatLong = (key) => {
  const p = parseKey(key)
  return p ? `${p.d} ${MONTHS_SHORT[p.m]} ${p.y}` : ''
}

const isOpen = ref(false)
const hoverKey = ref('')
// Mientras se elige un rango guardamos aquí el primer clic
const pendingStart = ref('')
const rootEl = ref(null)

// Mes mostrado en el panel izquierdo
const anchor = ref({ y: new Date().getFullYear(), m: new Date().getMonth() })

const syncAnchorToSelection = () => {
  const p = parseKey(props.start) || parseKey(props.end)
  if (p) anchor.value = { y: p.y, m: p.m }
}

watch(() => [props.start, props.end], syncAnchorToSelection, { immediate: true })

const shiftMonth = (delta) => {
  const d = new Date(anchor.value.y, anchor.value.m + delta, 1)
  anchor.value = { y: d.getFullYear(), m: d.getMonth() }
}

/** Construye la retícula de un mes: semanas de 7 celdas, empezando en lunes. */
const buildMonth = (year, month) => {
  const first = new Date(year, month, 1)
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  // getDay(): 0=domingo. Queremos 0=lunes.
  const offset = (first.getDay() + 6) % 7

  const cells = []
  for (let i = 0; i < offset; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push({ d, key: toKey(year, month, d) })
  while (cells.length % 7 !== 0) cells.push(null)

  const weeks = []
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7))

  return { year, month, title: `${MONTHS[month]} ${year}`, weeks }
}

const leftMonth = computed(() => buildMonth(anchor.value.y, anchor.value.m))
const rightMonth = computed(() => {
  const d = new Date(anchor.value.y, anchor.value.m + 1, 1)
  return buildMonth(d.getFullYear(), d.getMonth())
})

// Extremos efectivos del rango, incluyendo la previsualización al pasar el ratón
const effective = computed(() => {
  if (props.mode === 'single') return { from: props.start, to: props.start }

  if (pendingStart.value) {
    const other = hoverKey.value || pendingStart.value
    return pendingStart.value <= other
      ? { from: pendingStart.value, to: other }
      : { from: other, to: pendingStart.value }
  }
  return { from: props.start, to: props.end }
})

const dayClass = (key) => {
  const { from, to } = effective.value
  const classes = []
  if (key === todayKey()) classes.push('is-today')
  if (from && key === from) classes.push('is-edge', 'is-start')
  if (to && key === to) classes.push('is-edge', 'is-end')
  if (from && to && key > from && key < to) classes.push('is-inside')
  return classes
}

const selectDay = (key) => {
  if (props.mode === 'single') {
    emit('update:start', key)
    isOpen.value = false
    return
  }

  if (!pendingStart.value) {
    // Primer clic: arranca un rango nuevo
    pendingStart.value = key
    hoverKey.value = ''
    return
  }

  // Segundo clic: cerramos el rango, ordenando por si se eligió al revés
  const a = pendingStart.value
  const [from, to] = a <= key ? [a, key] : [key, a]
  emit('update:start', from)
  emit('update:end', to)
  pendingStart.value = ''
  hoverKey.value = ''
  isOpen.value = false
}

const label = computed(() => {
  if (props.mode === 'single') {
    return props.start ? formatLong(props.start) : 'Elegir fecha'
  }
  if (props.start && props.end) return `${formatLong(props.start)} – ${formatLong(props.end)}`
  if (props.start) return `${formatLong(props.start)} – …`
  return 'Elegir rango'
})

const hasValue = computed(() => Boolean(props.start || props.end))

const clear = () => {
  emit('update:start', '')
  if (props.mode === 'range') emit('update:end', '')
  pendingStart.value = ''
}

// Atajos de uso frecuente
const applyPreset = (preset) => {
  const n = new Date()
  let from, to
  if (preset === 'semana') {
    const day = n.getDay()
    const monday = new Date(n.getFullYear(), n.getMonth(), n.getDate() - day + (day === 0 ? -6 : 1))
    from = monday
    to = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 6)
  } else if (preset === 'mes') {
    from = new Date(n.getFullYear(), n.getMonth(), 1)
    to = new Date(n.getFullYear(), n.getMonth() + 1, 0)
  } else { // 'proximos30'
    from = n
    to = new Date(n.getFullYear(), n.getMonth(), n.getDate() + 30)
  }
  emit('update:start', toKey(from.getFullYear(), from.getMonth(), from.getDate()))
  emit('update:end', toKey(to.getFullYear(), to.getMonth(), to.getDate()))
  pendingStart.value = ''
  isOpen.value = false
}

// --- Posicionamiento ---
// El panel se teletransporta al <body> con position:fixed porque sus
// contenedores lo recortarían: la cabecera tiene overflow:hidden (para redondear
// las esquinas) y la barra de filtros overflow-x:auto en móvil.
const popEl = ref(null)
const popPos = ref({ top: 0, left: 0 })

const MARGIN = 8

const updatePosition = () => {
  const trigger = rootEl.value?.querySelector('.drp-trigger')
  if (!trigger) return
  const r = trigger.getBoundingClientRect()
  const popW = popEl.value?.offsetWidth || 320
  const popH = popEl.value?.offsetHeight || 300

  let left = r.left
  // No dejar que se salga por la derecha ni por la izquierda
  left = Math.min(left, window.innerWidth - popW - MARGIN)
  left = Math.max(MARGIN, left)

  // Si no cabe debajo, lo abrimos hacia arriba
  let top = r.bottom + MARGIN
  if (top + popH > window.innerHeight - MARGIN && r.top - popH - MARGIN > 0) {
    top = r.top - popH - MARGIN
  }

  popPos.value = { top, left }
}

const popStyle = computed(() => ({
  top: `${popPos.value.top}px`,
  left: `${popPos.value.left}px`
}))

const close = () => {
  isOpen.value = false
  pendingStart.value = ''
  hoverKey.value = ''
}

const toggle = async () => {
  if (isOpen.value) return close()
  pendingStart.value = ''
  syncAnchorToSelection()
  isOpen.value = true
  // Medimos después de pintar para conocer el tamaño real del panel
  await nextTick()
  updatePosition()
}

// Reposicionar mientras esté abierto (la cabecera es sticky y se mueve al hacer scroll)
watch([leftMonth, () => props.mode], () => { if (isOpen.value) nextTick(updatePosition) })

// Cerrar al hacer clic fuera o pulsar Escape
const onDocClick = (e) => {
  if (!isOpen.value) return
  const insideTrigger = rootEl.value?.contains(e.target)
  const insidePop = popEl.value?.contains(e.target)
  if (!insideTrigger && !insidePop) close()
}
const onKeydown = (e) => {
  if (e.key === 'Escape' && isOpen.value) close()
}
const onViewportChange = () => { if (isOpen.value) updatePosition() }

onMounted(() => {
  document.addEventListener('mousedown', onDocClick)
  document.addEventListener('keydown', onKeydown)
  // capture:true para enterarnos también del scroll de contenedores internos
  window.addEventListener('scroll', onViewportChange, true)
  window.addEventListener('resize', onViewportChange)
})
onUnmounted(() => {
  document.removeEventListener('mousedown', onDocClick)
  document.removeEventListener('keydown', onKeydown)
  window.removeEventListener('scroll', onViewportChange, true)
  window.removeEventListener('resize', onViewportChange)
})
</script>

<template>
  <div class="drp" ref="rootEl">
    <button
      type="button"
      class="drp-trigger"
      :class="{ 'is-active': isOpen, 'has-value': hasValue }"
      @click="toggle"
    >
      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
        <rect x="3" y="4" width="18" height="18" rx="2" />
        <path d="M16 2v4M8 2v4M3 10h18" />
      </svg>
      <span class="drp-label">{{ label }}</span>
    </button>

    <Teleport to="body">
    <div v-if="isOpen" class="drp-pop" ref="popEl" :style="popStyle">
      <div class="drp-nav">
        <button type="button" class="drp-arrow" @click="shiftMonth(-1)" aria-label="Mes anterior">‹</button>
        <div class="drp-titles">
          <span>{{ leftMonth.title }}</span>
          <!-- En modo 'single' solo se pinta un mes: su título sobraría -->
          <span v-if="mode === 'range'" class="drp-second-title">{{ rightMonth.title }}</span>
        </div>
        <button type="button" class="drp-arrow" @click="shiftMonth(1)" aria-label="Mes siguiente">›</button>
      </div>

      <div class="drp-months">
        <div
          v-for="month in (mode === 'single' ? [leftMonth] : [leftMonth, rightMonth])"
          :key="month.title"
          class="drp-month"
          :class="{ 'drp-month--second': month === rightMonth }"
        >
          <div class="drp-weekdays">
            <span v-for="(w, i) in WEEKDAYS" :key="i">{{ w }}</span>
          </div>
          <div
            v-for="(week, wi) in month.weeks"
            :key="wi"
            class="drp-week"
          >
            <template v-for="(cell, ci) in week" :key="ci">
              <span v-if="!cell" class="drp-day drp-day--empty"></span>
              <button
                v-else
                type="button"
                class="drp-day"
                :class="dayClass(cell.key)"
                @click="selectDay(cell.key)"
                @mouseenter="hoverKey = cell.key"
              >{{ cell.d }}</button>
            </template>
          </div>
        </div>
      </div>

      <div class="drp-footer">
        <div v-if="mode === 'range'" class="drp-presets">
          <button type="button" @click="applyPreset('semana')">Esta semana</button>
          <button type="button" @click="applyPreset('mes')">Este mes</button>
          <button type="button" @click="applyPreset('proximos30')">30 días</button>
        </div>
        <span v-else class="drp-hint"></span>
        <button type="button" class="drp-clear" :disabled="!hasValue" @click="clear">Limpiar</button>
      </div>
    </div>
    </Teleport>
  </div>
</template>

<style scoped>
.drp {
  position: relative;
  flex: 0 0 auto;
}

.drp-trigger {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  background: var(--bg-base);
  border: 1px solid var(--border-color);
  color: var(--text-secondary);
  border-radius: var(--radius-sm);
  padding: 0.4rem 0.75rem;
  font-family: inherit;
  font-size: 0.85rem;
  cursor: pointer;
  white-space: nowrap;
  transition: var(--transition);
}

.drp-trigger.has-value { color: var(--text-primary); }
.drp-trigger:hover,
.drp-trigger.is-active { border-color: var(--accent-primary); }
.drp-trigger svg { flex-shrink: 0; }

/* Teletransportado al <body>: las coordenadas las calcula updatePosition() */
.drp-pop {
  position: fixed;
  z-index: 2500;
  background: var(--bg-surface);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  box-shadow: 0 12px 30px -8px var(--overlay-bg);
  padding: 0.85rem;
  width: max-content;
}

.drp-nav {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.6rem;
}

.drp-titles {
  flex: 1;
  display: flex;
  justify-content: space-around;
  gap: 0.5rem;
  font-size: 0.82rem;
  font-weight: 600;
  color: var(--text-primary);
}

.drp-arrow {
  background: transparent;
  border: 1px solid var(--border-color);
  color: var(--text-secondary);
  border-radius: var(--radius-sm);
  width: 26px;
  height: 26px;
  font-size: 1rem;
  line-height: 1;
  cursor: pointer;
  flex-shrink: 0;
}
.drp-arrow:hover { color: var(--text-primary); border-color: var(--accent-primary); }

.drp-months {
  display: flex;
  gap: 1.1rem;
}

.drp-weekdays,
.drp-week {
  display: grid;
  grid-template-columns: repeat(7, 30px);
}

.drp-weekdays span {
  text-align: center;
  font-size: 0.68rem;
  font-weight: 600;
  color: var(--text-muted);
  padding-bottom: 0.3rem;
}

.drp-day {
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: none;
  color: var(--text-secondary);
  font-family: inherit;
  font-size: 0.78rem;
  cursor: pointer;
  border-radius: 0;
}

.drp-day--empty { cursor: default; }
.drp-day:not(.drp-day--empty):hover { background: var(--bg-surface-hover); color: var(--text-primary); }

.drp-day.is-today {
  font-weight: 700;
  color: var(--accent-primary);
}

/* Relleno del interior del rango */
.drp-day.is-inside {
  background: var(--accent-soft-bg);
  color: var(--text-primary);
}

/* Extremos del rango */
.drp-day.is-edge {
  background: var(--accent-primary);
  color: var(--text-inverse);
  font-weight: 600;
}
.drp-day.is-start { border-radius: var(--radius-sm) 0 0 var(--radius-sm); }
.drp-day.is-end { border-radius: 0 var(--radius-sm) var(--radius-sm) 0; }
.drp-day.is-start.is-end { border-radius: var(--radius-sm); }

.drp-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  margin-top: 0.75rem;
  padding-top: 0.7rem;
  border-top: 1px solid var(--border-color);
}

.drp-presets {
  display: flex;
  gap: 0.35rem;
  flex-wrap: wrap;
}

.drp-presets button,
.drp-clear {
  background: transparent;
  border: 1px solid var(--border-color);
  color: var(--text-secondary);
  border-radius: var(--radius-sm);
  padding: 0.25rem 0.6rem;
  font-family: inherit;
  font-size: 0.75rem;
  cursor: pointer;
  white-space: nowrap;
  transition: var(--transition);
}

.drp-presets button:hover,
.drp-clear:not(:disabled):hover {
  color: var(--text-primary);
  border-color: var(--accent-primary);
}

.drp-clear:disabled { opacity: 0.4; cursor: default; }

@media (max-width: 768px) {
  /* Un solo mes: dos no caben en pantallas estrechas */
  .drp-pop { padding: 0.7rem; }
  .drp-months { gap: 0; }
  .drp-month--second { display: none; }
  .drp-second-title { display: none; }
  .drp-titles { justify-content: center; }
  /* Celdas algo más grandes: objetivo táctil cómodo */
  .drp-weekdays,
  .drp-week { grid-template-columns: repeat(7, 36px); }
  .drp-day { height: 34px; font-size: 0.82rem; }
  .drp-footer { flex-direction: column; align-items: stretch; gap: 0.5rem; }
  .drp-presets { justify-content: space-between; }
}
</style>
