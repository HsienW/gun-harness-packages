export { MANIFEST_SCHEMA_VERSION } from "@gun-ai/harness-contracts";
export { createContextView } from "./context.js";
export type { ContextView } from "./context.js";
export { projectProviderToolDescription } from "./provider.js";
export type { ProviderDescriptionAdapter, ProviderToolDescription } from "./provider.js";
export {
  defineAgent,
  defineTool,
  registerTool,
  registerTools,
  validateManifest,
} from "./registration.js";
export type {
  RegistrationFailure,
  RegistrationFailureCode,
  RegistrationHooks,
  RegistrationInput,
  RegistrationPlan,
  RegistrationResult,
} from "./registration.js";
