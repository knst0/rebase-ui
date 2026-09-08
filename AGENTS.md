# Agent Instructions

@PORT_FIDELITY.md

## Context

Follow these core principles when contributing to the repository.
Always read `PORT_FIDELITY.md` before porting or modifying a component.

## System Goals

- **Port Fidelity**: Maintain a high level of fidelity in porting components from Base UI to Solid JS 2.0. Ensure that the functionality, accessibility features, and interactive states are preserved exactly.
- **Layer Separation**: Keep `packages/solid` as pure, headless primitives (focus on logic and accessibility).

## Core Directives

- Use **Solid JS 2.0** for all reactivity logic.
- Implement high-performance components by following Solid best practices to minimize unnecessary reactivations.
- Ensure full accessibility compliance using WAI-ARIA standards in `packages/solid`.
- Follow the established design system of Base UI when drafting new features or modifications.

## Development Workflow

- **Package Management**: Use `pnpm` for all package management and installation tasks.
- **Linting & Formatting**: Utilize `oxlint` and `oxfmt` to maintain consistent code quality across the monorepo.
- **Testing Strategy**: Implement unit tests in `vitest` and perform end-to-end (E2E) testing with `playwright`.
- **Build Step**: Use `tsdown` for production builds and bundling.

## Key Modules

1.  **Core (`packages/solid`)**: The foundation of the library; contains all primitive components, headless logic, and shared utilities.
