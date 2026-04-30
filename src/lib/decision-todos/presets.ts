/**
 * F3: 決定後に発生する実務タスクの system preset（15 件）。
 *
 * 選定根拠: ゼクシィ・みんなのウェディング等の公開チェックリストを参照しつつ、
 * 「契約・支払い」「式の中身」「前後の周辺」でバランスを取って 15 件に絞り込み。
 * 20 件超は "開いただけで疲れる" ため不採用（docs/designs/f3-post-decision-todo.md §2.5）。
 *
 * 冪等性: templateKey は全 preset で一意。seedDecisionTodos は
 * createMany({ skipDuplicates: true }) + @@unique([projectId, templateKey]) で
 * 多端末競合でも二重 seed しない。新規 preset を足すときは templateKey の
 * 衝突がないことと orderIndex の連続性を必ず確認する。
 */

export type TodoPriority = "high" | "normal" | "low";

export interface DecisionTodoPreset {
  /** DB 固定 key。UI 文言が変わっても seed 冪等性を保つため不変。 */
  templateKey: string;
  /** 表示タイトル（丁寧体、動詞で始める）。 */
  title: string;
  /** 補足文（1-2 行、句点なし、60 字以内目安）。 */
  description: string;
  priority: TodoPriority;
  /** 決定日からの目安日数。null は「いつでも OK」を表現（現状未使用、将来拡張用）。 */
  dueOffsetDays: number | null;
  /** 表示順（0 始まり、連続）。high → normal → low の順に並べるのが基本。 */
  orderIndex: number;
}

export const DECISION_TODO_PRESETS: readonly DecisionTodoPreset[] = [
  {
    templateKey: "contract_review",
    title: "契約書を読み合わせる",
    description:
      "キャンセル規定・延期ポリシー・支払スケジュールを、ふたりで一度通し読み",
    priority: "high",
    dueOffsetDays: 7,
    orderIndex: 0,
  },
  {
    templateKey: "deposit_payment",
    title: "内金（申込金）を振り込む",
    description: "式場から届いた振込案内にしたがって手配",
    priority: "high",
    dueOffsetDays: 14,
    orderIndex: 1,
  },
  {
    templateKey: "wedding_date_fix",
    title: "日取りを確定する",
    description:
      "仮予約から本予約へ。天候季節・親族の都合・記念日を最終チェック",
    priority: "high",
    dueOffsetDays: 14,
    orderIndex: 2,
  },
  {
    templateKey: "guest_list_draft",
    title: "ゲストリストを書き出す",
    description: "新郎側・新婦側それぞれ、ざっくり人数だけでも OK",
    priority: "high",
    dueOffsetDays: 30,
    orderIndex: 3,
  },
  {
    templateKey: "budget_reconcile",
    title: "総予算を再点検する",
    description: "見積もりと入金計画を並べて、余白があるか確認",
    priority: "high",
    dueOffsetDays: 30,
    orderIndex: 4,
  },
  {
    templateKey: "invitation_design",
    title: "招待状のデザインを決める",
    description: "式場提携 or 外注 or 手作り。サンプルをふたりで見比べ",
    priority: "normal",
    dueOffsetDays: 60,
    orderIndex: 5,
  },
  {
    templateKey: "dress_fitting",
    title: "衣装合わせを予約する",
    description: "試着 3-4 着が目安。早めの枠を押さえると選択肢が広がる",
    priority: "normal",
    dueOffsetDays: 45,
    orderIndex: 6,
  },
  {
    templateKey: "hair_makeup_trial",
    title: "ヘアメイクの打ち合わせを入れる",
    description: "好みのイメージ写真を集めてから相談すると話が早い",
    priority: "normal",
    dueOffsetDays: 60,
    orderIndex: 7,
  },
  {
    templateKey: "ring_preparation",
    title: "結婚指輪を用意する",
    description:
      "サイズ直し・刻印・納品までに 1-2 ヶ月かかることが多い",
    priority: "normal",
    dueOffsetDays: 60,
    orderIndex: 8,
  },
  {
    templateKey: "seating_chart_draft",
    title: "席次表のたたきを作る",
    description:
      "ゲストリストが固まってから。親族間のバランス確認が肝心",
    priority: "normal",
    dueOffsetDays: 90,
    orderIndex: 9,
  },
  {
    templateKey: "gift_return",
    title: "引出物・引菓子を選ぶ",
    description: "2-3 品構成が一般的。地域性とゲスト層を意識",
    priority: "normal",
    dueOffsetDays: 90,
    orderIndex: 10,
  },
  {
    templateKey: "ceremony_program",
    title: "当日の進行・演出を相談する",
    description:
      "入場・乾杯・余興・手紙。プランナーさんと役割分担",
    priority: "normal",
    dueOffsetDays: 90,
    orderIndex: 11,
  },
  {
    templateKey: "prewedding_photo",
    title: "前撮りを計画する",
    description:
      "季節ロケーションで印象が変わる。数ヶ月前に撮影枠を押さえる",
    priority: "low",
    dueOffsetDays: 90,
    orderIndex: 12,
  },
  {
    templateKey: "wedding_movie",
    title: "ムービー演出を決める",
    description:
      "オープニング / プロフィール / エンドロール。自作 or 外注 or なし",
    priority: "low",
    dueOffsetDays: 120,
    orderIndex: 13,
  },
  {
    templateKey: "honeymoon_plan",
    title: "新婚旅行の大枠を決める",
    description:
      "式後すぐ or 数ヶ月後。式場予約と連動するフライトの押さえ忘れ注意",
    priority: "low",
    dueOffsetDays: 150,
    orderIndex: 14,
  },
] as const;

export const DECISION_TODO_PRESET_COUNT = DECISION_TODO_PRESETS.length;

/** UI 用のカスタム todo 上限（design §4.4 edge cases）。 */
export const CUSTOM_TODO_LIMIT = 10;
