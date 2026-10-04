import type { ProjectRequest } from "@/lib/schemas/projectRequest";

export function getFieldsToClarify(project: ProjectRequest) {
  const fieldsToClarify: string[] = [];

  if (project.budget.status === "ambiguous") {
    fieldsToClarify.push("budget");
  }

  return fieldsToClarify;
}
