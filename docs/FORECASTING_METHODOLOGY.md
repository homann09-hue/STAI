# Forecasting methodology

Stand: 2026-08-10

Forecasts are scenario probabilities, never guaranteed point predictions.
Generation is restricted to instruments with measured quote availability.
Features are deterministic and versioned; the narrative explains drivers,
counterarguments and uncertainty.

The scheduled generator is idempotent and selection is recorded to expose
selection bias. Forecast records include model version, horizon, source times,
quality and the probability distribution for up/down/sideways outcomes.

