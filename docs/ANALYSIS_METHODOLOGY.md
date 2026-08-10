# Analysis methodology

Stand: 2026-08-10

Deterministic code computes technical indicators, valuation inputs, portfolio
risk and score aggregation. AI may summarize evidence but may not invent,
calculate or silently fill missing values.

Each analysis communicates:

- conclusion and counterarguments;
- contributing evidence and score impact;
- confidence and uncertainty;
- provider/source and observation time;
- missing inputs and data-quality guard;
- the permanent no-investment-advice notice.

The score bands are descriptive, not buy/sell recommendations. A high score can
coexist with high risk.

## Backtesting integrity gate

The backtest selects adjusted close only when every usable provider row carries
that field. It blocks mixed raw/adjusted histories because the resulting return
series would be internally inconsistent. A raw-close series remains available
only with a prominent limitation that corporate actions are not evidenced.

The current provider history is a present-day snapshot rather than a
point-in-time vintage. Results therefore disclose possible survivorship,
selection and look-ahead bias and must not be interpreted as a validated
forecast or investable strategy.
