# Makefile helpers for date-calculator

.DEFAULT_GOAL := help

SERVICE ?= date_calculator

help: ## Show available targets
	@grep -E '^[a-zA-Z_-]+:.*?## ' $(MAKEFILE_LIST) | awk 'BEGIN {FS=":.*?## "}; {printf "\033[36m%-15s\033[0m %s\n", $$1, $$2}'

build: ## Build Docker images
	docker compose build

rebuild: ## Build without cache
	docker compose build --no-cache

up: ## Start stack in foreground
	docker compose up

up-d: ## Start stack detached
	docker compose up -d

down: ## Stop and remove containers, networks
	docker compose down --remove-orphans

restart: ## Restart stack (detached)
	$(MAKE) down
	$(MAKE) up-d

fresh: ## Rebuild without cache and start detached
	docker compose down --remove-orphans || true
	docker compose build --no-cache
	docker compose up -d

logs: ## Follow service logs
	docker compose logs -f $(SERVICE)

ps: ## Show compose processes
	docker compose ps

sh: ## Open a shell in a throwaway container
	docker compose run --rm $(SERVICE) sh

health: ## Check Flask health endpoint
	curl -sf http://localhost:5000/health || true

open: ## Open app in browser (macOS/Linux)
	@if command -v open >/dev/null 2>&1; then \
		open http://localhost:3000/; \
	elif command -v xdg-open >/dev/null 2>&1; then \
		xdg-open http://localhost:3000/; \
	else \
		echo "Open http://localhost:3000/ in your browser"; \
	fi


