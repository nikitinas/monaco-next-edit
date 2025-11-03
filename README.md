# Next Edit Suggestions API Prototype

This repository proposes a new VS Code API for predictive "next edit" suggestions (inspired by JetBrains AI Assistant) and ships a Monaco-backed reference implementation to validate the design without depending on VS Code internals.

## Project Layout
- `docs/next-edit-suggestions-proposal.md` ? design doc covering goals, API surface, and lifecycle.
- `src/api` ? TypeScript definitions for the proposed `vscode.nextEdits` API namespace.
- `src/monaco` ? `MonacoNextEditSuggestionService`, a runtime that maps the proposal onto `monaco-editor` capabilities (ghost text, decorations, undo/redo).
- `src/demo` ? a mock extension (`registerPredictiveEditingDemo`) showing how providers would register, trigger, and accept next edit predictions using only the proposed API.

## Getting Started
```bash
npm install
npm run build
```

The `build` command emits type declarations and JavaScript into `dist/` so the prototype can be embedded in a playground or an integration test harness.

## Using the Demo Service
```ts
import * as monaco from 'monaco-editor';
import { registerPredictiveEditingDemo } from './dist/demo/mockExtension.js';

const editor = monaco.editor.create(container, { language: 'typescript', value: initialCode });
const registration = registerPredictiveEditingDemo(editor);

// Later, dispose of all predictive editing wiring.
registration.dispose();
```

The demo wires up keyboard shortcuts:
- `Ctrl+Alt+Enter` to request predictions.
- `Tab` / `Shift+Tab` to cycle suggestions.
- `Ctrl+Alt+L` to accept the active suggestion.

Suggestions are rendered as Monaco decorations with ghost text and emphasis ranges, matching the UX outlined in the proposal.

## Authoring Providers
See `PredictiveNextEditProvider` in `src/demo/mockExtension.ts` for a fully typed example. Providers implement:
- `provideNextEditSuggestions` to return `NextEditSuggestionList` objects with multi-range edits and previews.
- (Optional) `resolveNextEditSuggestion` to hydrate documentation or commands once the user focuses a suggestion.

## Status
- ? API surface and TypeScript definitions.
- ? Monaco reference implementation with session management and cancellation.
- ? Demo provider showcasing predictive logging and try/catch wrapping suggestions.
- ?? Additional telemetry, theming, and streaming behaviours are noted as follow-up questions in the design doc.
