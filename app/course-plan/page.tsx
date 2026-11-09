import { CoursePlanViewer } from "@/components/CoursePlanViewer";
import type { Metadata } from "next";
import "./course-plan.css";

export const metadata: Metadata = {
  title: "编程学习方案",
  description: "孩子专属编程学习方案"
};

export default function CoursePlanPage() {
  return <CoursePlanViewer />;
}
