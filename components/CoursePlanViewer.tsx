"use client";

import Image from "next/image";
import { COURSE_PLAN_PROFILES, type CoursePlanProfile } from "@/lib/course-plan-profiles";
import {
  type CSSProperties,
  type ReactNode,
  Fragment,
  useEffect,
  useMemo,
  useRef,
  useState
} from "react";
import {
  ArrowLeft,
  ArrowRight,
  BookOpenCheck,
  BrainCircuit,
  CalendarDays,
  Check,
  Clock3,
  GraduationCap,
  LibraryBig,
  Trophy
} from "lucide-react";
import {
  buildCoursePlanData,
  getCoursePlanLine,
  normalizeCoursePlanLine,
  type CoursePlanLineId,
  type CoursePlanPayload
} from "@/lib/course-plan-config";

const BASE_PAGE_COUNT = 7;
const HYBRID_ADDITIONAL_PAGE_COUNT = 6;

const ACHIEVEMENT_POSTERS = [
  { src: "/images/course-plan/achievement-noi-gold-2026.png", alt: "2026全国青少年信息学奥赛NOI金银铜牌获奖海报", label: "NOI 金牌", metric: "7金16银7铜" },
  { src: "/images/course-plan/achievement-nct-810000.jpg", alt: "NCT青少年编程能力等级测试累计冲考学员海报", label: "NCT 等考成果", metric: "810,000+" },
  { src: "/images/course-plan/achievement-whitelist-110000.jpg", alt: "编程猫白名单赛事累计助力学员海报", label: "白名单赛事", metric: "110,000+" },
  { src: "/images/course-plan/achievement-ioi-31-7.jpg", alt: "编程猫2026信息学奥林匹克竞赛金牌成绩海报", label: "信奥 2026", metric: "31+7 金" },
  { src: "/images/course-plan/achievement-ioi-58.jpg", alt: "编程猫累计信息学奥林匹克竞赛金牌成绩海报", label: "信奥金牌", metric: "累计 58 金" }
] as const;

const OUTCOME_STORIES = [
  {
    id: "ioi-gold",
    eyebrow: "STUDENT OUTCOMES / 01",
    accent: "信奥金牌",
    headline: "信奥金牌",
    claim: "行业第一",
    subtitle: "自2015年至今，持续站上信息学奥赛金牌领奖台",
    metric: "58",
    unit: "枚",
    metricLabel: "信息学奥林匹克竞赛金牌",
    statement: "从竞赛启蒙到国际舞台，用系统培养兑现顶尖成果。",
    facts: [],
    image: "/images/course-plan/outcome-ioi-58-gold.png",
    imageWidth: 1875,
    imageHeight: 3333,
    imageAlt: "编程猫累计斩获58枚信息学奥林匹克竞赛金牌",
    tone: "gold"
  },
  {
    id: "tech-talent",
    eyebrow: "STUDENT OUTCOMES / 02",
    accent: "科特生",
    headline: "科特生学员数",
    claim: "断层领先",
    subtitle: "让每一份编程能力，都沉淀为可认证的科技特长成果",
    metric: "110000+",
    metricLabel: "白名单赛事获奖 / 晋级学员",
    statement: "2024—2025，编程猫累计助力11万+学员在各大白名单赛事中获奖或晋级。",
    facts: [["白名单", "覆盖多类赛事"], ["获奖晋级", "成果真实可见"], ["科创升学", "长期成长路径"]],
    image: "/images/course-plan/outcome-whitelist-110000.png",
    imageWidth: 1875,
    imageHeight: 3334,
    imageAlt: "编程猫累计助力11万以上学员在白名单赛事中获奖或晋级",
    tone: "tech-talent"
  },
  {
    id: "admission",
    eyebrow: "STUDENT OUTCOMES / 04",
    accent: "助力升学",
    headline: "科技特长生",
    claim: "助力升学",
    subtitle: "走科技特长路径，关键升学节点持续放大竞争优势",
    metric: "83%",
    metricLabel: "重点高中 · 科技特长升学率",
    statement: "重点初中79%、重点高中83%、重点大学69%，三大关键阶段全面领先，让编程能力成为升学新优势。",
    facts: [],
    image: "/images/course-plan/outcome-admission-tech-path.png",
    imageWidth: 1280,
    imageHeight: 720,
    imageAlt: "科技特长升学率与应试升学率对比数据",
    tone: "admission"
  }
] as const;

const ADMISSION_COMPARISON = [
  { stage: "重点初中", exam: 18, tech: 79 },
  { stage: "重点高中", exam: 12, tech: 83 },
  { stage: "重点大学", exam: 2, tech: 69 }
] as const;

const HERO_TITLES: Record<CoursePlanLineId, { main: string; accent: string }> = {
  python: { main: "科特班", accent: "英才计划" },
  moon: { main: "探月班", accent: "成长计划" },
  rocket: { main: "小火箭", accent: "育才计划" },
  preschool: { main: "幼儿班", accent: "英才计划" }
};

function decodePayload(encoded: string): CoursePlanPayload {
  const normalized = encoded.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
  const binary = window.atob(padded);
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  const payload = JSON.parse(new TextDecoder().decode(bytes)) as CoursePlanPayload;
  return { ...payload, courseLine: normalizeCoursePlanLine(payload.courseLine) };
}

