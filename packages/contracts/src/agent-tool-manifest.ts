import { z } from "zod";

export const MANIFEST_SCHEMA_VERSION = "1.0.0" as const;
export const SIDE_EFFECT_CLASSES = [
  "read-only",
  "local_mutation",
  "external_mutation",
  "irreversible",
  "custom",
] as const;

const nonEmpty = z.string().trim().min(1);
const zodSchema = z.custom<z.ZodTypeAny>(
  (value) => value instanceof z.ZodType,
  { message: "A Zod v3 schema is required" }
);
const profileSchema = z.object({
  profileId: nonEmpty,
  profileVersion: z.literal("1.0"),
  egress: z.object({
    destinations: z.array(nonEmpty),
    protocols: z.array(z.enum(["http", "https"])),
  }).strict(),
}).strict();
const toolReferenceSchema = z.object({
  toolId: nonEmpty,
  toolVersion: nonEmpty,
}).strict();

const toolShape = z.object({
  kind: z.literal("tool"),
  manifestVersion: z.literal(MANIFEST_SCHEMA_VERSION),
  toolId: nonEmpty,
  toolVersion: nonEmpty,
  description: nonEmpty,
  inputSchema: zodSchema,
  outputSchema: zodSchema,
  sideEffectClass: z.enum(SIDE_EFFECT_CLASSES),
  requiredCapabilities: z.array(nonEmpty).min(1),
  executionProfile: profileSchema,
  idempotency: z.discriminatedUnion("kind", [
    z.object({ kind: z.literal("read_only") }).strict(),
    z.object({ kind: z.literal("business_effect_key"), descriptorRef: nonEmpty }).strict(),
  ]),
  approvalPolicyKey: nonEmpty,
  timeoutRetryClass: nonEmpty,
  compensation: z.enum(["none", "reconcile_only"]),
  dataClassification: z.string().regex(
    /^[a-z][a-z0-9._-]*:[a-z][a-z0-9._-]*$/,
    "A non-sensitive namespaced classification key is required"
  ),
}).strict();

const agentShape = z.object({
  kind: z.literal("agent"),
  manifestVersion: z.literal(MANIFEST_SCHEMA_VERSION),
  agentId: nonEmpty,
  agentVersion: nonEmpty,
  description: nonEmpty,
  tools: z.array(toolReferenceSchema),
}).strict();

function validateToolSemantics(
  value: z.infer<typeof toolShape>,
  context: z.RefinementCtx
): void {
  if (new Set(value.requiredCapabilities).size !== value.requiredCapabilities.length) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["requiredCapabilities"], message: "Duplicate authorization action" });
  }
  if (value.sideEffectClass === "custom") {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["sideEffectClass"], message: "Custom side-effect class is unsupported" });
  }
  if (value.sideEffectClass === "read-only") {
    if (value.idempotency.kind !== "read_only" || value.compensation !== "none") {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ["idempotency"], message: "Read-only metadata is contradictory" });
    }
  } else {
    if (value.idempotency.kind !== "business_effect_key") {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ["idempotency"], message: "Mutation requires a business-effect key" });
    }
    if (value.sideEffectClass === "irreversible" && value.compensation !== "none") {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ["compensation"], message: "Irreversible effect cannot claim compensation" });
    }
  }
}

export const toolManifestSchema = toolShape.superRefine(validateToolSemantics);
export const agentManifestSchema = agentShape;
export const agentToolManifestSchema = z
  .discriminatedUnion("kind", [agentShape, toolShape])
  .superRefine((value, context) => {
    if (value.kind === "tool") validateToolSemantics(value, context);
  });

export type SideEffectClass = (typeof SIDE_EFFECT_CLASSES)[number];
export type ToolManifest = z.infer<typeof toolShape>;
export type AgentManifest = z.infer<typeof agentShape>;
export type AgentToolManifest = z.infer<typeof agentToolManifestSchema>;

/** JSON-safe provenance. Zod schemas and implementation functions are never copied here. */
export interface ToolManifestEvidence {
  manifestVersion: typeof MANIFEST_SCHEMA_VERSION;
  toolId: string;
  toolVersion: string;
  dataClassification: string;
}
