"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  Check,
  CheckCircle2,
  Clock3,
  Compass,
  GraduationCap,
  HeartHandshake,
  LogOut,
  Rocket,
  ShieldCheck,
  X,
  ZoomIn
} from "lucide-react";
import {
  getCoursePlanLine,
  normalizeCoursePlanLine,
  type CoursePlanPayload
} from "@/lib/course-plan-config";

const AVAILABLE_CLASS_DAYS = ["星期一", "星期四", "星期五", "星期六", "星期日"];
const AVAILABLE_CLASS_TIMES = ["14:00–15:00", "15:00–16:00", "16:00–17:00", "17:00–18:00", "18:00–19:00", "19:00–20:00", "20:00–21:00"];
type ViewId = "roadmap" | "consensus" | "seat";
const VIEWS: Array<{ id: ViewId; label: string; icon: typeof Compass }> = [
  { id: "roadmap", label: "规划", icon: Compass },
  { id: "consensus", label: "共识", icon: HeartHandshake },
  { id: "seat", label: "学位", icon: GraduationCap }
];
const VIEW_INDEX = Object.fromEntries(VIEWS.map((item, index) => [item.id, index])) as Record<ViewId, number>;

function ExpandableImage({
  src,
  alt,
  imageClassName,
  triggerClassName
}: {
  src: string;
  alt: string;
  imageClassName: string;
  triggerClassName: string;
}) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  return (
    <>
      <button className={`image-zoom-trigger ${triggerClassName}`} type="button" onClick={() => setOpen(true)} aria-label={`查看大图：${alt}`}>
        <img className={imageClassName} src={src} alt={alt} />
        <span className="image-zoom-trigger__icon" aria-hidden="true"><ZoomIn size={17} /></span>
      </button>
      {open ? createPortal(
        <div className="image-lightbox" role="dialog" aria-modal="true" aria-label={alt} onClick={(event) => { if (event.currentTarget === event.target) setOpen(false); }}>
          <div className="image-lightbox__toolbar">
            <strong>{alt}</strong>
            <button type="button" onClick={() => setOpen(false)} aria-label="关闭大图" title="关闭大图"><X size={22} /></button>
          </div>
          <img className="image-lightbox__image" src={src} alt={alt} />
        </div>,
        document.body
      ) : null}
    </>
  );
}

function decodePayload(encoded: string): CoursePlanPayload {
  const normalized = encoded.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
  const binary = window.atob(padded);
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  const payload = JSON.parse(new TextDecoder().decode(bytes)) as CoursePlanPayload;
  return { ...payload, courseLine: normalizeCoursePlanLine(payload.courseLine) };
}

function readPayloadFromLocation() {
  const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  const encoded = hashParams.get("p");
  if (encoded) {
    try {
      return decodePayload(encoded);
    } catch {
      // Query parameters remain a fallback for older preview links.
    }
  }
  const params = new URLSearchParams(window.location.search);
  return {
    studentId: params.get("studentId")?.trim() || undefined,
    student: params.get("student")?.trim() || "学生",
    score: params.get("score")?.trim() || undefined,
    courseLine: "moon" as const,
    targetClass: params.get("className")?.trim() || undefined,
    preferredCourseTime: params.get("preferredCourseTime")?.trim() || null
  };
}

function splitStoredCourseTime(value?: string | null) {
  const [storedDay, storedTime] = (value ?? "").split(" ");
  const day = storedDay?.startsWith("周") ? storedDay.replace(/^周/, "星期") : storedDay;
  const time = storedTime?.replace(/-/g, "–");
  return {
    day: AVAILABLE_CLASS_DAYS.includes(day) ? day : "星期五",
    time: AVAILABLE_CLASS_TIMES.includes(time) ? time : "19:00–20:00"
  };
}

function toStoredCourseTime(day: string, time: string) {
  return `${day.replace(/^星期/, "周")} ${time.replace(/–/g, "-")}`;
}

