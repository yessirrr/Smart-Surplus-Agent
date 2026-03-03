# Contributing

## Development Setup

1. Install dependencies:
```bash
npm install
```
2. Start dev server:
```bash
npm run dev
```

## Quality Gate

Before opening a pull request:
```bash
npm run preflight
```

This runs typecheck, lint, and a lightweight secret scan.

## Contribution Guidelines

- Keep changes small and focused.
- Preserve deterministic behavior in `lib/domain/*`.
- Add or update tests for domain logic changes.
- Avoid unrelated refactors in feature PRs.
- Do not commit local artifacts (`.env`, logs, cache files).

## Pull Request Checklist

- [ ] Scope is minimal and reviewable
- [ ] Typecheck passes
- [ ] Lint passes
- [ ] Secret scan passes
- [ ] Documentation updated when behavior changes

## Code of Conduct

Use respectful, professional communication in all project channels.
