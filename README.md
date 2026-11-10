# Foco

Pomodoro con video de YouTube en pantalla dividida. Monorepo TypeScript con
frontend y backend separados.

```
.
├── apps/
│   ├── mobile/          # App Expo (iOS, Android, web) — frontend
│   │   ├── App.tsx      # Login, video + stats a la izquierda, foco a la derecha
│   │   ├── middleware.ts # Basic Auth para el deploy web en Vercel
│   │   ├── vercel.json   # Build web + headers de seguridad
│   │   └── src/
│   │       ├── components/
│   │       │   ├── AccountBar.tsx       # Email + salir
│   │       │   ├── AuthPanel.tsx        # Login / registro
│   │       │   ├── AuthProvider.tsx     # Sesión + sincronización
│   │       │   ├── YouTubePane.tsx      # WebView nativo
│   │       │   ├── YouTubePane.web.tsx  # iframe para la build web
│   │       │   ├── YouTubePicker.tsx    # Buscador / link
│   │       │   ├── StatsPane.tsx        # Contenedor de estadísticas
│   │       │   ├── WeeklyStats.tsx      # Barras de la semana
│   │       │   └── TimerPane.tsx
│   │       ├── hooks/
│   │       │   ├── usePomodoro.ts       # Motor del timer (timestamp)
│   │       │   └── useWeeklyStats.ts
│   │       ├── lib/
│   │       │   ├── auth.ts              # Cliente de auth + tokens
│   │       │   ├── youtube.ts           # Parseo y validación de URLs
│   │       │   ├── youtubeSearch.ts     # YouTube Data API v3
│   │       │   └── sessionHistory.ts    # Historial local/caché + estadísticas
│   │       └── theme.ts
│   └── backend/         # Fastify + TypeScript — backend
│       ├── src/
│       │   ├── app.ts       # Plugins, CORS, errores
│       │   ├── auth.ts      # Registro/login, JWT y middleware
│       │   ├── config.ts    # GET /v1/config
│       │   ├── env.ts       # Validación de configuración (Zod)
│       │   ├── health.ts    # GET /health
│       │   ├── index.ts     # Arranque y shutdown
│       │   ├── load-env.ts  # Carga .env
│       │   ├── session.ts   # Esquema de sesión (Zod)
│       │   ├── sessions.ts  # GET/POST /v1/sessions
│       │   └── supabase.ts  # Clientes auth/admin/user
│       └── .env.example
├── package.json         # Workspaces npm
└── .gitignore
```

## Requisitos

- Node.js >= 22.13
- npm 10+

## Instalación

```bash
npm install
```

## Correr la app móvil

```bash
npm run mobile          # Expo dev server
npm run mobile:android  # Android
npm run mobile:ios      # iOS
npm run mobile:web      # Web (usa iframe)
```

## Conectar la app con el backend

En `apps/mobile/.env`:

```bash
EXPO_PUBLIC_API_URL=http://127.0.0.1:3001
```

En la web local funciona con `127.0.0.1`. Para el celular, usá la URL pública
del backend deployado (Render/Fly/Railway): `127.0.0.1` en el teléfono apunta
al teléfono, no a la PC.

## Login

El timer funciona sin cuenta. **YouTube y las estadísticas requieren iniciar
sesión**; si no hay sesión, la columna izquierda muestra el panel de acceso.
El registro pide el `SIGNUP_CODE` configurado en el backend.

## Buscador de YouTube (opcional)

El buscador por nombre usa la **YouTube Data API v3** y necesita una API key
gratuita. Sin key, la app sigue funcionando: se puede pegar una URL o un ID.

1. Entrá a https://console.cloud.google.com/apis/credentials
2. Creá un proyecto (o elegí uno existente).
3. Habilitá **YouTube Data API v3**.
4. Creá una **API key** y copiala.
5. Creá `apps/mobile/.env`:

   ```bash
   EXPO_PUBLIC_YOUTUBE_API_KEY=tu_key
   ```

6. Reiniciá Expo (`Ctrl+C` y de nuevo `npm run mobile`).

La key viaja en el bundle (`EXPO_PUBLIC_*` es público), así que no es un
secreto de backend: restringila a **YouTube Data API v3** y, cuando compiles
el APK, al paquete de Android. La cuota gratuita alcanza para ~100 búsquedas
por día.

## Estadísticas semanales

Cada fase completada se guarda en el dispositivo y, si hay sesión, se sube a
Supabase. Al iniciar sesión se baja el historial remoto y se une con el local.
La tarjeta **Esta semana** muestra los minutos de foco de lunes a domingo.

