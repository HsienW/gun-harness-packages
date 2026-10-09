# Public API and version policy

The package root `index.ts` files are the only public entry points. Every
export is listed in `api-surface.json`; wildcard exports are prohibited.

- Public contracts require a documented external use case and an `@since`
  marker in source documentation.
- Additive compatible exports require a minor-version decision.
- Removed or structurally incompatible exports require a major-version
  decision and a documented deprecation period.
- Serialized contracts carry an explicit `schemaVersion`; unsupported
  versions fail with the existing typed compatibility codes.
- Package dependency direction is `contracts <- kernel <- testkit`.
- Before release, CI must run typecheck, tests, API-surface verification,
  boundary/cycle checks, clean install, and `npm pack --dry-run`.

The root workspace remains private during incubation. The three packages are
public alpha release candidates under the `@gun-ai` scope. Chat Gun may use the
sibling checkout during development, but X26 final acceptance requires the
published alpha versions and a clean install without that checkout. Human
approval controls the first publication; full provenance/signing and
compatibility release governance remain separate X29 gates.
