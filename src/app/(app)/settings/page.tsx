import { getOrCreateProject } from "@/server/actions/projects";
import { SettingsForm } from "@/components/settings/settings-form";

export default async function SettingsPage() {
  const project = await getOrCreateProject();

  const conditions = (project.conditions ?? {}) as {
    style?: string[];
    guestCount?: number;
    area?: string[];
    budget?: { min: number; max: number };
  };

  return (
    <div className="space-y-6">
      <h2>設定</h2>
      <SettingsForm initialConditions={conditions} />
    </div>
  );
}
