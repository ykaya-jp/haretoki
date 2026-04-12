import { getDecision } from "@/server/actions/decisions";
import { getVenues } from "@/server/actions/venues";
import { DecisionForm } from "@/components/decision/decision-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function DecisionPage() {
  const decision = await getDecision();

  if (decision) {
    return (
      <div className="space-y-6">
        <h1 className="font-serif text-xl font-bold">式場決定</h1>
        <Card className="bg-gradient-to-br from-primary/10 to-primary/5 shadow-[var(--shadow-soft)]">
          <CardHeader>
            <CardTitle className="font-serif text-base">
              おめでとうございます!
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-lg font-bold">{decision.venue.name}</p>
            {decision.rationale && (
              <p className="text-sm text-muted-foreground">
                {decision.rationale}
              </p>
            )}
            <p className="text-xs text-muted-foreground">
              決定日:{" "}
              {new Date(decision.decidedAt).toLocaleDateString("ja-JP")}
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
      <h1 className="font-serif text-xl font-bold">式場決定</h1>

      {shortlisted.length === 0 ? (
        <p className="py-12 text-center text-muted-foreground">
          まず候補リストに式場を追加してください
        </p>
      ) : (
        <DecisionForm
          venues={shortlisted.map((v) => ({ id: v.id, name: v.name }))}
        />
      )}
    </div>
  );
}
