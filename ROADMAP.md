# 🗺️ Roadmap — Diario de Trading Pro

Mejoras planificadas basadas en análisis comparativo con los mejores diarios del mercado
(Edgewonk, TradeZella, TraderSync, Tradervue, TradesViz).

---

## 🔴 v4.1 — Datos de precio y screenshots *(Alta prioridad)*

### Precios exactos de entrada/salida/SL/TP
- Añadir campos numéricos al formulario: Entry price, SL price, TP price, Close price
- Calcular automáticamente el R:R planificado desde los precios (en vez de introducirlo manualmente)
- Habilitar análisis de slippage (precio de entrada real vs. precio ideal del POI)

### Screenshots adjuntos al trade
- Subir imágenes (setup antes y después del cierre) directamente desde el formulario
- Almacenamiento en IndexedDB (para no saturar localStorage)
- Galería visual de screenshots por trade en la vista de detalle
- Vista de galería global filtrable por resultado / setup

---

## 🟠 v4.2 — Análisis avanzado de tiempo y horario *(Alta prioridad)*

### Heatmap de rendimiento por hora del día
- Mapa de calor: hora de entrada (eje X) × día de semana (eje Y)
- Color = P&L promedio o win rate en esa franja
- Identificar automáticamente las horas más rentables

### Análisis de tiempo en posición
- Calcular duración del trade (desde fecha/hora entrada hasta cierre)
- Gráfico: duración promedio de wins vs. losses
- Correlación duración / R:R real
- Campo "tiempo en posición" calculado automáticamente si se registran ambas fechas

---

## 🟡 v4.3 — Tags libres y análisis multidimensional *(Impacto medio)*

### Tags personalizados por trade
- Campo de etiquetas libres en el formulario (ej: "liquidity grab", "HTF bajista", "OB premium")
- No categorías fijas — tags como texto libre con autocompletado desde histórico
- Filtrar por tag en la sección de Registro y Análisis

### Análisis multidimensional cruzado
- Tabla pivot interactiva: cruzar estado mental × sesión × activo × resultado
- Responder preguntas como "¿cuál es mi win rate cuando opero en estado Ansioso durante NY en XAUUSD?"

---

## 🟡 v4.4 — Mejoras de workflow *(Impacto medio)*

### Pre-trade checklist
- Checklist configurable que se completa ANTES de abrir la posición
- Guardado como parte del trade (no post-trade)
- Campos sugeridos: sesgo HTF alineado, confirmación de sesión, sin noticias de alto impacto, setup visible en gráfico

### Múltiples timeframes por trade
- Dos campos TF en el formulario: "TF de sesgo" y "TF de entrada"
- Análisis de rendimiento separado por TF de sesgo

### Notas de sesión / diario del día
- Sección de nota libre por día (no por trade)
- Accesible desde el calendario del dashboard
- Campo para: contexto del mercado, sesgo del día, noticias relevantes

---

## 🟢 v4.5 — Exportación y sincronización *(Calidad de vida)*

### Exportación de reportes en PDF
- Generar snapshot visual mensual exportable como PDF
- Incluir: métricas clave, curva de equity, calendario PnL, top setups
- Útil para revisión con mentor o archivo personal

### PWA offline
- Service Worker para funcionamiento sin conexión
- Manifest para instalación en móvil/escritorio
- Sincronización de datos cuando vuelve la conexión (si se añade backend)

### Backup automático
- Export JSON automático programado (semanal) desde el propio navegador
- Opción futura: sincronización con Supabase para persistencia en nube

---

## 🔵 v5.0 — Funcionalidades avanzadas *(Futuro)*

- Simulador "¿Qué hubiera pasado?" (what-if): ¿qué pasa con el equity si movo el SL a BE en todos los winners?)
- Tracking de reglas de prop firm (límite diario de loss, trailing DD, días mínimos)
- Scale-out / cierre parcial de posiciones (TP1, TP2 con % del lote)
- Análisis de calidad del POI (¿cuán precisa fue la entrada respecto al POI ideal?)
- AI coaching básico: detección de patrones de revenge trading, over-trading, tilt

---

*Última actualización: junio 2026*
