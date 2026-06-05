const students = [];

const normalize = (value) => value.trim().replace(/\s+/g, "").toLowerCase();

const queryForm = document.querySelector("#queryForm");
const messageBox = document.querySelector("#messageBox");
const resultCard = document.querySelector("#resultCard");
const teacherLogin = document.querySelector("#teacherLogin");
const teacherDashboard = document.querySelector("#teacherDashboard");

if (queryForm) {
  queryForm.addEventListener("submit", (event) => {
    event.preventDefault();

    const studentName = document.querySelector("#studentName").value;
    if (!studentName.trim()) {
      showMessage("请输入学员姓名后再查询。");
      resultCard.hidden = true;
      return;
    }

    const matches = students.filter(
      (student) => normalize(student.studentName) === normalize(studentName)
    );

    if (matches.length === 0) {
      showMessage("未查询到相关结果，请确认学员姓名是否填写正确，或联系老师。");
      resultCard.hidden = true;
      return;
    }

    messageBox.classList.remove("show");
    renderResult(matches[0]);
  });
}

if (teacherLogin) {
  teacherLogin.addEventListener("submit", (event) => {
    event.preventDefault();
    const account = document.querySelector("#teacherAccount").value.trim();
    const password = document.querySelector("#teacherPassword").value.trim();

    if (account !== "xiaohong" || password !== "bdsz666") {
      teacherDashboard.hidden = false;
      teacherDashboard.innerHTML = '<div class="result-footer">账号或密码不正确，请使用演示账号登录。</div>';
      return;
    }

    renderTeacherDashboard();
  });
}

if (teacherDashboard) {
  teacherDashboard.addEventListener("click", async (event) => {
    if (event.target.id !== "exportPlansButton") {
      return;
    }

    const teacherStudents = await getExportStudents();
    const exportStatus = document.querySelector("#exportStatus");
    event.target.disabled = true;
    event.target.textContent = "正在生成...";

    try {
      const files = [];
      for (const student of teacherStudents) {
        const blob = createPlanDocument(student);
        files.push({
          name: `${student.studentName}个性化学习方案文档.doc`,
          blob
        });
      }

      const zipBlob = await createZip(files);
      downloadBlob(zipBlob, "个性化学习方案批量导出.zip");

      exportStatus.innerHTML = `
        <strong>已生成并下载 ${files.length} 份个性化学习方案文档</strong>
      `;
      exportStatus.hidden = false;
    } catch (error) {
      exportStatus.innerHTML = `<strong>生成失败</strong><p>${error.message}</p>`;
      exportStatus.hidden = false;
    } finally {
      event.target.disabled = false;
      event.target.textContent = "生成并批量导出";
    }
  });
}

function showMessage(text) {
  messageBox.textContent = text;
  messageBox.classList.add("show");
}

function renderResult(student) {
  const queryDate = new Date().toLocaleDateString("zh-CN", {
    year: "numeric",
    month: "long",
    day: "numeric"
  });

  resultCard.hidden = false;
  resultCard.innerHTML = `
    <article class="result-certificate">
      <header class="result-title">
        <span></span>
        <p>录取结果</p>
        <span></span>
      </header>

      <section class="student-result">
        <p class="student-label">恭喜</p>
        <h2>${student.studentName}</h2>
        <p class="student-subtitle">同学获得英才班录取资格</p>
      </section>

      <section class="score-panel">
        <div>
          <span>学生成绩</span>
          <strong>${student.score}</strong>
        </div>
        <em>已录取 · ${student.className}</em>
      </section>

      <section class="letter-card">
        <div class="letter-ribbon">
          <div class="letter-brand">
            <span class="mini-seal">北</span>
            <strong>北京大学</strong>
            <i></i>
            <strong>CODEMAO</strong>
          </div>
          <p>北大 - 点猫科技人工智能教育联合实验室</p>
          <h3>编程猫英才班</h3>
          <h4>入学邀请函</h4>
        </div>

        <div class="letter-copy">
          <p>经编程猫教学中心审核，${student.detail}</p>
          <strong>${student.className}录取资格</strong>
          <p>${student.advice}</p>
        </div>
      </section>

      <footer class="result-footer-line">
        <span>${queryDate}</span>
        <span>深圳点猫科技有限公司</span>
      </footer>
    </article>
  `;
  resultCard.scrollIntoView({ behavior: "smooth", block: "start" });
}

