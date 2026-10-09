# Gun Harness Packages


- `gun-harness` 是 npm package implementation，保存可執行 contracts、kernel、testkit、測試與發佈相關設定。
- `gun-harness-engineering` 是負責 Harness 的理念、名詞、架構推論、ADR、實驗與成熟度模型保存在獨立的 repository。

> Engineering repository 解釋「為什麼」，本 repository 定義並驗證「可以依賴什麼」。

## Packages

- `@gun-ai/harness-contracts`：Chat Gun runtime 的 framework-neutral 型別、Zod v3 schema、enum 與封閉 domain constant。
- `@gun-ai/harness-kernel`：無 I/O、無框架、可決定性驗證的純函式原語。
- `@gun-ai/harness-testkit`：deterministic clock／ID、contract fixtures 與 failure injection。

## Requirements

- Node.js 22.19 或更新版本。
- npm 10 或更新版本。

## Development

```bash
npm install
npm run check
```

`npm run check` 會先 build 各 workspace，再執行 TypeScript typecheck 與完整測試。發佈前另對三個 package 執行 `npm pack --dry-run` 與 `npm publish --dry-run --tag alpha`。

## Alpha release gate

- 套件名稱固定為 `@gun-ai/harness-contracts`、`@gun-ai/harness-kernel`、`@gun-ai/harness-testkit`，版本固定為 `0.1.0-alpha.1`，公開發布使用 `alpha` dist-tag。
- 發布順序為 contracts → kernel → testkit；每個 tarball 必須包含 JS、`.d.ts`、API snapshot 與 changelog，且不得包含測試、秘密或 workspace 專用路徑。
- npm scope／套件名稱、發布權限與實際發布須由 Human 確認。Codex 只準備候選版並執行 dry-run，不執行實際 `npm publish`。workspace 模式下必須在發布命令明確加 `--tag alpha`，不可只依賴 `publishConfig.tag`；未帶旗標的 dry-run 曾顯示 `latest`。
- 發布後 Chat Gun 才切換為三個精確的 registry alpha 版本，並在沒有 sibling `gun-harness` checkout 的乾淨環境驗證 `npm ci`、lint、完整測試與 build。

### Human-only 發布步驟

先決定授權條款、審閱三個 tarball 的公開內容，確認 npm 帳號具有 `@gun-ai` 發布權限並已完成所需驗證，再由 Human 提交／推送此 repository。首次發布不可回復或覆寫同一版本；若 registry 已有任一目標版本，請停下檢查，不要重複發布。

在 repository root 依序執行下列命令。`--tag alpha` 與 `--access public` 必須明確提供；不要只依賴 `publishConfig`。

```bash
npm whoami --registry=https://registry.npmjs.org/
npm publish --workspace @gun-ai/harness-contracts --tag alpha --access public --registry=https://registry.npmjs.org/
npm publish --workspace @gun-ai/harness-kernel --tag alpha --access public --registry=https://registry.npmjs.org/
npm publish --workspace @gun-ai/harness-testkit --tag alpha --access public --registry=https://registry.npmjs.org/
```

每次發布後核對該 package 的 `0.1.0-alpha.1` 可從公開 registry 讀到，且 `alpha` dist-tag 指向該版本；全部通過後才將 Chat Gun 的三項 `file:` 相依切換為精確 registry 版本。

## Package boundaries

```text
@gun-ai/harness-contracts
  ↑
@gun-ai/harness-kernel
  ↑
@gun-ai/harness-testkit
```

- `contracts` 只保存型別、schema、enum 與封閉 domain constant；不得包含 event factory、ID/hash 產生、解析或 product projection。
- `kernel` 只包含 deterministic domain primitives，不執行 I/O；clock、hash 與 UUID 由呼叫端注入。
- `testkit` 提供測試 fixture 與 deterministic utilities，不得成為 production dependency 的必要條件。
- LangGraph、database、HTTP、Provider、trusted-header parsing 與 Chat Gun product composition 留在 Chat Gun。
- 公開入口使用 named exports，並由各 package 的 `api-surface.json` 鎖定。

## Current scope

目前實作涵蓋：

- execution identity 與 task／step／run lifecycle；
- tool descriptor、authorization、failure taxonomy 與 retry contract；
- versioned runtime event、checkpoint／resume、side-effect／idempotency、approval／terminal outcome；
- retry/backoff、event parsing/sequence、scope predicate、side-effect identity 與 version compatibility primitives；
- deterministic clock／ID、contract fixture builders 與 failure injection。

Chat Gun 的 event factory、state machine、tool dispatch、authorization execution、persistence、LangGraph adapter 與 Provider integration 不屬於本 repository。

## Repository policy

- 公開輸入必須有 runtime validation。
- 公開狀態使用 discriminated union 或封閉 schema。
- Breaking change 必須附 migration notes 與 semver 決策。
- 不將 framework-specific types 或 product policy 洩漏到 public API。
- 新能力必須附 deterministic tests 或 conformance evidence。

## License

本專案採用 [MIT License](./LICENSE)。
