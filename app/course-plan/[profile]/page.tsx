import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CoursePlanViewer } from "@/components/CoursePlanViewer";
import { COURSE_PLAN_PROFILES, getCoursePlanProfile } from "@/lib/course-plan-profiles";
import "../course-plan.css";

type Props = { params: Promise<{ profile: string }> };

export const dynamicParams = false;

export function generateStaticParams() {
  return Object.keys(COURSE_PLAN_PROFILES).map((profile) => ({ profile }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const profile = getCoursePlanProfile((await params).profile);
  if (!profile) notFound();
  return { title: `${profile.name} | 英才计划专项培养方案`, description: `${profile.name}课程大纲、${profile.goals.title}与上课安排` };
}

export default async function CourseProfilePage({ params }: Props) {
  const profile = getCoursePlanProfile((await params).profile);
  if (!profile) notFound();
  return <CoursePlanViewer variant="hybrid" profile={profile} />;
}
