# Agenda EH — Matriz de Eisenhower

Agenda de gestión de tareas que organiza el trabajo según la **Matriz de Eisenhower** (urgente × importante) y lo mantiene sincronizado con **Google Calendar** y **Gmail**.

Las tareas se guardan en Firestore y se reflejan en tiempo real en todas las vistas y pestañas abiertas. Si una tarea tiene fechas, se crea automáticamente el evento correspondiente en el calendario del usuario; si tiene un responsable asignado, se le puede avisar por correo.

---

## Índice

- [Funcionalidades](#funcionalidades)
- [Stack](#stack)
- [Puesta en marcha](#puesta-en-marcha)
- [Configuración de Google Cloud](#configuración-de-google-cloud)
- [Estructura del proyecto](#estructura-del-proyecto)
- [Modelo de datos](#modelo-de-datos)
- [Cómo funciona la sesión de Google](#cómo-funciona-la-sesión-de-google)
- [Temas claro y oscuro](#temas-claro-y-oscuro)
- [Despliegue](#despliegue)
- [Notas de desarrollo](#notas-de-desarrollo)

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

- **Vue 3** (Composition API, `<script setup>`) + **Vue Router**
- **Vite** como bundler
- **Firebase** — Authentication (Google), Firestore, Hosting
- **FullCalendar** para la vista de calendario
- **Google Identity Services** para renovar el token OAuth sin interrumpir al usuario

Sin librería de estado ni de UI: el estado compartido son composables singleton y los estilos son CSS propio con variables en `src/assets/styles/main.css`.

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
