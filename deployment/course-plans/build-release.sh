#!/usr/bin/env bash
set -euo pipefail
cd /srv/course-plans/releases/20260911T072601Z
export NEXT_TELEMETRY_DISABLED=1
export CIRCLE_NODE_TOTAL=1
export NODE_OPTIONS=--max-old-space-size=1024
export npm_config_cache=/srv/course-plans/npm-cache
npm ci --no-audit --no-fund
npm test
npm run build
