import { DOMParser, type Element as XmlElement } from "@xmldom/xmldom";
import JSZip from "jszip";
import { normalizeProgramType } from "./programs";
import type { SheetStudentRow, SheetTeacherRow } from "./types";

type RecordRow = Record<string, unknown>;
type CellValue = string | number | boolean | null;

export async function parseSheetFile(file: File): Promise<RecordRow[]> {
  const buffer = Buffer.from(await file.arrayBuffer());
  const lowerName = file.name.toLowerCase();

  if (lowerName.endsWith(".csv")) {
    return parseCsv(buffer.toString("utf8"));
  }

  if (!lowerName.endsWith(".xlsx")) {
    throw new Error("当前支持 .xlsx 或 .csv 文件，请将旧版 .xls 另存为 .xlsx 后上传");
  }

  return matrixToRecords(await parseXlsx(buffer));
}

function parseCsv(text: string): RecordRow[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];
    if (char === '"' && quoted && next === '"') {
      cell += '"';
      index += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      row.push(cell.trim());
      cell = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && next === "\n") index += 1;
      row.push(cell.trim());
      if (row.some(Boolean)) rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += char;
    }
  }
  row.push(cell.trim());
  if (row.some(Boolean)) rows.push(row);

  return matrixToRecords(rows);
}

function matrixToRecords(rows: unknown[][]): RecordRow[] {
  const [header = [], ...body] = rows;
  const keys = header.map((cell) => String(cell ?? "").trim());

  return body.map((row) =>
    keys.reduce<RecordRow>((record, key, index) => {
      if (key) {
        record[key] = row[index] ?? "";
      }
      return record;
    }, {})
  );
}

async function parseXlsx(buffer: Buffer): Promise<CellValue[][]> {
  const zip = await JSZip.loadAsync(buffer);
  const sharedStrings = await readSharedStrings(zip);
  const sheetPath = await findFirstSheetPath(zip);
  const sheetXml = await zip.file(sheetPath)?.async("string");

  if (!sheetXml) {
    throw new Error("未找到 Excel 工作表内容");
  }

  const doc = parseXml(sheetXml);
  const rowNodes = Array.from(doc.getElementsByTagName("row"));

  return rowNodes.map((rowNode) => {
    const values: CellValue[] = [];
    const cellNodes = Array.from(rowNode.getElementsByTagName("c"));

    for (const cellNode of cellNodes) {
      const ref = cellNode.getAttribute("r") ?? "";
      const columnIndex = getColumnIndex(ref);
      values[columnIndex] = readCellValue(cellNode, sharedStrings);
    }

    return values.map((value) => value ?? "");
  });
}

async function readSharedStrings(zip: JSZip) {
  const xml = await zip.file("xl/sharedStrings.xml")?.async("string");
  if (!xml) return [];

  const doc = parseXml(xml);
  return Array.from(doc.getElementsByTagName("si")).map((item) =>
    Array.from(item.getElementsByTagName("t"))
      .map((textNode) => textNode.textContent ?? "")
      .join("")
  );
}

async function findFirstSheetPath(zip: JSZip) {
  const workbookXml = await zip.file("xl/workbook.xml")?.async("string");
  const relsXml = await zip.file("xl/_rels/workbook.xml.rels")?.async("string");

  if (!workbookXml || !relsXml) {
    return "xl/worksheets/sheet1.xml";
  }

  const workbookDoc = parseXml(workbookXml);
  const firstSheet = workbookDoc.getElementsByTagName("sheet")[0];
  const relId = firstSheet?.getAttribute("r:id");

  if (!relId) {
    return "xl/worksheets/sheet1.xml";
  }

  const relsDoc = parseXml(relsXml);
  const relationships = Array.from(relsDoc.getElementsByTagName("Relationship"));
  const target = relationships.find((rel) => rel.getAttribute("Id") === relId)?.getAttribute("Target");

  if (!target) {
    return "xl/worksheets/sheet1.xml";
  }

  return target.startsWith("xl/") ? target : `xl/${target.replace(/^\/+/, "")}`;
}

function readCellValue(cellNode: XmlElement, sharedStrings: string[]): CellValue {
  const type = cellNode.getAttribute("t");
  const valueNode = cellNode.getElementsByTagName("v")[0];
  const inlineTextNode = cellNode.getElementsByTagName("t")[0];
  const raw = valueNode?.textContent ?? inlineTextNode?.textContent ?? "";

  if (type === "s") {
    return sharedStrings[Number(raw)] ?? "";
  }

  if (type === "inlineStr" || type === "str") {
    return raw;
  }

  if (type === "b") {
    return raw === "1";
  }

  return raw;
}

function getColumnIndex(cellRef: string) {
  const letters = cellRef.match(/[A-Z]+/i)?.[0]?.toUpperCase() ?? "A";
  return [...letters].reduce((sum, letter) => sum * 26 + letter.charCodeAt(0) - 64, 0) - 1;
}

function parseXml(xml: string) {
  return new DOMParser().parseFromString(xml, "application/xml");
}

export function toStudentRows(rows: RecordRow[]): SheetStudentRow[] {
  return rows
    .map((row) => ({
      studentName: String(row["学生姓名"] ?? "").trim(),
      score: String(row["成绩"] ?? "").trim(),
      overallScore: String(row["综合得分"] ?? row["分数"] ?? row["得分"] ?? row["综合分数"] ?? row["总分"] ?? "").trim() || null,
      teacherName: String(row["老师姓名"] ?? "未分配老师").trim() || "未分配老师",
      programType: normalizeProgramType(String(row["班级类型"] ?? row["班型"] ?? row["录取班级"] ?? row["班级"] ?? "")),
      homeworkLessonCount: toNonNegativeInteger(row["提交作业课次数"] ?? row["提交作业数"] ?? row["作业课次数"] ?? row["作业数量"]),
      videoCount: toNonNegativeInteger(row["录制视频次数"] ?? row["视频次数"] ?? row["录制视频数"]),
      messageCount: toNonNegativeInteger(row["学生消息数"] ?? row["消息数"] ?? row["消息数量"] ?? row["学生消息数量"])
    }))
    .filter((row) => row.studentName && row.score);
}

function toNonNegativeInteger(value: unknown) {
  const numeric = Number(String(value ?? "").trim());
  return Number.isFinite(numeric) && numeric > 0 ? Math.floor(numeric) : 0;
}

export function toTeacherRows(rows: RecordRow[]): SheetTeacherRow[] {
  return rows
    .map((row) => ({
      teacherName: String(row["老师姓名"] ?? "").trim(),
      password: String(row["密码"] ?? "bcm666").trim() || "bcm666"
    }))
    .filter((row) => row.teacherName);
}
