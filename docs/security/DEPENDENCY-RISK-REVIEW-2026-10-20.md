# HCMS Backend — Dependency Risk Review

**Review date:** 2026-10-20
**Branch:** `fix/sprint8-backend-readiness`
**Scope:** npm dependency advisories and current repository execution paths

## Residual advisory

`npm audit` reports three High findings for one development-only advisory chain:

`nodemon@3.1.14` → `chokidar@3.6.0` → `braces@3.0.3`

The root advisory is [GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm), **CVE-2026-93687**. It affects `braces` versions through `3.0.3`; the advisory lists no patched version. The issue is uncontrolled recursion on deeply nested brace patterns, which can exhaust the Node.js call stack. npm repeats the finding through `chokidar` and `nodemon`; these are not three distinct root vulnerabilities.

## HCMS exposure assessment

The lockfile marks `nodemon`, `chokidar`, and `braces` as development dependencies. The application API does not pass request data to these packages. In the current project, `nodemon` is invoked only by `npm run dev`; the production script is `npm start`, which runs `node src/server.js`. Swagger's `glob` usage has a fixed repository path and is not the `braces` package affected by this advisory.

A local developer or automation that can control the brace patterns processed by the development watcher could potentially trigger the denial of service. No API-reachable or production-runtime path to this `braces` instance was identified. The repository contains no Docker, CI/CD, or hosting deployment configuration, so the actual external hosting command cannot be verified from source. A production install simulation using `npm ci --omit=dev` installed `express` and did not install `nodemon`.

This assessment is conditional on production being installed with development dependencies omitted and launched through `npm start`. Confirm those settings in the hosting platform before deployment.

## Actions taken

- Updated `proxy-addr` from `2.0.7` to patched `2.0.8` in `package-lock.json`, addressing [GHSA-jqcg-44mw-7w3h / CVE-2026-90711](https://github.com/advisories/GHSA-jqcg-44mw-7w3h). The affected version range is `>=1.1.0 <2.0.8`. The current application has no `trust proxy` setting; the advisory's spoofing condition requires a misconfigured trusted-proxy subnet.
- Updated `brace-expansion` from `5.0.9` to `5.0.12` in `package-lock.json`, addressing the reported advisories for that package.
- Kept `nodemon` and the development workflow unchanged. Did not use `npm audit fix --force` or downgrade `nodemon`; npm's suggested `1.14.10` downgrade is a major version regression and does not represent a suitable remediation.
- No patched `braces` release is listed as of this review. Reassess this chain when upstream publishes a fix or when the development watcher dependency changes through a separately reviewed decision.

## Verification and residual risk

- `npm ci`: passed against the updated lockfile.
- `npm ci --omit=dev` simulation: passed; `express` present, `nodemon` absent.
- `npm test`: 426 passed, 0 failed. The test runner applied all 25 migrations to a newly created temporary database and dropped that database after the run.
- OpenAPI validation: passed through the automated contract test.
- `npm audit --omit=dev`: 0 vulnerabilities.
- `npm audit`: 3 High findings remain, all repeated paths to the same development-only `braces` advisory above; no Critical findings remain.
- `git diff --check`: passed.

The development-only advisory remains a known risk and means the full dependency audit is not clean. This review is not a claim that the application is fully secure; it records why the current residual finding is not reachable through the HCMS API or the verified production-install path, and what must be checked in the external deployment environment.
