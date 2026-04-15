"use client";

import { useEffect, useState, useTransition } from "react";
import { scheduleVisit, completeVisit, addVisitNote } from "@/server/actions/visits";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Calendar, Check, FileText, MapPin, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { useGeolocation } from "@/hooks/use-geolocation";
import { cn } from "@/lib/utils";
import { VisitChecklist } from "@/components/visits/visit-checklist";

interface Visit {
  id: string;
  scheduledAt: Date | null;
  status: string;
  completedAt: Date | null;
  title: string | null;
  memo: string | null;
  checklist: Array<{ id: string; item: string; category: string | null; status: string; memo: string | null; photoUrls: string[] }>;
  notes: Array<{
    id: string;
    content: string;
    tags: string[];
    locationLat: number | null;
    locationLng: number | null;
    createdAt: Date;
    media: Array<{ id: string; type: string; mediaUrl: string }>;
  }>;
}

interface VisitSectionProps {
  venueId: string;
  venueName: string;
  visits: Visit[];
  projectId: string;
}

export function VisitSection({ venueId, visits }: VisitSectionProps) {
  const [showScheduleForm, setShowScheduleForm] = useState(false);
  const [scheduleDate, setScheduleDate] = useState("");
  const [scheduleMemo, setScheduleMemo] = useState("");
  const [noteText, setNoteText] = useState("");
  const [showNoteForm, setShowNoteForm] = useState(false);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const geo = useGeolocation();

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
        toast.success("見学の予定を追加しました");
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
      toast.success("見学おつかれさまでした");
      router.refresh();
    });
  };

  const handleAddNote = (visitId: string) => {
    if (!noteText.trim()) return;
    startTransition(async () => {
      const result = await addVisitNote(visitId, {
        content: noteText,
        locationLat: geo.latitude ?? undefined,
        locationLng: geo.longitude ?? undefined,
      });
      if (result.success) {
        toast.success("メモを残しました");
        setNoteText("");
        setShowNoteForm(false);
        router.refresh();
      } else {
        toast.error(result.error ?? "メモをうまく残せませんでした");
      }
    });
  };

  // handleToggleCheck is now in VisitChecklist component

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base">見学のきろく</h2>
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
            <label className="text-sm font-medium">見学の日時</label>
            <Input type="datetime-local" value={scheduleDate} onChange={(e) => setScheduleDate(e.target.value)} />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">メモ（任意）</label>
            <Input value={scheduleMemo} onChange={(e) => setScheduleMemo(e.target.value)} placeholder="待ち合わせ場所、担当の方のお名前など" />
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
              visit.status === "scheduled" ? "bg-blue-50 text-blue-700" :
              visit.status === "completed" ? "bg-green-50 text-green-700" : "bg-muted text-muted-foreground"
            )}>
              {visit.status === "scheduled" ? "見学予定" : visit.status === "completed" ? "見学済み" : "取りやめ"}
            </span>
          </div>

          {visit.memo && <p className="text-sm text-muted-foreground">{visit.memo}</p>}

          {/* Complete button */}
          {visit.status === "scheduled" && (
            <Button size="sm" variant="outline" onClick={() => handleComplete(visit.id)} disabled={isPending} className="gap-1">
              <Check className="h-4 w-4" /> 見学を終えた
            </Button>
          )}

          {/* Checklist */}
          {visit.checklist.length > 0 && (
            <VisitChecklist items={visit.checklist} />
          )}

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
                  <Button size="sm" variant="outline" onClick={() => setShowNoteForm(false)}>キャンセル</Button>
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
              {visit.notes.map((note) => (
                <div key={note.id} className="rounded-lg bg-muted/50 p-3 text-sm">
                  <p>{note.content}</p>
                  <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                    <span className="tabular-nums">{new Date(note.createdAt).toLocaleString("ja-JP")}</span>
                    {note.locationLat && <><MapPin className="h-3 w-3" /> GPS</>}
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
              ))}
            </div>
          )}
        </div>
      ))}

      {visits.length === 0 && !showScheduleForm && (
        <p className="text-sm text-muted-foreground">見学の思い出をここに残せます</p>
      )}
    </section>
  );
}