function readPayloadFromLocation(): CoursePlanPayload {
  const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  const encoded = hashParams.get("p");
  if (encoded) {
    try {
      return decodePayload(encoded);
    } catch {
      // Older links remain available through the query-string fallback below.
    }
  }
  const params = new URLSearchParams(window.location.search);
  return {
    studentId: params.get("studentId")?.trim() || undefined,
    student: params.get("student")?.trim() || "学生",
    score: params.get("score")?.trim() || undefined,
    courseLine: normalizeCoursePlanLine(params.get("courseLine")),
    targetClass: params.get("className")?.trim() || undefined,
    preferredCourseTime: params.get("preferredCourseTime")?.trim() || null
  };
}

function SectionHeading({ index, label, title, subtitle, dark = false, hideKicker = false }: { index: string; label: string; title: string; subtitle?: string; dark?: boolean; hideKicker?: boolean }) {
  return (
    <header className={`cp-section-heading${dark ? " cp-section-heading--dark" : ""}`}>
      {hideKicker ? null : <div className="cp-section-kicker"><span>{index}</span><b>{label}</b></div>}
      <h2>{title}</h2>
      {subtitle ? <p>{subtitle}</p> : null}
    </header>
  );
}

function Reveal({ children, className = "", delay = 0 }: { children: ReactNode; className?: string; delay?: number }) {
  return <div className={`cp-reveal ${className}`} data-reveal style={{ "--reveal-delay": `${delay}ms` } as CSSProperties}>{children}</div>;
}

function PageMascot({ src, pose, width, height }: { src: string; pose: string; width: number; height: number }) {
  return (
    <div className={`cp-page-mascot cp-page-mascot--${pose}`} data-motion-mascot aria-hidden="true">
      <Image src={src} alt="" width={width} height={height} sizes="110px" draggable={false} />
    </div>
  );
}

