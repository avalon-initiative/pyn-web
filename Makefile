-include .env
export

RUN_DIR := _running
PID_DIR := $(RUN_DIR)/pids
LOG_DIR := $(RUN_DIR)/logs
PID_FILE := $(PID_DIR)/pyn-web.pid
LOG_FILE := $(LOG_DIR)/pyn-web.log

.PHONY: install help build run start stop restart status test fmt fmt-check lint boundary-check check clean release-checks release release-skip-tests

install:
	npm install

help:
	@echo "pyn-web — local dev commands"
	@echo ""
	@echo "  make build         build the project"
	@echo "  make run           run in the foreground"
	@echo "  make start         run in the background (pid/log under $(RUN_DIR)/)"
	@echo "  make stop          stop what 'make start' started"
	@echo "  make restart       stop, then start"
	@echo "  make status        report whether the background process is running"
	@echo "  make test          run the test suite"
	@echo "  make fmt           auto-format"
	@echo "  make fmt-check     format check, no writes"
	@echo "  make lint          linter, type check and public-boundary check"
	@echo "  make boundary-check  fail on private references or secrets in tracked files"
	@echo "  make check         fmt-check + lint + test — what CI runs"
	@echo "  make release VER=x.y.z TITLE=...  run release checks, bump version, commit, tag (docs/releasing.md)"
	@echo "  make clean         remove build artifacts and PID/log files"

build:
	npm run build

run:
	npm run dev

# PID-file background run; only `run` is per-stack.
start:
	@mkdir -p $(PID_DIR) $(LOG_DIR)
	@if [ -f $(PID_FILE) ] && kill -0 "$$(cat $(PID_FILE))" 2>/dev/null; then \
		echo "already running (pid $$(cat $(PID_FILE)))"; \
	else \
		( $(MAKE) run > $(LOG_FILE) 2>&1 & echo $$! > $(PID_FILE) ); \
		sleep 1; \
		echo "started (pid $$(cat $(PID_FILE))), logs: $(LOG_FILE)"; \
	fi

stop:
	@if [ -f $(PID_FILE) ] && kill -0 "$$(cat $(PID_FILE))" 2>/dev/null; then \
		kill "$$(cat $(PID_FILE))"; \
		rm -f $(PID_FILE); \
		echo "stopped"; \
	else \
		echo "not running"; \
		rm -f $(PID_FILE); \
	fi

restart: stop start

status:
	@if [ -f $(PID_FILE) ] && kill -0 "$$(cat $(PID_FILE))" 2>/dev/null; then \
		echo "running (pid $$(cat $(PID_FILE)))"; \
	else \
		echo "not running"; \
	fi

test:
	npm test

fmt:
	npm run format

fmt-check:
	npm run format:check

lint:
	npm run lint && npm run typecheck
	python3 scripts/check_public_boundary.py

boundary-check:
	python3 scripts/check_public_boundary.py

check: fmt-check lint test

clean:
	rm -rf dist
	rm -rf $(RUN_DIR)

release-checks:
	bash scripts/release-checks.sh

# Usage: make release VER=0.1.0 TITLE="Some title". Tag is v<VER>[-<title-slug>].
# Runs the checks first (no changes if they fail), bumps package.json/package-lock.json, commits, tags.
release:
	@set -euo pipefail; \
	if [ "$(SKIP_CHECKS)" = "1" ]; then \
		echo "release: skipping pre-release checks (SKIP_CHECKS=1) -- only use this if you already ran and passed them"; \
	else \
		echo "release: running pre-release checks (scripts/release-checks.sh)"; \
		if ! bash scripts/release-checks.sh; then \
			echo "release: pre-release checks failed -- nothing was changed, fix and re-run 'make release'"; \
			exit 1; \
		fi; \
	fi; \
	ver="$(strip $(VER))"; \
	current_ver="$$(node -p 'require("./package.json").version')"; \
	if [ -z "$$ver" ]; then \
		read -r -p "Release version (current: $$current_ver): " ver; \
		if [ -z "$$ver" ]; then ver="$$current_ver"; fi; \
	fi; \
	if ! [[ "$$ver" =~ ^[0-9]+\.[0-9]+\.[0-9]+$$ ]]; then \
		echo "release: invalid VER '$$ver' (expected X.Y.Z)"; \
		exit 1; \
	fi; \
	title="$(strip $(TITLE))"; \
	if [ -z "$$title" ] && [ -t 0 ]; then \
		read -r -p "Release title (optional): " title; \
	fi; \
	title_slug="$$(printf '%s' "$$title" | sed -E 's/[[:space:]]+/-/g; s/[^A-Za-z0-9._-]//g; s/^-+//; s/-+$$//')"; \
	tag_name="v$$ver"; \
	if [ -n "$$title_slug" ]; then \
		tag_name="$$tag_name-$$title_slug"; \
	fi; \
	echo "release: tag='$$tag_name' version='$$ver'"; \
	if git rev-parse -q --verify "refs/tags/$$tag_name" >/dev/null; then \
		echo "release: git tag '$$tag_name' already exists"; \
		exit 1; \
	fi; \
	npm version --no-git-tag-version --allow-same-version "$$ver" >/dev/null; \
	git add -- package.json package-lock.json; \
	if git diff --cached --quiet -- package.json package-lock.json; then \
		echo "release: no version changes to commit (continuing with tag)"; \
	else \
		git commit -m "Release $$tag_name"; \
	fi; \
	git tag -a "$$tag_name" -m "$$tag_name"; \
	echo "release done: $$tag_name"; \
	echo "Next: land the version bump on main by PR, then push the tag on the merged commit (docs/releasing.md)"

release-skip-tests: SKIP_CHECKS=1
release-skip-tests: release
