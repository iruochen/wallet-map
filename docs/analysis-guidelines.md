# Analysis Guidelines

## Purpose

The tool should help users understand visible on-chain relationships between wallets.

It should not provide instructions for evading platform rules, automating abusive behavior, or hiding activity from detection systems.

## Analysis Principles

Every finding must be:

- Evidence-backed.
- Explainable.
- Reproducible from stored events.
- Careful about confidence.
- Clear about uncertainty.

Do not present weak signals as proof.

## Finding Shape

Each analyzer should return `Finding` objects with:

- `title`: short result label.
- `description`: human-readable explanation.
- `severity`: practical importance.
- `confidence`: strength of evidence.
- `scoreImpact`: contribution to the final score.
- `evidence`: transaction or event references.
- `metadata`: structured details for UI and export.

## Confidence Guidance

High confidence:

- Direct transfer between watched wallets.
- Multiple direct transfers across time.
- A short multi-hop path with non-public intermediary addresses.

Medium confidence:

- Shared non-public funding source.
- Shared withdrawal destination.
- Bridge timing that lines up with amount and chain route.

Low confidence:

- Shared interaction with popular contracts.
- Similar timing without amount or counterparty overlap.
- Same token or NFT collection interaction.

## Scoring Guidance

Scores are not identity claims. They are a prioritization signal for review.

`RelationshipScore` keeps the overall `score`, `confidence`, `reasons`, and `counterEvidence` fields for compatibility, and also exposes multidimensional review scores:

- `funding`: direct transfers, shared funding sources, and multi-hop funding paths.
- `destination`: shared withdrawals, shared counterparties, and bridge destinations.
- `contract`: shared contract interaction signals.
- `temporal`: timing and behavior-window overlap.
- `asset`: token, NFT, SBT, POAP, or other asset overlap signals.

Suggested starting weights:

- Direct transfer: `+40`
- Repeated direct transfers: `+10` to `+30`
- Short multi-hop path: `+25` to `+45`
- Shared funding source: `+30` to `+36`
- Shared withdrawal destination: `+26` to `+34`
- Shared non-public counterparty: `+20` to `+35`
- Bridge route correlation: `+12` to `+32`
- Shared public contract interaction: `+3` to `+10`
- Temporal similarity: `+5` to `+20`

Reduce score when:

- The counterparty is a large public service.
- The contract is extremely popular.
- The event is old and isolated.
- The path depends on many hops.
- A bridge route lacks a destination chain, protocol, or amount similarity.
- The only overlap is a common token or NFT collection.

Public entity labels from graph enrichment should lower confidence and score for weak-to-medium signals. This applies to shared counterparties, shared funding or withdrawal nodes, shared contract interactions, and multi-hop intermediaries. The finding should keep the evidence but mark the public-entity adjustment in metadata so UI and reports can explain the lower review priority.

## Analyzer Requirements

New analyzers should include:

- A stable `id`.
- A short `name`.
- Focused tests with synthetic fixtures.
- Clear evidence references.
- No external data fetching inside the analyzer.

Analyzers should read from `AnalysisContext` and return findings. Data loading belongs in adapters or ingestion services.

## Live Fetch Coverage

Live analysis may not include the full on-chain history for every address.

- Default live mode uses a time window (currently 365 days unless overridden).
- Full-history mode paginates provider APIs until data is exhausted or a per-address safety cap is reached.
- `meta.fetchCoverage` and `meta.warnings` describe the scope, per-address event counts, and any truncation.
- Treat findings as incomplete when truncation warnings are present, especially for older funding or bridge signals.

## Report Language

Use careful language:

- Prefer “关联信号” over “证明同一人”.
- Prefer “发现直接转账” over “两个钱包一定属于同一人”.
- Prefer “需要人工复核” when confidence is low or medium.

Avoid language that sounds like instructions for bypassing third-party review systems.
