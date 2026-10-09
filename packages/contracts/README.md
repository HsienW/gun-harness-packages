# @gun-ai/harness-contracts

跨框架的 Harness contracts 與 boundary schemas。

- 此 package 保存已核准的 Chat Gun runtime v4 型別、Zod v3 schema、enum 與封閉 domain constant。
它可以依賴 schema validation library，但不能依賴 LangGraph、HTTP framework、database driver、特定模型 Provider、`node:*` 或任何 Chat Gun application module。

- 公開入口只允許 `src/index.ts` 的 named exports，並由 `api-surface.json` 鎖定。
