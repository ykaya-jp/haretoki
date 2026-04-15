# E-2 Fit Reason 一行 — 「ふたりの◯◯条件に合います」

**モック**: [mockups/e-2-fit-reason.html](../mockups/e-2-fit-reason.html)
**優先度**: H
**関連**: W-3 (AI 価値見える化), R-2 (気分タグ), Venue の情報階層

---

## What

各式場カードの **写真の直下** に、AI が生成した 1 行の fit reason を添える。

```
[写真]
[価格 eyebrow]
[式場名・明朝]
【新規追加】 "朝の自然光が差す中庭 — ふたりの『光がきれい』に合います"
[location · capacity]
[tags]
```

長さ 30-50 字、eyebrow でなく body サイズ（13px）、`text-[var(--gold-warm)]` + 細字。

### 実例

| 条件（Project.conditions） | Venue 特徴 | Fit Reason |
|---|---|---|
| 光を重視・80 名・予算 400 万 | アマン東京 / 天井高 12m / 緑中庭 | 「天井 12m と緑の中庭 — ふたりの "光と緑" に合います」 |
| アクセス重視・駅近 | パレスホテル / 大手町直結 | 「大手町駅直結 — ふたりの "アクセス" にまっすぐ合います」 |
| 料理重視 | アマン / 専属シェフ | 「専属シェフの和仏フュージョン — 料理の条件に合います」 |
| 少人数・静か | リッツ東京 / プライベートチャペル | 「プライベートチャペル 40 名 — "少人数で静か" にぴったり」 |
| 情報不足（条件未設定） | 任意 | 表示しない。「条件を入れるとここにヒントが出ます」CTA に置換 |

---

## Why

### 不の解消
1. **カタログ化の脱却**: 式場カードが並んでも「なぜ私に合うか」が不明
2. **Zola / Airbnb 体験の模倣**: "Matches your taste" ラベルはコンバージョン効果実証済み
3. **夫への文脈共有**: 妻が設定した条件を、夫が見ても一目で納得できる
4. **AI 価値の細かい露出**: バッチでなく **一覧の至るところ** に AI が生きている

### ブランド接続
- 条件未設定 = Sky 曇り → fit reason が出ない = 「まだ見えていない」を誠実に示す
- 条件が増える = Sky 晴れ間 → fit reason が豊かに

---

## How

### 生成戦略（コスト最適化）

Claude 呼び出しは **venue × project.conditions 単位** でキャッシュ。
inputHash に `(venue.id, venue.updatedAt, conditions.hash)` を使えば、venue または条件が変わった時だけ再生成。

### Server Action

```ts
// src/server/actions/fit-reason.ts
export async function getFitReasons(venueIds: string[]): Promise<Record<string, string | null>> {
  "use cache";
  const { projectId } = await requireMembership();
  cacheTag(`fit-reason:${projectId}`);

  const project = await prisma.project.findUnique({
    where: { id: projectId }, select: { conditions: true },
  });
  if (!project?.conditions) return {}; // 条件未設定 → 空

  const venues = await prisma.venue.findMany({
    where: { id: { in: venueIds }, projectId },
    select: { id: true, name: true, location: true, capacityMin: true, capacityMax: true, ceremonyStyles: true, features: true, accessInfo: true, updatedAt: true },
  });

  const results: Record<string, string> = {};
  const toGenerate: typeof venues = [];

  for (const v of venues) {
    const hash = computeInputHash(`${v.id}:${v.updatedAt.getTime()}:${JSON.stringify(project.conditions)}`);
    const cached = await prisma.aiAnalysis.findFirst({
      where: { venueId: v.id, type: "fit_reason", inputHash: hash },
    });
    if (cached) { results[v.id] = cached.output; continue; }
    toGenerate.push(v);
  }

  // 並列で新規生成 (最大 10 件 / リクエスト)
  await Promise.all(toGenerate.slice(0, 10).map(async (v) => {
    const raw = await askClaude({
      system: FIT_REASON_PROMPT.system,
      userMessage: FIT_REASON_PROMPT.buildUserMessage(v, project.conditions),
      maxTokens: 80,
    });
    const reason = parseOneLine(raw); // 30-50 字に収める
    const hash = computeInputHash(`${v.id}:${v.updatedAt.getTime()}:${JSON.stringify(project.conditions)}`);
    await prisma.aiAnalysis.create({
      data: { projectId, venueId: v.id, type: "fit_reason", inputHash: hash, output: reason },
    });
    results[v.id] = reason;
  }));

  return results;
}
```

