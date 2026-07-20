import { z } from "zod";

export const BranchSchema = z.object({
  label: z.string().min(1),
  next: z.string().min(1),
});

export const StepSchema = z
  .object({
    id: z.string().min(1),
    title: z.string().min(1),
    file: z.string().min(1),
    startLine: z.number().int().min(1),
    endLine: z.number().int().min(1),
    symbol: z.string().optional(),
    note: z.string().min(1),
    next: z.array(z.string().min(1)).optional(),
    branches: z.array(BranchSchema).optional(),
    /** Process-linear hop vs optional detail (step-into only). */
    role: z.enum(["spine", "detail"]).optional().default("spine"),
    kind: z
      .enum(["statement", "call", "branch", "effect"])
      .optional()
      .default("statement"),
    /** Line that is "about to execute" in the process spine. */
    highlightLine: z.number().int().min(1).optional(),
    /** Required for spine hops when present in v2 docs; encouraged always. */
    whySpine: z.string().min(1).optional(),
    stepOver: z.string().min(1).optional(),
    stepInto: z.string().min(1).optional(),
    stepOut: z.string().min(1).optional(),
  })
  .superRefine((step, ctx) => {
    if (step.endLine < step.startLine) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `endLine (${step.endLine}) must be >= startLine (${step.startLine})`,
        path: ["endLine"],
      });
    }
    if (
      step.highlightLine !== undefined &&
      (step.highlightLine < step.startLine ||
        step.highlightLine > step.endLine)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `highlightLine (${step.highlightLine}) must be within startLine..endLine`,
        path: ["highlightLine"],
      });
    }
    if (step.role === "spine" && !step.whySpine && !step.note) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `spine hop should include whySpine (or note)`,
        path: ["whySpine"],
      });
    }
  });

export const PathDocumentSchema = z.object({
  version: z.literal(1),
  title: z.string().min(1),
  query: z.string().min(1),
  repoRoot: z.string().min(1),
  createdAt: z.string().optional(),
  steps: z.array(StepSchema).min(1),
});

export type Branch = z.infer<typeof BranchSchema>;
export type Step = z.infer<typeof StepSchema>;
export type PathDocument = z.infer<typeof PathDocumentSchema>;

export type ValidationIssue = {
  path: string;
  message: string;
};

export function parsePathDocument(data: unknown): {
  doc?: PathDocument;
  issues: ValidationIssue[];
} {
  const parsed = PathDocumentSchema.safeParse(data);
  if (!parsed.success) {
    return {
      issues: parsed.error.issues.map((issue) => ({
        path: issue.path.join(".") || "(root)",
        message: issue.message,
      })),
    };
  }
  return { doc: parsed.data, issues: [] };
}

function checkRef(
  ids: Set<string>,
  stepId: string,
  field: string,
  ref: string | undefined,
  issues: ValidationIssue[],
): void {
  if (!ref) return;
  if (!ids.has(ref)) {
    issues.push({
      path: `steps[id=${stepId}].${field}`,
      message: `unknown ${field} step id "${ref}"`,
    });
  }
}

export function checkGraphIntegrity(doc: PathDocument): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const ids = new Set(doc.steps.map((s) => s.id));
  const seen = new Set<string>();

  for (const step of doc.steps) {
    if (seen.has(step.id)) {
      issues.push({
        path: `steps[id=${step.id}]`,
        message: `duplicate step id "${step.id}"`,
      });
    }
    seen.add(step.id);

    for (const nextId of step.next ?? []) {
      checkRef(ids, step.id, "next", nextId, issues);
    }

    for (const [i, branch] of (step.branches ?? []).entries()) {
      if (!ids.has(branch.next)) {
        issues.push({
          path: `steps[id=${step.id}].branches[${i}].next`,
          message: `unknown branch next step id "${branch.next}"`,
        });
      }
    }

    checkRef(ids, step.id, "stepOver", step.stepOver, issues);
    checkRef(ids, step.id, "stepInto", step.stepInto, issues);
    checkRef(ids, step.id, "stepOut", step.stepOut, issues);
  }

  return issues;
}

/** Spine hops in document order (for Paso X/Y). */
export function spineSteps(doc: PathDocument): Step[] {
  return doc.steps.filter((s) => (s.role ?? "spine") === "spine");
}

export function effectiveStepOver(step: Step): string | undefined {
  return step.stepOver ?? step.next?.[0];
}
