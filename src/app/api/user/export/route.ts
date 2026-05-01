import { NextResponse } from "next/server";
import JSZip from "jszip";
import { prisma } from "@/server/db";
import { requireUser } from "@/server/auth";
import {
  buildUserExportBundle,
  collectPhotoUrls,
} from "@/server/actions/user-data";
import { detectBot } from "@/lib/botid";
import { extractRequestMeta, recordAudit } from "@/server/audit";

/**
 * GET /api/user/export — GDPR Article 20 (Right to data portability).
 *
 * Returns the authenticated user's entire data footprint as a ZIP
 * archive containing:
 *
 *   profile.json           — user row (id, email, name, createdAt)
 *   projects.json          — every project the user belongs to
 *   venues.json            — venues across all projects
 *   visits.json            — visits with checklist + ratings
 *   reviews.json           — reviews on the user's venues
 *   coach-messages.json    — coach chat history
 *   notifications.json     — in-app inbox + delivery preferences
 *   photos/manifest.txt    — newline-separated list of every Supabase
 *                            Storage URL referenced. Files themselves
 *                            are NOT bundled (would 10x archive size);
 *                            the URLs are signed Supabase paths the
 *                            user can download with their own credentials.
 *   README.txt             — explains the bundle layout in 日本語
 *
 * Round 15 changed the response from a single JSON blob to this ZIP
 * bundle — easier for the user to inspect with stock OS tools, and
 * separates concerns so a future export script can stream individual
 * files without re-assembling the whole structure.
 *
 * BotID gate — data exfiltration via export is the obvious abuse path
 * for a stolen session cookie; checking before bundle assembly (which
 * fans out across half a dozen tables) saves DB load too.
 *
 * Audit trail — every successful export records a `user.export` row
 * in `audit_logs` with email_hash + IP/UA so an account-takeover
 * incident has a precise per-event log to retrace.
 */
export async function GET(request: Request) {
  const bot = await detectBot("user-export");
  if (bot.blocked) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const user = await requireUser();
  const requestMeta = extractRequestMeta(request);

  const bundle = await buildUserExportBundle(prisma, user.id);
  const photoUrls = collectPhotoUrls(bundle);

  const zip = new JSZip();
  // README first so unzipping into Finder / Explorer shows it at the
  // top of the listing.
  zip.file("README.txt", README_BODY);
  zip.file("profile.json", JSON.stringify(bundle.user, null, 2));
  zip.file(
    "projects.json",
    JSON.stringify(
      { primary: bundle.project, all: bundle.projects },
      null,
      2,
    ),
  );
  zip.file("venues.json", JSON.stringify(bundle.venues, null, 2));
  zip.file("visits.json", JSON.stringify(bundle.visits, null, 2));
  zip.file("reviews.json", JSON.stringify(bundle.reviews_i_wrote, null, 2));
  zip.file("ratings.json", JSON.stringify(bundle.ratings, null, 2));
  zip.file("favorites.json", JSON.stringify(bundle.favorites, null, 2));
  zip.file("decisions.json", JSON.stringify(bundle.decisions, null, 2));
  zip.file(
    "coach-messages.json",
    JSON.stringify(bundle.coachMessages, null, 2),
  );
  zip.file(
    "notifications.json",
    JSON.stringify(
      {
        preference: bundle.notificationPreference,
        inbox: bundle.notifications,
      },
      null,
      2,
    ),
  );
  // Photo URLs as a plain newline-separated manifest — easier to feed
  // into a downloader script than JSON. Trailing newline so editors
  // don't complain.
  zip.file(
    "photos/manifest.txt",
    photoUrls.length > 0 ? photoUrls.join("\n") + "\n" : "",
  );

  const archive = await zip.generateAsync({
    type: "uint8array",
    compression: "DEFLATE",
    compressionOptions: { level: 6 },
  });

  // Best-effort audit row. Doesn't block the response.
  await recordAudit({
    action: "user.export",
    actorId: user.id,
    actorRole: "user",
    target: { type: "user", id: user.id },
    request: requestMeta,
    detail: {
      photoUrlCount: photoUrls.length,
      sizeBytes: archive.byteLength,
    },
  });

  const date = new Date().toISOString().slice(0, 10);
  return new NextResponse(new Uint8Array(archive), {
    status: 200,
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="haretoki-data-${date}.zip"`,
      "Cache-Control": "no-store",
      "Content-Length": String(archive.byteLength),
    },
  });
}

const README_BODY = `Haretoki — あなたのデータの書き出し

このアーカイブには、Haretoki に保存されたあなたのデータ全部が入っています。
GDPR 第 20 条 (データポータビリティ権) に基づいて発行しています。

ファイル一覧:
  profile.json          プロフィール (id / email / 名前 / 登録日)
  projects.json         参加している式場さがしプロジェクト
  venues.json           候補式場の情報
  visits.json           見学の記録 (チェックリスト・評価付き)
  reviews.json          AI が要約した口コミ
  ratings.json          あなたが入れた星評価
  favorites.json        ハートをつけた式場
  decisions.json        最終決定の記録
  coach-messages.json   AI コーチとの会話履歴
  notifications.json    通知設定 + 受信履歴
  photos/manifest.txt   写真の URL 一覧 (画像本体は含まれません)

写真の本体は Supabase Storage に保存されています。
manifest.txt に書かれた URL は、ご自身のアカウントでログインして
ダウンロードできます。 上記 JSON 内にも同じ URL が含まれています。

このアーカイブのデータをすべて削除したい場合は、 Haretoki アプリの
マイページ → 「アカウントを退会する」から実行できます。

— Haretoki
`;
