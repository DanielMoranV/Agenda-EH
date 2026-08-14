# Agenda EH — Matriz de Eisenhower

![Vue 3](https://img.shields.io/badge/Vue-3.5-42b883?logo=vue.js&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-8-646CFF?logo=vite&logoColor=white)
![Firebase](https://img.shields.io/badge/Firebase-Auth%20%7C%20Firestore%20%7C%20Hosting-FFCA28?logo=firebase&logoColor=white)
![Estado](https://img.shields.io/badge/estado-en%20producción-brightgreen)
![Licencia](https://img.shields.io/badge/uso-privado-lightgrey)

Agenda de gestión de tareas que organiza el trabajo según la **Matriz de Eisenhower** (urgente × importante) y lo mantiene sincronizado con **Google Calendar** y **Gmail**.

Las tareas se guardan en Firestore y se reflejan en tiempo real en todas las vistas y pestañas abiertas. Si una tarea tiene fechas, se crea automáticamente el evento correspondiente en el calendario del usuario; si tiene un responsable asignado, se le puede avisar por correo.

---

## Índice

- [Estado del proyecto](#estado-del-proyecto)
- [Funcionalidades](#funcionalidades)
- [Stack](#stack)
- [Arquitectura](#arquitectura)
- [Puesta en marcha](#puesta-en-marcha)
- [Configuración de Google Cloud](#configuración-de-google-cloud)
- [Estructura del proyecto](#estructura-del-proyecto)
- [Modelo de datos](#modelo-de-datos)
- [Cómo funciona la sesión de Google](#cómo-funciona-la-sesión-de-google)
- [Seguridad y manejo de credenciales](#seguridad-y-manejo-de-credenciales)
- [Temas claro y oscuro](#temas-claro-y-oscuro)
- [Despliegue](#despliegue)
- [Notas de desarrollo](#notas-de-desarrollo)

---

## Estado del proyecto

El desarrollo siguió las 5 fases del [documento técnico](docs/Documento_Tecnico_Agenda_Matriz_Eisenhower.pdf) y del [plan de trabajo](docs/plan_de_trabajo.md). Estado real a día de hoy:

| Fase | Alcance | Estado |
|---|---|---|
| 1. PoC Calendar API | OAuth 2.0, creación de eventos, recordatorios | ✅ Completa |
| 2. Arquitectura base | Vue 3 + Vite, Firebase (Auth/Firestore/Hosting), estructura de carpetas | ✅ Completa |
| 3. UI/UX | Login, Matriz 2×2 responsive, tarjetas, modales | ✅ Completa |
| 4. Integración | CRUD en tiempo real (`onSnapshot`), clasificación dinámica por cuadrante, sync bidireccional con Calendar | ✅ Completa |
| 5. Seguridad y despliegue | Firestore Rules por `user_id`, build de producción, Firebase Hosting | ✅ Completa |

Sobre el alcance original del plan, ya en producción:

- **5 vistas completas**: Matriz (dashboard), Calendario, Gantt, Proyectos y Contactos — el plan solo contemplaba matriz + calendario.
- **Sistema de temas** claro/oscuro/sistema con paleta accesible (WCAG AA) — no estaba en el alcance original.
- **Capa de resiliencia de sesión** (`useGoogleToken`): renovación proactiva, bajo demanda, reintento tras 401 y reconexión al recuperar foco/red.
- **Filtros compartidos** (estado, proyecto, responsable, periodo) entre Matriz y Gantt con un único predicado (`matchesFilters`).

`docs/plan_de_trabajo.md` quedó como bitácora histórica de planificación; las casillas sin marcar reflejan el checklist original, no el estado actual del código.

---

## Funcionalidades

### Vistas

| Vista | Ruta | Descripción |
|---|---|---|
| **Matriz** | `/` | Grilla 2×2 de Eisenhower: Hacer (I), Decidir (II), Delegar (III), Eliminar (IV). En móvil colapsa a pestañas por cuadrante. |
| **Calendario** | `/calendar` | Mes / semana / día con FullCalendar. Arrastrar un evento reprograma la tarea y actualiza Google Calendar. |
| **Gantt** | `/gantt` | Cronograma de las tareas con fechas. Modo días o 24 horas (automático según el filtro de periodo). |
| **Proyectos** | `/proyectos` | CRUD de proyectos, con responsable asignable. |
| **Contactos** | `/contactos` | CRUD de contactos/responsables a los que notificar. |

### Filtros

Barra compartida entre Matriz y Gantt: **estado**, **proyecto**, **responsable** y **periodo**. El periodo admite Hoy, Esta semana, Este mes, **Día concreto** y **Rango**, estos dos últimos con un selector de calendario de doble mes con previsualización.

Al crear una tarea, el proyecto y el responsable activos en los filtros vienen preseleccionados.

### Sincronización

- **Google Calendar** — crear, editar y borrar una tarea con fechas se replica en el calendario. Respeta eventos de día completo y rangos de horas, incluidos los que cruzan medianoche. Se añaden recordatorios (popup 30 min antes, correo 1 día antes). Si el evento se borró desde Google, se recrea en la siguiente edición.
- **Gmail** — aviso opcional al responsable de la tarea, con botón para añadirla a su propio calendario.
- **Firestore es la fuente de verdad.** Si Google falla, la tarea se guarda igualmente y la app avisa de que la sincronización quedó pendiente.

---

## Stack

| Capa | Tecnología | Uso |
|---|---|---|
| Frontend | **Vue 3** (Composition API, `<script setup>`) | Toda la UI, sin Options API |
| Enrutado | **Vue Router 5** | Rutas + guardas de autenticación |
| Build | **Vite 8** | Dev server, HMR, bundle de producción |
| Backend as a Service | **Firebase** — Authentication (Google), Firestore, Hosting | Persistencia, sesión y despliegue |
| Calendario | **FullCalendar 6** (`core`, `daygrid`, `timegrid`, `interaction`, `vue3`) | Vista mensual/semanal/diaria con drag & drop |
| Identidad | **Google Identity Services** (GIS) | Renovación silenciosa del token OAuth de Calendar/Gmail |
| APIs externas | **Google Calendar API v3**, **Gmail API v1** | Sincronización de eventos y envío de avisos |

Deliberadamente **sin librería de estado** (Vuex/Pinia) ni **librería de componentes** (Vuetify/PrimeVue): el estado compartido son composables singleton a nivel de módulo y los estilos son CSS propio con variables en `src/assets/styles/main.css`. Superficie de dependencias mínima a propósito — menos versiones que mantener, menos bundle.

---

## Arquitectura

Arquitectura en capas, unidireccional: la UI nunca toca Firebase o Google directamente, siempre pasa por un composable.

```
┌─────────────────────────────────────────────────────────┐
│  Views (una por ruta)                                    │
│  DashboardView · CalendarView · GanttView ·               │
│  ProyectosView · ContactosView · LoginView                │
└───────────────────────────┬────────────────────────────┘
                             │ usa
┌───────────────────────────▼────────────────────────────┐
│  Composables (estado + lógica de negocio, singleton)      │
│  useAuth · useTasks · useProjects · useContacts ·          │
│  useFilters · useTheme · useGoogleToken · useNotifications │
└──────────┬───────────────────────────────┬──────────────┘
           │                               │
┌──────────▼──────────────┐   ┌────────────▼─────────────┐
│  services/firebase        │   │  services/google           │
│  config.js (SDK init)     │   │  apiClient.js (googleFetch) │
│  errors.js (Firestore →   │   │  gisClient.js (OAuth/GIS)   │
│   mensajes accionables)   │   │  googleCalendar.js · gmail.js│
└──────────┬───────────────┘   └────────────┬─────────────┘
           │                                │
┌──────────▼───────────────┐   ┌────────────▼─────────────┐
│  Firebase (Auth,           │   │  Google Calendar API /     │
│  Firestore, Hosting)       │   │  Gmail API                 │
└────────────────────────────┘   └─────────────────────────┘
```

**Principios que sostiene el código:**

- **Composables singleton para estado compartido.** `useAuth`, `useFilters` y `useGoogleToken` declaran sus `ref` fuera de la función exportada, así todos los componentes leen la misma instancia — un solo observador de Firebase para toda la app, no uno por componente montado.
- **Un único punto de entrada a Google.** Todo `fetch` a Calendar o Gmail pasa por `googleFetch` (`services/google/apiClient.js`), que centraliza token, reintento tras 401 y errores. Los servicios de dominio (`googleCalendar.js`, `gmail.js`) no conocen tokens.
- **Firestore es la fuente de verdad; Google es best-effort.** Se escribe primero en Firestore y después se sincroniza con Google — si la sincronización falla, la tarea no se pierde, solo queda marcada como pendiente.
- **Errores traducidos antes de llegar a la UI.** `describeFirestoreError`, `describeGoogleApiError` y `describeAuthError` convierten códigos de error en mensajes accionables en español; los componentes nunca muestran un código crudo.
- **Predicados de filtrado centralizados.** `matchesFilters()` vive en `useFilters` y lo comparten Matriz y Gantt, así no pueden divergir en qué tarea se muestra en cada vista.

---

## Puesta en marcha

Requisitos: **Node.js 20+** y una cuenta de Firebase.

```bash
git clone <url-del-repo>
cd Agenda-EH
npm install
cp .env.example .env.local   # y rellena los valores
npm run dev                  # http://localhost:5173
```

### Variables de entorno

Todas van en `.env.local` (ignorado por git). Los valores de Firebase están en *Configuración del proyecto → Tus apps → Configuración del SDK*.

| Variable | Obligatoria | Para qué sirve |
|---|---|---|
| `VITE_FIREBASE_API_KEY` | Sí | Credenciales del SDK de Firebase |
| `VITE_FIREBASE_AUTH_DOMAIN` | Sí | |
| `VITE_FIREBASE_PROJECT_ID` | Sí | |
| `VITE_FIREBASE_STORAGE_BUCKET` | Sí | |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | Sí | |
| `VITE_FIREBASE_APP_ID` | Sí | |
| `VITE_GOOGLE_CLIENT_ID` | Recomendada | Renovación **silenciosa** del token de Calendar/Gmail. Sin ella la app funciona, pero al caducar el token pide reconectar con un clic. |

### Scripts

| Comando | Qué hace |
|---|---|
| `npm run dev` | Servidor de desarrollo con recarga en caliente |
| `npm run build` | Compila a `dist/` |
| `npm run preview` | Sirve localmente lo compilado |

---

## Configuración de Google Cloud

La app pide dos permisos además del perfil básico:

- `https://www.googleapis.com/auth/calendar.events` — gestionar eventos
- `https://www.googleapis.com/auth/gmail.send` — enviar avisos

Pasos en [Google Cloud Console](https://console.cloud.google.com/), sobre el mismo proyecto que Firebase:

1. **Habilitar APIs** — *APIs y servicios → Biblioteca*: activa **Google Calendar API** y **Gmail API**.
2. **Pantalla de consentimiento** — añade los dos scopes de arriba. Mientras esté en modo *Testing*, registra como usuarios de prueba las cuentas que vayan a entrar.
3. **Client ID** — en *Credenciales*, abre el ID de cliente OAuth 2.0 de tipo *Aplicación web* (Firebase crea uno automáticamente, suele llamarse «Web client (auto created by Google Service)»). Copia su valor a `VITE_GOOGLE_CLIENT_ID` y añade en **Orígenes de JavaScript autorizados**:
   - `http://localhost:5173`
   - `https://TU-DOMINIO-DE-HOSTING`

> Sin `VITE_GOOGLE_CLIENT_ID` no hay renovación silenciosa: cada hora aparecerá un aviso con un botón «Reconectar».

---

## Estructura del proyecto

```
src/
├── assets/styles/main.css        Variables CSS y estilos globales
├── components/
│   ├── matrix/
│   │   ├── TaskCard.vue          Tarjeta de tarea
│   │   └── TaskFormModal.vue     Alta y edición de tareas
│   └── ui/
│       ├── DateRangePicker.vue   Calendario de rango / día concreto
│       ├── GoogleSyncStatus.vue  Indicador de conexión con Google
│       ├── ThemeToggle.vue       Conmutador claro / oscuro / sistema
│       └── ToastHost.vue         Notificaciones
├── composables/
│   ├── useAuth.js                Sesión de Firebase (singleton global)
│   ├── useTheme.js               Tema activo y lectura de la paleta
│   ├── useGoogleToken.js         Ciclo de vida del token OAuth de Google
│   ├── useFilters.js             Estado de filtros + matchesFilters()
│   ├── useTasks.js               CRUD de tareas y sincronización
│   ├── useProjects.js            CRUD de proyectos
│   ├── useContacts.js            CRUD de contactos
│   └── useNotifications.js       Cola de toasts
├── services/
│   ├── firebase/
│   │   ├── config.js             Inicialización del SDK
│   │   └── errors.js             Códigos de Firestore → mensajes
│   ├── google/
│   │   ├── apiClient.js          googleFetch: auth, reintento y errores
│   │   └── gisClient.js          Google Identity Services
│   ├── googleCalendar.js         Calendar API v3
│   └── gmail.js                  Gmail API v1
├── views/                        Una por ruta
└── router/index.js               Rutas y guardas de navegación
```

### Decisiones de arquitectura

- **Los composables de estado compartido son singleton a nivel de módulo.** `useAuth`, `useFilters` y `useGoogleToken` declaran sus `ref` fuera de la función, así que todos los componentes leen la misma instancia y solo existe un observador de Firebase para toda la app.
- **`matchesFilters()` vive en `useFilters`.** Matriz y Gantt comparten el mismo predicado para que no puedan divergir.
- **Toda llamada a Google pasa por `googleFetch`.** Centraliza la obtención del token, el reintento tras un 401 y la traducción de errores; los servicios no manejan tokens.
- **Los errores se traducen antes de llegar a la UI.** `describeFirestoreError`, `describeGoogleApiError` y `describeAuthError` convierten códigos en mensajes accionables en español.

---

## Modelo de datos

Tres colecciones en Firestore, todas con `user_id` y `createdAt`. Las [reglas de seguridad](firestore.rules) permiten a cada usuario acceder únicamente a sus propios documentos.

### `tareas`

| Campo | Tipo | Notas |
|---|---|---|
| `titulo` | string | Obligatorio |
| `descripcion` | string | |
| `es_urgente` | boolean | Junto a `es_importante` determina el cuadrante |
| `es_importante` | boolean | |
| `estado` | string | `Pendiente` \| `En curso` \| `Finalizado` |
| `area_contexto` | string | Etiqueta libre |
| `fecha_inicio` | string | `YYYY-MM-DD` |
| `fecha_vencimiento` | string | `YYYY-MM-DD` |
| `con_hora` | boolean | Si es `false`, el evento es de día completo |
| `hora_inicio` | string | `HH:MM` |
| `hora_vencimiento` | string | `HH:MM` |
| `proyecto_id` | string | Referencia a `proyectos` |
| `contacto_id` | string | Responsable |
| `notificar_responsable` | boolean | Dispara el correo al guardar |
| `calendar_event_id` | string \| null | ID del evento en Google Calendar |

**Cuadrantes:** I Hacer (`urgente && importante`) · II Decidir (`!urgente && importante`) · III Delegar (`urgente && !importante`) · IV Eliminar (ninguno).

### `proyectos`

`nombre`, `descripcion`, `estado` (`Activo` \| `En Pausa` \| `Finalizado`), `contacto_id`.

### `contactos`

`nombre`, `email`, `telefono`.

---

## Cómo funciona la sesión de Google

Firebase Auth renueva su propio ID token, pero **no** renueva el access token de Google: ese caduca en una hora y el SDK no guarda el refresh token en el cliente. Sin tratamiento, Calendar y Gmail empiezan a devolver 401 en silencio.

`useGoogleToken.js` lo resuelve en cuatro capas:

1. **Renovación proactiva** — temporizador que refresca 10 minutos antes de caducar.
2. **Renovación bajo demanda** — si una operación encuentra el token vencido, lo renueva antes de seguir.
3. **Reintento tras 401** — si Google rechaza un token todavía vigente (revocado, scopes cambiados), se fuerza la renovación y se reintenta la llamada una vez.
4. **Al recuperar el foco o la red** — eventos `visibilitychange` y `online`.

La renovación es silenciosa vía Google Identity Services. Si no es posible (sin `VITE_GOOGLE_CLIENT_ID`, o sesión de Google cerrada), aparece un aviso persistente con un botón **Reconectar** que resuelve todo en un clic. Las renovaciones concurrentes se agrupan en una sola petición y el token se comparte entre pestañas.

---

## Seguridad y manejo de credenciales

- **Ninguna credencial vive en el repositorio.** Todas las claves (Firebase, Google Client ID) se leen de variables de entorno `VITE_*` en tiempo de build; el repo solo versiona `.env.example` con placeholders. `.env`, `.env.local` y cualquier `.env.*` están en `.gitignore`.
- **La API key de Firebase no es un secreto de servidor.** Identifica el proyecto ante Firebase, pero quien decide qué puede leer o escribir cada usuario son las [Firestore Security Rules](firestore.rules) — no la API key. Igualmente se mantiene fuera del repo por buena práctica y para no acoplar el código a un proyecto de Firebase concreto.
- **Autorización a nivel de documento.** Las tres colecciones (`tareas`, `proyectos`, `contactos`) exigen `request.auth != null` y que `user_id` del documento coincida con el UID autenticado, tanto para leer como para escribir. Un usuario no puede ver ni modificar datos de otro aunque conozca el ID del documento.
- **El token OAuth de Google nunca se persiste.** Vive solo en memoria (`useGoogleToken.js`) durante la sesión del tab; no se guarda en `localStorage` ni en Firestore. Al cerrar la pestaña, desaparece.
- **Auditoría realizada en esta sesión:** se revisó el código fuente completo y el historial de git en busca de claves API, tokens, service accounts y contraseñas embebidas — no se encontró ninguna. Se corrigió `.gitignore` (no cubría explícitamente `.env`, solo `*.local`) y se dejó de versionar la caché local de Firebase Hosting (`.firebase/`), que no contenía secretos pero no debía estar en el repo.
- **Antes de desplegar o hacer público el repositorio:** confirma que `.env.local` nunca se hizo `git add` por error (`git log --all -- .env.local`), rota cualquier credencial que hayas compartido fuera de este flujo, y revisa los **orígenes autorizados** del OAuth Client ID en Google Cloud Console para que solo incluyan tus dominios reales.

---

## Despliegue

Firebase Hosting sirve `dist/` con reescritura SPA a `index.html`. Proyecto por defecto: `agenda-eh` (ver [`.firebaserc`](.firebaserc)).

```bash
npm install -g firebase-tools
firebase login

npm run build
firebase deploy                      # hosting + reglas de Firestore
firebase deploy --only hosting       # solo la app
firebase deploy --only firestore:rules
```

Antes del primer despliegue, añade el dominio de hosting a los **Orígenes de JavaScript autorizados** del Client ID de OAuth y a los **dominios autorizados** de Firebase Authentication.

---

## Temas claro y oscuro

Toda la paleta vive en `src/assets/styles/main.css` como variables CSS, definidas
por duplicado para `:root[data-theme='light']` y `:root[data-theme='dark']`.

Los dos temas comparten neutros con matiz azul pizarra, pero **no comparten el
nivel de croma de los acentos, y es deliberado**: sobre fondo oscuro el ojo
necesita más saturación para percibir el mismo color, así que desaturar allí se
lee como gris sucio. El tema claro va apagado (azul acero, terracota, ocre,
verde salvia) y el oscuro conserva acentos vivos sobre un fondo profundo
(`#0e141d`), que es lo que les da sitio para contrastar.

El tema se resuelve así:

1. Un script inline en `index.html` fija `data-theme` en `<html>` **antes** del
   primer pintado, leyendo `localStorage.theme` o la preferencia del sistema.
   Sin esto se vería un destello del tema equivocado al cargar.
2. `useTheme.js` toma el relevo: expone la preferencia (`light` / `dark` /
   `system`), la persiste, sigue los cambios del sistema y sincroniza pestañas.
3. `ThemeToggle.vue` cicla entre los tres modos desde la cabecera.

**Regla al escribir estilos: ningún color literal en un componente.** Si falta un
matiz, se añade el token en `main.css` en **los dos temas**. Los componentes solo
usan `var(--token)`.

Tokens principales: superficies (`--bg-base`, `--bg-surface`, `--bg-elevated`,
`--bg-inset`, `--bg-header`), texto (`--text-primary/secondary/muted/inverse`),
bordes (`--border-color`, `--border-strong`, `--border-focus`), acento
(`--accent-primary`, `--accent-text`, `--accent-soft-bg`), semánticos
(`--success/warning/danger/info-color` con sus variantes `-soft-bg` y
`-soft-border`), cuadrantes (`--q1..q4-color` / `-bg`) y efectos
(`--overlay-bg`, `--hover-wash`, `--stripe-wash`, `--shadow-sm/md/lg`).

Dos casos especiales que conviene conocer:

- **`--on-color-text`** — texto sobre rellenos de color (barras del Gantt,
  eventos del calendario). Se invierte con el tema: blanco en claro, porque los
  rellenos son colores oscuros; casi negro en oscuro, porque allí son pasteles
  claros. Fijarlo a blanco siempre haría ilegible el modo oscuro.
- **Colores pintados desde JS** — FullCalendar aplica estilos en línea y necesita
  valores resueltos, no `var(...)`. `useTheme().readThemeColors([...])` los lee
  del CSS y se recalcula al cambiar de tema, de modo que `main.css` sigue siendo
  la única fuente de verdad.

Los 44 pares de color relevantes cumplen el contraste mínimo de WCAG AA (4.5:1
en texto normal, 3:1 en texto grande e indicadores) en ambos temas.

Una excepción intencionada: el cuadrante IV (Eliminar) se queda gris claro en el
tema oscuro en vez de recuperar el gris original `#6b7280`. Con aquel valor el
texto sobre sus eventos del calendario bajaba a 3,9:1, y es el cuadrante neutro:
no gana nada con más color.

---

## Notas de desarrollo

- **Fechas siempre en horario local.** Evita `new Date("2026-08-12")` y `toISOString()` para fechas de calendario: interpretan y devuelven UTC, lo que desplaza el día. Usa el helper `parseDateTime()` de `useFilters.js`. A Google se le envía la hora local sin sufijo junto al campo `timeZone`.
- **No uses `alert()`.** Para avisos usa `useNotifications()`: `notifySuccess`, `notifyError`, `notifyWarning`, `notifyInfo`. Admiten un botón de acción y una `key` para no apilar duplicados.
- **Guarda en Firestore antes de sincronizar con Google.** Si se invierte el orden, un fallo de Google hace perder el dato que el usuario acaba de escribir.
- **El `build` avisa de que el bundle supera 500 kB.** Es esperado: Firebase y FullCalendar pesan. Se resolvería con carga diferida por ruta.
