export interface ContextView<TAction extends string> {
  readonly capabilities: Readonly<Record<TAction, true>>;
  readonly secretRefs: readonly string[];
}

/**
 * A host-supplied projection. The host must authorize actions and enforce its
 * execution profile independently; this function does not grant permissions.
 */
export function createContextView<const TAction extends string>(
  declaredActions: readonly TAction[],
  availableActions: readonly string[],
  secretRefs: readonly string[] = []
): ContextView<TAction> {
  if (declaredActions.length === 0) throw new Error("At least one declared action is required");
  const capabilities: Record<string, true> = Object.create(null);
  const available = new Set(availableActions);
  for (const action of declaredActions) {
    if (!available.has(action)) throw new Error("Declared action is unavailable");
    capabilities[action] = true;
  }
  if (secretRefs.some((reference) => !/^[a-z][a-z0-9._-]*:[A-Za-z0-9._/-]+$/.test(reference))) {
    throw new Error("Secret reference is invalid");
  }
  return Object.freeze({
    capabilities: Object.freeze(capabilities) as Readonly<Record<TAction, true>>,
    secretRefs: Object.freeze([...secretRefs]),
  });
}
