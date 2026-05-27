# Sistema de Notificaciones Web Push

## Actualizacion: Login Telegram + notificaciones temporales

Se ha iniciado la implementacion de un sistema paralelo por Telegram (sin reemplazar aun el plan Web Push):

- Login web con Telegram oficial (hash firmado por Telegram Login).
- Suscripciones temporales por cargador o por zona.
- Trigger de notificaciones con envio directo desde n8n a Telegram, en dos olas:
  - Ola `priority`: usuarios definidos en variable de entorno/config.
  - Ola `regular`: resto de suscriptores, tras espera en n8n inferior a 2 minutos.

### Variables de entorno nuevas

```
TELEGRAM_BOT_TOKEN=
NUXT_PUBLIC_TELEGRAM_BOT_USERNAME=
NUXT_PUBLIC_TELEGRAM_BOT_ID=
TELEGRAM_SESSION_SECRET=
TELEGRAM_AUTH_CHALLENGE_TTL_SECONDS=600
TELEGRAM_SESSION_TTL_DAYS=14
TELEGRAM_CLAIM_SECRET=
NOTIFICATION_TRIGGER_SECRET=
PRIORITY_TELEGRAM_USERS=
PRIORITY_MATCH_FIELD=telegram_user_id
PRIORITY_NOTIFY_DELAY_SECONDS=120
```

### Endpoints implementados (MVP backend)

- `POST /api/subscriptions/cancel` -> cancela suscripciones activas del usuario (por `subscriptionId`, `stationId`, `zone` o `all=true`).

### Persistencia de login en app

- Se ha añadido restauracion automatica de sesion al arrancar cliente.
- El plugin cliente consulta `GET /api/auth/session` y actualiza estado global (`user`, `isAuthenticated`).
- Si hay cookie valida, el usuario permanece logueado entre recargas sin relogin manual.

### Flujo recomendado en n8n para prioridad

Flujo nuevo recomendado (sin endpoint API de notificaciones en la app):

1. Workflow `Iberdrola -> Supabase Aspe` inserta muestras en `charging_logs`.
2. Al final, nodo `Disparar notificaciones n8n` llama webhook interno de n8n.
3. Workflow `Telegram notifications from DB`:
  - Detecta transiciones ocupado -> libre en ventana reciente.
  - Envia primero a usuarios prioritarios.
  - Espera (`regularWaveWaitSeconds`) por defecto 75s.
  - Envia la ola regular.
  - Registra deduplicacion en `notification_dispatches`.

Cabecera requerida para el webhook interno de notificaciones:

```
x-notify-secret: <N8N_NOTIFY_WEBHOOK_SECRET>
```

Archivo del nuevo flujo: `scripts/n8n/telegram-notifications-db-workflow.json`.

### Flujo de login Telegram oficial (app)

La app ya no depende de un workflow n8n para autenticar usuarios.

1. Frontend abre `Telegram.Login.auth(...)` con `NUXT_PUBLIC_TELEGRAM_BOT_ID`.
2. Telegram devuelve payload firmado (`id`, `auth_date`, `hash`, etc.).
3. Backend valida la firma en `POST /api/auth/telegram/widget-login`.
4. Si es valido, crea/actualiza usuario y emite cookie de sesion web.

Body minimo:

```json
{
  "eventKey": "libre_ahora:ESIBE22E0001001:2026-05-20T09:00:00Z",
  "stationId": "ESIBE22E0001001",
  "message": "Tu cargador suscrito esta disponible ahora.",
  "url": "https://cargadores-aspe.onlineexpansions.com/charger/ESIBE22E0001001",
  "wave": "priority"
}
```

## Estado: ⏳ Pendiente de implementar

---

## Objetivo

Enviar notificaciones push nativas al dispositivo del usuario cuando:
- Un cargador que estaba ocupado **queda libre**
- Una zona tiene **riesgo de saturación** (todos ocupados en breve)
- (Futuro) Recordatorio de recarga en horario de tarifa valle

---

## Arquitectura

```
GitHub Actions scraper (cada 5 min)
       ↓ POST /api/notifications/trigger
   Nuxt server (web-push + VAPID keys)
       ↓ HTTPS firmado con VAPID
   Browser Push Server (Google FCM / Mozilla autopush)
       ↓
   Service Worker (sw.js) → Notificación nativa del SO
```

---

## Checklist de implementación

### 1. Preparación del proyecto
- [ ] Instalar dependencias: `npm install web-push @vite-pwa/nuxt`
- [ ] Generar claves VAPID una sola vez:
  ```bash
  npx web-push generate-vapid-keys
  ```
