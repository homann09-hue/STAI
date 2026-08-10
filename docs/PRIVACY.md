# Privacy engineering notes

Stand: 2026-08-10

- User portfolios, watchlists and alerts are private tenant data under RLS.
- Public market data is cached separately from user data.
- User endpoints send `private, no-store` cache controls.
- Account export and deletion paths are server-authorized.
- Logs use request IDs and redaction, not raw credentials or portfolio values.
- Production retention, subprocessors, legal basis and deletion SLAs require a
  reviewed privacy policy before commercial launch.

This engineering note is not a substitute for legal privacy documentation.

