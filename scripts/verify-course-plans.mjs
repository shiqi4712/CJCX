import assert from "node:assert/strict";

const origin = new URL(process.argv[2] ?? "http://127.0.0.1:3100");
const profiles = ["yucai-rocket", "yucai-preschool", "yingcai-preschool", "kete-moon", "kete-python", "yingcai-python"];
const checkedAssets = new Set();
for (const profile of profiles) {
  const response = await fetch(new URL(`/course-plan/${profile}`, origin), { signal: AbortSignal.timeout(30000) });
  assert.equal(response.status, 200, `${profile}: HTTP status`);
  const html = await response.text();
  assert.equal((html.match(/<section\b/g) ?? []).length, 13, `${profile}: expected 13 pages`);
  assert.ok(html.includes("北大合作品牌"), `${profile}: latest closing copy`);
  assert.ok(!html.includes("MONTHS"), `${profile}: Chinese month labels`);
  const usesLearningGoals = profile.startsWith("yucai") || profile === "yingcai-preschool";
  assert.ok(html.includes(usesLearningGoals ? 'aria-label="学习目标"' : 'aria-label="赛考目标"'));
  assert.ok(html.indexOf('aria-label="科技特长生——保送名校"') < html.indexOf('aria-label="科特班学生学习成果—助力升学"'));
  if (profile === "yucai-preschool") assert.ok(html.includes("goals-outcomes.webp"));
  for (const match of html.matchAll(/(?:src|href)="([^"<>]+)"/g)) {
    const asset = match[1].replaceAll("&amp;", "&");
    if ((!asset.startsWith("/images/") && !asset.startsWith("/_next/")) || checkedAssets.has(asset)) continue;
    const result = await fetch(new URL(asset, origin), { signal: AbortSignal.timeout(30000) });
    assert.equal(result.status, 200, asset);
    assert.ok((await result.arrayBuffer()).byteLength > 0, asset);
    checkedAssets.add(asset);
  }
  console.log(`${profile}: OK`);
}
for (const route of ["/", "/admin", "/teacher", "/result", "/api/query", "/course-plan/demo2", "/course-plan/unknown"]) {
  const response = await fetch(new URL(route, origin), { signal: AbortSignal.timeout(30000) });
  assert.equal(response.status, 404, `Unpublished route ${route}`);
}
console.log(`${profiles.length} public routes and ${checkedAssets.size} assets passed; unpublished routes return 404.`);
