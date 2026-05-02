# Phase 5 — 関西エリア展開 設計

**作成**: 2026-05-03 (paneA、Phase 5 入口準備)
**状態**: 🟡 **設計 doc**。実装は Beta launch + 関東 baseline 取得後の判断
**根拠**: 現状 area string は free text (主に表参道 / 青山 / 恵比寿 / 横浜 等の
首都圏地名が hard-coded) で、関西展開時に「area=梅田」のような string が
arbitrary に増殖して比較・検索の質が崩れる構造的問題

---

## 0. 一行サマリー

**area を free string から「region (関東/関西/...) → prefecture (東京/大阪/...)
→ city (梅田/銀座/...)」の 3 階層構造に拡張する**。同時に AI 推薦 / search /
saved search filter / venue card 表示が新構造に対応する 5 段階移行。**既存
ユーザー体験は完全 backward compat** で進める。

---

## 1. 現状

### 1.1 area データの実態

`prisma/schema.prisma` (おおよその構造):
- `Venue.area: String?` — free text、主な値は「表参道」「銀座」「恵比寿」
  「横浜」「鎌倉」等の首都圏地名
- `Project.conditions Json` 内の `area: string[]` — onboarding で couple が
  選んだエリア候補

### 1.2 関東 only の暗黙仮定

- `src/lib/prompts/onboarding.ts` Section C (Area inference) は area 未指定
  時に **「都心ホテル / 表参道専門式場 / 横浜系」を first-choice** で推薦
  (= Tokyo metropolitan default)
- 上記 Section C には「地方 (大阪 / 京都 / 名古屋 / 福岡 / 札幌) を area で
  指定された場合は **首都圏に寄せず地方代表式場を選ぶ**」という escape hatch
  はある = 関西を **完全には無視していない** が、area string がフラットなので
  「梅田」「難波」「神戸」が個別 string で出てきた瞬間に AI が「都心ホテル」
  推薦に戻ってしまう
- venue search filter は area string 完全一致 → couple が「梅田」と入れた
  search が「大阪」検索の couple の候補と統合できない

### 1.3 構造的問題

- 「関西で式場を探す couple」が増えるほど area string の variant が爆発
  (梅田 / うめだ / 大阪駅前 / 北区 / etc.)
- AI 推薦が「梅田 = 表参道のような都心、ホテル系を選ぶ」と一般化してしまう
  (関西の wedding 文化は東京と微妙に異なる: ホテル比率が高い、料理が選ばれる
  軸として強い、parental approval の比重が大きい等)
- saved search filter で「大阪府全域」を 1 つのフィルターにまとめられない

---

## 2. ゴール (5 段階)

### Stage 1 — Area 階層 enum 化 (~3 day)

- `prisma/schema.prisma` に新 enum:
  - `Region` — `KANTO` / `KANSAI` / `CHUBU` / `KYUSHU` / `HOKKAIDO` / `OTHER`
  - `Prefecture` — 47 都道府県の enum (`TOKYO` / `OSAKA` / `KYOTO` / 等)
- `Venue` に `region: Region?`, `prefecture: Prefecture?`, `city: String?` を追加
  (既存 `area: String?` は **deprecated** 扱いで残置、Stage 5 で削除)
- migration: 既存 venue を **scripts/migrate-area-to-region.ts** で best-effort
  分類 (表参道 → KANTO/TOKYO/渋谷区、梅田 → KANSAI/OSAKA/北区、等)。失敗した
  既存 row は `region=OTHER` で保留、operator が後で手動補正
- `Project.conditions Json` には影響無し (既存 area string array はそのまま、
  Stage 3 で別 field に migration)

### Stage 2 — Server Action / search 拡張 (~2 day)

- `src/server/actions/venues.ts` `getVenues` filter に `region` / `prefecture`
  / `city` を追加 (既存 `area` filter も併走)
- `src/lib/venue-filters.ts` の `buildVenueWhere` で **region 一致を優先**、
  area string 完全一致は fallback として残す
- `src/server/actions/saved-searches.ts` の filter schema に新 field 追加

### Stage 3 — onboarding / search UI 更新 (~3 day)

- onboarding step 3 (エリア) を「都道府県を選ぶ」→「市町村 (任意)」の 2 段
  pull-down に
- `src/lib/prompts/onboarding.ts` Section C を region-aware に書き換え:
  - 関東 → 既存 default
  - 関西 → 「ホテル比率高め / 料理重視」default、神戸エリア指定なら異人館系の
    1 件を入れる
  - 中部 / 九州 / 北海道 → 各地域代表会場を hand-curated
- saved search の filter UI を region/prefecture/city の 3 段選択に
- venue card の area 表示を「東京都渋谷区 (表参道)」のような階層 label に

### Stage 4 — AI 推薦の region knowledge 強化 (~5 day)

- `ONBOARDING_RECOMMENDATION_PROMPT` の Section A (Decision-driver inference)
  を **region 別の cultural pattern** で拡張:
  - 関東 → デザイン感性 + アクセス重視
  - 関西 → 料理 + ホテル格式 + 親族中心
  - 中部 → 料理 + アクセス
  - 九州 → 料理 + 地域コミュニティ
  - 北海道 → 季節 (winter wedding 比率) + 料理
- Section D (Diversity) を「同 region 内で散らす」ルールに更新
- prompt version bump (例: 3 → 4)、cache eviction を許容

### Stage 5 — 旧 area string 廃止 (~1 day)

- 既存 `Venue.area` field を削除する migration
- 全 callsite を grep して `region/prefecture/city` 経由に置換完了確認
- onboarding `Project.conditions.area: string[]` を `regions: Region[]` +
  `prefectures: Prefecture[]` に変換 + migration

