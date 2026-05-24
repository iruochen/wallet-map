# Security Policy

## Supported Versions

This project is pre-1.0. Security fixes apply to the latest commit on `main` unless a release branch is created later.

## Reporting A Vulnerability

Please do not publish vulnerability details before maintainers have time to review and respond.

Report issues privately to the maintainer when possible. Until a dedicated security contact is configured, open a private maintainer discussion or contact the repository owner directly.

Relevant issues include:

- leaked secrets or unsafe defaults
- private wallet data exposure
- server-side request forgery
- unsafe file import/export behavior
- dependency vulnerabilities with a practical exploit path
- behavior that could mislead users about evidence or confidence

## Project Security Boundaries

Wallet Map must not:

- ask for private keys or seed phrases
- sign transactions
- automate wallet actions
- store real API keys in the repository
- upload wallet address sets by default

