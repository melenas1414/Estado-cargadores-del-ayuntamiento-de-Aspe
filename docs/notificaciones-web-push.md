# Sistema de Notificaciones Web Push

## Actualizacion: Bot Telegram + notificaciones temporales

El sistema pasa a gestionarse desde un bot de Telegram y n8n, usando Supabase como persistencia:

- El bot muestra el listado de cargadores disponibles con botones inline.
- El usuario crea y elimina suscripciones desde el propio chat.
- El usuario puede ver su listado de notificaciones activas.
- La prioridad se guarda en `telegram_users.is_priority`, ya no en una CSV de entorno.
- El workflow de notificaciones envia primero a prioritarios y luego al resto con una espera inferior a 2 minutos.

### Variables de entorno nuevas

```
N8N_NOTIFY_WEBHOOK_SECRET=
```

### Workflows n8n implicados

- `scripts/n8n/telegram-subscriptions-bot-workflow.json`
  - Gestiona `/start`, menú principal, listado de cargadores, creación y borrado de alertas, consulta de alertas activas y toggle de prioridad.
- `scripts/n8n/telegram-notifications-db-workflow.json`
  - Lee `charging_logs`, detecta transiciones ocupado -> libre, envía prioridad primero y después la ola regular.

### Flujo recomendado en n8n para prioridad

Flujo nuevo recomendado (sin endpoint API de notificaciones en la app):

1. Workflow `Iberdrola -> Supabase Aspe` inserta muestras en `charging_logs`.
2. Al final, nodo `Disparar notificaciones n8n` llama webhook interno de n8n.
3. Workflow `Telegram notifications from DB`:
  - Detecta transiciones ocupado -> libre en ventana reciente.
  - Envia primero a usuarios con `telegram_users.is_priority = true`.
  - Espera (`regularWaveWaitSeconds`) por defecto 75s.
  - Envia la ola regular.
  - Registra deduplicacion en `notification_dispatches`.
  - Desactiva automaticamente las alertas `first_only` tras el primer envio.

Cabecera requerida para el webhook interno de notificaciones:

```
x-notify-secret: <N8N_NOTIFY_WEBHOOK_SECRET>
```

Archivos de referencia:

- `scripts/n8n/telegram-subscriptions-bot-workflow.json`
- `scripts/n8n/telegram-notifications-db-workflow.json`

Body minimo para el webhook interno de notificaciones:

```json
{
  "eventKey": "libre_ahora:ESIBE22E0001001:2026-05-20T09:00:00Z",
  "stationId": "ESIBE22E0001001",
  "message": "Tu cargador suscrito esta disponible ahora.",
  "url": "https://cargadores-aspe.onlineexpansions.com/charger/ESIBE22E0001001",
  "wave": "priority"
}
```
2. Service Worker básico
3. Endpoint `/api/subscriptions/subscribe`
4. Evento `libre_ahora` en `/api/notifications/trigger`
5. Botón de suscripción en el header

Dejar para fase 2: `riesgo_saturacion`, `horario_valle`, configuración por estación, quiet hours personalizables.
