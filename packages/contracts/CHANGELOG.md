# Changelog

## 0.1.0-alpha.4

- Add MODEL_STREAM_OUTPUT_KINDS and ModelStreamOutputKind as the single source for model.stream output kinds.
- Add independently optional messageId, outputKind, and textOffset with runtime validation; retain strict rejection of unknown fields and the existing delta limit. messageId uses the existing opaque ID trim rule; textOffset is a non-negative safe integer measured in UTF-16 code units.
- Prepare alpha.4 under Master authorization for Chat Gun stream-chat-answer-text; retain RUNTIME_EVENT_SCHEMA_VERSION 1.0.0.
- Compatibility: alpha.3 and earlier strict consumers reject payloads containing the new identity fields. Upgrade consumers before producers send these fields; delta-only payloads remain valid.

## 0.1.0-alpha.3

- Add strict `deduplicated` governed outcomes with original execution references. Require `result` for `committed_result_reused` and forbid it for the other reasons.
- Add the `deduplicated` termination cause and synchronize both TypeScript outcome unions.
- Prepare alpha.3 under Master authorization for the Chat Gun governed dispatch consumer (design §6.12 and §19 SI-4); retain schema version 1.0. Consumers with exhaustive outcome switches must handle the new variant.

## 0.1.0-alpha.1

- First public alpha candidate for the reviewed Chat Gun runtime v4 contract types, schemas, and domain constants.
- Published declarations and explicit API-surface snapshot are included.