function renderTeacherDashboard() {
  if (teacherLogin) {
    teacherLogin.hidden = true;
  }

  const doneCount = students.filter((student) => student.queried).length;
  const pendingCount = students.length - doneCount;
  const teacherCount = new Set(students.map((student) => student.teacherName)).size;
  const admittedCount = students.filter((student) => student.admission === "已录取").length;

  teacherDashboard.hidden = false;
  teacherDashboard.innerHTML = `
    <div class="result-head">
      <h2>管理后台</h2>
      <p>当前系统数据与运营状态</p>
    </div>
    <div class="stats-grid">
      <div class="stat-item">
        <span class="stat-value">${students.length}</span>
        <span class="stat-label">学生总数</span>
      </div>
      <div class="stat-item">
        <span class="stat-value">${teacherCount}</span>
        <span class="stat-label">老师数量</span>
      </div>
      <div class="stat-item">
        <span class="stat-value">${admittedCount}</span>
        <span class="stat-label">已录取</span>
      </div>
    </div>

    <div class="admin-grid">
      <section class="admin-tool">
        <div class="admin-tool-head">
          <h3>学生成绩信息</h3>
          <span>批量导入</span>
        </div>
        <p>导入表头固定为：学生姓名、成绩。查询结果页按成绩字段展示。</p>
        <label class="file-field">
          <span>成绩表</span>
          <input type="file" accept=".xls,.xlsx,.csv" />
        </label>
        <button class="secondary-button" type="button">导入学生成绩</button>
      </section>

      <section class="admin-tool">
        <div class="admin-tool-head">
          <h3>老师账号</h3>
          <span>批量导入</span>
        </div>
        <p>导入表头固定为：老师姓名、密码。老师姓名作为登录账号。</p>
        <label class="file-field">
          <span>账号表</span>
          <input type="file" accept=".xls,.xlsx,.csv" />
        </label>
        <button class="secondary-button" type="button">导入老师账号</button>
      </section>
    </div>

    <div class="stats-grid compact-stats">
      <div class="stat-item">
        <span class="stat-value">${doneCount}</span>
        <span class="stat-label">已查询</span>
      </div>
      <div class="stat-item">
        <span class="stat-value">${pendingCount}</span>
        <span class="stat-label">未查询</span>
      </div>
      <div class="stat-item">
        <span class="stat-value">${students.length - admittedCount}</span>
        <span class="stat-label">其他状态</span>
      </div>
    </div>

    <div class="admin-section-title">学生查询状态</div>
    <table class="teacher-list">
      <thead>
        <tr>
          <th>学生</th>
          <th>老师</th>
          <th>结果</th>
          <th>查询状态</th>
        </tr>
      </thead>
      <tbody>
        ${students
          .map(
            (student) => `
              <tr>
                <td>${student.studentName}</td>
                <td>${student.teacherName}</td>
                <td>${student.admission}</td>
                <td class="${student.queried ? "query-done" : "query-pending"}">${student.queried ? "已查询" : "未查询"}</td>
              </tr>
            `
          )
          .join("")}
      </tbody>
    </table>
    <div class="export-panel">
      <div class="export-head">
        <h3>个性化学习方案</h3>
        <span>批量导出</span>
      </div>

      <label class="file-field">
        <span>课程规划文档</span>
        <input id="planDocumentInput" type="file" accept=".doc,.docx" />
      </label>

      <label class="file-field">
        <span>学生信息表</span>
        <input id="studentSheetInput" type="file" accept=".xls,.xlsx,.csv" />
      </label>

      <p class="export-hint">学生信息表格表头固定为：学生姓名、成绩。测试阶段下载 Word 文档，用于确认姓名和综合成绩已替换。</p>
      <button class="secondary-button" id="exportPlansButton" type="button">生成并批量导出</button>
      <div class="export-status" id="exportStatus" hidden></div>
    </div>
  `;
}

