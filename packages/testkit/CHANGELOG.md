# Changelog

## 0.1.0-alpha.4

- Align harness dependencies to exact 0.1.0-alpha.4 versions; no runtime implementation changes.
- Verify that the runtime event envelope fixture preserves all model.stream identity fields.
- Compatibility: alpha.3 and earlier strict consumers reject payloads containing the new identity fields. Upgrade consumers before producers send these fields; delta-only payloads remain valid.

## 0.1.0-alpha.3

- Align internal harness dependencies and package version with contracts 0.1.0-alpha.3.

## 0.1.0-alpha.1

- First public alpha candidate for deterministic clocks, IDs, fixtures, and failure injection.
- Depends on `@gun-ai/harness-contracts@0.1.0-alpha.1` and `@gun-ai/harness-kernel@0.1.0-alpha.1`.