function AchievementPage({
  achievementTotal,
  activePoster,
  onPosterChange,
  showMascot
}: {
  achievementTotal: number;
  activePoster: number;
  onPosterChange: (index: number) => void;
  showMascot: boolean;
}) {
  return (
    <section className={`cp-page cp-section cp-section--tint cp-achievements${showMascot ? " cp-section--mascot" : ""}`} aria-label="赛考成绩">
      {showMascot ? <PageMascot src="/images/course-plan/codemao-achievement.png" pose="achievement" width={1379} height={1391} /> : null}
      <div className="cp-achievement-content">
        <Reveal>
          <SectionHeading
            hideKicker
            index="06"
            label="ACHIEVEMENTS"
            title={showMascot ? "赛考成绩 断层领先" : "赛考成绩"}
            subtitle={showMascot ? undefined : "把日常学习转化为可验证、可展示的阶段成果。"}
          />
        </Reveal>
        <Reveal className="cp-award-total" delay={80}>
          <Trophy size={28} />
          <strong>{achievementTotal}+</strong>
          <p>{showMascot ? "累计帮助11万+学生获得科技特长生入场券" : "累计帮助10万+学生获得科技特长生入场券"}</p>
        </Reveal>
        <div className="cp-poster-showcase cp-motion-image cp-motion-image--stack" data-motion-image aria-label="赛考荣誉海报展映">
          <div className="cp-poster-showcase-head" aria-live="polite">
            <div><small>HONORS ARCHIVE</small><strong>{ACHIEVEMENT_POSTERS[activePoster].label}</strong></div>
            <span>{ACHIEVEMENT_POSTERS[activePoster].metric}</span>
          </div>
          <div className="cp-poster-stack">
            {ACHIEVEMENT_POSTERS.map((poster, index) => {
              const stackPosition = (index - activePoster + ACHIEVEMENT_POSTERS.length) % ACHIEVEMENT_POSTERS.length;
              return (
                <figure
                  className={`cp-poster-card${stackPosition === 0 ? " is-active" : ""}`}
                  key={poster.src}
                  style={{ "--stack-position": stackPosition } as CSSProperties}
                  aria-hidden={stackPosition !== 0}
                >
                  <Image src={poster.src} alt={stackPosition === 0 ? poster.alt : ""} width={750} height={1333} sizes="(max-width: 519px) 286px, 286px" />
                </figure>
              );
            })}
          </div>
          <div className="cp-poster-tabs" role="tablist" aria-label="选择荣誉海报">
            {ACHIEVEMENT_POSTERS.map((poster, index) => (
              <button
                className={index === activePoster ? "is-active" : ""}
                key={poster.src}
                type="button"
                role="tab"
                aria-selected={index === activePoster}
                aria-label={`查看${poster.label}`}
                onClick={() => onPosterChange(index)}
              >
                {poster.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function UniversityPlacementPage() {
  const [activePoster, setActivePoster] = useState(0);
  const posters = [
    { src: "/images/course-plan/outcome-university-singapore.webp", width: 1400, height: 2489, label: "国际金牌喜报", alt: "2026新加坡国家信息学奥林匹克竞赛喜报：编程猫助力17名金牌同学保送世界顶尖名校" },
    { src: "/images/course-plan/outcome-university-domestic.webp", width: 1080, height: 1800, label: "中国名校榜", alt: "编程猫信奥系列赛名校榜：北大保送、清华强基计划录取、中科大少年班及浙江大学就读学员成果" }
  ];
  return (
    <section className="cp-page cp-outcome-story cp-outcome-story--placement" aria-label="科技特长生——保送名校">
      <PageMascot src="/images/course-plan/codemao-achievement.png" pose="achievement" width={1379} height={1391} />
      <Reveal className="cp-outcome-heading cp-outcome-heading--claim">
        <small>STUDENT OUTCOMES / 03</small>
        <h2><span>编程猫学员成长成果</span><em>科技特长生<b>——保送名校</b></em></h2>
        <p>编程猫培养的学员，通过编程学习与竞赛获奖，获得名校保送、强基录取等成长机会，走向北京大学、清华大学、新加坡国立大学。</p>
      </Reveal>
      <Reveal className="cp-university-schools" delay={80}>
        <div><strong>北京大学</strong><span>NOI 金牌保送</span></div>
        <div><strong>清华大学</strong><span>强基计划录取</span></div>
        <div><strong>新加坡<br />国立大学</strong><span>国际金牌喜报</span></div>
      </Reveal>
      <div className="cp-university-gallery cp-motion-image cp-motion-image--stack" data-motion-image>
        <div className="cp-university-stack" aria-label="名校成果海报">
          {posters.map((poster, index) => (
            <button
              className={`cp-university-poster${activePoster === index ? " is-front" : ""}`}
              key={poster.src}
              type="button"
              onClick={() => setActivePoster(index)}
              aria-label={`展示${poster.label}`}
              aria-pressed={activePoster === index}
            >
              <Image src={poster.src} alt={poster.alt} width={poster.width} height={poster.height} sizes="260px" />
            </button>
          ))}
        </div>
        <div className="cp-university-poster-switch" role="group" aria-label="选择海报主题">
          {posters.map((poster, index) => (
            <button type="button" key={poster.src} aria-pressed={activePoster === index} onClick={() => setActivePoster(index)}>
              {poster.label}
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}

function OutcomeStoryPage({ story }: { story: (typeof OUTCOME_STORIES)[number] }) {
  return (
    <section className={`cp-page cp-outcome-story cp-outcome-story--${story.tone}`} aria-label={`科特班学生学习成果—${story.accent}`}>
      <PageMascot src="/images/course-plan/codemao-achievement.png" pose="achievement" width={1379} height={1391} />
      <Reveal className="cp-outcome-heading cp-outcome-heading--claim">
        <small>{story.eyebrow}</small>
        <h2><span>科特班学生学习成果</span><em>{story.headline}<b>——{story.claim}</b></em></h2>
        <p>{story.subtitle}</p>
      </Reveal>
      <Reveal className="cp-outcome-proof" delay={70}>
        <div className="cp-outcome-metric">
          <div><strong>{story.metric}</strong>{"unit" in story ? <b>{story.unit}</b> : null}</div>
          <span>{story.metricLabel}</span>
        </div>
        <p>{story.statement}</p>
      </Reveal>
      {story.facts.length > 0 ? (
        <Reveal className="cp-outcome-facts" delay={140}>
          {story.facts.map(([value, label]) => <div key={value}><strong>{value}</strong><span>{label}</span></div>)}
        </Reveal>
      ) : null}
      {story.id === "admission" ? (
        <Reveal className="cp-admission-chart" delay={140}>
          <div className="cp-admission-chart-head">
            <div><small>ADMISSION ADVANTAGE</small><strong>三大升学阶段 · 实力对比</strong></div>
            <div className="cp-admission-chart-legend" aria-hidden="true">
              <span><i />应试升学</span>
              <span><i />科技特长升学</span>
            </div>
          </div>
          <div
            className="cp-admission-chart-plot"
            role="img"
            aria-label="科技特长升学率与应试升学率对比：重点初中79%比18%，重点高中83%比12%，重点大学69%比2%"
          >
            {ADMISSION_COMPARISON.map((item, index) => (
              <div className="cp-admission-chart-group" key={item.stage} style={{ "--chart-delay": `${index * 110}ms` } as CSSProperties}>
                <div className="cp-admission-chart-bars">
                  <div className="cp-admission-chart-bar cp-admission-chart-bar--exam" style={{ "--chart-height": `${item.exam}%` } as CSSProperties}>
                    <span>{item.exam}%</span><i />
                  </div>
                  <div className="cp-admission-chart-bar cp-admission-chart-bar--tech" style={{ "--chart-height": `${item.tech}%` } as CSSProperties}>
                    <span>{item.tech}%</span><i />
                  </div>
                </div>
                <strong>{item.stage}</strong>
                <div className="cp-admission-chart-gap"><b>+{item.tech - item.exam}</b><span>个百分点</span></div>
              </div>
            ))}
          </div>
        </Reveal>
      ) : (
        <div className="cp-outcome-visual cp-motion-image" data-motion-image>
          <Image src={story.image} alt={story.imageAlt} width={story.imageWidth} height={story.imageHeight} sizes="(max-width: 519px) calc(100vw - 44px), 386px" />
        </div>
      )}
    </section>
  );
}

export function CoursePlanViewer({ variant = "default", profile }: { variant?: "default" | "demo2" | "hybrid"; profile?: CoursePlanProfile }) {
  const presentation = variant === "hybrid" ? profile ?? COURSE_PLAN_PROFILES["kete-moon"] : undefined;
  const [payload, setPayload] = useState<CoursePlanPayload>({
    student: "学生",
    courseLine: presentation?.courseLine ?? "moon",
    targetClass: presentation?.className
  });
  const [acknowledged, setAcknowledged] = useState(false);
  const [achievementTotal, setAchievementTotal] = useState(0);
  const [activeAchievementPoster, setActiveAchievementPoster] = useState(0);
  const [currentPage, setCurrentPage] = useState(0);
  const pagesRef = useRef<HTMLDivElement>(null);
  const navigationStartedRef = useRef(false);
  const plan = useMemo(() => buildCoursePlanData(payload), [payload]);
  const courseLine = getCoursePlanLine(payload.courseLine);
  const heroTitle = presentation ? { main: presentation.className, accent: "英才计划" } : HERO_TITLES[courseLine.id];
  const useSharedMaterials = !!presentation || courseLine.id === "python";
  const pageTitle = presentation ? `${presentation.name} | 英才计划专项培养方案` : `${plan.student}编程学习方案`;
  const showPageMascots = variant === "hybrid";
  const showBrandPrelude = variant === "hybrid";
  const pageCount = BASE_PAGE_COUNT + (showBrandPrelude ? HYBRID_ADDITIONAL_PAGE_COUNT : 0);
  const achievementPageIndex = showBrandPrelude ? -1 : 5;
  const isHybridDarkPage = showBrandPrelude && ((currentPage >= 1 && currentPage <= OUTCOME_STORIES.length + 2) || currentPage === pageCount - 1);

  useEffect(() => {
    const locationPayload = readPayloadFromLocation();
    setPayload({
      ...locationPayload,
      courseLine: presentation?.courseLine ?? locationPayload.courseLine,
      targetClass: presentation?.className ?? locationPayload.targetClass
    });
  }, [presentation]);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      // Preserve an early cover click replayed during hydration.
      if (navigationStartedRef.current) return;
      const pages = pagesRef.current;
      if (!pages) return;
      pages.scrollLeft = 0;
      Array.from(pages.children).forEach((page) => {
        (page as HTMLElement).scrollTop = 0;
      });
      setCurrentPage(0);
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    const title = pageTitle;
    document.title = title;
    const timer = window.setTimeout(() => {
      document.title = title;
    }, 120);
    return () => window.clearTimeout(timer);
  }, [pageTitle]);

  useEffect(() => {
    const pages = pagesRef.current;
    const activePage = pages?.children.item(currentPage) as HTMLElement | null;
    if (!activePage) return;

    const animatedElements = Array.from(activePage.querySelectorAll<HTMLElement>("[data-reveal], [data-motion-image], [data-motion-mascot]"));
    animatedElements.forEach((element) => {
      element.classList.add("is-resetting");
      element.classList.remove("is-visible");
    });

    let revealObserver: IntersectionObserver | null = null;
    let revealFrame = 0;
    const resetFrame = window.requestAnimationFrame(() => {
      animatedElements.forEach((element) => element.classList.remove("is-resetting"));
      revealFrame = window.requestAnimationFrame(() => {
        revealObserver = new IntersectionObserver((entries) => {
          entries.forEach((entry) => {
            if (!entry.isIntersecting) return;
            entry.target.classList.add("is-visible");
            revealObserver?.unobserve(entry.target);
          });
        }, { root: activePage, rootMargin: "80px 0px", threshold: 0.01 });
        animatedElements.forEach((element) => revealObserver?.observe(element));
      });
    });

    return () => {
      window.cancelAnimationFrame(resetFrame);
      window.cancelAnimationFrame(revealFrame);
      revealObserver?.disconnect();
      animatedElements.forEach((element) => element.classList.remove("is-resetting"));
    };
  }, [currentPage]);

  useEffect(() => {
    if (currentPage !== achievementPageIndex) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setAchievementTotal(110000);
      return;
    }

    setAchievementTotal(0);
    let frame = 0;
    const start = performance.now();
    const duration = 1400;
    const target = 110000;
    const animate = (time: number) => {
      const elapsed = Math.min(1, (time - start) / duration);
      const eased = 1 - Math.pow(1 - elapsed, 3);
      setAchievementTotal(Math.round(target * eased));
      if (elapsed < 1) frame = requestAnimationFrame(animate);
    };
    frame = requestAnimationFrame(animate);

    return () => cancelAnimationFrame(frame);
  }, [achievementPageIndex, currentPage]);

  function returnToResult() {
    const student = payload.student?.trim();
    window.location.href = student && student !== "学生" ? `/result?name=${encodeURIComponent(student)}` : "/";
  }

  function goToPage(pageIndex: number) {
    const pages = pagesRef.current;
    if (!pages) return;
    navigationStartedRef.current = true;
    const nextPage = Math.max(0, Math.min(pageCount - 1, pageIndex));
    const targetPage = pages.children.item(nextPage) as HTMLElement | null;
    if (targetPage) targetPage.scrollTop = 0;
    pages.scrollTo({ left: nextPage * pages.clientWidth, behavior: "smooth" });
  }

  return (
    <div className={`course-plan-page${variant !== "default" ? ` course-plan-page--${variant}` : ""}${variant === "hybrid" && currentPage === 0 ? " course-plan-page--hybrid-cover-active" : ""}${isHybridDarkPage ? " course-plan-page--hybrid-trust-active" : ""}`}>
      <title>{pageTitle}</title>
      <main className="course-stage" id="top">
        <header className={`cp-topbar${currentPage === 0 ? " cp-topbar--cover" : ""}${isHybridDarkPage ? " cp-topbar--trust" : ""}`}>
          <a className="cp-brand" href="#top" aria-label="返回页面顶部">
            <img
              className={`cp-lab-logo${currentPage === 0 ? " cp-cover-lockup" : ""}`}
              src={isHybridDarkPage || (currentPage === 0 && variant !== "default") ? "/images/course-plan/brand-lab-light.png" : "/images/course-plan/brand-lab-color.png"}
              alt="北京大学与点猫科技人工智能教育联合实验室"
              width={1280}
              height={260}
            />
          </a>
          <i className="cp-scroll-progress" aria-hidden="true" style={{ "--scroll-progress": `${((currentPage + 1) / pageCount) * 100}%` } as CSSProperties} />
        </header>

        <div
          className="cp-pages"
          ref={pagesRef}
          onScroll={(event) => {
            const pageWidth = event.currentTarget.clientWidth;
            if (pageWidth > 0) setCurrentPage(Math.round(event.currentTarget.scrollLeft / pageWidth));
          }}
        >
        <section className="cp-page cp-hero cp-cover" aria-label="首页">
          <div className="cp-grid-texture" aria-hidden="true" />
          <div className="cp-hero-content">
            <h1>
              <span className="cp-cover-program">{heroTitle.main} <em>{heroTitle.accent}</em></span>
              <span className="cp-cover-title-line">{variant === "hybrid" ? "专项培养方案" : "专属学习规划"}</span>
            </h1>
            {variant === "hybrid" ? null : <p className="cp-cover-subtitle">班级介绍及学习方案</p>}
          </div>
          {variant === "hybrid" ? (
            <button className="cp-swipe-hint" type="button" onClick={() => goToPage(1)} aria-label="向左滑动查看下一页">
              <ArrowLeft size={17} aria-hidden="true" />
              <span>向左滑动查看</span>
            </button>
          ) : null}
        </section>

        {showBrandPrelude ? OUTCOME_STORIES.map((story) => (
          <Fragment key={story.id}>
            {story.id === "admission" ? <UniversityPlacementPage /> : null}
            <OutcomeStoryPage story={story} />
          </Fragment>
        )) : null}

        {showBrandPrelude ? (
          <section className="cp-page cp-brand-prelude cp-brand-prelude--trust" aria-label="信任编程猫">
            <div className="cp-prelude-grid" aria-hidden="true" />
            <Reveal className="cp-prelude-copy">
              <span className="cp-prelude-index">TRUST / 01</span>
              <h2><span>信任编程猫</span><em>源于专业共建</em></h2>
              <p>与北京大学共建人工智能教育联合实验室</p>
            </Reveal>
            <div className="cp-prelude-visual cp-prelude-visual--trust cp-motion-image" data-motion-image>
              <Image
                src="/images/course-plan/brand-trust-pku.png"
                alt="北京大学与点猫科技人工智能教育联合实验室共建现场"
                width={1152}
                height={2052}
                sizes="(max-width: 519px) calc(100vw - 36px), 394px"
              />
            </div>
            <div className="cp-prelude-visual-caption"><span>ACADEMIC ALLIANCE</span><b>权威学术资源 × 长期科技教育实践</b></div>
          </section>
        ) : null}

        {showBrandPrelude ? null : (
          <section className="cp-page cp-section cp-class-page" aria-label={courseLine.id === "python" ? "科特班英才计划介绍" : `${heroTitle.main}介绍`}>
          <Reveal><SectionHeading hideKicker index="02" label="CLASS PROFILE" title={courseLine.id === "python" ? "科特班英才计划介绍" : `${heroTitle.main}介绍`} subtitle={courseLine.id === "python" ? "科技特长生专属培养计划" : "面向科技特长与赛考进阶目标，为孩子建立一条长期、清晰的成长路径。"} /></Reveal>
          <Reveal className={`cp-class-intro${courseLine.id === "python" ? " cp-class-intro--long cp-class-intro--campaign" : ""}`} delay={80}>
            <span><GraduationCap size={24} /></span>
            {courseLine.id === "python" ? (
              <div>
                <small>ELITE TALENT PROGRAM</small>
                <h3>面向<mark>重点人才</mark>的专项培养</h3>
                <p className="cp-class-description">
                  科特班·英才计划依托<mark>北京大学与点猫科技</mark>联合共建人工智能教育实验室的学术背景，由编程猫全新设立，专注发掘与培养编程领域的重点人才。面向展现出突出思维能力与探索兴趣的孩子，择优入班，<b>定制科创升学成长路径。</b>
                </p>
              </div>
            ) : (
              <div><small>{courseLine.name}专项成长计划</small><h3>能力培养与成果目标同步规划</h3><p>{plan.goal}</p></div>
            )}
          </Reveal>
          <Reveal className="cp-brand-proof-grid" delay={140}>
            <div><strong>9年</strong><span>专项培养沉淀</span></div>
            <div><strong>70000+</strong><span>服务学校</span></div>
            <div><strong>千万</strong><span>家庭选择</span></div>
          </Reveal>
          {courseLine.id === "python" ? (
            <div className="cp-class-detail cp-motion-image" data-motion-image>
              <Image
                className="cp-class-detail-image"
                src="/images/course-plan/kete-class-detail.png"
                alt="编程猫科特班科技特长生人才培养计划介绍"
                width={750}
                height={3313}
                sizes="(max-width: 519px) calc(100vw - 44px), 386px"
              />
            </div>
          ) : null}
          </section>
        )}

        <section className={`cp-page cp-section${showPageMascots ? " cp-section--mascot" : ""}`} aria-label="专业师资">
          {showPageMascots ? <PageMascot src="/images/course-plan/codemao-teacher.png" pose="teacher" width={685} height={1050} /> : null}
          <Reveal><SectionHeading hideKicker index="03" label="TEACHERS" title="专业师资" subtitle={useSharedMaterials ? "北大认证 专业师资，全中心筛选金牌老师辅导" : "用清晰标准筛选老师，让孩子获得稳定、专业的长期陪伴。"} /></Reveal>
          {useSharedMaterials ? (
            <Reveal className="cp-teacher-pillars" delay={80}>
              <div><span><GraduationCap size={18} /></span><strong>全中心</strong><p>前5%名师教学</p></div>
              <div><span><BookOpenCheck size={18} /></span><strong>顶级教研</strong><p>研发课程</p></div>
              <div><span><Trophy size={18} /></span><strong>金牌赛考</strong><p>教练保驾护航</p></div>
            </Reveal>
          ) : (
            <Reveal className="cp-teacher-stat" delay={80}>
              <div><strong>5%</strong><span>TOP TEACHERS</span></div>
              <p>从全集团 2000+ 教师中，按专业能力、教学经验与学员成果层层评测。</p>
            </Reveal>
          )}
          {useSharedMaterials ? (
            <div className="cp-teacher-detail cp-motion-image" data-motion-image>
              <Image
                className="cp-teacher-detail-image"
                src="/images/course-plan/kete-teachers-ioi-experts.png"
                alt="IOI主席与北大专家联合指导的科特班师资团队"
                width={1878}
                height={1678}
                sizes="(max-width: 519px) calc(100vw - 44px), 386px"
              />
            </div>
          ) : null}
        </section>

        {showBrandPrelude ? (
          <section className="cp-page cp-section cp-section--tint cp-section--mascot cp-master-teacher" aria-label="名师授课">
            <PageMascot src="/images/course-plan/codemao-teacher.png" pose="teacher" width={685} height={1050} />
            <Reveal>
              <SectionHeading hideKicker index="05" label="MASTER TEACHERS" title="名师授课" subtitle="北大官方认证的好老师，带来高标准专业课堂" />
            </Reveal>
            <Reveal className="cp-master-teacher-lead" delay={70}>
              <small>PEKING UNIVERSITY CERTIFIED</small>
              <h3><em>北大认证</em>好老师亲授</h3>
              <p>依托北大—点猫科技人工智能教育联合实验室，编程猫骨干教师完成北京大学组织的专项培训并获得结业认证。</p>
            </Reveal>
            <div className="cp-master-teacher-visual cp-motion-image" data-motion-image>
              <Image
                src="/images/course-plan/master-teacher-pku-certification.png"
                alt="编程猫老师完成北京大学骨干教师培训并获得官方结业证书"
                width={1875}
                height={3333}
                sizes="(max-width: 519px) calc(100vw - 44px), 386px"
              />
            </div>
          </section>
        ) : null}

        <section className={`cp-page cp-section cp-section--tint cp-syllabus-page${showPageMascots ? " cp-section--mascot" : ""}`} aria-label={presentation?.syllabus.title ?? (courseLine.id === "python" ? "探月进阶课程大纲" : `${courseLine.name} 课程内容`)}>
          {showPageMascots ? <PageMascot src="/images/course-plan/codemao-syllabus.png" pose="syllabus" width={1115} height={1524} /> : null}
          <Reveal><SectionHeading hideKicker index="04" label="SYLLABUS" title={presentation?.syllabus.title ?? (courseLine.id === "python" ? "探月进阶课程大纲" : `${courseLine.name} 课程内容`)} /></Reveal>
          {presentation ? (
            <Reveal className="cp-mini-stats cp-mini-stats--three" delay={160}>
              {presentation.syllabus.stats.map((stat, index) => {
                const Icon = [BrainCircuit, BookOpenCheck, LibraryBig][index];
                return <div key={stat.label}><Icon size={19} /><strong>{stat.value}</strong><span>{stat.label}</span></div>;
              })}
            </Reveal>
          ) : <Reveal className={`cp-mini-stats${courseLine.id === "python" ? " cp-mini-stats--three" : ""}`} delay={160}>
            <div><BrainCircuit size={19} /><strong>120+</strong><span>阶段核心知识点</span></div>
            <div><BookOpenCheck size={19} /><strong>125+</strong><span>课中思维训练</span></div>
            {courseLine.id === "python" ? <div><LibraryBig size={19} /><strong>全课程</strong><span>融合小学学科知识<br />侧面提升成绩</span></div> : null}
          </Reveal>}
          {useSharedMaterials ? (
            <div className="cp-syllabus-detail cp-motion-image" data-motion-image>
              <Image
                className="cp-syllabus-detail-image"
                src={presentation?.syllabus.image.src ?? "/images/course-plan/kete-syllabus-detail.png"}
                alt={presentation?.syllabus.image.alt ?? "探月图形化科特班进阶课程大纲"}
                width={presentation?.syllabus.image.width ?? 1450}
                height={presentation?.syllabus.image.height ?? 5571}
                sizes="(max-width: 519px) calc(100vw - 44px), 386px"
              />
            </div>
          ) : null}
        </section>

        {presentation ? (
          <section className="cp-page cp-section cp-exam-goal cp-section--mascot" aria-label={presentation.goals.title}>
            <PageMascot src="/images/course-plan/codemao-achievement.png" pose="achievement" width={1379} height={1391} />
            <Reveal>
              <SectionHeading hideKicker index="08" label="LEARNING PATH" title={presentation.goals.title} subtitle={presentation.goals.subtitle} />
            </Reveal>
            <Reveal className="cp-exam-goal-lead" delay={70}>
              <small>6个月成长路径</small>
              <h3><em>{presentation.goals.headline}</em></h3>
              <p>{presentation.goals.description}</p>
            </Reveal>
            <Reveal className="cp-exam-goal-roadmap" delay={130}>
              {presentation.goals.milestones.map((milestone, index) => (
                <div key={milestone.month} className={index === 2 ? "is-featured" : undefined}>
                  <small><b>{Number(milestone.month)}</b>个月</small>
                  <strong>{milestone.title}</strong>
                  <p>{milestone.description}</p>
                </div>
              ))}
            </Reveal>
            <Reveal className="cp-exam-goal-output" delay={200}>
              {presentation.goals.outputs.map((stat) => <div key={stat.label}><strong>{stat.value}</strong><span>{stat.label}</span></div>)}
            </Reveal>
            {presentation.goals.images.map((poster) => <div key={poster.src} className="cp-exam-goal-visual cp-motion-image" data-motion-image>
              <Image
                {...poster}
                sizes="(max-width: 519px) calc(100vw - 44px), 386px"
              />
            </div>)}
          </section>
        ) : null}

        <section className={`cp-page cp-section${showPageMascots ? " cp-section--mascot" : ""}`} aria-label={`${heroTitle.main} 上课模式`}>
          {showPageMascots ? <PageMascot src="/images/course-plan/codemao-tutoring.png" pose="tutoring" width={746} height={1042} /> : null}
          <Reveal>
            <SectionHeading
              hideKicker
              index="05"
              label="TUTORING"
              title={`${heroTitle.main} 上课模式`}
              subtitle={useSharedMaterials ? "专业老师保驾护航——学习不费爸妈" : "课前、课中、课后都有老师实时跟进，学习过程更安心。"}
            />
          </Reveal>
          {useSharedMaterials ? (
            <div className="cp-tutoring-detail cp-motion-image" data-motion-image>
              <Image
                className="cp-tutoring-detail-image"
                src="/images/course-plan/kete-tutoring-classroom-services.png"
                unoptimized
                alt="编程猫科特班教学服务：开学典礼、开课提醒、课前直播、课中监测与答疑、学情反馈、课后练习和阶段测评"
                width={346}
                height={669}
                sizes="(max-width: 519px) calc(100vw - 44px), 386px"
              />
            </div>
          ) : null}
        </section>

        {showBrandPrelude ? null : (
          <AchievementPage
            achievementTotal={achievementTotal}
            activePoster={activeAchievementPoster}
            onPosterChange={setActiveAchievementPoster}
            showMascot={showPageMascots}
          />
        )}

        <section className={`cp-page cp-section cp-section--tint cp-schedule-page${showPageMascots ? " cp-section--mascot" : ""}`} id="schedule" aria-label={`${heroTitle.main} 上课安排`}>
          {showPageMascots ? <PageMascot src="/images/course-plan/codemao-schedule.png" pose="schedule" width={740} height={1008} /> : null}
          <Reveal><SectionHeading hideKicker index="07" label="SCHEDULE" title={`${heroTitle.main} 上课安排`} subtitle="固定学习节奏，灵活匹配孩子的时间与成长需要。" /></Reveal>
          {useSharedMaterials ? (
            <div className="cp-schedule-detail cp-motion-image" data-motion-image>
              <Image
                className="cp-schedule-detail-image"
                src={presentation?.schedule.image.src ?? "/images/course-plan/class-schedule.png"}
                alt={presentation?.schedule.image.alt ?? "探月科特班学习时间安排表"}
                width={presentation?.schedule.image.width ?? 2620}
                height={presentation?.schedule.image.height ?? 1417}
                quality={90}
                sizes="(max-width: 519px) calc(100vw - 44px), 386px"
              />
            </div>
          ) : null}
          <Reveal className="cp-schedule-rhythm" delay={130}>
            <div><strong>1</strong><span>次 / 周</span><small>稳定学习频率</small></div>
            <i aria-hidden="true">×</i>
            <div><strong>2</strong><span>课时 / 次</span><small>完整学习单元</small></div>
          </Reveal>
          <Reveal className="cp-schedule-path" delay={190}>
            <header>
              <small>{presentation ? "课前直播 · 编程实操 · 在线辅导" : "灵活时间 · 专属小班 · 全程带教"}</small>
              <strong>把合适的时间，变成稳定的成长节奏</strong>
            </header>
            <div className="cp-schedule-steps">
              <div>
                <span><CalendarDays size={18} /></span>
                <div><small>01</small><strong>{presentation ? "课前真人直播" : "灵活选择上课时间"}</strong><p>{presentation ? `周四、周五、周六三选一，${presentation.schedule.liveTime}开课；错过可联系老师补课。` : "根据孩子的日常安排，自由选择合适时段。"}</p></div>
              </div>
              <div>
                <span><Clock3 size={18} /></span>
                <div><small>02</small><strong>{presentation ? "实操解锁后灵活安排" : "固定专属小班席位"}</strong><p>{presentation ? `随课前直播于${presentation.schedule.unlockTime}解锁。周一、周四至周日，14:00–21:00可选学习时段。` : <><b>例如：周六下午</b>，确定后按固定节奏稳定学习。</>}</p></div>
              </div>
              <div>
                <span><GraduationCap size={18} /></span>
                <div><small>03</small><strong>老师全程针对性辅导</strong><p>{presentation ? "导师在线辅导答疑；周二、周三公休，有问题可给老师留言。" : "无论课程学习还是创新实践，老师持续跟进带教。"}</p></div>
              </div>
            </div>
          </Reveal>
          <Reveal delay={250}>
            <button
              className={`cp-cta cp-schedule-cta${acknowledged ? " is-acknowledged" : ""}`}
              type="button"
              aria-pressed={acknowledged}
              disabled={acknowledged && !showBrandPrelude}
              onClick={() => {
                setAcknowledged(true);
                if (showBrandPrelude) {
                  window.setTimeout(() => goToPage(pageCount - 1), 80);
                }
              }}
            >
              <Check size={20} /> {acknowledged ? "已知悉" : "我已知悉"}
            </button>
          </Reveal>
          {variant === "hybrid" ? null : (
            <footer className="cp-footer">
              <strong>编程猫 · <span>{plan.targetClass}</span></strong>
              <p>联合国教科文组织官方合作伙伴</p>
              <button type="button" onClick={returnToResult}><ArrowLeft size={15} /> 返回成绩页</button>
            </footer>
          )}
        </section>

        {showBrandPrelude ? (
          <section className="cp-page cp-brand-closing" aria-label="学编程选择编程猫">
            <div className="cp-closing-grid" aria-hidden="true" />
            <Reveal className="cp-closing-heading">
              <small>TRUSTED CHOICE · SINCE 2015</small>
              <h2><span>学编程，就选</span><em>北大合作品牌</em></h2>
              <p>好课程 · 强师资 · 真成果</p>
            </Reveal>
            <div className="cp-closing-poster cp-motion-image" data-motion-image>
              <Image
                src="/images/course-plan/codemao-programming-pioneer.png"
                alt="编程猫中国少儿编程在线教育开创者市场地位声明"
                width={1875}
                height={3125}
                quality={92}
                sizes="(max-width: 519px) 254px, 254px"
              />
            </div>
            <Reveal className="cp-closing-signoff" delay={180}>
              <strong><b>11</b>年编程猫</strong>
              <span>用心做好编程教育</span>
            </Reveal>
          </section>
        ) : null}
        </div>

        {variant === "hybrid" ? (
          currentPage > 0 ? (
            <nav className="cp-side-nav" aria-label="学习方案翻页">
              <button className="cp-side-nav__previous" type="button" onClick={() => goToPage(currentPage - 1)} aria-label="上一页" title="上一页">
                <ArrowLeft size={16} />
              </button>
              <button className="cp-side-nav__next" type="button" onClick={() => goToPage(currentPage + 1)} disabled={currentPage === pageCount - 1} aria-label="下一页" title={currentPage === pageCount - 1 ? "已到最后一页" : "下一页"}>
                <ArrowRight size={16} />
              </button>
            </nav>
          ) : null
        ) : (
          <nav className={`cp-page-nav${currentPage === 0 ? " cp-page-nav--cover" : ""}`} aria-label="学习方案分页">
            <button type="button" onClick={() => goToPage(currentPage - 1)} disabled={currentPage === 0} aria-label="上一页" title="上一页"><ArrowLeft size={18} /></button>
            <div className="cp-page-dots">
              {Array.from({ length: pageCount }, (_, index) => (
                <button key={index} type="button" className={currentPage === index ? "is-active" : ""} onClick={() => goToPage(index)} aria-label={`第 ${index + 1} 页`} aria-current={currentPage === index ? "page" : undefined} />
              ))}
            </div>
            <span>{currentPage + 1} / {pageCount}</span>
            <button type="button" onClick={() => goToPage(currentPage + 1)} disabled={currentPage === pageCount - 1} aria-label="下一页" title="下一页"><ArrowRight size={18} /></button>
          </nav>
        )}
      </main>
    </div>
  );
}
