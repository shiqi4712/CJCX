#!/usr/bin/env bash
set -euo pipefail
curl -fsS -o /dev/null http://127.0.0.1:3100/course-plan/kete-moon
test -f /etc/letsencrypt/live/plan.bcmty.cn/fullchain.pem
cmp /srv/course-plans/deployment/nginx-bootstrap.conf /etc/nginx/sites-available/course-plans
install -m 644 /srv/course-plans/deployment/nginx.conf /etc/nginx/sites-available/course-plans
if ! nginx -t; then
  install -m 644 /srv/course-plans/deployment/nginx-bootstrap.conf /etc/nginx/sites-available/course-plans
  exit 1
fi
systemctl reload nginx
curl --retry 5 --retry-all-errors --retry-delay 1 -fsS --resolve plan.bcmty.cn:443:127.0.0.1 -o /dev/null https://plan.bcmty.cn/course-plan/kete-moon
node /srv/course-plans/current/scripts/verify-course-plans.mjs https://plan.bcmty.cn
