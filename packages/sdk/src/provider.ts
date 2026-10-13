import { toolManifestSchema, type ToolManifest } from "@gun-ai/harness-contracts";

export interface ProviderDescriptionAdapter {
  readonly providerId: string;
  projectInputSchema(canonicalSchema: ToolManifest["inputSchema"]): unknown;
  projectDescription?(canonicalDescription: string): string;
}

export interface ProviderToolDescription {
  readonly name: string;
  readonly description: string;
  readonly parameters: unknown;
}

/** Provider quirks affect the description only. The runtime retains canonical Zod schemas. */
export function projectProviderToolDescription(
  value: unknown,
  adapter: ProviderDescriptionAdapter
): ProviderToolDescription {
  const manifest = toolManifestSchema.parse(value);
  if (adapter.providerId.trim().length === 0) throw new Error("Provider ID is required");
  return Object.freeze({
    name: manifest.toolId,
    description: adapter.projectDescription?.(manifest.description) ?? manifest.description,
    parameters: adapter.projectInputSchema(manifest.inputSchema),
  });
}
