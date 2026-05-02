"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { scheduleVisit, completeVisit, addVisitNote, addVisitNotePhoto, markVisitCalendarExported } from "@/server/actions/visits";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Calendar, Camera, Check, FileText, MapPin, Loader2, Star, X } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useGeolocation } from "@/hooks/use-geolocation";
import { useOnlineStatus } from "@/hooks/use-online-status";
import { cn } from "@/lib/utils";
import { VisitChecklist } from "@/components/visits/visit-checklist";
import { VisitRatingForm } from "@/components/visits/visit-rating-form";
import { CalendarExportButton } from "@/components/visits/calendar-export-button";
import {
  enqueueVisitNote,
  peekQueue,
  removeFromQueue,
  type QueuedVisitNotePayload,
} from "@/lib/visit-note-queue";
import { PermissionSheet } from "@/components/notifications/permission-sheet";

interface Visit {
  id: string;
  scheduledAt: Date | null;
  status: string;
  completedAt: Date | null;
  title: string | null;
  memo: string | null;
  /** F2: iCalendar export timestamp (null = never exported). */
  calendarExportedAt?: Date | null;
  checklist: Array<{ id: string; item: string; category: string | null; status: string; memo: string | null; photoUrls: string[] }>;
  notes: Array<{
    id: string;
    content: string;
    tags: string[];
    userId: string | null;
    locationLat: number | null;
    locationLng: number | null;
    createdAt: Date;
    media: Array<{ id: string; type: string; mediaUrl: string }>;
  }>;
  /** Current user's VisitRating entries for this visit. */
  ratings?: Array<{ dimension: string; score: number }>;
}

interface VisitSectionProps {
  venueId: string;
  venueName: string;
  visits: Visit[];
  projectId: string;
  /** Current signed-in user id — used to label notes "自分" vs "パートナー" */
  currentUserId?: string;
  /** Partner's user id — used to label notes "パートナー" */
  partnerUserId?: string;
  /**
   * VAPID public key — passed from the server component so the value tracks
   * the deploy environment. Empty string disables the post-save permission
   * sheet (e.g. preview deploys that skipped the env). The PermissionSheet
   * itself also no-ops when the browser doesn't support push.
   */
  vapidPublicKey?: string;
}

