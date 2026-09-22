import { isYingcaiClass } from "./course-plan-config";
import type { LearningCourseLine } from "./types";

export type QueryScope = { courseLine: LearningCourseLine; yingcai?: boolean };

export const QUERY_ENTRIES: Record<string, QueryScope> = {
  "tykete.bcmty.cn": { courseLine: "moon" },
  "yucai.bcmty.cn": { courseLine: "rocket" },
  "pykete.bcmty.cn": { courseLine: "python", yingcai: false },
  "pyyingcai.bcmty.cn": { courseLine: "python", yingcai: true },
  "yeyingcai.bcmty.cn": { courseLine: "preschool", yingcai: true },
  "bpython.bcmty.cn": { courseLine: "python", yingcai: true },
  "bmoon.bcmty.cn": { courseLine: "moon", yingcai: true },
  "brocket.bcmty.cn": { courseLine: "rocket", yingcai: true }
};

export function queryScopeForHost(host: string): QueryScope | undefined {
  const hostname = host.toLowerCase().split(":")[0].replace(/\.$/, "");
  if (hostname === "bcmty.cn" || hostname === "www.bcmty.cn" || hostname === "localhost" || hostname === "127.0.0.1") return undefined;
  const scope = QUERY_ENTRIES[hostname];
  if (!scope) throw new Error("请通过老师提供的课线查询地址访问");
  return scope;
}

export function matchesQueryScope(student: { courseLine: string; className: string }, scope?: QueryScope) {
  return !scope || (student.courseLine === scope.courseLine &&
    (scope.yingcai === undefined || isYingcaiClass(student.className) === scope.yingcai));
}

export function queryScopeForEntry(entry: string): QueryScope {
  if (!/^[a-z]+$/.test(entry) || !Object.hasOwn(QUERY_ENTRIES, `${entry}.bcmty.cn`)) {
    throw new Error("查询入口无效，请使用老师提供的链接");
  }
  return QUERY_ENTRIES[`${entry}.bcmty.cn`];
}

export function queryEntryPath(entry?: string) {
  try {
    queryScopeForEntry(entry ?? "");
    return `/entry/${entry}`;
  } catch {
    return "/";
  }
}

export function queryResultPath(name: string, entry?: string) {
  const params = new URLSearchParams({ name });
  if (entry) params.set("entry", entry);
  return `/result?${params}`;
}
