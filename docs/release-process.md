# Release Process

The project is still pre-1.0. Releases should remain simple and auditable.

## Versioning

Use semantic versioning:

- Patch: bug fixes, docs, internal improvements.
- Minor: new analyzers, adapters, UI flows, or report formats.
- Major: breaking API, schema, or report format changes.

Before `1.0.0`, minor versions may contain breaking changes, but they must be called out in `CHANGELOG.md`.

## Release Checklist

- [ ] `pnpm typecheck`
- [ ] `pnpm test`
- [ ] `pnpm lint`
- [ ] `pnpm build`
- [ ] Update `CHANGELOG.md`
- [ ] Confirm `.env` files and private data are not tracked
- [ ] Tag the release

## Tag Format

```text
v0.1.0
v0.2.0
v1.0.0
```

## Changelog Style

Use sections:

- Added
- Changed
- Fixed
- Security
- Docs

Keep entries user-facing and concise.

