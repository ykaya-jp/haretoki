import Link from "next/link";
import { getOrCreateProject } from "@/server/actions/projects";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const STEP_LABELS = [
  "条件設定",
  "式場探索",
  "見学",
  "比較",
  "絞り込み",
  "決定",
];

export default async function DashboardPage() {
  const project = await getOrCreateProject();
  const venueCount = project.venues.length;
  const currentStepLabel = STEP_LABELS[project.currentStep - 1] ?? "開始";

  return (
    <div className="space-y-6">
      <h1 className="font-serif text-xl font-bold">ダッシュボード</h1>

      {/* Stats cards */}
      <div className="grid grid-cols-2 gap-4">
        <Card className="shadow-[var(--shadow-soft)]">
          <CardHeader>
            <CardTitle className="font-serif text-sm text-foreground-muted">
              登録式場数
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-serif text-2xl font-bold">{venueCount}</p>
          </CardContent>
        </Card>

        <Card className="shadow-[var(--shadow-soft)]">
          <CardHeader>
            <CardTitle className="font-serif text-sm text-foreground-muted">
              現在のステップ
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-serif text-2xl font-bold">{currentStepLabel}</p>
          </CardContent>
        </Card>
      </div>

      {/* State-based content */}
      {venueCount === 0 ? (
        <Card className="shadow-[var(--shadow-soft)]">
          <CardContent className="flex flex-col items-center gap-4 py-8 text-center">
            <p className="text-foreground-muted">
              まずは気になる式場を追加してみましょう
            </p>
            <Link
              href="/venues"
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              式場を探す
            </Link>
          </CardContent>
        </Card>
      ) : (
        <Card className="shadow-[var(--shadow-soft)]">
          <CardContent className="space-y-3 py-4">
            <p className="text-sm">
              現在 <span className="font-bold text-primary">{venueCount}件</span>{" "}
              の式場が登録されています
            </p>
            <div className="flex gap-3">
              <Link
                href="/venues"
                className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
              >
                式場一覧
              </Link>
              <Link
                href="/compare"
                className="rounded-md border border-border px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted"
              >
                比較する
              </Link>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
