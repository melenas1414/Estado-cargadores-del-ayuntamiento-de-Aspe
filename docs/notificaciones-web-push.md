# Sistema de Notificaciones Web Push

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
