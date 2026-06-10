# RBAC: reportes ejecutivos vs operativos y control de acceso

**Ámbito:** aplicación web (Next.js), API (FastAPI), usuarios demo del seed.  
**Última revisión documentada:** 2026-05.

**Documentación relacionada:** autenticación, matriz general del menú y rutas, usuarios demo, alertas, tickets y gemelo por WebSocket → **`docs/AUTH_ROLES_ALERTAS_TICKETS_GEMELO.md`**.

## 1. Objetivo

Separar los permisos de **reportes ejecutivos** (vista de gestión: salud de flota y KPI de mantenimiento) de los **reportes operativos** (export detallado de anomalías para operación/taller), tanto en la interfaz como en la API, de modo que el **gerente de flotas** no acceda al export crudo de anomalías y el **técnico** no acceda a los informes ejecutivos.

## 2. Definición de capacidades (frontend)

En `lib/rbac.ts` existen dos features independientes:

| Feature | Uso |
|---------|-----|
| `reportes_ejecutivos` | Vista ejecutiva en `/reportes`: gráficos, KPI y **indicadores económicos demostrativos** (no CSV/JSON como vista principal). Los datos siguen viniendo de la API en JSON consumido por el cliente. |
| `reportes_operativos` | Descarga técnica **CSV/JSON** de anomalías (`GET /reports/anomalies`). |

La función `canAccessReportes(role)` devuelve verdadero si el rol tiene **al menos una** de las dos capacidades; sirve para mostrar el ítem **Reportes** en el menú y para permitir la ruta `/reportes`.

## 3. Matriz por rol (resumen)

| Rol | Reportes ejecutivos | Reportes operativos |
|-----|---------------------|---------------------|
| `admin` | Sí | Sí |
| `fleet_manager` | Sí | No |
| `technician` | No | Sí |
| `viewer` | Sí | No |

El resto del menú lateral sigue la matriz definida en `lib/rbac.ts` (usuarios, gemelo digital, laboratorio, optimización GA, etc.).

## 4. Protección de rutas (frontend)

- **`lib/route-features.ts`:** la función `canAccessPathname(role, pathname)` determina si una URL puede abrirse con el rol actual. El segmento `/reportes` usa `canAccessReportes(role)` en lugar de un único feature genérico.
- **`components/auth/auth-guard.tsx`:** tras validar sesión, rechaza con mensaje de “sin permiso” si `canAccessPathname` es falso (incluye acceso directo por URL, no solo por menú).
- **`components/app-sidebar.tsx`:** el enlace a `/reportes` se muestra solo cuando `canAccessReportes(role)` es verdadero.
- **`app/reportes/page.tsx`:** quien tiene ejecutivos ve el panel **`ReportesEjecutivosPanel`** (gráficos + métricas monetarias **ilustrativas**). Quien tiene solo operativos ve el bloque de descarga CSV/JSON de anomalías. El **admin** (ambos permisos) ve primero el panel ejecutivo y un acordeón colapsable **«Exportación técnica»** para el CSV/JSON de anomalías.

## 5. Protección de API (FastAPI)

Router de reportes: `backend/app/api/reports.py`. Todas las rutas exigen autenticación (`require_auth` a nivel de router). Además:

| Endpoint | Roles autorizados |
|----------|-------------------|
| `GET /reports/anomalies` | `admin`, `technician` |
| `GET /reports/fleet-health/{fleet_id}` | `admin`, `fleet_manager`, `viewer` |
| `GET /reports/maintenance-kpi` | `admin`, `fleet_manager`, `viewer` |

Los roles no listados reciben **403 Forbidden** al llamar al endpoint correspondiente.

## 6. Optimización GA y técnico

La **Optimización GA** está expuesta como **ruta de aplicación** (`/optimizacion`), protegida por la misma matriz de features que el menú (`optimizacion` no está asignado al rol `technician`). El guard de rutas impide abrir la pantalla por URL directa sin permiso.

**Nota para mantenimiento:** si en el futuro la lógica de optimización se expone también como endpoints REST en FastAPI, debe aplicarse el mismo patrón (`require_roles` u otro control explícito por recurso), porque la seguridad del navegador no sustituye la autorización en servidor.

## 7. Referencias de código

| Tema | Ubicación principal |
|------|---------------------|
| Matriz de features por rol | `lib/rbac.ts` |
| Mapa ruta → permiso | `lib/route-features.ts` |
| Sesión y bloqueo por URL | `components/auth/auth-guard.tsx` |
| Menú lateral | `components/app-sidebar.tsx` |
| UI `/reportes` (ejecutivo vs técnico) | `app/reportes/page.tsx`, `components/reportes/reportes-ejecutivos-panel.tsx` |
| Export CSV/JSON y RBAC HTTP | `backend/app/api/reports.py` |
| Bitácora de avances del proyecto | `docs/REGISTRO_AVANCES.md` |

## 8. Usuarios demo

Las credenciales y roles de prueba se crean con `backend/scripts/seed_demo.py` (cuentas `admin@`, `fleet@`, `technician@`, `viewer@`, etc.). Para validar esta política, iniciar sesión con cada rol y comprobar menú, página `/reportes` y llamadas a `/reports/*` en Swagger o cliente HTTP con cookie/token válidos.
