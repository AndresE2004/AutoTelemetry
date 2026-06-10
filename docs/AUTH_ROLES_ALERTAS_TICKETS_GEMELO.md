# Autenticación, roles demo, alertas, tickets y gemelo por WebSocket

**Propósito:** documentar en un solo lugar el bloque de trabajo anterior al refinamiento de **reportes ejecutivos vs operativos**. Para la política concreta de exportaciones (`/reports`), usar **`docs/RBAC_REPORTES_Y_ACCESO.md`**.

**Referencia cronológica en bitácora:** `docs/REGISTRO_AVANCES.md` — entradas **2026-05-04** (auth), **2026-05-06** (WebSocket gemelo, tickets desde anomalía, reportes).

---

## 1. Autenticación y sesión (API + navegador)

| Elemento | Descripción |
|----------|-------------|
| **Login** | `POST /auth/login` con formulario OAuth2 (`username` = correo, `password`). Respuesta `TokenPair` y **`Set-Cookie` HttpOnly** para el access JWT (`AUTH_COOKIE_NAME`, p. ej. `telema_access`). |
| **Tokens** | Access JWT (HS256, `JWT_SECRET`, duración `JWT_ACCESS_MINUTES`). Refresh JWT con claim `typ: refresh` y `JWT_REFRESH_DAYS`. |
| **Refresh** | `POST /auth/refresh` con cuerpo `{ "refresh_token": "..." }`; devuelve nuevo par y renueva la cookie de access. El cliente guarda el refresh en **`localStorage`** (`lib/auth-session.ts`). |
| **Sesión actual** | `GET /auth/me` — acepta **Authorization: Bearer** o cookie HttpOnly (`get_token_from_request`). |
| **Swagger** | `OAuth2PasswordBearer` con `auto_error=False` para permitir también cookie en navegador y que **`/docs`** muestre **Authorize**. |
| **Frontend** | Ruta **`/login`** (`app/login/page.tsx`). Tras login válido, las llamadas a la API usan **`credentials: "include"`** donde aplica (`lib/api.ts`) para enviar la cookie. **`AuthGuard`** (`components/auth/auth-guard.tsx`) valida sesión antes de mostrar páginas protegidas y refresca tokens periódicamente (`ACCESS_REFRESH_INTERVAL_MS` en `lib/auth-session.ts`). |

**Configuración recomendada en local:** `NEXT_PUBLIC_API_URL` apuntando al mismo host que el navegador usará para la API (**p. ej. `http://127.0.0.1:8000`**) para que CORS + cookie funcionen de forma predecible entre front (`:3000`) y API (`:8000`).

**Código de referencia:** `backend/app/api/auth.py`, `backend/app/core/security.py`, `backend/app/core/config.py`, `lib/auth-session.ts`, `lib/api.ts`.

---

## 2. Roles, menú lateral y rutas (visión general)

La matriz de **features por rol** vive en **`lib/rbac.ts`** (`Role`, tipo `Feature`, función `can`). El menú (`components/app-sidebar.tsx`) solo muestra enlaces permitidos.

La función **`canAccessPathname(role, pathname)`** en **`lib/route-features.ts`** traduce la primera parte de la URL (`/flota`, `/alertas`, `/usuarios`, etc.) al feature correspondiente y decide si el rol puede entrar. Así se evita que un usuario abra por URL directa una pantalla que no aparece en el menú.

**`AuthGuard`** usa esa misma lógica y muestra un mensaje de “sin permiso” cuando la ruta no está autorizada.

> **Nota:** Los permisos específicos de **reportes** (ejecutivos vs operativos) se documentan aparte en **`RBAC_REPORTES_Y_ACCESO.md`**.

### Resumen orientativo del menú por rol

| Rol | Idea general |
|-----|----------------|
| **admin** | Acceso completo, incluida gestión de **usuarios** (`/usuarios`). |
| **fleet_manager** | Similar al admin salvo **usuarios**; incluye **Optimización GA** en menú. |
| **technician** | Operación, laboratorio, alertas, etc.; **sin Optimización GA**. |
| **viewer** | Observabilidad (flota, telemetría, alertas en solo lectura, pipeline, ajustes); sin gemelos/lab según matriz actual. |

Los detalles exactos (lista de `Feature` por rol) deben leerse siempre en **`lib/rbac.ts`** por si la matriz evoluciona.

---

## 3. Usuarios demo y seed

Tras **`python scripts/seed_demo.py`** (desde `backend/` con BD migrada) existen cuatro cuentas de demostración:

| Email | Contraseña (demo) | Rol |
|-------|-------------------|-----|
| `admin@telema.example` | `Admin12345!` | `admin` |
| `fleet@telema.example` | `FleetMgr12345!` | `fleet_manager` |
| `technician@telema.example` | `Technician12345!` | `technician` |
| `viewer@telema.example` | `Viewer12345!` | `viewer` |

