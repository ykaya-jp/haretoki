import { getOrCreateProject } from "@/server/actions/projects";
import { ConditionsForm } from "@/components/conditions/conditions-form";
import type { ProjectConditions } from "@/types";

export default async function ConditionsPage() {
  const project = await getOrCreateProject();
  const conditions = (project.conditions as ProjectConditions) ?? {};

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h1 className="font-serif text-xl font-bold">
          おふたりの理想を教えてください
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          すべて任意です。後からいつでも変更できます。
        </p>
      </div>
      <ConditionsForm initialConditions={conditions} />
    </div>
  );
}
