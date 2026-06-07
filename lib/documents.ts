import { execFile } from "node:child_process";
import { access, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { DOMParser, XMLSerializer, type Element as XmlElement } from "@xmldom/xmldom";
import fontkit from "@pdf-lib/fontkit";
import JSZip from "jszip";
import { PDFDocument, rgb } from "pdf-lib";
import type { SheetStudentRow } from "./types";

const execFileAsync = promisify(execFile);
const WORD_NAMESPACE = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";
const A4_WIDTH = 595.28;
const A4_HEIGHT = 841.89;
const PAGE_MARGIN = 48;
const TITLE_SIZE = 20;
const BODY_SIZE = 11;
const LINE_HEIGHT = 18;
const PDF_FONT_CANDIDATES = [
  process.env.COURSE_PLAN_FONT_PATH,
  "C:\\Windows\\Fonts\\simhei.ttf",
  "C:\\Windows\\Fonts\\msyh.ttf",
  "/usr/share/fonts/truetype/arphic/ukai.ttf",
  "/usr/share/fonts/truetype/arphic/uming.ttf",
  "/usr/share/fonts/truetype/droid/DroidSansFallbackFull.ttf",
  "/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.otf",
  "/usr/local/share/fonts/NotoSansCJK-Regular.otf"
].filter((value): value is string => Boolean(value));
const OFFICE_CANDIDATES = [
  process.env.LIBREOFFICE_BIN,
  "/usr/bin/soffice",
  "/usr/bin/libreoffice",
  "C:\\Program Files\\LibreOffice\\program\\soffice.exe",
  "soffice",
  "libreoffice"
].filter((value): value is string => Boolean(value));

const escapeXml = (value: string) =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");

export async function buildCoursePlanZip(templateFile: File | null, students: SheetStudentRow[]) {
  const archive = new JSZip();
  const templateBuffer = templateFile ? Buffer.from(await templateFile.arrayBuffer()) : null;
  const isDocx = templateFile?.name.toLowerCase().endsWith(".docx") && templateBuffer;
  const pdfFontBytes = isDocx ? null : await loadPdfFontBytes();

  for (const student of students) {
    const filename = `${student.studentName}个性化学习方案.pdf`;
    const content = isDocx
      ? await convertDocxTemplateToPdf(templateBuffer, student)
      : await buildPdfDocument(filename.replace(/\.pdf$/i, ""), buildFallbackPdfLines(student), pdfFontBytes!);
    archive.file(filename, content);
  }

  return archive.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
}

async function convertDocxTemplateToPdf(templateBuffer: Buffer, student: SheetStudentRow) {
  const docxBuffer = await buildDocxFromTemplate(templateBuffer, student);
  return convertDocxBufferToPdf(docxBuffer, student.studentName);
}

async function convertDocxBufferToPdf(docxBuffer: Buffer, studentName: string) {
  const officeBinary = await findLibreOfficeBinary();
  const tempDir = await mkdtemp(path.join(tmpdir(), "course-plan-"));
  const docxPath = path.join(tempDir, `${sanitizeFilename(studentName)}.docx`);
  const pdfPath = docxPath.replace(/\.docx$/i, ".pdf");

  try {
    await writeFile(docxPath, docxBuffer);
    await execFileAsync(
      officeBinary,
      ["--headless", "--convert-to", "pdf", "--outdir", tempDir, docxPath],
      { windowsHide: true, timeout: 120000 }
    );
    return await readFile(pdfPath);
  } catch (error) {
    throw new Error(
      "未找到可用的 LibreOffice PDF 转换环境，请在服务器安装 libreoffice 和 libreoffice-writer，或配置 LIBREOFFICE_BIN"
    );
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

async function findLibreOfficeBinary() {
  for (const candidate of OFFICE_CANDIDATES) {
    try {
      if (candidate.includes(path.sep) || candidate.includes("\\")) {
        await access(candidate);
      }
      return candidate;
    } catch {
      continue;
    }
  }

  throw new Error(
    "未找到可用的 LibreOffice PDF 转换环境，请在服务器安装 libreoffice 和 libreoffice-writer，或配置 LIBREOFFICE_BIN"
  );
}

function sanitizeFilename(value: string) {
  return value.replace(/[<>:"/\\|?*\u0000-\u001f]/g, "_").slice(0, 80) || "course-plan";
}

async function buildPdfDocument(title: string, lines: string[], pdfFontBytes: Uint8Array) {
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);

  const font = await pdf.embedFont(pdfFontBytes, { subset: false });
  let page = pdf.addPage([A4_WIDTH, A4_HEIGHT]);
  let cursorY = A4_HEIGHT - PAGE_MARGIN;

  const drawWrappedLine = (text: string, size: number) => {
    const wrapped = wrapText(text, font, size, A4_WIDTH - PAGE_MARGIN * 2);
    for (const line of wrapped) {
      if (cursorY < PAGE_MARGIN + LINE_HEIGHT) {
        page = pdf.addPage([A4_WIDTH, A4_HEIGHT]);
        cursorY = A4_HEIGHT - PAGE_MARGIN;
      }

      page.drawText(line, {
        x: PAGE_MARGIN,
        y: cursorY,
        size,
        font,
        color: rgb(0.12, 0.14, 0.18)
      });
      cursorY -= size === TITLE_SIZE ? 28 : LINE_HEIGHT;
    }
  };

  drawWrappedLine(title, TITLE_SIZE);
  cursorY -= 8;

  for (const line of lines) {
    if (!line.trim()) {
      cursorY -= 8;
      continue;
    }
    drawWrappedLine(line, BODY_SIZE);
  }

  return Buffer.from(await pdf.save());
}

function wrapText(text: string, font: { widthOfTextAtSize: (text: string, size: number) => number }, size: number, maxWidth: number) {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (!normalized) return [""];

  const lines: string[] = [];
  let current = "";

  for (const char of normalized) {
    const next = `${current}${char}`;
    if (font.widthOfTextAtSize(next, size) <= maxWidth) {
      current = next;
      continue;
    }

    if (current) {
      lines.push(current);
      current = char;
    } else {
      lines.push(char);
    }
  }

  if (current) {
    lines.push(current);
  }

  return lines;
}

async function loadPdfFontBytes() {
  for (const candidate of PDF_FONT_CANDIDATES) {
    try {
      await access(candidate);
      return new Uint8Array(await readFile(candidate));
    } catch {
      continue;
    }
  }

  throw new Error("未找到可用的中文字体，请在服务器安装可读的中文字体，或配置 COURSE_PLAN_FONT_PATH");
}

async function buildDocxFromTemplate(templateBuffer: Buffer, student: SheetStudentRow) {
  const zip = await JSZip.loadAsync(templateBuffer);
  const replacements = [
    ["{{学生姓名}}", student.studentName],
    ["{{成绩}}", student.score],
    ["张小红", student.studentName],
    ["A+", student.score],
    ["前10%", student.score]
  ] as const;

  const xmlFiles = Object.keys(zip.files).filter((name) => name.startsWith("word/") && name.endsWith(".xml"));

  for (const name of xmlFiles) {
    const file = zip.file(name);
    if (!file) continue;

    let xml = await file.async("string");
    if (name === "word/document.xml") {
      xml = replaceTableFields(xml, student);
    }

    for (const [from, to] of replacements) {
      xml = xml.replaceAll(escapeXml(from), escapeXml(to));
      xml = xml.replaceAll(from, escapeXml(to));
    }
    zip.file(name, xml);
  }

  return zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
}

function replaceTableFields(xml: string, student: SheetStudentRow) {
  const doc = new DOMParser().parseFromString(xml, "application/xml");
  if (!doc.documentElement) {
    return xml;
  }

  const rows = getElements(doc.documentElement, "tr");
  const valueStyleSource = findValueStyleSource(rows);

  for (const row of rows) {
    const cells = getElements(row, "tc");
    if (cells.length < 2) continue;

    const label = normalizeLabel(getCellText(cells[0]));

    if (label === "姓名" || label === "学生姓名") {
      replaceCellText(cells[1], student.studentName, valueStyleSource ?? cells[0]);
      continue;
    }

    if (label === "综合成绩" || label === "成绩") {
      replaceCellText(cells[1], student.score, valueStyleSource ?? cells[0]);
    }
  }

  return new XMLSerializer().serializeToString(doc);
}

function getElements(root: XmlElement, localName: string) {
  const elements: XmlElement[] = [];

  const walk = (node: any) => {
    if (node.nodeType === 1) {
      const element = node as unknown as XmlElement;
      const name = element.localName || element.nodeName.split(":").pop();
      if (name === localName) {
        elements.push(element);
      }
    }

    for (let child = node.firstChild; child; child = child.nextSibling) {
      walk(child);
    }
  };

  walk(root);
  return elements;
}

function findValueStyleSource(rows: XmlElement[]) {
  for (const row of rows) {
    const cells = getElements(row, "tc");
    if (cells.length < 2) continue;

    const label = normalizeLabel(getCellText(cells[0]));
    const value = getCellText(cells[1]).trim();

    if (value && label !== "姓名" && label !== "学生姓名" && label !== "综合成绩" && label !== "成绩") {
      return cells[1];
    }
  }

  return null;
}

function getCellText(cell: XmlElement) {
  return getElements(cell, "t")
    .map((node) => node.textContent ?? "")
    .join("");
}

function replaceCellText(cell: XmlElement, value: string, styleSource?: XmlElement | null) {
  const textNodes = getElements(cell, "t");

  if (textNodes.length > 0) {
    textNodes.forEach((node, index) => {
      node.textContent = index === 0 ? value : "";
    });
    return;
  }

  const paragraph = getElements(cell, "p")[0] ?? appendWordElement(cell, "p");
  const run = getElements(paragraph, "r")[0] ?? appendWordElement(paragraph, "r");
  cloneRunStyle(styleSource, run);
  const text = appendWordElement(run, "t");
  text.setAttribute("xml:space", "preserve");
  text.textContent = value;
}

function cloneRunStyle(source: XmlElement | null | undefined, targetRun: XmlElement) {
  if (!source || getElements(targetRun, "rPr").length > 0) {
    return;
  }

  const sourceRunStyle = getElements(source, "rPr")[0];
  if (!sourceRunStyle) {
    return;
  }

  targetRun.insertBefore(sourceRunStyle.cloneNode(true), targetRun.firstChild);
}

function appendWordElement(parent: XmlElement, localName: string) {
  const document = parent.ownerDocument;
  if (!document) {
    throw new Error("Word 文档结构异常，无法写入表格内容");
  }

  const element = document.createElementNS(WORD_NAMESPACE, `w:${localName}`) as XmlElement;
  parent.appendChild(element);
  return element;
}

function normalizeLabel(value: string) {
  return value.replace(/[\s:：]/g, "");
}

function buildFallbackPdfLines(student: SheetStudentRow) {
  return [
    `学生姓名：${student.studentName}`,
    `综合成绩：${student.score}`,
    `负责老师：${student.teacherName || "未分配老师"}`,
    "课程建议：根据当前成绩制定阶段性学习计划，并定期复盘。",
    `生成日期：${new Date().toLocaleDateString("zh-CN")}`
  ];
}
