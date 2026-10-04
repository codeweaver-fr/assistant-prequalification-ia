import type { ProjectRequest } from "@/lib/schemas/projectRequest";

export function mergeProjectRequest(
  current: ProjectRequest,
  incoming: ProjectRequest
): ProjectRequest {
  return {
    projectType: incoming.projectType ?? current.projectType,
    mainNeed: incoming.mainNeed ?? current.mainNeed,
    location: incoming.location ?? current.location,

    budget:
      incoming.budget.status !== "missing"
        ? incoming.budget
        : current.budget,

    deadline: incoming.deadline ?? current.deadline,
  };
}