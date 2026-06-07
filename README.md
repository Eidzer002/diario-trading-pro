# 📊 Diario de Trading Pro

Aplicación web personal (SPA) para registro, análisis y psicología del trading.
Construida con HTML/CSS/JS vanilla + Tailwind CSS + Plotly.js. Sin dependencias de servidor — funciona completamente en el navegador con `localStorage`.

---

## ✨ Funcionalidades actuales (v4.0)

### Dashboard
- KPIs principales: Win Rate, Profit Factor, R:R promedio, Max Drawdown
- Métricas avanzadas: Expectancy, Sharpe mensual, mejores/peores rachas
- Resumen multi-cuenta con tabs
- Gráficos: distribución de resultados, evolución de capital, drawdown histórico, win rate por setup, rendimiento por activo, calendario PnL mensual, P&L por día de semana

### Registro de Operaciones
- Formulario completo: cuenta, fecha/hora, activo, dirección, timeframe, sesión, estrategia, setup/POI, nivel Fibonacci
- Calculadora de lotaje integrada (pip value automático para pares principales)
- Registro de riesgo (% o $ absoluto)
- Estado psicológico (8 estados: Neutro, Confiado, Ansioso, Eufórico, Venganza, Aburrido, Miedo, FOMO)
- Adherencia a reglas (Sí / Parcial / No)
- Análisis de LOSS con causa categorizada
- Notas post-trade
- Filtros avanzados: cuenta, activo, resultado, fechas

### Análisis
- Gráficos interactivos (Plotly.js)
- Filtrado por múltiples dimensiones

### Psicología
- Gestor de riesgo en vivo (DD actual vs límite, objetivo de ganancia)
- Insights automáticos (patrones detectados en los datos)
- Rendimiento por estado mental
- Adherencia a reglas vs resultados
- Revisión semanal navegable
- Resumen mensual

### Configuración
- Gestión de múltiples cuentas (nombre, capital, color, max DD, objetivo)
- Listas personalizables de activos, estrategias y setups
- Exportación CSV y JSON
- Importación / restauración desde JSON
- Reset completo

---

## 🗺️ Roadmap de mejoras

Ver [ROADMAP.md](./ROADMAP.md) para el plan detallado de próximas versiones.

---

## 🛠️ Stack

| Tecnología | Uso |
|---|---|
| HTML5 / CSS3 / JS vanilla | Base de la aplicación |
| Tailwind CSS (CDN) | Estilos utilitarios |
| Plotly.js | Gráficos interactivos |
| Font Awesome | Iconografía |
| Google Fonts — Inter | Tipografía |
| localStorage | Persistencia de datos |

---

## 🚀 Uso

1. Descargar `index.html`
2. Abrir en cualquier navegador moderno
3. No requiere instalación ni conexión a internet (excepto para cargar CDNs la primera vez)

---

## 📁 Estructura del proyecto

```
diario-trading-pro/
├── index.html          # Aplicación completa (SPA de un solo archivo)
├── README.md           # Este archivo
├── ROADMAP.md          # Plan de mejoras futuras
└── CHANGELOG.md        # Historial de versiones
```

---

## 📝 Changelog

Ver [CHANGELOG.md](./CHANGELOG.md)