function AppHeader({ view, student, onNavigate, onLogout }: { view: ViewId; student: string; onNavigate: (view: ViewId) => void; onLogout: () => void }) {
  const activeIndex = VIEW_INDEX[view];
  return (
    <header className={`sticky-header ${view === "seat" ? "sticky-header--seat" : ""}`}>
      <div className="header-row">
        <div className="student-lockup"><div className="student-avatar">{student.slice(-1)}</div><div><p>{student}家长</p></div></div>
        <button className="icon-button" type="button" onClick={onLogout} aria-label="退出报告" title="退出报告"><LogOut size={18} /></button>
      </div>
      <nav className="step-nav" aria-label="报告章节">
        {VIEWS.map((item, index) => {
          const Icon = item.icon;
          const isActive = view === item.id;
          return <button key={item.id} type="button" className={isActive ? "is-active" : index < activeIndex ? "is-complete" : ""} onClick={() => onNavigate(item.id)} aria-current={isActive ? "page" : undefined}><span className="step-nav__icon">{index < activeIndex ? <Check size={14} /> : <Icon size={15} />}</span><span>{item.label}</span></button>;
        })}
      </nav>
    </header>
  );
}

function BottomAction({ label, icon: Icon, onClick, secondaryAction }: { label: string; icon: typeof ArrowRight; onClick: () => void; secondaryAction?: () => void }) {
  return <div className="bottom-action">{secondaryAction ? <button className="back-button" type="button" onClick={secondaryAction} aria-label="返回上一步" title="返回上一步"><ArrowLeft size={19} /></button> : null}<button className="primary-button" type="button" onClick={onClick}><Icon size={18} /><span>{label}</span></button></div>;
}

function RoadmapView({ payload, onBack, onNext }: { payload: CoursePlanPayload; onBack: () => void; onNext: () => void }) {
  const courseLine = getCoursePlanLine(payload.courseLine);
  return (
    <section className="page roadmap-page page--with-action">
      <div className="page-heading page-heading--stacked"><p className="eyebrow">个性化成长路径</p><h1>专属6个月学习目标</h1><p>学习目标、学科知识与赛事目标同步规划。</p></div>
      <ExpandableImage triggerClassName="competition-plan-image-trigger" imageClassName="competition-plan-image" src={courseLine.goalImage} alt={`${courseLine.name}课线学习目标`} />
      <section className="monthly-plan-section">
        <div className="monthly-plan-section__heading"><div><p>6 MONTH PLAN</p><h2>六个月学习规划</h2></div><span>共 6 个月</span></div>
        <ExpandableImage triggerClassName="plan-detail-image-trigger" imageClassName={`plan-detail-image plan-detail-image--${courseLine.id}`} src={courseLine.planDetailImage} alt={`${courseLine.name}课线六个月学习规划明细`} />
      </section>
      <BottomAction label="查看上课模式" icon={ArrowRight} onClick={onNext} secondaryAction={onBack} />
    </section>
  );
}

function ConsensusView({ onNext }: { onNext: () => void }) {
  const [reasonIndex, setReasonIndex] = useState(0);
  const transitionLocked = useRef(false);
  const touchStartY = useRef<number | null>(null);
  const reasons = [
    { category: "专业陪伴", title: "孩子遇到问题，有老师及时帮助", imageSrc: "/images/course-plan/reason-professional-support.jpg" },
    { category: "学情反馈", title: "课后清晰看见孩子的学习与成长", imageSrc: "/images/course-plan/reason-learning-feedback.jpg" },
    { category: "个性定制", title: "1V1 学情规划，让成长更有方向", imageSrc: "/images/course-plan/reason-learning-plan.jpg" },
    { category: "赛事辅导", title: "北大认证名师，助力赛事辅导", imageSrc: "/images/course-plan/reason-competition-coaching.jpg" }
  ];
  const currentReason = reasons[reasonIndex];

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "auto" });
  }, [reasonIndex]);

  useEffect(() => {
    const isAtBottom = () => window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 4;
    const showNextReason = () => {
      if (reasonIndex >= reasons.length - 1 || transitionLocked.current || !isAtBottom()) return;
      transitionLocked.current = true;
      setReasonIndex((current) => Math.min(current + 1, reasons.length - 1));
      window.setTimeout(() => { transitionLocked.current = false; }, 450);
    };
    const showPreviousReason = () => {
      if (reasonIndex === 0 || transitionLocked.current || window.scrollY > 4) return;
      transitionLocked.current = true;
      setReasonIndex((current) => Math.max(current - 1, 0));
      window.setTimeout(() => { transitionLocked.current = false; }, 450);
    };
    const handleWheel = (event: WheelEvent) => {
      if (event.deltaY > 24) showNextReason();
      if (event.deltaY < -24) showPreviousReason();
    };
    const handleTouchStart = (event: TouchEvent) => {
      touchStartY.current = event.touches[0]?.clientY ?? null;
    };
    const handleTouchEnd = (event: TouchEvent) => {
      const endY = event.changedTouches[0]?.clientY;
      if (touchStartY.current !== null && endY !== undefined) {
        if (touchStartY.current - endY > 44) showNextReason();
        if (endY - touchStartY.current > 44) showPreviousReason();
      }
      touchStartY.current = null;
    };
    window.addEventListener("wheel", handleWheel, { passive: true });
    window.addEventListener("touchstart", handleTouchStart, { passive: true });
    window.addEventListener("touchend", handleTouchEnd, { passive: true });
    return () => {
      window.removeEventListener("wheel", handleWheel);
      window.removeEventListener("touchstart", handleTouchStart);
      window.removeEventListener("touchend", handleTouchEnd);
    };
  }, [reasonIndex, reasons.length]);

  return (
    <section className="page page--paper letter-page">
      <article className="family-letter">
        {reasonIndex === 0 ? (
          <><header className="letter-letterhead"><div className="letter-seal"><HeartHandshake size={24} /></div><div><p>成长支持 · INVITATION</p><h1>感谢您<br />信任编程猫的课程</h1></div><img className="letter-mascot" src="/images/course-plan/codemao-trophy-mascot.png" alt="编程猫手持奖杯与奖牌" /></header><div className="letter-rule"><span /></div><p className="letter-lead">不只是教孩子学编程，更为孩子提供持续、专业、个性化的成长支持。</p></>
        ) : null}
        <div className="consensus-page-status" aria-live="polite">
          <span>0{reasonIndex + 1} / 04</span>
          <strong>{currentReason.category}</strong>
        </div>
        <div className="consensus-page" key={currentReason.category}>
          <img className="reason-illustration" src={currentReason.imageSrc} alt={`${currentReason.category}：${currentReason.title}`} />
        </div>
      </article>
      {reasonIndex === reasons.length - 1 ? <button className="consensus-seat-cta" type="button" onClick={onNext}><ShieldCheck size={18} /> 查看上课时间</button> : null}
    </section>
  );
}

