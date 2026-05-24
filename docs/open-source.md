# Open Source Guidelines

## Project Boundary

Wallet Map is intended for:

- personal chain-footprint audits
- wallet relationship research
- compliance-friendly investigation
- open-source education around on-chain graph analysis

Wallet Map is not intended for:

- private key handling
- transaction signing
- automated wallet operations
- evasion of platform rules
- bulk abuse or spam workflows

## Privacy

Default to local-first behavior.

- Do not upload address sets by default.
- Do not log API keys.
- Do not store private secrets in fixtures.
- Keep exports user-controlled.
- Offer redaction for reports before sharing.

## Documentation Tone

Documentation should be practical and calm.

- Explain what the tool can and cannot infer.
- Keep examples reproducible.
- Label synthetic data clearly.
- Avoid claims that overstate certainty.

## Contribution Expectations

Contributions should:

- Respect package boundaries.
- Include tests for new behavior.
- Avoid unrelated refactors.
- Keep fixtures small and inspectable.
- Update docs when behavior changes.

## Security Reporting

Follow the repository [Security Policy](../SECURITY.md). Until a dedicated security contact exists, open a private discussion with the maintainer before publishing details about vulnerabilities, leaked secrets, or unsafe defaults.
