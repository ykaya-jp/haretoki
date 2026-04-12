import Link from "next/link";
import { getDecision } from "@/server/actions/decisions";
import { getVenues } from "@/server/actions/venues";
import { DecisionForm } from "@/components/decision/decision-form";
import { Celebration } from "@/components/decision/celebration";
import { Button } from "@/components/ui/button";

export default async function DecisionPage() {
  const decision = await getDecision();

  if (decision) {
    return (
      <div className="space-y-6">
        <Celebration
          venueName={decision.venue.name}
          rationale={decision.rationale}
          decidedAt={decision.decidedAt}
        />
      </div>
    );
  }

  const venues = await getVenues();
  const shortlisted = venues.filter(
    (v) => v.status === "shortlisted" || v.status === "selected",
  );

  return (
    <div className="space-y-6">
      <h1 className="font-serif text-xl font-light tracking-wide">運命の式場を決めましょう</h1>

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
