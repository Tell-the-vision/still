#!/bin/sh
# Run a command with the Cloudflare token from the repo .env (key CLOUDFLARE) exposed as
# CLOUDFLARE_API_TOKEN, which wrangler reads. Values are never printed.
#   ./cf.sh npx wrangler deploy
# ENV_FILE defaults to the main checkout's .env (worktrees do not have one).
ENV_FILE="${ENV_FILE:-/Users/phihu/Desktop/still/.env}"
get() { /usr/bin/python3 -I -c 'import sys
for l in open(sys.argv[1]):
    k,_,v=l.strip().partition("=")
    if k==sys.argv[2]: print(v.strip().strip("\"\x27")); break' "$ENV_FILE" "$1"; }
CLOUDFLARE_API_TOKEN="$(get CLOUDFLARE)" exec "$@"
