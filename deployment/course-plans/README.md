# 五条课线部署

同一套 Next.js 应用提供五个固定链接，无需学生姓名或查询参数。Demo2 对应科特班探月。

一个展示子域名即可，例如 `plan.example.com`，无需为五条课线创建五个子域名。

| 版本 | 路径 |
| --- | --- |
| 育才班·火箭 | /course-plan/yucai-rocket |
| 育才班·幼儿 | /course-plan/yucai-preschool |
| 英才班·幼儿 | /course-plan/yingcai-preschool |
| 科特班·探月 | /course-plan/kete-moon |
| 科特班·Python | /course-plan/kete-python |
| 英才班·Python | /course-plan/yingcai-python |

## 内容维护

`lib/course-plan-profiles.ts` 管理首页班名、课程大纲、目标和时间表。共同页面与动效由 `components/CoursePlanViewer.tsx` 管理。育才班目标标题统一为“学习目标”；幼儿版保留两张目标图，按用户确认与火箭版共用时间表。图片已存入 `public/images/course-plan/`，服务器不依赖本地桌面文件。

更新原始物料后，可在项目根目录执行 `node scripts/import-course-materials.mjs "物料文件夹路径"` 生成 WebP。若图片比例改变，同时更新配置中的宽高；新增目标海报需加入 `goals.images` 数组。不同物料不要复用同一资源文件名，以免旧缓存影响显示。

## 生成发布包

在原项目运行 `node scripts/package-course-plans.mjs`。它将当前未提交修改一并打包到 `dist/course-plans-时间戳.zip`，并生成 SHA-256 校验文件。包内仅包含五课线展示所需源码、依赖锁文件、物料、检查脚本和部署配置，不含查询接口、后台页面、学生数据、环境密钥或本机依赖。Demo2 只保留在开发项目，正式发布使用五个固定路径。

包内 `release-manifest.json` 记录每个源文件的 SHA-256。发布包是在 Ubuntu 上安装依赖和构建的源码包；不要直接上传本机 Windows 构建产物。物料导入和打包脚本在原项目维护，服务器使用已生成的物料。成绩查询系统的正式更新应使用项目完整仓库部署流程，不要使用这个仅规划展示的精简发布包。

## Ubuntu 部署步骤

推荐使用已有域名的独立子域名，例如 `courses.example.com`。将该子域名 A 记录指向阿里云服务器公网 IP，安全组开放 80、443。安装 Node.js 22 LTS、npm、Nginx。服务器上安装依赖并构建，不上传 Windows 的 `node_modules` 或 `.next`。

1. 创建专用系统用户 `courseplan`。上传 ZIP 及其 `.sha256` 校验文件，执行 `sha256sum -c 文件名.zip.sha256` 后解压到独立版本目录 `/srv/course-plans/releases/版本号`，该目录应归 `courseplan` 所有。本展示功能无需数据库、账号登录或环境密钥。
2. 在该目录以 `courseplan` 用户运行：

   ```sh
   npm ci
   npm run typecheck
   npm test
   npm run build
   ```

3. 构建成功后将 `/srv/course-plans/current` 链接到版本目录。核对 `command -v node`，据此修改 `course-plans.service` 的 `/usr/bin/node`。将服务文件安装到 `/etc/systemd/system/course-plans.service`，执行 `sudo systemctl daemon-reload`、`sudo systemctl enable --now course-plans`。在项目目录运行 `node scripts/verify-course-plans.mjs http://127.0.0.1:3100` 检查页面和物料。
4. 替换 `nginx.conf` 的示例域名，将它作为独立站点配置安装。先运行 `sudo nginx -t`，通过后 reload Nginx。此配置仅公开五个展示路由和物料，不公开现有项目中的管理后台、查询页及 API。
5. 为该域名安装 HTTPS 证书，例如使用 Certbot 的 Nginx 插件。执行 `node scripts/verify-course-plans.mjs https://实际域名`，并逐一检查五个 HTTPS 链接、目标图片及手机翻页。国内用户加载不到 Google Fonts 时会使用页面配置的本机中文字体。

当前配置是部署模板，尚未连接或修改服务器。实际安装前需取得域名、服务器 SSH 地址/用户及现有站点情况；若域名已有其他站点，使用独立子域名可避免覆盖。

## 更新与回退

保留上一个版本目录。先在新的版本目录安装依赖并构建成功，再更新服务的工作目录或 `current` 链接并重启 `course-plans`。检查五个页面后完成发布；异常时切回上一版本并重启。用 `journalctl -u course-plans -n 100` 查看运行日志。不要在运行目录中直接删除 `.next` 后重建。
