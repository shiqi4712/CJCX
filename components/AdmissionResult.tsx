export type QueryResult = {
  studentName: string;
  score: string;
  admissionResult: string;
  recommendedClass: string;
  admissionDetail: string;
  advice: string;
  queryDate: string;
};

export function AdmissionResult({ result }: { result: QueryResult }) {
  const admitted = result.admissionResult === "已录取";

  return (
    <section className={`certificate ${admitted ? "" : "not-admitted"}`}>
      <div className="certificate-frame">
        <header className="certificate-title">
          <span />
          <h2>{admitted ? "录取结果" : "查询结果"}</h2>
          <span />
        </header>

        <div className="student-display">
          <p>{admitted ? "恭喜" : "亲爱的"}</p>
          <strong>{result.studentName}</strong>
          <em>{admitted ? "同学获得英才班录取资格" : "同学暂未获得本次录取资格"}</em>
        </div>

        <div className="score-display">
          <span>学生成绩</span>
          <strong>{result.score}</strong>
          <i>
            {result.admissionResult} · {result.recommendedClass}
          </i>
        </div>

        <article className="invitation">
          <div className="invitation-head">
            <img src="/images/lab-logo-white.png" alt="北大-点猫科技人工智能教育联合实验室" />
            <p>北大 - 点猫科技人工智能教育联合实验室</p>
            <h3>{admitted ? "编程猫英才班" : "编程猫学习建议"}</h3>
            <h4>{admitted ? "入学邀请函" : "继续加油"}</h4>
          </div>
          <div className="invitation-body">
            <p>
              {admitted ? "经编程猫教学中心审核，" : ""}
              {result.admissionDetail}
            </p>
            <strong>{admitted ? `${result.recommendedClass}录取资格` : "期待下一次突破"}</strong>
            <p>{result.advice}</p>
          </div>
        </article>

        <footer className="certificate-footer">
          <span>{result.queryDate}</span>
        </footer>
      </div>
    </section>
  );
}
