// /visits/[visitId]/prep — visit question list. The page calls
// ensureVisitQuestions which can take a few hundred ms on cold cache,
// so the skeleton has to read as deliberate (10+ row placeholders) and
// not as "the app froze". Couples often open this on the morning of a
// visit on a slow train wifi connection.
export default function VisitPrepLoading() {
  return (
    <div className="mx-auto max-w-2xl space-y-8 px-4 py-6">
      {/* Back link + title block */}
      <div className="space-y-3">
        <div className="h-4 w-20 animate-pulse rounded bg-muted/60" />
        <div className="h-7 w-56 animate-pulse rounded bg-muted/80" />
        <div className="h-3 w-72 animate-pulse rounded bg-muted/40" />
      </div>

      {/* Question rows — ~10 placeholders matches the typical question
          density once the list resolves. */}
      <div className="space-y-2">
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className="h-14 animate-pulse rounded-xl bg-muted/40"
          />
        ))}
      </div>
    </div>
  );
}
