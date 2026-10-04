import type { ProjectRequest } from "@/lib/schemas/projectRequest";

export function getMissingFields(project: ProjectRequest) {
  const missingFields: string[] = [];

  if (project.projectType === null) {
    missingFields.push("projectType");
  }

  if (project.location === null) {
    missingFields.push("location");
  }

  if (project.budget.status === "missing") {
    missingFields.push("budget");
  }

  if (project.deadline === null) {
    missingFields.push("deadline");
  }

  return missingFields;
}
