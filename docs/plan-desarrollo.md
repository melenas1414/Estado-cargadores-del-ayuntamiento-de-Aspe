# Plan de desarrollo

## Fase 1 - Prediccion inteligente real

1. Mejorar algoritmo de prediccion por hora y dia de semana.
2. Implementar fallback global cuando falten datos del weekday.
3. Exponer nivel de confianza y metodo de prediccion.
4. Calcular tiempo medio de ocupacion y ETA de liberacion.
5. Validar calidad de datos y definir umbrales minimos.

## Fase 2 - Historico, analitica publica y salud

1. Exponer metricas historicas (ocupacion por hora, por dia, heatmap).
2. Crear estado de fiabilidad por cargador (verde/amarillo/rojo).
3. Mostrar uptime, desconexiones, tiempo offline y disponibilidad media.
4. Crear vista de detalle por cargador con graficas.

## Fase 3 - IA e insights automaticos

1. Deteccion de anomalias (siempre ocupado, desconexion sospechosa, picos).
2. Insights automaticos en lenguaje natural.
3. Prediccion de liberacion por cargador y franja.
4. Panel de insights para operativa y mantenimiento.

## Fase 4 - Ranking y gamificacion

1. Ranking de cargadores mas libres y mas fiables.
2. Top de horas tranquilas y records semanales.
3. Badges y logros para usuarios colaboradores.

## Fase 5 - SEO local

1. Crear landing pages de intencion local (Aspe/Alicante).
2. Reforzar metadatos, canonical y schema.org.
3. Extender sitemaps para nuevas rutas.

## Estado actual de implementacion

- Iniciado: Fase 1.
- Implementado en backend:
  - Fallback progresivo de prediccion (weekday -> global -> sin datos).
  - Nivel de confianza (alta/media/baja).
  - Metodo de prediccion y marca de uso de fallback global.
  - Fechas disponibles con soporte de fallback global para proximos dias.
  - Nuevo endpoint de duracion de ocupacion: /api/analytics/occupation-duration.
  - Nuevo endpoint de ETA de liberacion: /api/analytics/estimated-release.
  - Nuevo endpoint de salud por cargador: /api/analytics/charger-health.
  - Nuevo endpoint de ocupacion por hora: /api/analytics/occupancy-by-hour.
  - Nuevo endpoint de ocupacion por dia: /api/analytics/occupancy-by-day.
- Implementado en frontend:
  - Mensaje visible cuando la prediccion usa historico global.
  - Integracion de ETA de liberacion y duracion media en pestaña Inteligencia.
  - Integracion de salud por cargador, ocupacion por hora/dia, insights y ranking en Inteligencia.
  - Nueva pagina de detalle por cargador: /charger/[id].
  - Nuevo panel admin de insights: /admin/insights.

- Implementado en fase de IA / insights:
  - Endpoint de deteccion de anomalias: /api/analytics/anomalies.
  - Endpoint de recomendaciones automáticas: /api/analytics/recommendations.

- Implementado en fase ranking:
  - Endpoint de ranking operativo por score mixto: /api/analytics/rankings.

- Implementado en fase SEO local:
  - Landings: /cargar-coche-electrico-aspe, /cargadores-gratis-aspe, /mejores-puntos-recarga-alicante, /mapa-ev-aspe-tiempo-real.
  - Actualizacion de sitemap-pages con rutas nuevas y fichas de cargador.
  - Regla noindex para /admin/** en nuxt.config.ts.

## Proximo bloque recomendado

1. Endurecer acceso admin (token temporal -> mecanismo robusto de autenticacion).
2. Añadir tests de regresion para prediccion y endpoints de insights.