async function getExportStudents() {
  const input = document.querySelector("#studentSheetInput");
  const file = input?.files?.[0];

  if (!file || !file.name.toLowerCase().endsWith(".csv")) {
    return students.map((student) => ({
      studentName: student.studentName,
      score: student.score
    }));
  }

  const text = await file.text();
  const rows = text
    .split(/\r?\n/)
    .map((line) => line.split(",").map((cell) => cell.trim()))
    .filter((row) => row.some(Boolean));

  const header = rows.shift() || [];
  const nameIndex = header.indexOf("学生姓名");
  const scoreIndex = header.indexOf("成绩");

  if (nameIndex === -1 || scoreIndex === -1) {
    throw new Error("学生信息表头必须包含：学生姓名、成绩");
  }

  return rows
    .map((row) => ({
      studentName: row[nameIndex],
      score: row[scoreIndex]
    }))
    .filter((student) => student.studentName && student.score);
}

function createPlanDocument(student) {
  const studentName = escapeHtml(student.studentName);
  const score = escapeHtml(student.score);
  const html = `
    <!doctype html>
    <html>
      <head>
        <meta charset="UTF-8">
        <style>
          body { font-family: "Microsoft YaHei", Arial, sans-serif; color: #222; }
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
    </html>
  `;

  return new Blob(["\ufeff", html], { type: "application/msword;charset=utf-8" });
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

async function createZip(files) {
  const localParts = [];
  const centralParts = [];
  let offset = 0;

  for (const file of files) {
    const data = new Uint8Array(await file.blob.arrayBuffer());
    const nameBytes = new TextEncoder().encode(file.name);
    const crc = crc32(data);

    const localHeader = new Uint8Array(30 + nameBytes.length);
    const localView = new DataView(localHeader.buffer);
    localView.setUint32(0, 0x04034b50, true);
    localView.setUint16(4, 20, true);
    localView.setUint16(6, 0x0800, true);
    localView.setUint16(8, 0, true);
    localView.setUint32(14, crc, true);
    localView.setUint32(18, data.length, true);
    localView.setUint32(22, data.length, true);
    localView.setUint16(26, nameBytes.length, true);
    localHeader.set(nameBytes, 30);
    localParts.push(localHeader, data);

    const centralHeader = new Uint8Array(46 + nameBytes.length);
    const centralView = new DataView(centralHeader.buffer);
    centralView.setUint32(0, 0x02014b50, true);
    centralView.setUint16(4, 20, true);
    centralView.setUint16(6, 20, true);
    centralView.setUint16(8, 0x0800, true);
    centralView.setUint16(10, 0, true);
    centralView.setUint32(16, crc, true);
    centralView.setUint32(20, data.length, true);
    centralView.setUint32(24, data.length, true);
    centralView.setUint16(28, nameBytes.length, true);
    centralView.setUint32(42, offset, true);
    centralHeader.set(nameBytes, 46);
    centralParts.push(centralHeader);

    offset += localHeader.length + data.length;
  }

  const centralSize = centralParts.reduce((sum, part) => sum + part.length, 0);
  const endHeader = new Uint8Array(22);
  const endView = new DataView(endHeader.buffer);
  endView.setUint32(0, 0x06054b50, true);
  endView.setUint16(8, files.length, true);
  endView.setUint16(10, files.length, true);
  endView.setUint32(12, centralSize, true);
  endView.setUint32(16, offset, true);

  return new Blob([...localParts, ...centralParts, endHeader], { type: "application/zip" });
}

function crc32(data) {
  let crc = -1;
  for (let i = 0; i < data.length; i += 1) {
    crc = (crc >>> 8) ^ crcTable[(crc ^ data[i]) & 0xff];
  }
  return (crc ^ -1) >>> 0;
}

const crcTable = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i += 1) {
    let c = i;
    for (let k = 0; k < 8; k += 1) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[i] = c >>> 0;
  }
  return table;
})();

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
