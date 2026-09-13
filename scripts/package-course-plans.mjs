import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import JSZip from "jszip";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const stage = await fs.mkdtemp(path.join(os.tmpdir(), "course-plans-release-"));
const releaseId = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d+Z$/, "Z");
const sources = [
  "app/globals.css", "app/course-plan/course-plan.css", "app/course-plan/[profile]/page.tsx",
  "components/CoursePlanViewer.tsx", "lib/course-plan-config.ts", "lib/course-plan-profiles.ts",
  "lib/types.ts", "lib/programs.ts", "next.config.ts", "tsconfig.json",
  "package.json", "package-lock.json", "tests/course-plan-profiles.test.ts",
  "deployment/course-plans/nginx.conf", "deployment/course-plans/course-plans.service",
  "deployment/course-plans/README.md", "scripts/verify-course-plans.mjs"
];

for (const relative of sources) {
  const target = path.join(stage, relative);
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.copyFile(path.join(root, relative), target);
}
await fs.copyFile(path.join(root, "deployment/course-plans/app-layout.tsx"), path.join(stage, "app/layout.tsx"));
await fs.cp(path.join(root, "public/images/course-plan"), path.join(stage, "public/images/course-plan"), { recursive: true });
await fs.writeFile(path.join(stage, "next-env.d.ts"), '/// <reference types="next" />\n/// <reference types="next/image-types/global" />\n');

const archive = new JSZip();
const manifest = { releaseId, kind: "course-presentations-source", files: [] };
async function collect(directory) {
  for (const entry of (await fs.readdir(directory, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name))) {
    const filename = path.join(directory, entry.name);
    if (entry.isSymbolicLink()) throw new Error(`Unexpected symlink: ${filename}`);
    if (entry.isDirectory()) { await collect(filename); continue; }
    const relative = path.relative(stage, filename).split(path.sep).join("/");
    const bytes = await fs.readFile(filename);
    archive.file(relative, bytes);
    manifest.files.push({ path: relative, size: bytes.length, sha256: createHash("sha256").update(bytes).digest("hex") });
  }
}
await collect(stage);
const manifestText = JSON.stringify(manifest, null, 2) + "\n";
archive.file("release-manifest.json", manifestText);
await fs.writeFile(path.join(stage, "release-manifest.json"), manifestText);
const outputDirectory = path.join(root, "dist");
await fs.mkdir(outputDirectory, { recursive: true });
const archivePath = path.join(outputDirectory, `course-plans-${releaseId}.zip`);
const buffer = await archive.generateAsync({ type: "nodebuffer", compression: "DEFLATE", compressionOptions: { level: 6 } });
await fs.writeFile(archivePath, buffer);
const sha256 = createHash("sha256").update(buffer).digest("hex");
await fs.writeFile(`${archivePath}.sha256`, `${sha256}  ${path.basename(archivePath)}\n`);
console.log(JSON.stringify({ releaseId, stage, archive: archivePath, sha256, bytes: buffer.length, files: manifest.files.length }, null, 2));