- [ ] Añadir las claves a las variables de entorno (`.env` local y secretos de Vercel/GitHub):
  ```
  VAPID_PUBLIC_KEY=...
  VAPID_PRIVATE_KEY=...
  VAPID_SUBJECT=mailto:info@onlineexpansions.com
  ```

### 2. Base de datos (Supabase)
- [ ] Ejecutar el siguiente SQL en Supabase:
  ```sql
  CREATE TABLE push_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    endpoint TEXT NOT NULL UNIQUE,
    p256dh TEXT NOT NULL,
    auth TEXT NOT NULL,
    station_ids TEXT[] NOT NULL DEFAULT '{}',  -- vacío = todas las estaciones
    quiet_hours_start INT NOT NULL DEFAULT 22, -- hora local Europe/Madrid
    quiet_hours_end INT NOT NULL DEFAULT 8,
    cooldown_minutes INT NOT NULL DEFAULT 30,
    last_notified_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
  );

  -- El endpoint ya es único por dispositivo+navegador (lo genera Google/Mozilla)
  -- ON CONFLICT (endpoint) DO NOTHING en los inserts evita duplicados sin login

  -- RLS: solo el service role puede leer/escribir
  ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;
  CREATE POLICY "service_role_only" ON push_subscriptions
    USING (auth.role() = 'service_role');
  ```

### 3. PWA / Service Worker
- [ ] Configurar `@vite-pwa/nuxt` en `nuxt.config.ts`:
  ```ts
  modules: ['@vite-pwa/nuxt'],
  pwa: {
    registerType: 'autoUpdate',
    manifest: {
      name: 'Cargadores Aspe',
      short_name: 'Cargadores',
      theme_color: '#1a1a1a',
      icons: [
        { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
        { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
      ],
    },
    workbox: {
      navigateFallback: '/',
    },
  }
  ```
- [ ] Crear `public/sw-push.js` (manejador del evento push):
  ```js
  self.addEventListener('push', (event) => {
    const data = event.data?.json() ?? {}
    event.waitUntil(
      self.registration.showNotification(data.title ?? 'Cargadores Aspe', {
        body: data.body ?? '',
        icon: '/icon-192.png',
        badge: '/icon-64.png',
        data: { url: data.url ?? '/' },
      })
    )
  })

  self.addEventListener('notificationclick', (event) => {
    event.notification.close()
    event.waitUntil(clients.openWindow(event.notification.data.url))
  })
  ```

### 4. Endpoints del servidor (Nuxt)
- [ ] `server/api/subscriptions/subscribe.post.ts` — guarda la suscripción en Supabase usando `ON CONFLICT (endpoint) DO NOTHING` para evitar duplicados si el usuario pulsa varias veces
- [ ] `server/api/subscriptions/unsubscribe.post.ts` — elimina la suscripción por `endpoint`
- [ ] `server/api/notifications/trigger.post.ts` — llamado por el scraper tras insertar; compara estado anterior/actual y envía push si hay cambio relevante

### 5. Frontend
- [ ] Componente `NotificationBell.vue` — botón para activar/desactivar notificaciones
- [ ] Lógica: `requestNotificationPermission()` → `serviceWorker.subscribe()` → POST a `/api/subscriptions/subscribe`
- [ ] Añadir el componente al header de `app.vue`

### 6. Integración con el scraper
- [ ] Al final de `scripts/iberdrola-scraper.mjs`, tras `insertRows()`, hacer un POST a `/api/notifications/trigger` con las filas insertadas como payload
- [ ] El endpoint compara con el estado previo en `charger_current_status` y determina qué notificaciones enviar

---

## Reglas de negocio para el envío

| Evento | Condición | Cooldown |
|--------|-----------|----------|
| `libre_ahora` | Estación pasa de 0 libres → ≥1 libre | 30 min por estación |
| `riesgo_saturacion` | Municipio ≥80% ocupado | 60 min global |
| `horario_valle` | (futuro) 22:00–08:00 si hay libres | 1 vez por noche |

- No enviar durante `quiet_hours` (22:00–08:00 Europe/Madrid por defecto)
- No enviar si `last_notified_at` < ahora - cooldown

---

## MVP recomendado (fase 1)

Implementar solo:
1. Tabla `push_subscriptions`
2. Service Worker básico
3. Endpoint `/api/subscriptions/subscribe`
4. Evento `libre_ahora` en `/api/notifications/trigger`
5. Botón de suscripción en el header

Dejar para fase 2: `riesgo_saturacion`, `horario_valle`, configuración por estación, quiet hours personalizables.
