# @gun-ai/harness-kernel

- Gun Harness 的 deterministic 純函式核心，保存 retry/backoff、event parsing/sequence、scope predicate、side-effect identity、idempotency serialization 與 version compatibility 等原語。
- Kernel 不執行 I/O，也不依賴 LangGraph、database、HTTP 或 Provider SDK。clock、hash、UUID 等非決定性來源必須由呼叫端注入。
