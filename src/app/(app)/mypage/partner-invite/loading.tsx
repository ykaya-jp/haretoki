import { Skeleton } from "@/components/ui/skeleton";

/**
 * /mypage/partner-invite skeleton — mirrors the actual page shape so
 * the layout doesn't shift on hydrate (back link + eyebrow + h1 +
 * subtitle + state panel). Same `<Skeleton>` primitive the sibling
 * mypage sub-routes use.
 */
export default function PartnerInviteLoading() {
  return (
    <div className="space-y-8 pb-8">
      <Skeleton className="h-5 w-40" />
      <div className="space-y-2">
        <Skeleton className="h-3 w-56" />
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-4 w-full max-w-md" />
        <Skeleton className="h-4 w-3/4 max-w-md" />
      </div>
      <Skeleton className="h-44 w-full rounded-2xl" />
    </div>
  );
}
