import { PublicGuestNav } from "@/components/ranking/PublicGuestNav";
import { PublicVenueSwitcher } from "@/components/ranking/PublicVenueSwitcher";
import { getActivePublicVenueId, listPublicVenues } from "@/lib/ranking/public-venue";
import { venueById } from "@/lib/venue/constants";

export default async function PublicRankingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const activeVenueId = await getActivePublicVenueId();
  const venues = listPublicVenues();
  const venue = venueById(activeVenueId);

  return (
    <div className="public-ranking-shell min-h-dvh h-dvh flex flex-col max-w-lg mx-auto w-full relative isolate">
      <div className="bg-mesh" aria-hidden />
      <header className="public-ranking-shell__header">
        <p className="public-ranking-shell__brand">MNF HOLDEM</p>
        <PublicVenueSwitcher venues={venues} activeVenueId={activeVenueId} />
      </header>
      {venue && (
        <p className="public-ranking-shell__venue-hint px-4 text-[11px] text-on-surface-variant -mt-1 mb-1">
          {venue.name} 기준
        </p>
      )}
      <main className="public-ranking-shell__main">{children}</main>
      <PublicGuestNav />
    </div>
  );
}
