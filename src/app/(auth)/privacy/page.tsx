import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "プライバシーポリシー",
  description:
    "Haretoki の個人情報の取り扱い、Cookie、AI への入力の扱いについて記載します。",
};

/**
 * Minimum viable privacy policy covering:
 *  - 取得情報 (Supabase Auth email, display name, browser session)
 *  - 利用目的
 *  - Claude / PostHog / Sentry / Vercel Analytics など外部共有
 *  - 削除要求の窓口
 *  - Cookie / localStorage
 *
 * Written to be read by end-users, not lawyers. Will be replaced by a
 * reviewed version once legal process is in place.
 */
export default function PrivacyPage() {
  return (
    <article className="mx-auto max-w-2xl px-6 py-16">
      <Link
        href="/"
        className="text-[11px] uppercase tracking-[0.2em] text-[var(--gold-warm)]"
      >
        ← Haretoki
      </Link>
      <h1 className="mt-4 font-[family-name:var(--font-display)] text-[28px] font-light tracking-[0.01em]">
        プライバシーポリシー
      </h1>
      <p className="mt-1 text-[12px] text-muted-foreground">
        最終更新: 2026 年 5 月 3 日
      </p>

      <div className="prose prose-sm mt-8 max-w-none text-[14px] leading-[1.9] text-foreground dark:prose-invert">
        <p>
          Haretoki（以下「本サービス」）は、おふたりの結婚式場さがしをお手伝いするため、
          以下の通り個人情報を取り扱います。
        </p>

        <h2 className="mt-8 font-[family-name:var(--font-display)] text-[18px] font-normal">
          1. 取得する情報
        </h2>
        <ul className="ml-4 list-disc space-y-1">
          <li>アカウント情報（メールアドレス、お名前、パートナーの紐付け情報）</li>
          <li>本サービスで入力した式場情報、見学メモ、評価、見積もり、写真、音声、チャット内容</li>
          <li>Cookie / localStorage（ログイン状態、テーマ、UI 設定の保存）</li>
          <li>サービス改善のための匿名アクセスログ（PostHog、Vercel Analytics）</li>
          <li>エラー監視のためのクラッシュレポート（Sentry）</li>
        </ul>

        <h2 className="mt-8 font-[family-name:var(--font-display)] text-[18px] font-normal">
          2. 利用目的
        </h2>
        <ul className="ml-4 list-disc space-y-1">
          <li>本サービスの提供、個別化、パートナーとの共有</li>
          <li>AI コーチ、見積もり分析、口コミ要約などの AI 機能の提供</li>
          <li>サービスの品質向上、不具合調査</li>
          <li>重要なお知らせのメール送信（今後対応予定）</li>
        </ul>

        <h2 className="mt-8 font-[family-name:var(--font-display)] text-[18px] font-normal">
          3. パートナー以外には見えません（プロジェクト分離）
        </h2>
        <p>
          おふたりが追加した式場・見学メモ・評価・写真などは、
          おふたりのプロジェクト内でのみ参照できます。
          他のカップル、運営者の閲覧用画面、検索エンジンに表示されることはありません。
        </p>
        <p>
          技術的には Supabase の Row Level Security と、
          サーバーサイドでのプロジェクトメンバーシップ確認の二段構えで、
          別のプロジェクトの情報が見える経路を物理的に遮断しています。
          バックアップ・障害対応のために、運営者がデータベースに直接アクセスする場合がありますが、
          ご本人の同意なく内容を閲覧することはありません。
        </p>

        <h2 className="mt-8 font-[family-name:var(--font-display)] text-[18px] font-normal">
          4. 外部への提供
        </h2>
        <p>
          AI 機能（コーチ会話、見積もり分析、口コミ要約など）の提供にあたり、
          ユーザーが入力した内容の一部が Anthropic 社（Claude）に送信されます。
          送信前に、メールアドレス・電話番号・住所などの個人を特定しうる文字列は
          サーバー側で除去します。また、ユーザー入力の文字列は AI への指示と区別される
          専用のタグ（<code>&lt;user_data&gt;</code>）で囲み、
          指示として解釈されないよう保護した上で送信します。
          詳細な技術仕様は{" "}
          <a
            href="https://github.com/ykaya-jp/haretoki/blob/main/docs/ai/guardrails.md"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[var(--gold-warm)] underline"
          >
            docs/ai/guardrails.md
          </a>
          {" "}に公開しています。
        </p>
        <p>
          その他の外部サービス（Supabase、Vercel、Sentry、PostHog、Resend）には、
          サービス提供に必要な最小限の範囲でのみ情報を渡します。
          これらのサービスは日本国外のサーバーで処理される場合があります。
        </p>
        <p>
          式場様や広告主には、おふたりの個人情報を一切提供しません。
          Haretoki は <strong>中立の立場</strong> で運営します。
        </p>

        <h2 className="mt-8 font-[family-name:var(--font-display)] text-[18px] font-normal">
          5. ダウンロードと削除
        </h2>
        <p>
          おふたりが保存した記録は、いつでも JSON 形式でダウンロードできます。
          {" "}<Link href="/settings" className="text-[var(--gold-warm)] underline">設定</Link>
          {" "}から「記録をダウンロード」を選んでください。
          式場・見学メモ・評価・候補・決めた場所・AI コーチとの会話のすべてが含まれます。
        </p>
        <p>
          アカウントの削除も同じ画面からできます。
          「アカウントを消す」を選び、登録メールアドレスを入力してください。
          関連するプロジェクトの記録、認証情報、お問い合わせ履歴を含むすべての情報が削除されます。
          削除後は復元できません。
        </p>

        <h2 className="mt-8 font-[family-name:var(--font-display)] text-[18px] font-normal">
          6. Cookie と localStorage
        </h2>
        <p>
          本サービスは、ログイン状態の維持、テーマ設定の記憶、AI 分析キャッシュの
          管理に Cookie と localStorage を使用します。広告目的の Cookie は使いません。
        </p>

        <h2 className="mt-8 font-[family-name:var(--font-display)] text-[18px] font-normal">
          7. 海外への移転
        </h2>
        <p>
          本サービスが利用する一部の事業者のサーバーは日本国外に所在しています。
          おふたりの情報は、サービス提供に必要な範囲で日本国外（米国・EU 等）の
          サーバーで処理される場合があります。具体的な事業者と所在地は次のとおりです。
        </p>
        <ul className="ml-4 list-disc space-y-1">
          <li>
            <strong>Supabase</strong>（米国）— アカウント認証、データベース、
            ファイルストレージ、リアルタイム同期。本サービスのデータ本体が保存される
            主要事業者。
          </li>
          <li>
            <strong>Vercel</strong>（米国）— 本サービスのホスティング、
            アクセスログ、パフォーマンス計測。
          </li>
          <li>
            <strong>Anthropic</strong>（米国）— AI 機能（コーチ会話、見積もり分析、
            口コミ要約）の処理。送信前に個人を特定しうる文字列はサーバー側で除去します。
          </li>
          <li>
            <strong>Resend</strong>（米国）— メール配信（パートナー招待、
            お問い合わせ自動応答）。
          </li>
          <li>
            <strong>PostHog</strong>（EU）— 匿名アクセスログによるサービス改善分析。
          </li>
          <li>
            <strong>Sentry</strong>（米国）— クラッシュレポート（不具合の記録）。
          </li>
        </ul>
        <p>
          いずれも、各社のプライバシーポリシーおよび GDPR / 個人情報保護法相当の枠組みに
          基づいて運用されています。
        </p>

        <h2 className="mt-8 font-[family-name:var(--font-display)] text-[18px] font-normal">
          8. 未成年の方の情報の取扱い
        </h2>
        <p>
          本サービスは原則として満 18 歳以上の方を対象としています。18 歳未満の方が
          ご利用される場合は、保護者の同意のもとでご利用ください。18 歳未満であることが
          判明した場合、保護者の方からのご請求により、おふたりの情報を速やかに削除します。
        </p>

        <h2 className="mt-8 font-[family-name:var(--font-display)] text-[18px] font-normal">
          9. 個人情報取扱事業者
        </h2>
        <p>
          本サービスの運営者および個人情報取扱事業者の正式表記は、launch 前に本セクションに
          掲載します。それまでの間、個人情報の開示・訂正・利用停止・削除のご請求は{" "}
          <Link href="/support" className="text-[var(--gold-warm)] underline">
            サポート窓口
          </Link>
          {" "}でお受けします。ご本人確認のため、ご請求時に登録メールアドレスからの
          ご連絡をお願いいたします。
        </p>

        <h2 className="mt-8 font-[family-name:var(--font-display)] text-[18px] font-normal">
          10. お問い合わせ
        </h2>
        <p>
          プライバシーや個人情報に関するお問い合わせは、{" "}
          <Link href="/support" className="text-[var(--gold-warm)] underline">
            サポート窓口
          </Link>
          {" "}からお寄せください。通常 3 営業日以内にお返事します。
          よくあるご質問は{" "}
          <Link href="/help" className="text-[var(--gold-warm)] underline">
            ヘルプセンター
          </Link>
          {" "}にもまとめています。
        </p>

        <p className="mt-12 text-[12px] text-muted-foreground">
          本ポリシーは改善のため予告なく変更されることがあります。
          重要な変更時にはログイン後の画面でお知らせします。
        </p>
      </div>
    </article>
  );
}
