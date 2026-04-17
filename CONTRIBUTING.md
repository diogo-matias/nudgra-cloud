# Contributing

Thanks for taking the time to contribute.

## Before You Start

- Read the [README](./README.md) for setup and deployment context.
- For architecture context, read [docs/technical-architecture.md](./docs/technical-architecture.md).
- If you want to make a large change, open an issue first so the direction can be agreed before implementation starts.

## Local Setup

1. Install dependencies.

   ```bash
   npm install
   ```

2. Create a local env file from `.env.example`.
3. Start the app.

   ```bash
   npm run dev
   ```

## Required Checks

Before opening a pull request, make sure these commands pass locally:

```bash
npm run lint
npm test
npm run build
```

## Pull Request Guidelines

- Keep pull requests focused. Small, single-purpose changes are easier to review and merge.
- Avoid unrelated refactors in feature or bug-fix PRs.
- Add or update tests when behavior changes.
- Update docs when setup, architecture, or operator-facing behavior changes.
- Do not commit secrets, production tokens, or local `.env` files.

## Scope Expectations

Good contribution areas:

- bug fixes
- tests
- docs improvements
- UI polish that preserves the product direction
- performance and reliability improvements

Changes that should usually be discussed first:

- schema changes
- public API changes
- auth changes
- major product-direction changes
- rebranding

## Coding Notes

- Follow the existing project structure and naming.
- Keep external behavior stable unless the change explicitly intends otherwise.
- Prefer account-scoped data access over workspace-wide scans when touching dashboard reads.
- For Convex work, follow the repo guidance in `AGENTS.md` and `convex/_generated/ai/guidelines.md`.

## Branding

By contributing, you agree that your code contributions are licensed under the
repository's MIT license. That does not grant rights to use the `Nudgra` name
or branding outside this repository. See [TRADEMARKS.md](./TRADEMARKS.md).
