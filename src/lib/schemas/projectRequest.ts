import { z } from "zod";

const BudgetSchema = z.object({
  status: z.enum(["missing", "unknown", "provided", "ambiguous"]),
  min: z.number().nullable(),
  max: z.number().nullable(),
});

export const ProjectRequestSchema = z.object({
  projectType: z.string().nullable(),
  mainNeed: z.string().nullable(),
  location: z.string().nullable(),
  budget: BudgetSchema,
  deadline: z.string().nullable(),
});

export type ProjectRequest = z.infer<typeof ProjectRequestSchema>;