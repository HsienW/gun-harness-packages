# Changelog

## 0.1.0-alpha.3

- Add strict `deduplicated` governed outcomes with original execution references. Require `result` for `committed_result_reused` and forbid it for the other reasons.
- Add the `deduplicated` termination cause and synchronize both TypeScript outcome unions.
- Prepare alpha.3 under Master authorization for the Chat Gun governed dispatch consumer (design §6.12 and §19 SI-4); retain schema version 1.0. Consumers with exhaustive outcome switches must handle the new variant.

## 0.1.0-alpha.1

- First public alpha candidate for the reviewed Chat Gun runtime v4 contract types, schemas, and domain constants.
- Published declarations and explicit API-surface snapshot are included.
