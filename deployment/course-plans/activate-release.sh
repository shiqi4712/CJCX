#!/usr/bin/env bash
set -euo pipefail
test -f /srv/course-plans/releases/20260911T072601Z/.next/BUILD_ID
test ! -e /srv/course-plans/current
test ! -e /etc/systemd/system/course-plans.service
if ss -ltnH 'sport = :3100' | grep -q .; then
  echo 'Port 3100 is occupied; activation stopped.' >&2
  exit 1
fi
ln -s /srv/course-plans/releases/20260911T072601Z /srv/course-plans/current
systemd-analyze verify /srv/course-plans/deployment/course-plans.service
install -m 644 /srv/course-plans/deployment/course-plans.service /etc/systemd/system/course-plans.service
systemctl daemon-reload
systemctl enable --now course-plans
curl --retry 8 --retry-connrefused --retry-delay 1 -fsS -o /dev/null http://127.0.0.1:3100/course-plan/kete-moon
node /srv/course-plans/current/scripts/verify-course-plans.mjs http://127.0.0.1:3100
