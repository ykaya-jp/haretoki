import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "新規登録",
  description: "無料で3分。AIがおふたりに合う式場をご提案します。",
};

export default function SignupLayout({ children }: { children: React.ReactNode }) {
  return children;
}
