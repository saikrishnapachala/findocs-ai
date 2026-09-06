.PHONY: dev build start test lint typecheck eval query seed clean

dev: ## Run the dev server
	npm run dev

build: ## Production build
	npm run build

start: ## Start the production server
	npm run start

test: ## Run unit tests
	npm test

lint: ## Lint
	npm run lint

typecheck: ## Typecheck
	npm run typecheck

eval: ## Run the eval harness (writes evals/results/<date>.json)
	npm run eval

query: ## Retrieval CLI, e.g. make query q="What was total revenue?"
	npm run query -- "$(q)"

clean: ## Remove build + install artifacts
	rm -rf .next node_modules