**Script:** `backend/scripts/seed_demo.py`. El orden de borrado en modo reset contempla **dependencias de FK** (p. ej. **`maintenance_tickets`** y **`anomaly_events`** antes de **`vehicles`**) para poder reprovisionar el cliente/flota demo sin errores de integridad referencial.

---

## 4. Alertas y detección de anomalías

| Elemento | Descripción |
|----------|-------------|
| **API** | Prefijo `/anomalies` — listados y **`POST /anomalies/run`** para ejecutar Isolation Forest sobre ventanas de `telemetry_readings` y persistir en **`anomaly_events`**. Rutas protegidas con **`require_auth`**; operaciones sensibles usan **`require_roles`** según el endpoint (`backend/app/api/anomalies.py`). |
| **Configuración** | La API usa **`get_settings()`** (`app/core/config.py`) para variables como URLs de base de datos, coherentes con el resto de la aplicación. |
| **UI** | **`app/alertas/page.tsx`** y **`components/alertas/alertas-panel.tsx`** consumen `lib/api.ts`. |
| **Viewer** | Rol **`viewer`**: en alertas se aplica **solo lectura** (sin ejecutar detección ni crear tickets), según **`isAlertasReadOnly`** en **`lib/rbac.ts`** y la lógica del panel. |

Documentación ampliada del modelo ML y endpoints: sección **«Anomalías»** en **`docs/REGISTRO_AVANCES.md`**.

---

## 5. Tickets (crear, listar, actualizar)

| Elemento | Descripción |
|----------|-------------|
| **Crear** | **`POST /tickets/from-anomaly`** — crea fila en **`maintenance_tickets`** y enlaza **`anomaly_events.ticket_id`**. Cuerpo con identificadores de la anomalía (incl. tiempo por PK compuesta en Timescale). **`require_roles`**: **admin**, **technician**, **fleet_manager**. |
| **Listar / ver** | **`GET /tickets`** (query `status`, `vehicle_id`, `limit`), **`GET /tickets/{id}`**. **`require_roles`**: **admin**, **technician**, **fleet_manager**, **viewer**. |
| **Actualizar** | **`PATCH /tickets/{id}`** — JSON con `status` y/o `priority` (al menos uno). **`require_roles`**: **admin**, **technician**, **fleet_manager** (no **viewer**). |
| **Código** | `backend/app/api/tickets.py`, esquemas `backend/app/schemas/ticket.py`. |
| **UI** | **`/tickets`** — `components/tickets/tickets-panel.tsx` (tabla, filtros, selectores de estado/prioridad). **`/alertas`** — botón **Crear ticket**, enlace **Ver tickets**; **`isTicketsReadOnly`** en **`lib/rbac.ts`** para **viewer** (solo lectura en `/tickets`). |

---

## 6. Gemelo digital por WebSocket

| Elemento | Descripción |
|----------|-------------|
| **Endpoint** | **`/ws/twin/{vehicle_id}`** con query opcional **`scenario`** (`normal`, `overheating`, `battery_failure`). Frecuencia aproximada ~2 Hz. |
| **Payload** | JSON alineado con **`TwinTelemetryFrame`** en el cliente (`lib/digital-twin-types.ts`). |
| **Lógica servidor** | `backend/app/twin_synthetic.py` (`next_twin_frame`). |
| **Cliente** | `hooks/use-twin-websocket.ts`; variable **`NEXT_PUBLIC_TWIN_WS_URL`** (p. ej. `ws://127.0.0.1:8000`). |
| **Seguridad** | En la versión demo documentada, el WS **no** valida cookie/token; si se expone en producción, conviene añadir autenticación explícita (token en query/subprotocolo, etc.). |

Detalle de troubleshooting: entrada **«WebSocket gemelo digital»** del **2026-05-06** en **`docs/REGISTRO_AVANCES.md`**.

---

## 7. Tabla de referencias rápidas

| Tema | Ubicación en código |
|------|---------------------|
| Login / JWT / roles en API | `backend/app/api/auth.py` |
| RBAC menú y features | `lib/rbac.ts` |
| Mapa pathname → permiso | `lib/route-features.ts` |
| Protección de páginas | `components/auth/auth-guard.tsx` |
| Contexto usuario en cliente | `components/auth/auth-context.tsx` |
| Seed y usuarios demo | `backend/scripts/seed_demo.py` |
| Anomalías | `backend/app/api/anomalies.py`, `backend/ml/isolation_detector.py` |
| Tickets | `backend/app/api/tickets.py`, `app/tickets/page.tsx`, `components/tickets/tickets-panel.tsx` |
| WS gemelo | `backend/app/main.py` (montaje), `backend/app/twin_synthetic.py` |

---

*Este documento complementa la bitácora técnica del proyecto; ante discrepancia con el código, prevalece el repositorio.*
