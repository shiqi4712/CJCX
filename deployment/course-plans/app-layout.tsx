import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "编程猫专项培养方案",
  description: "编程猫英才计划：课程大纲、学习目标与上课安排"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="zh-CN"><body>{children}</body></html>;
}
