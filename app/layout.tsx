import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "科特班·英才计划录取结果查询",
  description: "家长录取结果查询与老师管理后台"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
