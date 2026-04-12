import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { VenueForm } from "@/components/venues/venue-form";
import { VenueCard } from "@/components/venues/venue-card";
import { getVenues } from "@/server/actions/venues";

export default async function VenuesPage() {
  const venues = await getVenues();

  return (
    <div className="space-y-6">
      <h1 className="font-serif text-xl font-bold">式場探索</h1>

      <Card className="shadow-[var(--shadow-soft)]">
        <CardHeader>
          <CardTitle className="font-serif text-base">新しい式場を追加</CardTitle>
        </CardHeader>
        <CardContent>
          <VenueForm />
        </CardContent>
      </Card>

      {venues.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-medium text-muted-foreground">
            登録済み式場（{venues.length}件）
          </h2>
          {venues.map((venue) => (
            <VenueCard key={venue.id} venue={venue} />
          ))}
        </div>
      )}
    </div>
  );
}
