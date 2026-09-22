# 五个查询入口部署

使用现有 bcmty.cn 域名和 HTTPS 证书，无需通配符证书或新增 DNS。之前创建的五条 DNS 记录不参与路径入口功能。

| 链接 | 查询范围 |
| --- | --- |
| https://bcmty.cn/entry/pyyingcai | Python 英才班 |
| https://bcmty.cn/entry/yeyingcai | 幼儿英才班 |
| https://bcmty.cn/entry/pykete | Python 非英才班 |
| https://bcmty.cn/entry/tykete | 探月 |
| https://bcmty.cn/entry/yucai | 小火箭 |
| https://bcmty.cn/entry/bpython | B端 Python 英才班 |
| https://bcmty.cn/entry/bmoon | B端探月英才班 |
| https://bcmty.cn/entry/brocket | B端小火箭英才班 |

家长仍只输入姓名。查询页到结果页通过 entry 参数保留入口，查询 API 校验固定入口映射；规划页面携带入口，返回成绩或查询页时继续保留。预约按成绩返回的学生 ID 保存，不重新按姓名查找。无效路径返回 404，无效 API 入口返回 400。

B端三个入口只切换赛考规划、学习规划和上课时间三张物料图；班级介绍、教学服务、课程大纲等其他物料不进入用户查询流程。

根域名首页保留旧的全名单查询，发放新链接才能隔离。入口用于名单匹配，不是身份验证。同一范围内历史重名仍取最早发布记录。

后台继续使用 /admin，表头不变。导入按姓名、课线、最终班型匹配并更新老师；不同课线或班型分别保留。同范围重名不额外区分。

## 上线

1. 先创建 RDS 备份，并在测试数据库验证索引迁移。应用初始化先创建含课线和班型的新唯一索引，再删除旧姓名/老师唯一限制，不删除历史记录。为兼容历史重名，新索引仍含老师字段。
2. 推送代码后，在 /var/www/cjcx 拉取 codex/day2，执行 npm ci、npm run typecheck、npm test、npm run build。全部成功后执行 pm2 restart cjcx --update-env 和 pm2 save。不要使用 git reset --hard 覆盖服务器修改。
3. 现有 Nginx 的 location / 若已代理到 Next.js，无需修改；若使用路径白名单，需要放行 /entry/。保持 proxy_set_header Host $host。
4. 验证五个入口分别查询同名测试学生，核对成绩、规划物料、预约学生 ID、返回查询入口以及审核记录。

内存模式自动测试不能替代真实 RDS 索引迁移验收。现有根域名证书继续按期续期。
