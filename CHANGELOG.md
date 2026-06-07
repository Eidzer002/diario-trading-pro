# Changelog

Todos los cambios notables del proyecto están documentados aquí.
Formato basado en [Keep a Changelog](https://keepachangelog.com/es/1.0.0/).

---

## [4.0.0] — 2026-06 (versión base en este repositorio)

### Añadido
- Calculadora de lotaje integrada en el formulario de entrada
- Métricas avanzadas en dashboard: Expectancy, Sharpe mensual, rachas consecutivas
- Calendario mensual de PnL con navegación
- Gráfico de P&L por día de semana
- Drawdown histórico como gráfico separado
- Sección de Psicología completa: insights automáticos, rendimiento por estado mental, adherencia a reglas
- Revisión semanal y mensual navegables
- Multi-cuenta con tabs en dashboard
- Gestor de riesgo en vivo (DD actual vs límite prop firm)
- Niveles Fibonacci como campo en el formulario
- Soporte para resultado OPEN (operación abierta)
- Export JSON (backup completo) e Import JSON (restauración)

### Mejorado
- Arquitectura refactorizada a clase única `TradingJournal` (v4.0 final)
- Sistema de filtros con panel colapsable

---

## [3.x] — Versiones anteriores

Desarrollo local previo al repositorio. Funcionalidades base:
- Formulario de registro de trades
- Dashboard con KPIs principales (Win Rate, Profit Factor, R:R, Max Drawdown)
- Gráficos de resultados y evolución de capital
- Export CSV
- Gestión de múltiples cuentas
