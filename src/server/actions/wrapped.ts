"use server";

import { prisma } from "@/server/db";
import { requireProjectMembership, requireUser } from "@/server/auth";

/**
 * Wrapped — Spotify Wrapped 風の「ふたりの式場さがしの物語」集計。
 *
 * 6 つの数値 + 3 つの top-list を返す。9:16 hero ページ
 * (`/wrapped`) が page-by-page で見せる素材。商業メディアの "Year in
 * Review" 系は 1 数値 1 ページが鉄則 — `searches`, `topVibes`, `visits`,
 * `topAreas`, `decision/topVenue` の 5 シーンに分割しやすい shape。
 *
 * 性能: 全部 1 SQL round trip ではないが project-scoped で全 query が
 * O(N venues) なので 100 件未満ならば余裕。`use cache` は将来追加。
 */
export interface WrappedData {
  /** Project / 妻名のヘッダ用 */
  projectName: string;
  startedAt: Date;
  /** 取り込み・追加した式場の累計 */
  venuesAdded: number;
  /** 候補に入れたか見学した数 (どちらかでカウント) */
  venuesEngaged: number;
  /** 見学完了数 (visit.completedAt が non-null) */
  visitsCompleted: number;
  /** 評価 (Rating) を入れた回数 */
  ratingsRecorded: number;
  /** 残したメモの数 (VisitNote) */
  notesWritten: number;
  /** お気に入り保存頻度 top-3 vibe (頻度高い順) */
  topVibes: string[];
  /** よく見たエリア top-3 (location prefix) */
  topAreas: string[];
  /** Decision がある場合は決めた式場名、なければ null */
  decidedVenueName: string | null;
  /** 「物語」を出すに足るデータがあるか */
  hasStory: boolean;
}

export async function getWrappedData(): Promise<WrappedData> {
  const user = await requireUser();
  const { projectId } = await requireProjectMembership(user.id);

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { id: true, createdAt: true, name: true },
  });

  const projectName = project?.name ?? "おふたり";
  const startedAt = project?.createdAt ?? new Date();

  const [venues, visits, ratings, notes, decision] = await Promise.all([
    prisma.venue.findMany({
      where: { projectId, deletedAt: null },
      select: {
        id: true,
        vibeTags: true,
        location: true,
        favorites: { select: { id: true }, take: 1 },
        visits: { select: { id: true }, take: 1 },
      },
    }),
    prisma.visit.count({
      where: {
        venue: { projectId, deletedAt: null },
        deletedAt: null,
        completedAt: { not: null },
      },
    }),
    prisma.visitRating.count({
      where: {
        deletedAt: null,
        visit: { venue: { projectId, deletedAt: null }, deletedAt: null },
      },
    }),
    prisma.visitNote.count({
      where: {
        deletedAt: null,
        visit: { venue: { projectId, deletedAt: null }, deletedAt: null },
      },
    }),
    prisma.decision.findFirst({
      where: { projectId },
      select: { venue: { select: { name: true } } },
    }),
  ]);

  const venuesAdded = venues.length;
  const venuesEngaged = venues.filter(
    (v) => v.favorites.length > 0 || v.visits.length > 0,
  ).length;

  const vibeFreq = new Map<string, number>();
  const areaFreq = new Map<string, number>();
  for (const v of venues) {
    for (const tag of v.vibeTags) {
      vibeFreq.set(tag, (vibeFreq.get(tag) ?? 0) + 1);
    }
    if (v.location) {
      const areaKey = v.location.slice(0, 6);
      areaFreq.set(areaKey, (areaFreq.get(areaKey) ?? 0) + 1);
    }
  }

  const topK = (m: Map<string, number>, k: number) =>
    [...m.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, k)
      .map(([key]) => key);

  // hasStory: 何か 1 つでも 1 以上ならば物語として成立。zero-state 用
  // 分岐は wrapped page 側で「まだはじまったばかり」copy 出す。
  const hasStory =
    venuesAdded > 0 ||
    visits > 0 ||
    ratings > 0 ||
    notes > 0 ||
    decision !== null;

  return {
    projectName,
    startedAt,
    venuesAdded,
    venuesEngaged,
    visitsCompleted: visits,
    ratingsRecorded: ratings,
    notesWritten: notes,
    topVibes: topK(vibeFreq, 3),
    topAreas: topK(areaFreq, 3),
    decidedVenueName: decision?.venue.name ?? null,
    hasStory,
  };
}
