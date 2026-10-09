# Gun Harness Packages


- `gun-harness-packages` 是 npm package implementation，保存可執行 contracts、kernel、testkit、測試與發佈相關設定。
- `gun-harness-engineering` 是負責 Harness 的理念、名詞、架構推論、ADR、實驗與成熟度模型保存在獨立的 repository。

> gun-harness-engineering 解釋「為什麼」，gun-harness-packages 定義並驗證「可以依賴什麼」。

## Packages

- `@gun-ai/harness-contracts`：Chat Gun runtime 的 framework-neutral 型別、Zod v3 schema、enum 與封閉 domain constant。
- `@gun-ai/harness-kernel`：無 I/O、無框架、可決定性驗證的純函式原語。
- `@gun-ai/harness-testkit`：deterministic clock／ID、contract fixtures 與 failure injection。

## Requirements

- Node >= 22.19。
- npm >= 10。

## Development

```bash
npm install
npm run check
```

`npm run check` 會先 build 各 workspace，再執行 TypeScript typecheck 與完整測試。

## Alpha packages

三個套件目前皆為 `0.1.0-alpha.1`。Alpha 版的 API 仍可能在穩定版前調整；需要可重現安裝時，建議固定完整版本，`@alpha` 則適合測試最新候選版。

從 npm 安裝公開 alpha 版時，只需加入應用程式直接使用的套件。`@gun-ai/harness-testkit` 通常屬於開發相依：

```bash
npm install @gun-ai/harness-contracts@0.1.0-alpha.1 @gun-ai/harness-kernel@0.1.0-alpha.1
npm install --save-dev @gun-ai/harness-testkit@0.1.0-alpha.1
```

每個 package 都包含編譯後的 JavaScript、`.d.ts`、`api-surface.json` 與 changelog。套件不包含測試檔、workspace 專用設定或開發環境中的本機路徑。

## Package boundaries

```text
@gun-ai/harness-contracts
  ↑
@gun-ai/harness-kernel
  ↑
@gun-ai/harness-testkit
```

- `contracts` 提供型別、schema、enum 與封閉 domain constant，不包含 event factory、ID/hash 產生、解析或 product projection。
- `kernel` 提供 deterministic domain primitives，不執行 I/O；clock、hash 與 UUID 由呼叫端注入。
- `testkit` 提供測試 fixture 與 deterministic utilities，適合作為開發相依。
- LangGraph、database、HTTP、Provider、trusted-header parsing 與 Chat Gun product composition 屬於應用程式層，不包含在這些套件中。
- 公開入口使用 named exports，並由各 package 的 `api-surface.json` 鎖定。

## Current scope

目前實作涵蓋：

- execution identity 與 task／step／run lifecycle；
- tool descriptor、authorization、failure taxonomy 與 retry contract；
- versioned runtime event、checkpoint／resume、side-effect／idempotency、approval／terminal outcome；
- retry/backoff、event parsing/sequence、scope predicate、side-effect identity 與 version compatibility primitives；
- deterministic clock／ID、contract fixture builders 與 failure injection。

Chat Gun 的 event factory、state machine、tool dispatch、authorization execution、persistence、LangGraph adapter 與 Provider integration 不屬於本 repository。

## Contributing

- 新增公開輸入時，請提供 runtime validation。
- 公開狀態以 discriminated union 或封閉 schema 表達。
- Breaking change 需要 migration notes，並說明對應的 semver 調整。
- Public API 不接受 framework-specific types 或 product policy。
- 新功能需要 deterministic tests 或其他可重現的 conformance evidence。

## License

本專案採用 [MIT License](./LICENSE)。