### 非ゴール

- 海外展開 (米国 / アジア) — 別軸 (i18n design doc 参照)
- 47 都道府県すべての venue データ拡充 — Stage 1-3 で骨格、データ蓄積は
  separate effort
- 区 / 町 単位 (例: 渋谷区松濤 1 丁目) の番地レベル絞り込み — 過剰
  細分化、city レベルで止める

---

## 3. Schema 変更詳細

### 3.1 必須 (Stage 1)

```prisma
enum Region {
  KANTO
  KANSAI
  CHUBU
  KYUSHU
  HOKKAIDO
  TOHOKU
  CHUGOKU
  SHIKOKU
  OKINAWA
  OTHER
}

enum Prefecture {
  TOKYO
  OSAKA
  KYOTO
  KANAGAWA
  HYOGO
  // ... 47 全部
  OTHER
}

model Venue {
  // 既存 fields ...
  area       String?  // @deprecated — Stage 5 で削除
  region     Region?
  prefecture Prefecture?
  city       String?  // 区 / 市 名、free text (= 表記揺れ許容)
  // index 追加
  @@index([region, prefecture])
}
```

### 3.2 Stage 5 削除

- `Venue.area` カラム削除
- `Project.conditions` schema migration (Json 内の area 配列を新形式に)

### 3.3 backward compat

Stage 1 完了時点で:
- 既存 query (`where: { area: "表参道" }`) は **動き続ける** (area カラム残置)
- 新 query (`where: { region: "KANTO" }`) も動く
- Stage 2-3 で新 query に段階 migration
- Stage 5 で旧 query 完全削除

---

## 4. 着手判断の trigger

**着手 GO の signal** (どれか 1 つ):

- /admin/feedback で関西エリア要望が **1 ヶ月で 5 件以上**
- パートナーシップ (関西 wedding planner / ゼクシィ関西版チーム等) からの
  接触
- 関東 venue データが「もうこれ以上の拡充は ROI 低い」状態に達した (= 関東
  だけで saturated)

**着手 NO の signal**:

- Beta launch 後 6 ヶ月、関東で venue 数 / couple 数が伸びない → 関東 polish に
  回帰、地域展開は時期尚早
- データ取得コスト (関西 venue の photo / cost / review データ整備) が予算外

---

## 5. リスク + 既知の限界

### 5.1 既存 area string の自動分類精度

- migration script が「表参道 → KANTO/TOKYO/渋谷区」を確実に分類できる保証
  なし (誤マッピング = 検索結果が壊れる)
- 解決: best-effort 分類 + 失敗 row を `region=OTHER` 保留 + operator 手動
  補正 batch (`/admin/venues/uncategorized` ページで一覧 + 1 click 補正)
- Stage 1 で operator 手動補正 batch UI (1 day) を含む

### 5.2 関西の wedding 文化を AI prompt に正確に反映する難しさ

- 関東出身の operator 1 人で全国 cultural pattern を prompt 化するのは限界
- 解決: Stage 4 で **関西在住の業界パートナー or wedding planner 1 名に
  プロンプト原案 review を依頼**。年 1 回の review cycle にする
- 補完: 関西 venue データが 100 件貯まった時点で実 review distribution を
  確認、prompt の prior が data と合っているか chevk

### 5.3 既存 onboarding 4 質問の region 拡張が UX 重い

- step 3 (エリア) を「都道府県」→「市町村」の 2 段に拡張するのは tap 数増
- 解決: 「都道府県のみで OK、市町村は scroll 下に optional」レイアウトで
  デフォルトの tap 数を維持

### 5.4 saved search filter の複雑度

- region + prefecture + city の 3 段選択を 1 form で操作 → UI 複雑化
- 解決: chip 形式で 3 段ともコンパクトに、region 選ぶと prefecture が auto
  filter (関東選んだら東京/神奈川/埼玉/千葉/栃木/群馬/茨城だけ表示)

---

## 6. 影響範囲評価

| 領域 | Stage 1 | Stage 2 | Stage 3 | Stage 4 | Stage 5 |
|---|---|---|---|---|---|
| `prisma/schema.prisma` | 大 (enum 2 つ + 3 column) | 影響無 | 影響無 | 影響無 | 大 (column 削除) |
| `src/server/actions/venues.ts` | 中 | 大 (filter 拡張) | 影響無 | 影響無 | 大 |
| `src/server/actions/saved-searches.ts` | 影響無 | 中 | 中 (UI form schema) | 影響無 | 中 |
| `src/components/onboarding/` | 影響無 | 影響無 | 大 (step 3 改修) | 影響無 | 中 |
| `src/components/explore/` | 影響無 | 影響無 | 中 (filter chip 拡張) | 影響無 | 中 |
| `src/lib/prompts/onboarding.ts` | 影響無 | 影響無 | 中 | 大 + version bump | 影響無 |
| `tests/` | unit + e2e 追加 | 同 | 同 | prompt version test 更新 | 旧 area test 削除 |

---

## 7. 関連ドキュメント

- `prisma/schema.prisma` — Venue / Project model
- `src/lib/prompts/onboarding.ts` — Section A/C で region 認識
- `docs/phase5/multilingual-design.md` — Phase 5 別軸 (i18n)
- `docs/release/launch-day-checklist.md` — Phase 4 launch 完成
- `docs/phase3/COMPLETION.md` — Phase 3 完成宣言

---

## 8. 履歴

- 2026-05-03 (paneA、Phase 5 入口準備): 初版設計、5 stage 分割 + 着手 trigger
  + region/prefecture enum + AI prompt cultural pattern 拡張案
