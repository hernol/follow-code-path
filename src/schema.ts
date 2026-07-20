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
  })
  .superRefine((step, ctx) => {
    if (step.endLine < step.startLine) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `endLine (${step.endLine}) must be >= startLine (${step.startLine})`,
        path: ["endLine"],
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
      if (!ids.has(nextId)) {
        issues.push({
          path: `steps[id=${step.id}].next`,
          message: `unknown next step id "${nextId}"`,
        });
      }
    }

    for (const [i, branch] of (step.branches ?? []).entries()) {
      if (!ids.has(branch.next)) {
        issues.push({
          path: `steps[id=${step.id}].branches[${i}].next`,
          message: `unknown branch next step id "${branch.next}"`,
        });
      }
    }
  }

  return issues;
}
