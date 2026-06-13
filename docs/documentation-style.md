# Documentation Style

Documentation should help future contributors make good decisions without needing private context.

## Principles

- Write for maintainers and contributors, not only current authors.
- Prefer concrete examples over abstract descriptions.
- Explain project boundaries clearly.
- Keep analysis language careful and evidence-based.
- Update docs in the same change that updates behavior.

## Structure

Use short sections with descriptive headings.

Preferred order:

1. Purpose.
2. Rules or behavior.
3. Examples.
4. Operational notes.

## Language

Maintain public repository docs in English and Chinese. English remains the primary cross-project reference language; Chinese counterparts should communicate the same capability boundaries, safety posture, and operational requirements without informal wording.

## Analysis Wording

Avoid certainty where the data does not justify it.

Prefer:

- “relationship signal”
- “direct transfer found”
- “shared counterparty”
- “requires review”

Avoid:

- “same owner”
- “proves identity”
- “safe from detection”
- “bypass”

## Examples And Fixtures

Examples should be:

- synthetic or public
- small enough to inspect
- free of secrets
- labelled when simplified

Do not include private wallet lists, API keys, screenshots containing secrets, or private investigation notes.
