# Commit Convention

Use clear, small commits that describe one logical change.

## Format

Use a lightweight Conventional Commits style:

```text
type(scope): summary
```

The scope is optional.

Examples:

```text
feat(core): add graph builder
fix(adapters): handle empty csv rows
docs: add analysis guidelines
test(analyzers): cover direct transfers
chore: update local compose config
```

## Types

- `feat`: user-visible feature or new project capability.
- `fix`: bug fix.
- `docs`: documentation-only change.
- `test`: tests or fixtures.
- `refactor`: code change that does not alter behavior.
- `chore`: tooling, config, repository maintenance.
- `ci`: continuous integration changes.
- `perf`: performance improvement.

## Rules

- Use imperative mood: `add`, `fix`, `update`, `remove`.
- Keep the summary under 72 characters when practical.
- Do not mix unrelated changes in one commit.
- Mention privacy, data model, or analysis semantics in the body when relevant.
- Never commit secrets, private wallet data, or real `.env` files.

## Suggested Commit Body

Use a body when the change is not obvious:

```text
feat(core): add shared counterparty analyzer

Adds a first-pass shared counterparty rule. The analyzer treats public
contracts as weak evidence and keeps transaction hashes in each finding.
```

