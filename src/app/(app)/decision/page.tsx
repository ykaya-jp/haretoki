import Link from "next/link";
import { getDecision } from "@/server/actions/decisions";
import { getVenues } from "@/server/actions/venues";
import { DecisionForm } from "@/components/decision/decision-form";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function DecisionPage() {
  const decision = await getDecision();

  if (decision) {
    return (
      <div className="space-y-6">
        <Card className="bg-gradient-to-br from-primary/10 to-primary/5 shadow-[var(--shadow-card)]">
          <CardHeader className="text-center">
            <CardTitle className="font-serif text-2xl">
              おめでとうございます！
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              おふたりの特別な場所が決まりました
            </p>
          </CardHeader>
          <CardContent className="space-y-4 text-center">
            <p className="text-xl font-bold text-primary">{decision.venue.name}</p>
            {decision.rationale && (
              <p className="text-sm text-muted-foreground">
                {decision.rationale}
              </p>
            )}
            <p className="text-xs text-muted-foreground">
              {new Date(decision.decidedAt).toLocaleDateString("ja-JP", { year: "numeric", month: "long", day: "numeric" })}に決定
            </p>
            <p className="text-sm text-muted-foreground">
              素敵な一日になりますように
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const venues = await getVenues();
  const shortlisted = venues.filter(
    (v) => v.status === "shortlisted" || v.status === "selected",
  );

  return (
    <div className="space-y-6">
      <h1 className="text-xl">運命の式場を決めましょう</h1>

      {shortlisted.length === 0 ? (
        <div className="py-12 text-center">
          <p className="text-muted-foreground">
            まずお気に入りの式場を見つけてみましょう
          </p>
          <Link href="/shortlist" className="mt-4 inline-block">
            <Button variant="outline">お気に入りを見る</Button>
          </Link>
        </div>
      ) : (
        <DecisionForm
          venues={shortlisted.map((v) => ({ id: v.id, name: v.name }))}
        />
      )}
    </div>
  );
}
