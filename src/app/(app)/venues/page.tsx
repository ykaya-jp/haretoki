import { VenueListControls } from "@/components/venues/venue-list-controls";
import { getVenues } from "@/server/actions/venues";

export default async function VenuesPage() {
  const venues = await getVenues();

  return <VenueListControls venues={venues} />;
}
