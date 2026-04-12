import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/server/db";
import { redirect } from "next/navigation";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Plus, BarChart3, Star, CheckCircle } from "lucide-react";

async function getDashboardData() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const membership = await prisma.projectMember.findFirst({
    where: { userId: user.id, acceptedAt: { not: null } },
    select: { projectId: true },
  });

  if (!membership) {
    // Create project if none exists
    const project = await prisma.project.create({
      data: {
        name: "わたしたちの式場選び",
        members: {
          create: { userId: user.id, role: "owner", acceptedAt: new Date() },
        },
      },
    });
    return { venues: [], ratedCount: 0, shortlistedCount: 0, hasDecision: false, projectId: project.id };
  }

  const projectId = membership.projectId;

  const venues = await prisma.venue.findMany({
    where: { projectId },
    include: { scores: { where: { source: "user_rating" } } },
    orderBy: { updatedAt: "desc" },
  });

  const ratedCount = venues.filter((v) => v.scores.length > 0).length;
  const shortlistedCount = venues.filter((v) =>
    ["shortlisted", "selected"].includes(v.status),
  ).length;

  const decision = await prisma.decision.findUnique({
    where: { projectId },
  });

  return { venues, ratedCount, shortlistedCount, hasDecision: !!decision, projectId };
}

export default async function DashboardPage() {
  const { venues, ratedCount, shortlistedCount, hasDecision } =
    await getDashboardData();

  const venueCount = venues.length;

  // Determine next action
  let nextAction: { message: string; href: string; label: string } | null = null;

  if (venueCount === 0) {
    nextAction = {
      message: "まずは気になる式場を追加してみましょう。名前だけでもOKです。",
      href: "/venues",
      label: "式場を追加する",
    };
  } else if (ratedCount === 0) {
    nextAction = {
      message: `${venueCount}件の式場が登録されています。各式場を評価して比較しましょう。`,
      href: `/venues/${venues[0].id}`,
      label: "式場を評価する",
    };
  } else if (ratedCount < venueCount) {
    const unrated = venues.find((v) => v.scores.length === 0);
    nextAction = {
      message: `${ratedCount}/${venueCount}件を評価済み。残りの式場も評価しましょう。`,
      href: unrated ? `/venues/${unrated.id}` : "/venues",
      label: "未評価の式場を見る",
    };
  } else if (venueCount >= 2 && shortlistedCount === 0) {
    nextAction = {
      message: "全ての式場を評価しました！比較して候補を絞りましょう。",
      href: "/compare",
      label: "比較ボードへ",
    };
  } else if (shortlistedCount > 0 && !hasDecision) {
    nextAction = {
      message: `${shortlistedCount}件の候補があります。最終決定に進みましょう。`,
      href: "/decision",
      label: "最終決定へ",
    };
  }

  return (
    <div className="space-y-6">
      <h1 className="font-serif text-xl font-bold">ダッシュボード</h1>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="shadow-[var(--shadow-soft)]">
          <CardContent className="p-4 text-center">
            <p className="text-xs text-muted-foreground">候補式場</p>
            <p className="mt-1 text-2xl font-bold text-primary">{venueCount}</p>
          </CardContent>
        </Card>
        <Card className="shadow-[var(--shadow-soft)]">
          <CardContent className="p-4 text-center">
            <p className="text-xs text-muted-foreground">評価済み</p>
            <p className="mt-1 text-2xl font-bold text-secondary">
              {ratedCount}
              <span className="text-sm text-muted-foreground">
                {" "}
                / {venueCount}
              </span>
            </p>
          </CardContent>
        </Card>
        <Card className="shadow-[var(--shadow-soft)]">
          <CardContent className="p-4 text-center">
            <p className="text-xs text-muted-foreground">最終候補</p>
            <p className="mt-1 text-2xl font-bold text-accent">
              {shortlistedCount}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Decision banner */}
      {hasDecision && (
        <Card className="border-primary bg-gradient-to-br from-primary to-blue-800 text-white shadow-lg">
          <CardContent className="flex items-center gap-3 p-4">
            <CheckCircle className="h-8 w-8 shrink-0 text-accent" />
            <div>
              <p className="font-serif font-bold">式場が決定しています</p>
              <Link
                href="/decision"
                className="text-sm text-blue-200 underline"
              >
                決定内容を確認する
              </Link>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Next action */}
      {nextAction && !hasDecision && (
        <Card className="border-l-4 border-l-accent shadow-[var(--shadow-soft)]">
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">
              {nextAction.message}
            </p>
            <Link
              href={nextAction.href}
              className="mt-3 inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-all active:scale-[0.98] hover:bg-primary/90"
            >
              {nextAction.label}
            </Link>
          </CardContent>
        </Card>
      )}

      {/* Quick actions */}
      <div className="grid grid-cols-2 gap-3">
        <Link href="/venues">
          <Card className="shadow-[var(--shadow-soft)] transition-all active:scale-[0.98] hover:shadow-md">
            <CardContent className="flex items-center gap-3 p-4">
              <Plus className="h-5 w-5 text-primary" />
              <span className="text-sm font-medium">式場を追加</span>
            </CardContent>
          </Card>
        </Link>
        <Link href="/compare">
          <Card className="shadow-[var(--shadow-soft)] transition-all active:scale-[0.98] hover:shadow-md">
            <CardContent className="flex items-center gap-3 p-4">
              <BarChart3 className="h-5 w-5 text-secondary" />
              <span className="text-sm font-medium">比較する</span>
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* Recent venues */}
      {venueCount > 0 && (
        <div>
          <h2 className="mb-3 font-serif text-base font-semibold">
            最近の式場
          </h2>
          <div className="space-y-2">
            {venues.slice(0, 5).map((venue) => {
              const avgScore =
                venue.scores.length > 0
                  ? venue.scores.reduce((a, s) => a + Number(s.score), 0) /
                    venue.scores.length
                  : null;
              return (
                <Link key={venue.id} href={`/venues/${venue.id}`}>
                  <Card className="shadow-[var(--shadow-soft)] transition-all active:scale-[0.98]">
                    <CardContent className="flex items-center justify-between p-3">
                      <div>
                        <p className="font-medium">{venue.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {venue.location || "場所未設定"}
                          {venue.scores.length === 0 && " · 未評価"}
                        </p>
                      </div>
                      {avgScore !== null && (
                        <span className="text-lg font-bold text-accent">
                          {avgScore.toFixed(1)}
                        </span>
                      )}
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
