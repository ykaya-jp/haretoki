"use client";

import { useState, useTransition } from "react";
import { makeDecision } from "@/server/actions/decisions";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Venue = {
  id: string;
  name: string;
};

type DecisionFormProps = {
  venues: Venue[];
};

export function DecisionForm({ venues }: DecisionFormProps) {
  const [selectedId, setSelectedId] = useState<string>("");
  const [rationale, setRationale] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedId) {
      setError("式場を選んでください");
      return;
    }
    setError(null);

    startTransition(async () => {
      const result = await makeDecision({
        selectedVenueId: selectedId,
        rationale: rationale || undefined,
      });

      if (result && "error" in result) {
        const errMsg =
          ("_form" in (result.error as Record<string, unknown>)
            ? (result.error as Record<string, string[]>)._form?.[0]
            : null) ??
          (result.error as Record<string, string[]>).selectedVenueId?.[0] ??
          "エラーが発生しました";
        setError(errMsg);
      }
    });
  }

  return (
    <Card className="shadow-[var(--shadow-card)]">
      <CardHeader>
        <CardTitle className="font-serif text-base">
          最終決定
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>おふたりの式場を選びましょう</Label>
            <div className="space-y-2">
              {venues.map((venue) => (
                <label
                  key={venue.id}
                  className="flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition-colors has-[:checked]:border-primary has-[:checked]:bg-primary/5"
                >
                  <input
                    type="radio"
                    name="venue"
                    value={venue.id}
                    checked={selectedId === venue.id}
                    onChange={() => setSelectedId(venue.id)}
                    className="accent-primary"
                  />
                  <span className="font-medium">{venue.name}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="rationale">決め手を残しておきましょう（任意）</Label>
            <textarea
              id="rationale"
              value={rationale}
              onChange={(e) => setRationale(e.target.value)}
              placeholder="どんなところが決め手になりましたか？後から読み返すのも楽しいですよ"
              rows={3}
              className="w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            />
          </div>

          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}

          <Button
            type="submit"
            disabled={isPending || !selectedId}
            className="w-full bg-accent text-accent-foreground hover:bg-accent/80"
          >
            {isPending ? "決定中..." : "この式場に決めます"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
