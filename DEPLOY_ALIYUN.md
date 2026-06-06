# 阿里云 Ubuntu 部署清单

## 当前资源

- 服务器系统：`Ubuntu 24.04`
- 服务器公网 IP：`39.96.54.176`
- 数据库地址：`pgm-2ze68z6e07s8j7h7.pg.rds.aliyuncs.com`
- 数据库端口：`5432`
- 数据库账号：`cjcx_app`
- OSS Bucket：`cjcx-files-beijing`
- OSS Endpoint：`oss-cn-beijing.aliyuncs.com`

## 环境变量

```bash
DATABASE_URL="postgres://cjcx_app:REPLACE_PASSWORD@pgm-2ze68z6e07s8j7h7.pg.rds.aliyuncs.com:5432/cjcx"
SESSION_SECRET="REPLACE_WITH_LONG_RANDOM_SECRET"
OSS_REGION="cn-beijing"
OSS_ENDPOINT="oss-cn-beijing.aliyuncs.com"
OSS_BUCKET="cjcx-files-beijing"
OSS_ACCESS_KEY_ID="REPLACE_ME"
OSS_ACCESS_KEY_SECRET="REPLACE_ME"
UPSTASH_REDIS_REST_URL=""
UPSTASH_REDIS_REST_TOKEN=""
NODE_ENV="production"
PORT="3000"
```

注意：

- 如果数据库密码里包含 `@`，要改成 `%40`
- `SESSION_SECRET` 建议用下面命令生成：

```bash
openssl rand -base64 32
```

## 服务器初始化

```bash
sudo apt update
sudo apt install -y nginx git curl
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs
sudo npm install -g pm2
node -v
npm -v
pm2 -v
```

## 项目部署

```bash
cd /var/www
sudo mkdir -p cjcx
sudo chown -R $USER:$USER /var/www/cjcx
cd /var/www/cjcx
git clone https://github.com/shiqi4712/CJCX.git .
npm install
```

创建生产环境变量文件：

```bash
cat > .env.local <<'EOF'
DATABASE_URL=postgres://cjcx_app:REPLACE_PASSWORD@pgm-2ze68z6e07s8j7h7.pg.rds.aliyuncs.com:5432/cjcx
SESSION_SECRET=REPLACE_WITH_LONG_RANDOM_SECRET
OSS_REGION=cn-beijing
OSS_ENDPOINT=oss-cn-beijing.aliyuncs.com
OSS_BUCKET=cjcx-files-beijing
OSS_ACCESS_KEY_ID=REPLACE_ME
OSS_ACCESS_KEY_SECRET=REPLACE_ME
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
NODE_ENV=production
PORT=3000
EOF
```

首次构建与启动：

```bash
npm run test
npm run typecheck
npm run build
pm2 start npm --name cjcx -- start
pm2 save
pm2 startup
```

## Nginx 反向代理

```bash
sudo tee /etc/nginx/sites-available/cjcx > /dev/null <<'EOF'
server {
    listen 80;
    server_name _;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
EOF

sudo ln -sf /etc/nginx/sites-available/cjcx /etc/nginx/sites-enabled/cjcx
sudo nginx -t
sudo systemctl restart nginx
sudo systemctl enable nginx
```

## 更新发布

```bash
cd /var/www/cjcx
git pull
npm install
npm run build
pm2 restart cjcx
```

## 验收检查

```bash
pm2 status
curl http://127.0.0.1:3000
sudo systemctl status nginx
```

业务侧手工验收：

- 管理员登录
- 导入老师账号
- 导入学生成绩
- 家长姓名查询
- 老师只看自己学生
- 课程方案 ZIP 导出
