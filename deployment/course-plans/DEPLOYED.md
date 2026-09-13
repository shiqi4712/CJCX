# 正式部署记录

部署日期：2026-09-11。服务器：39.96.54.176。域名：plan.bcmty.cn。

## 正式链接

- https://plan.bcmty.cn/course-plan/yucai-rocket
- https://plan.bcmty.cn/course-plan/yucai-preschool
- https://plan.bcmty.cn/course-plan/yingcai-preschool
- https://plan.bcmty.cn/course-plan/kete-moon
- https://plan.bcmty.cn/course-plan/kete-python
- https://plan.bcmty.cn/course-plan/yingcai-python

根路径和后台/API 路径不发布，返回 404。请发送完整课线链接。

## 服务位置

- 应用用户：courseplan（普通系统用户）
- 服务：course-plans.service，已设置开机启动
- 监听：127.0.0.1:3100
- 版本目录：/srv/course-plans/releases/20260911T072601Z
- 当前链接：/srv/course-plans/current
- 源码包：/srv/course-plans/uploads/course-plans-20260911T072601Z.zip
- SHA-256：c5f665b8c84355cfc7d9e26c9da56a8732b1ed0e2298a04178cd0cbfcb22bfe4
- 实际部署配置：/srv/course-plans/deployment（优先于早期源码包内的通用模板）
- Nginx：/etc/nginx/sites-available/course-plans，sites-enabled 同名链接
- 证书：/etc/letsencrypt/live/plan.bcmty.cn/，本次证书有效至 2026-12-10
- 自动续期：系统现有 certbot.timer，webroot 为 /srv/course-plans/acme，续期后校验并平滑重载 Nginx

构建以单独的临时 systemd 服务执行：CPUQuota=80%、MemoryMax=1500M、Nice=15。实际内存峰值约 1008 MiB。应用运行上限为 CPUQuota=100%、MemoryHigh=600M、MemoryMax=800M；无须升级服务器现有 Node.js 或系统包。

## 已完成验证

五个正式 HTTPS 路由和40项页面资源通过，HTTP 自动跳转 HTTPS。五条课线浏览器交互通过，320/390/817像素视口截图完成。旧站点 bcmty.cn、yycl.bcmty.cn、guihua.bcmty.cn、mh.bcmty.cn 均返回 200；已有配置文件 SHA-256 与应用进程保持一致，Nginx 仅平滑重载，主进程未重启。

对不存在的动态路由做404验收时，Next.js 16.2.7 会记录 NoFallbackError；响应为预期的404，五个有效课线未出现该错误。

## 维护

```sh
systemctl status course-plans --no-pager
journalctl -u course-plans -n 100 --no-pager
node /srv/course-plans/current/scripts/verify-course-plans.mjs https://plan.bcmty.cn
```

后续发布应新建版本目录并限制构建资源，构建成功后切换 current 链接，仅重启 course-plans。当前是首次发布，没有上一个应用版本可回退；需要下线时仅停用 course-plans，并取消本专用 Nginx 站点链接，校验后平滑重载。不要修改其他站点或重启服务器。

本次使用的 plan-bcmty-deployment-20260911 公钥仅供临时部署，验收后从服务器授权文件精确移除；后续维护需要重新取得 SSH 授权。
