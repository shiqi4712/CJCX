import { DOMParser, XMLSerializer, type Element as XmlElement } from "@xmldom/xmldom";
import JSZip from "jszip";
import type { SheetStudentRow } from "./types";

const WORD_NAMESPACE = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";

const escapeXml = (value: string) =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");

const escapeHtml = (value: string) =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

export async function buildCoursePlanZip(templateFile: File | null, students: SheetStudentRow[]) {
  const archive = new JSZip();
  const templateBuffer = templateFile ? Buffer.from(await templateFile.arrayBuffer()) : null;
  const isDocx = templateFile?.name.toLowerCase().endsWith(".docx") && templateBuffer;

  for (const student of students) {
    const filename = `${student.studentName}个性化学习方案文档.${isDocx ? "docx" : "doc"}`;
    const content = isDocx
      ? await buildDocxFromTemplate(templateBuffer, student)
      : Buffer.from(buildFallbackWordHtml(student), "utf8");
    archive.file(filename, content);
  }

  return archive.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
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

function buildFallbackWordHtml(student: SheetStudentRow) {
  const studentName = escapeHtml(student.studentName);
  const score = escapeHtml(student.score);

  return `<!doctype html>
<html>
  <head>
    <meta charset="UTF-8">
    <style>
      body { font-family: "Microsoft YaHei", Arial, sans-serif; color: #202124; }
      h1 { font-size: 24px; margin: 24px 0; }
      table { width: 100%; border-collapse: collapse; font-size: 16px; }
      td { border: 1px solid #c8cdd5; padding: 12px 16px; line-height: 1.7; }
      td:first-child { width: 180px; background: #f7f9fc; }
    </style>
  </head>
  <body>
    <h1>${studentName}专属冲刺班课程规划</h1>
    <table>
      <tr><td>姓名</td><td>${studentName}</td></tr>
      <tr><td>综合成绩</td><td>${score}</td></tr>
      <tr><td>编程猫班主任</td><td>择一老师</td></tr>
      <tr><td>录取结果</td><td>已录取冲刺班</td></tr>
      <tr><td>录取详情</td><td>恭喜通过编程猫教学中心审核，符合【冲刺班】入学标准，予以录取</td></tr>
      <tr><td>学习目标</td><td>学习6个月，进行专注力、表达能力、思维能力训练，达到国家编程二级考证水平，对标省级白名单赛事</td></tr>
      <tr><td>录取时间</td><td>2026年XX月XX日</td></tr>
    </table>
  </body>
</html>`;
}
