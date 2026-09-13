# CHSN-RUNNERS

CHSN-RUNNERS is an endurance training platform for planning, tracking, and analyzing running performance.

## Product Scope

Runner is designed to support:

- weekly training planning
- individual workout planning
- completed-run tracking
- planned vs. actual comparison
- mileage and training trends
- dashboard metrics
- training history
- future performance and training-load insights

Longer-term, Runner may expand into:

- iOS/mobile support
- GPS activity tracking
- routes and heatmaps
- live pace, distance, and time
- offline activity recording and synchronization
- wearable and third-party integrations

## Architecture

The application is being developed as a modular monolith with multiple clients sharing a common backend.

```text
apps/
  web/    React / TypeScript
  api/    FastAPI / Python