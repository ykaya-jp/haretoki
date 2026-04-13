"use client";

import { useState, useTransition } from "react";
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
  checklist: Array<{ id: string; item: string; category: string | null; status: string; memo: string | null }>;
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

  const activeVisit = visits.find(v => v.status === "scheduled" || v.status === "completed");

  const handleSchedule = () => {
    if (!scheduleDate) return;
    startTransition(async () => {
      const result = await scheduleVisit(venueId, {
        scheduledAt: new Date(scheduleDate),
        memo: scheduleMemo || undefined,
      });
      if (result.success) {
        toast.success("見学を予約しました");
        setShowScheduleForm(false);
        setScheduleDate("");
        setScheduleMemo("");
        router.refresh();
      } else {
        toast.error(result.error ?? "予約に失敗しました");
      }
    });
  };

  const handleComplete = (visitId: string) => {
    startTransition(async () => {
      await completeVisit(visitId);
      toast.success("見学を完了しました");
      router.refresh();
    });
  };

  const handleAddNote = (visitId: string) => {
    if (!noteText.trim()) return;
    startTransition(async () => {
      geo.requestLocation();
      const result = await addVisitNote(visitId, {
        content: noteText,
        locationLat: geo.latitude ?? undefined,
        locationLng: geo.longitude ?? undefined,
      });
      if (result.success) {
        toast.success("メモを保存しました");
        setNoteText("");
        setShowNoteForm(false);
        router.refresh();
      }
    });
  };

  // handleToggleCheck is now in VisitChecklist component

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base">見学記録</h2>
        {!activeVisit && (
          <Button size="sm" variant="outline" onClick={() => setShowScheduleForm(true)} className="gap-1">
            <Calendar className="h-4 w-4" />
            見学を予約
          </Button>
        )}
      </div>

      {/* Schedule form */}
      {showScheduleForm && (
        <div className="space-y-3 rounded-lg border border-border p-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">見学日時</label>
            <Input type="datetime-local" value={scheduleDate} onChange={(e) => setScheduleDate(e.target.value)} />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">メモ（任意）</label>
            <Input value={scheduleMemo} onChange={(e) => setScheduleMemo(e.target.value)} placeholder="集合時間、担当者名など" />
          </div>
          <div className="flex gap-2">
            <Button onClick={handleSchedule} disabled={isPending || !scheduleDate}>
              {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "予約する"}
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
              {visit.status === "scheduled" ? "予定" : visit.status === "completed" ? "完了" : "キャンセル"}
            </span>
          </div>

          {visit.memo && <p className="text-sm text-muted-foreground">{visit.memo}</p>}

          {/* Complete button */}
          {visit.status === "scheduled" && (
            <Button size="sm" variant="outline" onClick={() => handleComplete(visit.id)} disabled={isPending} className="gap-1">
              <Check className="h-4 w-4" /> 見学完了にする
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
              className="flex h-11 w-11 items-center justify-center rounded-full bg-muted transition-transform active:scale-95"
            >
              <FileText className="h-5 w-5 text-muted-foreground" />
            </button>
          </div>

          {/* Note form */}
          {showNoteForm && (
            <div className="space-y-2 rounded-lg border border-border p-3">
              <textarea
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                placeholder="見学メモを入力..."
                className="w-full rounded-lg border border-border bg-card p-2 text-sm"
                rows={3}
              />
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">
                  {geo.latitude ? <><MapPin className="mr-1 inline h-3 w-3" />位置情報あり</> : "位置情報なし"}
                </span>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => setShowNoteForm(false)}>キャンセル</Button>
                  <Button size="sm" onClick={() => handleAddNote(visit.id)} disabled={isPending || !noteText.trim()}>
                    {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "保存"}
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
                    <span>{new Date(note.createdAt).toLocaleString("ja-JP")}</span>
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
        <p className="text-sm text-muted-foreground">見学の記録をここに残せます</p>
      )}
    </section>
  );
}
