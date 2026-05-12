# Tesla M3 Popup - Google Analytics Tracking

## 📊 Eventos Registrados en Google Analytics (100% GA)

**⚠️ IMPORTANTE:** 
- Todo el tracking se realiza ÚNICAMENTE a través de Google Analytics
- NO hay localStorage de datos de analytics (eliminado)
- sessionStorage solo para control "mostrar popup una vez por sesión"

El popup de Tesla M3 registra automáticamente los siguientes eventos en Google Analytics:

### 1. **Impresión del Popup**
- **Evento:** `tesla_m3_popup_impression`
- **Categoría:** `impression`
- **Label:** `tesla_referral_popup`
- **Valor:** `1`
- **Cuándo:** Se dispara cuando el popup se muestra (4 segundos después de cargar la página)
- **Uso:** Mide cuántas veces se vio el popup

### 2. **Click en Botón CTA Principal**
- **Evento:** `tesla_m3_popup_cta_click`
- **Categoría:** `engagement`
- **Label:** `tesla_referral_cta`
- **Valor:** `1`
- **Cuándo:** Se dispara cuando el usuario hace clic en "QUIERO MI TESLA AHORA"
- **Uso:** Mide conversiones/clics que salen hacia Tesla

### 3. **Cierre del Popup**
- **Evento:** `tesla_m3_popup_close`
- **Categoría:** `engagement`
- **Label:** Varía según el método de cierre:
  - `popup_close_button` - Clic en botón X o "Quizás más tarde"
  - `popup_close_background` - Clic en fondo oscuro
  - `popup_close_escape` - Presionar tecla Escape
- **Valor:** `1`
- **Cuándo:** Se dispara cada vez que se cierra el popup
- **Uso:** Mide el abandono y cómo los usuarios lo rechazan

## 📈 Cómo Ver los Datos en Google Analytics

### Opción 1: En "Realtime Events"
1. Ve a Google Analytics
2. Reports → Realtime → Events
3. Busca: `tesla_m3_popup_*`

### Opción 2: En "Events" (más detalles)
1. Ve a Google Analytics
2. Reports → Engagement → Events
3. Selecciona cualquiera de los eventos arriba
4. Verás:
   - Event count
   - Users
   - Conversion value
   - Event name
   - Event parameter (label, category)

### Opción 3: Custom Dashboard
Recomendamos crear un dashboard personalizado con:
- **Conversión:** `tesla_m3_popup_cta_click` / `tesla_m3_popup_impression`
- **Abandono:** `tesla_m3_popup_close` por tipo
- **Engagement:** Todos los eventos combinados

## 🔄 Flujo de Tracking

```
1. Usuario carga la página
   ↓
2. 3 segundos después → tesla_m3_popup_impression (shown = 1)
   ↓
3. Usuario decide:
   ├─ Click CTA → tesla_m3_popup_cta_click → Va a Tesla
   ├─ Click X/Button → tesla_m3_popup_close (method=button)
   ├─ Click fondo → tesla_m3_popup_close (method=background)
   └─ Escape → tesla_m3_popup_close (method=escape)
```

## 📊 Métricas Clave

Puedes calcular:

- **CTR (Click-Through Rate):** `tesla_m3_popup_cta_click` / `tesla_m3_popup_impression`
- **Tasa de Rechazo:** `tesla_m3_popup_close` / `tesla_m3_popup_impression`
- **Engagement Rate:** (`tesla_m3_popup_cta_click` + `tesla_m3_popup_close`) / `tesla_m3_popup_impression`

## ⚙️ Configuración en GA4

Los eventos se envían automáticamente si tienes:

1. **GA4 inicializado** en tu sitio
2. **Plugin de analytics** cargado (`plugins/analytics.client.ts`)
3. **gtag global** disponible: `window.gtag`

### Verificar que funciona

Abre DevTools:
```javascript
// En la consola del navegador:
// Deberías ver eventos como:
gtag('event', 'tesla_m3_popup_impression', {...})
gtag('event', 'tesla_m3_popup_cta_click', {...})
```

## 🎯 Objetivos de Conversión (Opcional)

Para mayor seguimiento, puedes crear un objetivo en Google Analytics:
- **Evento:** `tesla_m3_popup_cta_click`
- **Nombre:** "Tesla M3 - Popup CTA Click"
- **Valor:** Asignar valor de conversión (ej: €50 como valor de lead)

## 📝 Notas

- **sessionStorage:** Solo para control de "mostrar popup UNA SOLA VEZ por sesión" (no analítica)
- **0% localStorage de analytics:** TODO fue eliminado
- Los eventos de GA se envían DIRECTAMENTE a Google Analytics
- El popup se muestra automáticamente después de 3 segundos
- Una vez cerrado, no se muestra de nuevo EN LA MISMA SESIÓN
- Los datos se actualizan en GA4 con un delay de 24-48h en reportes estándar
- Usa "Realtime" para ver datos inmediatos
- AB Testing de recomendaciones (ab_recommended_links_metrics_v1) fue eliminado completamente