## Correr el backend

El backend usa **Supabase Auth** para login/registro y **Supabase Postgres**
para las sesiones. La app nunca ve la `service_role`: solo el backend la usa
para crear usuarios.

1. Creá un proyecto en [database.new](https://database.new).
2. En **Project Settings → API** copiá:
   - `Project URL` → `SUPABASE_URL`
   - `Publishable/anon key` → `SUPABASE_ANON_KEY`
   - `Service role key` → `SUPABASE_SERVICE_ROLE_KEY` (solo backend)
3. Copiá el `.env` y completalo:

   ```bash
   cp apps/backend/.env.example apps/backend/.env
   ```

4. En el **SQL Editor** de Supabase, corré:

   ```sql
   create table public.sessions (
     id text primary key,
     user_id uuid not null default auth.uid()
       references auth.users(id) on delete cascade,
     phase text not null check (phase in ('focus', 'short', 'long')),
     started_at timestamptz not null,
     ended_at timestamptz not null,
     duration_seconds integer not null check (duration_seconds > 0),
     completed boolean not null default true,
     created_at timestamptz not null default now()
   );

   alter table public.sessions enable row level security;

   create policy "sessions_select_own"
     on public.sessions for select
     using (auth.uid() = user_id);

   create policy "sessions_insert_own"
     on public.sessions for insert
     with check (auth.uid() = user_id);

   create policy "sessions_update_own"
     on public.sessions for update
     using (auth.uid() = user_id)
     with check (auth.uid() = user_id);

   create policy "sessions_delete_own"
     on public.sessions for delete
     using (auth.uid() = user_id);

   create index sessions_user_ended_idx
     on public.sessions (user_id, ended_at desc);

   grant select, insert, update, delete on public.sessions to authenticated;
   ```

5. En **Authentication → Providers → Email**, desactivá
   **"Allow new users to sign up"**. El registro de la app usa la
   `service_role` y el código `SIGNUP_CODE`; nadie puede registrarse directo
   contra Supabase.

6. Arrancá:

   ```bash
   npm run backend         # tsx watch en http://127.0.0.1:3001
   ```

En Render/Fly/Railway usá `HOST=0.0.0.0` y agregá la URL de la web a
`CORS_ORIGINS`.

### Endpoints

| Método | Ruta | Auth | Descripción |
|---|---|---|---|
| `GET` | `/health` | No | Estado del servicio |
| `GET` | `/v1/config` | No | Duraciones por defecto |
| `POST` | `/v1/auth/register` | Código de invitación | Crea usuario y devuelve JWT |
| `POST` | `/v1/auth/login` | No | Devuelve JWT + refresh token |
| `POST` | `/v1/auth/refresh` | No | Renueva el JWT |
| `GET` | `/v1/auth/me` | JWT | Usuario actual |
| `GET` | `/v1/sessions` | JWT | Últimas sesiones del usuario |
| `POST` | `/v1/sessions` | JWT | Registra una sesión |

```bash
# Login: copiá accessToken de la respuesta
curl -X POST http://127.0.0.1:3001/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"vos@ejemplo.com","password":"tu-password"}'

# Sesión
curl -X POST http://127.0.0.1:3001/v1/sessions \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"phase":"focus","startedAt":"2026-11-09T10:00:00Z","endedAt":"2026-11-09T10:25:00Z","durationSeconds":1500}'
```

El `user_id` lo pone el JWT y RLS verifica que coincida. No se puede leer ni
escribir una sesión de otro usuario.

## Checks

```bash
npm run typecheck     # mobile + backend
npm run lint          # mobile
npm run backend:build # compila el backend a dist/
```

## Publicar la web en Vercel (privada)

Vercel te da un dominio gratis `https://tu-app.vercel.app`; no hace falta
comprar uno. La web queda protegida con usuario y contraseña por
`apps/mobile/middleware.ts`.

### 1. Probar el build local

```bash
npm run build:web -w @foco/mobile
# genera apps/mobile/dist/
```

### 2. Crear el proyecto en Vercel

1. Subí el repo a GitHub.
2. En Vercel: **Add New → Project** e importá el repo.
3. Configurá:
   - **Root Directory**: `apps/mobile`
   - **Framework Preset**: Other
   - **Build Command**: `npm run build:web`
   - **Output Directory**: `dist`
4. En **Environment Variables** agregá:
   - `APP_USER` → el usuario que vas a compartir
   - `APP_PASSWORD` → una contraseña larga
   - `EXPO_PUBLIC_YOUTUBE_API_KEY` → tu key de YouTube
   - `EXPO_PUBLIC_API_URL` → la URL pública del backend
5. Deploy. En el backend, agregá la URL de Vercel a `CORS_ORIGINS`.

La web queda protegida por Basic Auth. Sin credenciales, Vercel responde
`401`; si faltan `APP_USER` o `APP_PASSWORD`, responde `500` (fail closed).

### 3. Compartir

Pasale a tus amigos:

- URL: `https://tu-app.vercel.app`
- Usuario: el de `APP_USER`
- Contraseña: la de `APP_PASSWORD`

El navegador les va a pedir esos datos una vez. No necesitan cuenta de Vercel.

### Notas

- La key de YouTube viaja en el bundle web: quien tenga acceso puede verla.
  Dejala restringida a **YouTube Data API v3**.
- Las estadísticas se guardan en Supabase por usuario (RLS). La app se conecta
  al backend en el próximo paso.
- Si cambiás `APP_USER` o `APP_PASSWORD`, hacé un redeploy para que tome los
  valores nuevos.

---

## Modelo de seguridad

### Qué está protegido

| Riesgo | Mitigación |
|---|---|
| Fuga de secretos | `.env` ignorado por git; `.env.example` sin valores reales |
| Abuso de la API key de YouTube | Key restringida a YouTube Data API v3 y al paquete de la app; solo permite búsquedas y tiene cuota |
| API expuesta a la red | Bind por defecto a `127.0.0.1`, no `0.0.0.0` |
| CORS abierto | Allowlist explícita; sin `*` y sin credenciales |
| Fuerza bruta / abuso | Rate limit global (100/min) y auth (5-20/min) |
| Inputs malformados | Validación Zod de todo lo que entra |
| Inyección / XSS en el WebView | La URL se construye solo con un ID de 11 caracteres (`[A-Za-z0-9_-]`) |
| Navegación del WebView a sitios ajenos | `onShouldStartLoadWithRequest` permite solo YouTube/Google |
| Acceso a archivos locales desde el WebView | `allowFileAccess={false}` |
| Contenido mixto HTTP | `mixedContentMode="never"` |
| Fuga de tokens en logs | `redact` de `authorization` y `cookie` |
| Filtración de errores internos | Handler devuelve códigos genéricos; stack solo en logs |
| Timing attacks en el código de invitación | `timingSafeEqual` |
| Acceso a datos de otro usuario | RLS en Postgres + JWT validado en el backend |
| Escalada con `service_role` | Solo backend; nunca en la app |
| Payloads gigantes | `bodyLimit` de 16 KB |
| Conexiones colgadas | `connectionTimeout` y `requestTimeout` |

### Qué NO está resuelto todavía

- **TLS**: en local es HTTP. En producción va detrás de un proxy con HTTPS
  (Fly.io, Railway, Caddy, Cloudflare).
- **Rate limit distribuido**: el actual es en memoria, por instancia.
- **Revocación al logout**: la app borra los tokens; el access token expira en
  1 hora.
- **Confirmación de email**: el registro usa `email_confirm: true`. Si querés
  verificar emails, hay que configurar SMTP.
- **Rotación de secretos**: pendiente.
- **Tests**: no hay suite todavía.

### Reglas para el frontend

- **Nunca** poner secretos en la app: todo lo que va al bundle es público
  (`EXPO_PUBLIC_*` incluido). La única excepción es la API key de YouTube: es
  una credencial de solo búsqueda, limitada por cuota, y debe ir restringida a
  YouTube Data API v3.
- Tokens de usuario: `expo-secure-store` en nativo; en web, `localStorage`.
  Nunca en `AsyncStorage`.
- `AsyncStorage` solo guarda preferencias no sensibles (el ID del video) y el
  historial de estudio local/caché.

### Nota legal

La app usa el **reproductor oficial embebido** de YouTube. No descarga, no
extrae streams y no reproduce en segundo plano. El video debe permanecer
visible (mitad superior), que es la condición de uso del IFrame Player.

---

## Decisiones de arquitectura

- **Sin paquete `shared` todavía**: la app consume la API con tipos locales.
  Si crece, extraemos `packages/shared` (o generamos tipos desde OpenAPI).
- **Supabase Postgres + Auth**: RLS por usuario, sin JSON en disco. El backend
  valida el JWT y no genera tokens propios.
- **`endAt` en vez de contador**: el timer es correcto aunque la app se
  suspenda o se recargue.