### Schema 追加

```prisma
enum AiAnalysisType {
  review_summary
  estimate_prediction
  comparison
  matrix_insight  // (C-15 で追加予定)
  fit_reason      // (E-2 追加)
  visit_prep
  coach_chat
  rating_comparison
}
```

### UI 改修

VenueCard の photo 直下に挿入:

```tsx
// src/components/venues/venue-card.tsx
interface VenueCardProps {
  venue: VenueWithScores;
  isFavorite?: boolean;
  fitReason?: string | null;  // 新規 prop
}

// 写真セクションの直後 (line ~88 の <PrefetchLink> 内):
{fitReason && (
  <p
    className="px-5 pt-4 pb-0 text-[13px] leading-relaxed tracking-wide text-[var(--gold-warm)] italic font-light"
    aria-label="AI による相性コメント"
  >
    <Sparkles className="inline h-3 w-3 mb-0.5 mr-1" strokeWidth={1.6} />
    {fitReason}
  </p>
)}
```

### Prompt

```ts
export const FIT_REASON_PROMPT = {
  system: `あなたは Haretoki (結婚式場選びツール) の編集者です。
式場 1 件とカップルの希望条件を受け取り、30〜50 字の
**中立で温かい** 一言を返します。

## 出力（そのままテキスト、JSON ではない）
"○○ — ふたりの"△△"条件に合います"

## 禁止
- 「最高の」「絶対」「間違いない」等の誇張
- 売り文句・広告的表現
- 断定推薦（"ここにしましょう" 等）
- 条件と一致しない特徴の列挙
- 絵文字・感嘆符

## 例
入力: venue=アマン東京 (天井12m 緑中庭), conditions={光: 重視, 緑: 欲しい}
出力: "天井 12m と緑の中庭 — ふたりの "光と緑" に合います"

入力: venue=パレスホテル東京, conditions={アクセス: 駅近}
出力: "大手町駅直結 — ふたりの "アクセス" にまっすぐ合います"

出力は 1 行のみ。説明不要。`,

  buildUserMessage: (v, conditions) =>
    `venue: ${v.name}
location: ${v.location}
capacity: ${v.capacityMin}-${v.capacityMax}
features: ${(v.features ?? []).join(", ")}
access: ${v.accessInfo}

conditions: ${JSON.stringify(conditions)}`,
};
```

### 表示 places

- `/explore` venue grid
- `/candidates` shortlist VenueCard
- `/home` RecentVenues カルーセル（写真上の overlay として mini 版）
- `/venues/[id]` 詳細ページ上部（よりリッチに 2 文バージョン）

---

## 実装見積もり

| 内容 | 工数 |
|---|---|
| Prisma `AiAnalysisType.fit_reason` + migration | 15 分 |
| Prompt + parser | 30 分 |
| Server Action `getFitReasons` + cache | 40 分 |
| UI: VenueCard に prop 追加 + explore/candidates page で fetch | 45 分 |
| Cron 生成（新規式場追加時・条件変更時の事前生成） | 30 分 |
| **合計** | **約 2.5 時間** |

---

## コスト試算

- 新規式場追加時 + 条件変更時のみ生成
- 1 venue × Claude 80 tokens = ~¥0.3
- 1 ユーザー平均 15 venues × 1-2 回 条件変更 = ~¥10/ユーザー/月

---

## KPI

- venue card タップ率: fit reason なし vs あり で 1.3 倍
- 「なぜこの式場？」と思う割合 (定性): 40% → 10%
