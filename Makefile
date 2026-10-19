.PHONY: install dev build test smoke clean

install:
	npm ci

dev:
	npm run dev

build:
	npm run build

# The test harness owns an ephemeral API server and a fresh SQLite database, so
# this works on a clean machine without a running service or network access.
test:
	npm run typecheck
	npm run build
	node scripts/test.mjs
	node scripts/encscan.mjs

smoke:
	npm run smoke

clean:
	node -e "require('node:fs').rmSync('dist',{recursive:true,force:true})"
