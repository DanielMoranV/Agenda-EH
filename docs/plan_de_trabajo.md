# Plan de Trabajo Detallado: Agenda Dinámica — Matriz de Eisenhower

Este plan de trabajo desglosa las 5 fases establecidas en el **Documento de Especificaciones Técnicas** en pasos accionables para garantizar un desarrollo ordenado y sistemático del proyecto.

## Fase 1: Pruebas de Concepto (PoC) Backend y Calendar API
*Objetivo: Validar la viabilidad de la integración con Google Calendar antes de construir la aplicación completa.*

- [ ] **1.1 Configuración en Google Cloud:** Crear un proyecto en Google Cloud Console, habilitar la **Google Calendar API** y configurar la pantalla de consentimiento.
- [ ] **1.2 Credenciales:** Generar credenciales OAuth 2.0 (Client ID y Client Secret).
- [ ] **1.3 Script de Autorización:** Desarrollar un script aislado para probar el flujo de autorización OAuth 2.0 y obtener los tokens de acceso/refresco (scopes de escritura para eventos).
- [ ] **1.4 Inyección de Evento de Prueba:** Programar la creación de un evento de prueba mediante una petición REST, inyectando obligatoriamente el payload de notificaciones (`reminders.overrides`).
- [ ] **1.5 Validación:** Comprobar que el evento aparece en el calendario y que las notificaciones (push/email) se disparan correctamente en los dispositivos.

## Fase 2: Arquitectura Base e Infraestructura
*Objetivo: Sentar las bases del proyecto frontend y configurar los servicios de backend (BaaS).*

- [ ] **2.1 Inicialización Frontend:** Crear el proyecto Vue 3 (Composition API) utilizando Vite (`npm create vite@latest`).
- [ ] **2.2 Configuración de Firebase:** Crear el proyecto en Firebase Console, registrar la app web y habilitar **Firestore Database**, **Authentication** y **Hosting**.
- [ ] **2.3 Integración del SDK:** Instalar y configurar el SDK de Firebase en el proyecto Vue.
- [ ] **2.4 Estructura del Proyecto:** Definir la arquitectura de carpetas (ej. `src/components`, `src/views`, `src/services/firebase`, `src/composables`).
- [ ] **2.5 Modelado de Base de Datos:** Crear la estructura de la colección `tareas` en Firestore según el esquema JSON definido en las especificaciones.

## Fase 3: Desarrollo de UI/UX (Interfaz de Usuario)
*Objetivo: Construir la capa visual priorizando la reactividad y el diseño adaptativo.*

- [ ] **3.1 Sistema de Diseño:** Configurar estilos base (CSS/SCSS) asegurando una estética moderna. Implementar el layout principal.
- [ ] **3.2 Vistas de Autenticación:** Maquetar las pantallas de Login y Registro (correo/contraseña y botón de vinculación con Google).
- [ ] **3.3 Matriz de Eisenhower (Grilla):** Desarrollar el layout de 4 cuadrantes. Debe ser una grilla 2x2 en escritorio que colapse fluidamente a 1 columna en resoluciones móviles (RNF-04).
- [ ] **3.4 Tarjetas de Tarea:** Crear el componente visual de la tarea, mostrando título, descripción, fechas y estado.
- [ ] **3.5 Formularios y Modales:** Construir modales interactivos para la creación, edición y visualización detallada de las tareas.

## Fase 4: Integración del Flujo Completo
*Objetivo: Conectar la interfaz gráfica con la base de datos en tiempo real y la API externa.*

- [ ] **4.1 Lógica de Autenticación (RF-01):** Implementar Firebase Auth para el inicio de sesión y gestionar la vinculación con Google Calendar guardando los tokens de forma segura.
- [ ] **4.2 CRUD de Tareas en Firestore (RF-02):** Implementar la creación, lectura, actualización y eliminación de tareas. Utilizar `onSnapshot` para que la vista se actualice en tiempo real sin recargar la página (RNF-01).
- [ ] **4.3 Clasificación Dinámica:** Programar la lógica en Vue para que cada tarea se renderice en su cuadrante correspondiente computando dinámicamente los valores booleanos `es_urgente` y `es_importante`.
- [ ] **4.4 Sincronización Bidireccional Base (RF-04 & RF-05):** Conectar el guardado de tareas con la API de Google Calendar. Si una tarea tiene fechas, enviar el payload, recibir el `calendar_event_id` y guardarlo en el documento de Firestore.
- [ ] **4.5 Reubicación Visual:** Asegurar que al editar la importancia/urgencia de una tarea, esta cambie de cuadrante instantáneamente en la UI.

## Fase 5: Testing, Seguridad y Despliegue
*Objetivo: Asegurar la aplicación y publicarla en producción.*

- [ ] **5.1 Reglas de Seguridad (RNF-03):** Escribir e implementar *Firebase Security Rules* restrictivas para que cada usuario solo pueda leer/escribir documentos donde el `user_id` coincida con su token de autenticación.
- [ ] **5.2 Pruebas de Flujo End-to-End:** Validar el registro de usuario, vinculación de calendario, creación de tareas y comprobación de eventos en Google Calendar.
- [ ] **5.3 Auditoría de Responsividad:** Probar la usabilidad de la matriz y formularios en distintas resoluciones (móviles y tablets).
- [ ] **5.4 Compilación para Producción:** Ejecutar el build de Vite (`npm run build`) resolviendo posibles warnings o errores.
- [ ] **5.5 Despliegue Final:** Configurar e inicializar Firebase Hosting (`firebase init hosting`) y desplegar la aplicación web a producción (`firebase deploy`).
