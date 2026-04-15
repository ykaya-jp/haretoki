.PHONY: ci lint typecheck test test-e2e build prisma-validate prisma-generate dev

# CI: run all checks (mirrors what GitHub Actions does)
ci: lint typecheck prisma-validate test build

lint:
	npm run lint

typecheck:
	npx tsc --noEmit

test:
	npm test

test-e2e:
	npx playwright test

build:
	npm run build

prisma-validate:
	npx prisma validate

prisma-generate:
	npx prisma generate

dev:
	npm run dev