function SeatView({ payload, onBack, onReturnToQuery, onSaved }: { payload: CoursePlanPayload; onBack: () => void; onReturnToQuery: () => void; onSaved: (courseTime: string) => void }) {
  const courseLine = getCoursePlanLine(payload.courseLine);
  const initial = splitStoredCourseTime(payload.preferredCourseTime);
  const [selectedDay, setSelectedDay] = useState(initial.day);
  const [selectedTime, setSelectedTime] = useState(initial.time);
  const [reserved, setReserved] = useState(Boolean(payload.preferredCourseTime));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const particles = useMemo(() => Array.from({ length: 18 }, (_, index) => ({ left: `${(index * 37) % 96}%`, top: `${12 + ((index * 47) % 65)}%`, delay: `${(index % 7) * 0.3}s`, duration: `${4 + (index % 5)}s` })), []);
  async function reserveSeat() {
    if (!payload.studentId) { setError("请从成绩查询结果进入专属学习规划"); return; }
    setSaving(true); setError("");
    const courseTime = toStoredCourseTime(selectedDay, selectedTime);
    try {
      const response = await fetch("/api/students/course-time", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ studentId: payload.studentId, courseTime }) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message ?? "学位锁定失败");
      setReserved(true); onSaved(courseTime);
    } catch (requestError) { setError(requestError instanceof Error ? requestError.message : "学位锁定失败"); } finally { setSaving(false); }
  }
  return (
    <section className="page seat-page page--with-action">
      <div className="particle-field" aria-hidden="true">{particles.map((particle, index) => <i key={index} style={{ left: particle.left, top: particle.top, animationDelay: particle.delay, animationDuration: particle.duration }} />)}</div>
      <button className="seat-back" type="button" onClick={onBack}><ArrowLeft size={17} /> 返回共识</button>
      <div className="seat-intro"><span className="seat-intro__icon"><Rocket size={22} /></span><p className="eyebrow">下一阶段 · 学习席位</p><h1>{reserved ? "已完成录取确认" : `${payload.student || "孩子"}的学习席位已预留`}</h1><p className="seat-intro__subtitle">{reserved ? `${selectedDay} ${selectedTime}` : "选择上课时间，即可完成录取确认"}</p></div>
      <ExpandableImage triggerClassName="class-schedule-image-trigger" imageClassName="class-schedule-image" src={courseLine.scheduleImage} alt={`${courseLine.name}课线上课时间安排表`} />
      <section className="course-time-picker" aria-labelledby="course-time-title">
        <div className="course-time-picker__heading"><span><CalendarDays size={18} /></span><div><p>选择课程时间</p><h2 id="course-time-title">优先选择合适的上课时间</h2></div></div>
        <div className="course-time-fields">
          <fieldset disabled={reserved || saving}>
            <legend>上课星期</legend>
            <div className="course-option-grid course-option-grid--days">{AVAILABLE_CLASS_DAYS.map((day) => <button key={day} className={selectedDay === day ? "is-selected" : ""} type="button" onClick={() => setSelectedDay(day)} aria-pressed={selectedDay === day}><span>{day}{selectedDay === day ? <Check size={13} /> : null}</span></button>)}</div>
          </fieldset>
          <fieldset disabled={reserved || saving}>
            <legend>上课时间</legend>
            <div className="course-option-grid course-option-grid--times">{AVAILABLE_CLASS_TIMES.map((time) => <button key={time} className={selectedTime === time ? "is-selected" : ""} type="button" onClick={() => setSelectedTime(time)} aria-pressed={selectedTime === time}><span>{time}{selectedTime === time ? <Check size={13} /> : null}</span>{time === "19:00–20:00" ? <small>推荐</small> : null}</button>)}</div>
          </fieldset>
        </div>
        <p className="course-time-picker__note"><Clock3 size={13} /> 已选择：{selectedDay} {selectedTime}</p>
        <div className="seat-trust-row"><span><ShieldCheck size={13} /> 当前选择不产生费用，上课时间可协调</span></div>
        {error ? <p className="course-time-picker__error" role="alert">{error}</p> : null}
      </section>
      <div className="seat-action-wrap"><button className={`reserve-button ${reserved ? "is-reserved" : ""}`} type="button" onClick={() => void reserveSeat()} disabled={reserved || saving}>{reserved ? <CheckCircle2 size={20} /> : <GraduationCap size={21} />}{reserved ? "已完成录取确认" : saving ? "正在确认..." : "确认时间 锁定学位"}</button><p><ShieldCheck size={13} /> 本操作仅确认学习意向，不会产生任何费用</p></div>
      <button className="seat-return-query" type="button" onClick={onReturnToQuery}><ArrowLeft size={16} /> 返回查询</button>
    </section>
  );
}

