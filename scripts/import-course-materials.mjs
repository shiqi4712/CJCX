import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const source = process.argv[2];
if (!source) throw new Error("Pass the source material directory as the first argument.");
const files = [
  ["kete-python", "科特班——python", "11、科特班-课程大纲.jpg", "syllabus"],
  ["kete-python", "科特班——python", "赛考规划.png", "goals"],
  ["kete-python", "科特班——python", "Python科特班-主课学习时间表.png", "schedule"],
  ["yucai-preschool", "育才班——幼儿", "小火箭幼儿编程大纲_2MB.jpeg", "syllabus"],
  ["yucai-preschool", "育才班——幼儿", "赛考目标.png", "goals"],
  ["yucai-preschool", "育才班——幼儿", "赛考目标1.png", "goals-outcomes"],
  ["yucai-rocket", "育才班—火箭", "课程大纲.jpg", "syllabus"],
  ["yucai-rocket", "育才班—火箭", "育才班-阶段学习规划图.png", "goals"],
  ["yucai-rocket", "育才班—火箭", "育才班-主课时间安排表 (1).png", "schedule"],
  ["yingcai-python", "英才班", "Python英才班-课程大纲.jpg", "syllabus"],
  ["yingcai-python", "英才班", "赛考规划.png", "goals"],
  ["yingcai-python", "英才班", "英才班-主课学习时间安排表.jpg", "schedule"]
];

for (const [profile, folder, filename, asset] of files) {
  const output = path.resolve("public/images/course-plan", profile);
  await fs.mkdir(output, { recursive: true });
  const info = await sharp(path.join(source, folder, filename))
    .rotate().resize({ width: 1600, withoutEnlargement: true })
    .webp({ quality: 88 }).toFile(path.join(output, `${asset}.webp`));
  console.log(`${profile}/${asset}.webp ${info.width}x${info.height} ${info.size} bytes`);
}
