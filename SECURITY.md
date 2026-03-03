# Security Policy

## Supported Scope

This repository is a prototype and not production banking software.
Security reports are still welcome for:
- credential leakage
- unsafe data handling
- unsafe filesystem behavior in API routes
- dependency vulnerabilities affecting this codebase

## Reporting a Vulnerability

Please report issues privately to the project maintainers.
Include:
- affected file(s)
- reproduction steps
- expected vs observed behavior
- potential impact

Do not open public issues for suspected secrets or exploit paths.

## Response Expectations

- Initial acknowledgement: within 3 business days
- Triage and severity assessment: within 7 business days
- Fix timeline: based on severity and reproducibility

## Handling Secrets

- Never commit `.env*` files with real values.
- Use `.env.example` placeholders only.
- Run `npm run security:scan` before opening pull requests.
