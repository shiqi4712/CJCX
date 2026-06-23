import { DOMParser, type Element as XmlElement } from "@xmldom/xmldom";
import JSZip from "jszip";
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
      teacherName: String(row["老师姓名"] ?? "未分配老师").trim() || "未分配老师",
      queryOpenAt: normalizeQueryOpenAt(
        row["开放查询时间"] ?? row["查询开放时间"] ?? row["开放时间"] ?? row["几点开放查询"]
      )
    }))
    .filter((row) => row.studentName && row.score);
}

function normalizeQueryOpenAt(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number") return excelDateToLocalDateTime(value);

  const text = String(value).trim();
  if (!text) return null;

  const normalized = text.replace(/[./]/g, "-").replace("T", " ");
  const match = normalized.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:\s+(\d{1,2}):(\d{1,2})(?::\d{1,2})?)?$/);
  if (!match) return text;

  const [, year, month, day, hour = "0", minute = "0"] = match;
  return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")} ${hour.padStart(2, "0")}:${minute.padStart(2, "0")}`;
}

function excelDateToLocalDateTime(value: number) {
  const epoch = Date.UTC(1899, 11, 30);
  const date = new Date(epoch + value * 24 * 60 * 60 * 1000);
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  const hour = String(date.getUTCHours()).padStart(2, "0");
  const minute = String(date.getUTCMinutes()).padStart(2, "0");
  return `${year}-${month}-${day} ${hour}:${minute}`;
}

export function toTeacherRows(rows: RecordRow[]): SheetTeacherRow[] {
  return rows
    .map((row) => ({
      teacherName: String(row["老师姓名"] ?? "").trim(),
      password: String(row["密码"] ?? "bcm666").trim() || "bcm666"
    }))
    .filter((row) => row.teacherName);
}