export function CoursePlanViewer() {
  const [payload, setPayload] = useState<CoursePlanPayload>({ student: "学生", courseLine: "moon" });
  const [view, setView] = useState<ViewId>("roadmap");
  const [toast, setToast] = useState<{ type: "success" | "error"; title: string; copy: string } | null>(null);
  useEffect(() => { setPayload(readPayloadFromLocation()); }, []);
  useEffect(() => { document.title = `${payload.student || "学生"}编程学习方案`; }, [payload.student]);
  useEffect(() => { if (!toast) return; const timer = window.setTimeout(() => setToast(null), 3200); return () => window.clearTimeout(timer); }, [toast]);
  function navigate(nextView: ViewId) { setView(nextView); window.scrollTo({ top: 0, behavior: "smooth" }); }
  function returnToResult() {
    const student = payload.student?.trim();
    window.location.href = student && student !== "学生" ? `/result?name=${encodeURIComponent(student)}` : "/";
  }
  function handleSaved(courseTime: string) { setPayload((current) => ({ ...current, preferredCourseTime: courseTime })); setToast({ type: "success", title: "学位确认成功", copy: `已保存上课时间：${courseTime}` }); }
  return (
    <main className={`app-shell ${view === "seat" ? "app-shell--seat" : ""}`}>
      <AppHeader view={view} student={payload.student || "学生"} onNavigate={navigate} onLogout={() => { window.location.href = "/"; }} />
      <div key={view} className="page-enter">{view === "roadmap" ? <RoadmapView payload={payload} onBack={returnToResult} onNext={() => navigate("consensus")} /> : null}{view === "consensus" ? <ConsensusView onNext={() => navigate("seat")} /> : null}{view === "seat" ? <SeatView payload={payload} onBack={() => navigate("consensus")} onReturnToQuery={() => { window.location.href = "/"; }} onSaved={handleSaved} /> : null}</div>
      {toast ? <div className={`toast toast--${toast.type}`} role="status" aria-live="polite"><span className="toast__icon"><Check size={17} strokeWidth={3} /></span><div><p className="text-sm font-semibold text-slate-900">{toast.title}</p><p className="mt-0.5 text-xs text-slate-500">{toast.copy}</p></div></div> : null}
    </main>
  );
}
