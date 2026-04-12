.PHONY: ci lint test dev build

ci: lint test

lint:
	npm run lint

test:
	npm test

dev:
	npm run dev

build:
	npm run build
