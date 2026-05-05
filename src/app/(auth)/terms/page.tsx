import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "利用規約",
  description: "Haretoki の利用条件、免責事項、AI 応答の扱いについて記載します。",
};

export default function TermsPage() {
  return (
    <article className="mx-auto max-w-2xl px-6 py-16">
      <Link
        href="/"
        className="text-[11px] uppercase tracking-[0.2em] text-[var(--gold-warm)]"
      >
        ← Haretoki
      </Link>
      <h1 className="mt-4 font-[family-name:var(--font-display)] text-[28px] font-light tracking-[0.01em]">
        利用規約
      </h1>
      <p className="mt-1 text-[12px] text-muted-foreground">
        最終更新: 2026 年 5 月 3 日
      </p>

      <div className="prose prose-sm mt-8 max-w-none text-[14px] leading-[1.9] text-foreground dark:prose-invert">
        <p>
          Haretoki（以下「本サービス」）をご利用いただくにあたり、以下の条件に同意いただいたものとみなします。
        </p>

        <h2 className="mt-8 font-[family-name:var(--font-display)] text-[18px] font-normal">
          1. 本サービスの位置づけ
        </h2>
        <p>
          本サービスは、おふたりの結婚式場さがしを <strong>中立の立場で支援する</strong>
          ツールです。特定の式場の予約・斡旋・広告掲載は行いません。
          本サービスが表示する情報は判断材料であり、最終的な契約・決定は
          おふたりの責任において行ってください。
        </p>

        <h2 className="mt-8 font-[family-name:var(--font-display)] text-[18px] font-normal">
          2. AI 応答の扱い
        </h2>
        <p>
          本サービスは、AI コーチ、AI 分析、AI 要約などの機能を提供します。
          AI の応答は参考情報であり、<strong>正確性や最新性を保証するものではありません</strong>。
          重要な判断にあたっては、ご自身で式場・専門家に確認してください。
        </p>

        <h2 className="mt-8 font-[family-name:var(--font-display)] text-[18px] font-normal">
          3. おふたりの記録について
        </h2>
        <p>
          式場名、見学メモ、写真、評価、見積もり、AI コーチとの会話など、
          おふたりが本サービスに登録した内容の <strong>権利はおふたりにあります</strong>。
          本サービスは、これらをサービス提供（パートナーへの共有、AI 機能の処理、
          表示）の目的でのみ利用し、それ以外の用途には使いません。
        </p>
        <p>
          いつでも <Link href="/settings" className="text-[var(--gold-warm)] underline">設定</Link>
          {" "}から、登録したすべての記録を JSON 形式でダウンロードできます。
          また、アカウントを削除すれば、おふたりの記録は完全に消去されます
          （詳細は本規約 6 を参照）。
        </p>

        <h2 className="mt-8 font-[family-name:var(--font-display)] text-[18px] font-normal">
          4. 禁止事項
        </h2>
        <ul className="ml-4 list-disc space-y-1">
          <li>他のユーザー、式場、運営者への誹謗中傷、名誉毀損</li>
          <li>本サービスのセキュリティを侵害する行為、不正アクセス、スクレイピング</li>
          <li>著作権、肖像権、その他の権利を侵害する投稿</li>
          <li>法令、公序良俗に反する行為</li>
        </ul>

        <h2 className="mt-8 font-[family-name:var(--font-display)] text-[18px] font-normal">
          5. 利用料金
        </h2>
        <p>
          現在、本サービスは無料でお使いいただけます。クレジットカード等の登録は不要です。
          将来、有料プランをご用意する場合は、ログイン後の画面で事前にお知らせし、
          ご同意いただいた方のみが対象となります。既存の無料機能は引き続き無料でお使いいただける形を検討しています。
        </p>

        <h2 className="mt-8 font-[family-name:var(--font-display)] text-[18px] font-normal">
          6. 免責事項
        </h2>
        <p>
          本サービスの利用により生じた損害について、運営者は故意または重大な過失がある場合を除き、
          一切の責任を負いません。外部サイト（式場公式、口コミサイト等）の内容については、
          当該サイトの責任となります。
        </p>

        <h2 className="mt-8 font-[family-name:var(--font-display)] text-[18px] font-normal">
          7. 退会とアカウントの削除
        </h2>
        <p>
          いつでも、ご自身の判断で本サービスを退会できます。
          {" "}<Link href="/settings" className="text-[var(--gold-warm)] underline">設定</Link>
          {" "}から「アカウントを消す」を選び、登録メールアドレスを入力してください。
          おふたりが追加した式場・見学記録・評価・候補・決めた場所など、
          プロジェクトに紐づくすべての記録が完全に削除されます。
          削除後の復元はできません。退会前にダウンロードしておきたい場合は、
          同じ画面の「記録をダウンロード」をご利用ください。
        </p>
        <p>
          運営者は、本規約に重大な違反があった場合、事前のご連絡なくアカウントを停止・削除することがあります。
        </p>
        <p>
          おふたりが本サービスを通じて目にされた式場の口コミ・写真・パートナーから共有された情報の中で、
          不適切と感じられる内容や、他者の権利を侵害している恐れのある投稿をご覧になった場合は、
          <Link href="/support" className="text-[var(--gold-warm)] underline">サポート窓口</Link>
          にご連絡ください。運営者が確認のうえ、速やかに対応いたします。
        </p>

        <h2 className="mt-8 font-[family-name:var(--font-display)] text-[18px] font-normal">
          8. 規約の変更
        </h2>
        <p>
          本規約は、サービスの改善や法令改正に応じて変更されることがあります。
          重要な変更は、ログイン後の画面でお知らせします。
          変更後にサービスを継続利用された場合、変更内容に同意したものとみなします。
        </p>

        <h2 className="mt-8 font-[family-name:var(--font-display)] text-[18px] font-normal">
          9. 未成年の方の利用
        </h2>
        <p>
          結婚式場さがしというサービスの性質上、本サービスは原則として満 18 歳以上の方を対象としています。
          18 歳未満の方が本サービスを利用される場合は、保護者の同意のもとでご利用ください。
        </p>

        <h2 className="mt-8 font-[family-name:var(--font-display)] text-[18px] font-normal">
          10. サービスの停止・終了
        </h2>
        <p>
          運営者は、システムメンテナンス、障害対応、その他やむを得ない事情により、
          本サービスの提供を一時停止または終了する場合があります。終了の場合は、
          可能な限り事前にお知らせし、おふたりの記録をダウンロードできる期間を設けます。
        </p>

        <h2 className="mt-8 font-[family-name:var(--font-display)] text-[18px] font-normal">
          11. 準拠法・管轄
        </h2>
        <p>本規約は日本法に準拠し、東京地方裁判所を第一審の専属的合意管轄裁判所とします。</p>

        <h2 className="mt-8 font-[family-name:var(--font-display)] text-[18px] font-normal">
          12. 運営者・お問い合わせ
        </h2>
        <p>
          本サービスの運営者については、launch 前に正式な事業者表記を本セクションに掲載します。
          現時点でのお問い合わせは{" "}
          <Link href="/support" className="text-[var(--gold-warm)] underline">
            サポート窓口
          </Link>
          {" "}からお寄せください。プライバシーに関するお問い合わせは{" "}
          <Link href="/privacy" className="text-[var(--gold-warm)] underline">
            プライバシーポリシー
          </Link>
          {" "}の「個人情報取扱事業者」セクションも併せてご確認ください。
        </p>
      </div>
    </article>
  );
}
