import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "ログイン",
  description: "Haretokiにログインして、式場選びの続きをはじめましょう。",
};

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return children;
}
