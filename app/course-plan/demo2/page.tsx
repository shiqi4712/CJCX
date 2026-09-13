import { CoursePlanViewer } from "@/components/CoursePlanViewer";
import type { Metadata } from "next";
import "../course-plan.css";

export const metadata: Metadata = {
  title: "编程学习方案 Demo 2",
  description: "红金封面与原版内容整合的编程学习方案"
};

export default function CoursePlanDemo2Page() {
  return <CoursePlanViewer variant="hybrid" />;
}