export function VisitSection({ venueId, venueName, visits, currentUserId, partnerUserId, vapidPublicKey }: VisitSectionProps) {
  const [showScheduleForm, setShowScheduleForm] = useState(false);
  const [scheduleDate, setScheduleDate] = useState("");
  const [scheduleMemo, setScheduleMemo] = useState("");
  const [noteText, setNoteText] = useState("");
  const [showNoteForm, setShowNoteForm] = useState(false);
  // W20-2: optional photo attached to the next memo. Held as a File so we
  // can preview it locally before the upload completes; the URL is created
  // with URL.createObjectURL on render and revoked when the picker resets.
  const [notePhoto, setNotePhoto] = useState<File | null>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const [expandedRatingVisitId, setExpandedRatingVisitId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const isOnline = useOnlineStatus();
  // Guard so the auto-flush only fires once per online transition. Without
  // this, a Strict-mode double-mount or a flapping connection would post
  // the same queued note twice.
  const flushingRef = useRef(false);
  const geo = useGeolocation();
  // F2: avoid double-triggering the ics fetch if the toast action is tapped
  // twice, or if the user schedules → tap → re-schedules within the toast window.
  const icsBusyRef = useRef(false);
  // B-1: visit id of the just-saved schedule. PermissionSheet keys off this
  // value — a new id triggers the 1-sec delayed prompt; null keeps it idle.
  const [pushPromptKey, setPushPromptKey] = useState<string | null>(null);

  // F2 (W15 audit): download + persist .ics for a visit the user just created.
  // Kept inside the component (not a helper) so it has router/toast scope.
  const triggerIcsDownload = async (visitId: string) => {
    if (icsBusyRef.current) return;
    icsBusyRef.current = true;
    try {
      const res = await fetch(`/api/visits/${visitId}/ics`, {
        method: "GET",
        credentials: "include",
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      let filename = "haretoki-visit.ics";
      const cd = res.headers.get("Content-Disposition");
      if (cd) {
        const m = cd.match(/filename="([^"]+)"/);
        if (m) filename = m[1];
      }
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 10_000);

      const result = await markVisitCalendarExported(visitId);
      if (!result.success) {
        console.warn("markVisitCalendarExported failed", result.error);
      }
      router.refresh();
      toast.success("ふたりのカレンダーに入りました", {
        description: "次の画面で「追加」を押してください",
        duration: 6000,
      });
    } catch (err) {
      console.error("calendar export failed", err);
      toast.error("うまく渡せませんでした。また試してみてください");
    } finally {
      icsBusyRef.current = false;
    }
  };

  // Only a *scheduled* visit should hide the "schedule new" button. Completed
  // visits should not block the user from booking another visit.
  const scheduledVisit = visits.find((v) => v.status === "scheduled");

  // Request geolocation on mount so it's ready when the user saves a note.
  // Previously `handleAddNote` called requestLocation() then read `geo.latitude`
  // synchronously, which was always null because getCurrentPosition is async.
  useEffect(() => {
    geo.requestLocation();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSchedule = () => {
    if (!scheduleDate) return;
    startTransition(async () => {
      const result = await scheduleVisit(venueId, {
        scheduledAt: new Date(scheduleDate),
        memo: scheduleMemo || undefined,
      });
      if (result.success) {
        // F2 (W15 audit): at peak intent, offer to push the event into the
        // couple's personal calendar. 8s duration gives enough time to tap
        // without feeling rushed.
        const newVisitId = result.visitId;
        // B-1: surface the push permission sheet 1 sec after this toast.
        // PermissionSheet handles all suppression logic (already-decided,
        // unsupported browser, "受け取らない" persisted) so we just hand
        // over the trigger key and let it decide whether to show.
        if (newVisitId) setPushPromptKey(newVisitId);
        toast.success("見学の予定を残しました", {
          description: "ふたりのカレンダーに入れておきますか？",
          action: newVisitId
            ? {
                label: "カレンダーに追加",
                onClick: () => {
                  void triggerIcsDownload(newVisitId);
                },
              }
            : undefined,
          duration: 8000,
        });
        setShowScheduleForm(false);
        setScheduleDate("");
        setScheduleMemo("");
        router.refresh();
      } else {
        toast.error(result.error ?? "うまく追加できませんでした");
      }
    });
  };

  const handleComplete = (visitId: string) => {
    startTransition(async () => {
      await completeVisit(visitId);
      // E-3: prompt the couple to use "帰り道モード" while impressions are
      // still warm. Action sends them to the 3-step capture flow.
      toast.success("見学おつかれさまでした", {
        description: "帰り道モードで、3 分の印象を残しませんか？",
        action: {
          label: "残す",
          onClick: () => router.push(`/visits/${visitId}/way-home`),
        },
        duration: 8000,
      });
      router.refresh();
    });
  };

  // W20-1: retry a single queued note by its local id. Used by the toast's
  // "もう一度送る" action — the note has already been displayed to the
  // user as queued, so success here just removes it from local storage and
  // refreshes the list without re-prompting.
  const retryQueuedNote = (queueId: string, visitId: string) => {
    const target = peekQueue().find((e) => e.id === queueId);
    if (!target) {
      // Already flushed by the online listener — nothing to do.
      toast.success("送信済みでした");
      return;
    }
    startTransition(async () => {
      const result = await addVisitNote(visitId, target.payload);
      if (result.success) {
        removeFromQueue(queueId);
        toast.success("メモを残しました");
        router.refresh();
      } else {
        toast.error("まだ送れません。もう少し待ってからもう一度試してください");
      }
    });
  };

  const handleAddNote = (visitId: string) => {
    if (!noteText.trim()) return;
    const payload: QueuedVisitNotePayload = {
      content: noteText,
      locationLat: geo.latitude ?? undefined,
      locationLng: geo.longitude ?? undefined,
    };
    // W20-2: capture the photo at submit time so we can clear `notePhoto`
    // optimistically without losing the file if the upload runs late.
    const photoFile = notePhoto;
    startTransition(async () => {
      const result = await addVisitNote(visitId, payload);
      if (!result.success) {
        // W20-1: save failed (network drop on the venue floor / Server
        // Action error). Persist the payload locally so the memo isn't
        // lost. The online listener auto-flushes when the connection
        // returns; the toast also offers a manual retry for users who
        // want to try right now. Photos do not survive the queue today —
        // we keep the picker open so the user can decide whether to drop
        // it or wait and re-attach.
        const queued = enqueueVisitNote(visitId, payload);
        toast.error("メモは下書きとして残しました", {
          description:
            result.error ??
            "電波が戻ったら自動で送ります。手動でも送れます。",
          action: {
            label: "もう一度送る",
            onClick: () => retryQueuedNote(queued.id, visitId),
          },
          duration: 10000,
        });
        setNoteText("");
        setShowNoteForm(false);
        return;
      }

      // W20-2: text saved. Now try to attach the optional photo. We
      // succeed-toast the note up front so the user sees confirmation
      // even if the upload is slow (a multi-MB photo on poor reception
      // can take several seconds), then surface the photo result
      // separately. The note row stays in the UI either way.
      toast.success("メモを残しました");
      setNoteText("");
      setNotePhoto(null);
      if (photoInputRef.current) photoInputRef.current.value = "";
      setShowNoteForm(false);

      if (photoFile && result.noteId) {
        const fd = new FormData();
        fd.append("photo", photoFile);
        const photoResult = await addVisitNotePhoto(result.noteId, fd);
        if (!photoResult.success) {
          toast.error(
            photoResult.error ??
              "写真は送れませんでした。あとで添付できます",
          );
        }
      }

      router.refresh();
    });
  };

  // W20-2: thumbnail preview URL. Treat as a derived value via useMemo so
  // the eslint `set-state-in-effect` rule stays clean (memo lives in the
  // render phase, not in a useEffect setState dance). The companion
  // useEffect's only job is the cleanup — it revokes the blob URL when
  // `notePhoto` changes or the component unmounts, so we don't leak a
  // fresh ObjectURL each time the user re-takes the shot.
  const photoPreviewUrl = useMemo(
    () => (notePhoto ? URL.createObjectURL(notePhoto) : null),
    [notePhoto],
  );
  useEffect(() => {
    if (!photoPreviewUrl) return;
    return () => URL.revokeObjectURL(photoPreviewUrl);
  }, [photoPreviewUrl]);

  // W20-1: when the browser reports online again, flush any queued notes.
  // Per-entry success removes from the queue; failures stay so the user
  // can keep retrying. We only attempt notes whose visitId belongs to
  // this venue's visits, so opening another venue's page doesn't fire
  // their queue from here.
  useEffect(() => {
    if (!isOnline) return;
    if (flushingRef.current) return;
    const queue = peekQueue();
    const ours = queue.filter((e) =>
      visits.some((v) => v.id === e.visitId),
    );
    if (ours.length === 0) return;
    flushingRef.current = true;
    (async () => {
      let succeeded = 0;
      for (const entry of ours) {
        try {
          const result = await addVisitNote(entry.visitId, entry.payload);
          if (result.success) {
            removeFromQueue(entry.id);
            succeeded++;
          }
        } catch {
          // Network still flaky — leave the entry queued for the next
          // online transition.
        }
      }
      flushingRef.current = false;
      if (succeeded > 0) {
        toast.success(
          succeeded === 1
            ? "下書きのメモを送信しました"
            : `下書きのメモ ${succeeded} 件を送信しました`,
        );
        router.refresh();
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOnline]);

  // handleToggleCheck is now in VisitChecklist component

  return (
    // id="visit" は Home の「見学予定を入れる」CTA からこの section に直接
    // scroll させるためのアンカー（/venues/<id>#visit）。
    <section id="visit" className="scroll-mt-24 space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[11.5px] uppercase tracking-[0.2em] text-muted-foreground">
            Visit
          </p>
          <h2 className="mt-0.5 font-[family-name:var(--font-display)] text-[15px] font-light tracking-[-0.005em]">
            見学のきろく
          </h2>
        </div>
        {!scheduledVisit && (
          <Button size="sm" variant="outline" onClick={() => setShowScheduleForm(true)} className="gap-1">
            <Calendar className="h-4 w-4" />
            見学の予定を入れる
          </Button>
        )}
      </div>

      {/* Schedule form */}
      {showScheduleForm && (
        <div className="space-y-3 rounded-lg border border-border p-4">
          <div className="space-y-2">
            <label htmlFor="visit-schedule-date" className="text-sm font-medium">見学の日時</label>
            <Input id="visit-schedule-date" type="datetime-local" value={scheduleDate} onChange={(e) => setScheduleDate(e.target.value)} />
          </div>
          <div className="space-y-2">
            <label htmlFor="visit-schedule-memo" className="text-sm font-medium">メモ（任意）</label>
            <Input id="visit-schedule-memo" value={scheduleMemo} onChange={(e) => setScheduleMemo(e.target.value)} placeholder="待ち合わせ場所、担当の方のお名前など" />
          </div>
          <div className="flex gap-2">
            <Button onClick={handleSchedule} disabled={isPending || !scheduleDate}>
              {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "予定を追加"}
            </Button>
            <Button variant="outline" onClick={() => setShowScheduleForm(false)}>キャンセル</Button>
          </div>
        </div>
      )}

      {/* Visit cards */}
      {visits.map((visit) => (
        <div key={visit.id} className="space-y-3 rounded-xl bg-card p-4 shadow-[var(--shadow-card)]">
          {/* Visit header */}
          <div className="flex items-center justify-between">
            <div>
              {visit.scheduledAt && (
                <p className="text-lg font-light tabular-nums">
                  {new Date(visit.scheduledAt).toLocaleDateString("ja-JP", { month: "numeric", day: "numeric", weekday: "short" })}
                  {" "}
                  {new Date(visit.scheduledAt).toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" })}
                </p>
              )}
              {visit.title && <p className="text-sm text-muted-foreground">{visit.title}</p>}
            </div>
            <span className={cn(
              "rounded-full px-2 py-0.5 text-xs",
              visit.status === "scheduled"
                ? "bg-[color-mix(in_oklab,var(--primary)_10%,var(--background))] text-[color-mix(in_oklab,var(--primary)_80%,var(--foreground))]"
                : visit.status === "completed"
                  ? "bg-[color-mix(in_oklab,var(--gold-warm)_12%,var(--background))] text-[color-mix(in_oklab,var(--gold-warm)_85%,var(--foreground))]"
                  : "bg-muted text-muted-foreground",
            )}>
              {visit.status === "scheduled" ? "見学予定" : visit.status === "completed" ? "見学済み" : "取りやめ"}
            </span>
          </div>

          {visit.memo && <p className="text-sm text-muted-foreground">{visit.memo}</p>}

          {/* Complete + Prep buttons for scheduled visits */}
          {visit.status === "scheduled" && (
            <div className="flex flex-wrap items-center gap-2">
              <Button size="sm" variant="outline" onClick={() => handleComplete(visit.id)} disabled={isPending} className="gap-1">
                <Check className="h-4 w-4" /> 見学を終えた
              </Button>
              {/* E-8 Question Bank: 当日の質問リスト */}
              <Link
                href={`/visits/${visit.id}/prep`}
                className="inline-flex min-h-9 items-center gap-1 rounded-md px-3 text-xs text-muted-foreground hover:text-foreground underline-offset-4 hover:underline"
              >
                質問を用意する →
              </Link>
              {/* F2 (W15 audit): third exposure point — next to the detail
                  page's in-visit actions. See design §3.2.3. */}
              <CalendarExportButton
                visitId={visit.id}
                venueName={venueName}
                calendarExportedAt={visit.calendarExportedAt ?? null}
                visitStatus={visit.status}
                variant="compact"
              />
            </div>
          )}

          {/* Checklist */}
          {visit.checklist.length > 0 && (
            <VisitChecklist items={visit.checklist} venueId={venueId} />
          )}

          {/* Star rating — completed visits only */}
          {visit.status === "completed" && (() => {
            const existingRatings = Object.fromEntries(
              (visit.ratings ?? []).map((r) => [r.dimension, r.score]),
            );
            const hasRatings = (visit.ratings ?? []).length > 0;
            const isExpanded = expandedRatingVisitId === visit.id;

            return (
              <div className="space-y-2 border-t border-border pt-3">
                {!isExpanded ? (
                  <button
                    type="button"
                    onClick={() => setExpandedRatingVisitId(visit.id)}
                    className={cn(
                      "flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2.5 text-sm transition-colors active:bg-muted",
                      hasRatings
                        ? "text-muted-foreground hover:text-foreground"
                        : "bg-[var(--gold-subtle)] text-[color-mix(in_oklab,var(--gold-warm)_80%,var(--foreground))]",
                    )}
                  >
                    <span className="flex items-center gap-1.5">
                      <Star className="h-4 w-4" strokeWidth={1.5} />
                      {hasRatings ? "星評価を書き直す" : "印象を残す"}
                    </span>
                    <span className="text-xs text-muted-foreground">→</span>
                  </button>
                ) : (
                  <div className="rounded-lg border border-border p-3">
                    <div className="mb-3 flex items-center justify-between">
                      <p className="text-sm font-light">各項目の印象を星で残す</p>
                      <button
                        type="button"
                        onClick={() => setExpandedRatingVisitId(null)}
                        className="text-xs text-muted-foreground hover:text-foreground"
                      >
                        閉じる
                      </button>
                    </div>
                    <VisitRatingForm
                      visitId={visit.id}
                      venueId={venueId}
                      existingRatings={existingRatings}
                      onSaved={() => setExpandedRatingVisitId(null)}
                    />
                  </div>
                )}
              </div>
            );
          })()}

          {/* Quick capture bar */}
          <div className="flex items-center gap-3 border-t border-border pt-3">
            <button
              type="button"
              onClick={() => setShowNoteForm(true)}
              aria-label="メモを追加"
              className="flex h-11 w-11 items-center justify-center rounded-full bg-muted transition-transform active:scale-95"
            >
              <FileText aria-hidden="true" className="h-5 w-5 text-muted-foreground" />
            </button>
          </div>

          {/* Note form */}
          {showNoteForm && (
            <div className="space-y-2 rounded-lg border border-border p-3">
              <textarea
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                placeholder="感じたことを自由に書いてください"
                className="w-full rounded-lg border border-border bg-card p-2 text-sm"
                rows={3}
                maxLength={2000}
              />
              {/* W20-2: optional photo. `capture="environment"` opens the
                  rear camera on mobile so the couple can snap a wall /
                  ceiling / banquet detail without leaving the form. The
                  picker stays empty when no shot is selected — we don't
                  pre-claim space, the form grows when needed. */}
              {photoPreviewUrl ? (
                <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/30 p-2">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={photoPreviewUrl}
                    alt="添付する写真のプレビュー"
                    className="h-16 w-16 shrink-0 rounded object-cover"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs text-foreground">
                      {notePhoto?.name ?? "写真"}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      残すと一緒に保存されます
                    </p>
                  </div>
                  <button
                    type="button"
                    aria-label="写真を外す"
                    onClick={() => {
                      setNotePhoto(null);
                      if (photoInputRef.current)
                        photoInputRef.current.value = "";
                    }}
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => photoInputRef.current?.click()}
                  className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-border bg-card px-3 text-xs text-muted-foreground transition-colors hover:border-[var(--gold-warm)]/60 hover:text-[var(--gold-warm)]"
                >
                  <Camera className="h-4 w-4" strokeWidth={1.6} />
                  写真を添える
                </button>
              )}
              <input
                ref={photoInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0] ?? null;
                  if (!file) return;
                  setNotePhoto(file);
                }}
              />
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">
                  {geo.latitude ? <><MapPin className="mr-1 inline h-3 w-3" />位置情報を取得済み</> : "位置情報なし"}
                </span>
                <span
                  className={cn(
                    "text-xs tabular-nums",
                    noteText.length > 1800
                      ? "text-destructive"
                      : "text-muted-foreground",
                  )}
                >
                  {noteText.length} / 2000
                </span>
              </div>
              <div className="flex items-center justify-end">
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => {
                    setShowNoteForm(false);
                    setNotePhoto(null);
                    if (photoInputRef.current) photoInputRef.current.value = "";
                  }}>キャンセル</Button>
                  <Button size="sm" onClick={() => handleAddNote(visit.id)} disabled={isPending || !noteText.trim()}>
                    {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "残す"}
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Notes list */}
          {visit.notes.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-medium">メモ</p>
              {visit.notes.map((note) => {
                const authorLabel =
                  note.userId && currentUserId
                    ? note.userId === currentUserId
                      ? "自分"
                      : note.userId === partnerUserId
                        ? "パートナー"
                        : null
                    : null;
                return (
                  <div key={note.id} className="rounded-lg bg-muted/50 p-3 text-sm">
                    <p>{note.content}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <span className="tabular-nums">{new Date(note.createdAt).toLocaleString("ja-JP")}</span>
                      {note.locationLat && <><MapPin className="h-3 w-3" /> GPS</>}
                      {authorLabel && (
                        <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] leading-none text-muted-foreground">
                          {authorLabel}
                        </span>
                      )}
                    </div>
                    {note.media.length > 0 && (
                      <div className="mt-2 flex gap-2">
                        {note.media.map((m) => (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img key={m.id} src={m.mediaUrl} alt="見学写真" className="h-16 w-16 rounded-lg object-cover" />
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ))}

      {visits.length === 0 && !showScheduleForm && (
        <div className="flex flex-col items-center gap-4 py-8 text-center">
          <div
            className="flex h-12 w-12 items-center justify-center rounded-full"
            style={{ boxShadow: "0 0 0 0.5px var(--gold-subtle)" }}
          >
            <Calendar className="h-6 w-6 text-[var(--gold-warm)]" strokeWidth={1.5} />
          </div>
          <div className="space-y-1">
            <p className="text-sm font-light">見学のきろくはこれから</p>
            <p className="text-xs text-muted-foreground leading-relaxed">
              予定を入れて、当日の印象やメモを残せば
              <br />
              あとで比べるときの手がかりになります
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowScheduleForm(true)}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-full bg-primary px-6 text-sm font-medium text-primary-foreground shadow-[0_2px_8px_rgba(0,0,0,0.08)] transition-all duration-200 active:scale-[0.98]"
          >
            <Calendar className="h-4 w-4" />
            見学の予定を入れる
          </button>
        </div>
      )}
      {vapidPublicKey ? (
        <PermissionSheet
          triggerKey={pushPromptKey}
          vapidPublicKey={vapidPublicKey}
        />
      ) : null}
    </section>
  );
}
