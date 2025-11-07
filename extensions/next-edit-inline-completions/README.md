# Next Edit Inline Completions

This experimental VS Code extension demonstrates how the prototype “next edit suggestions” proposal can be expressed with the stable inline completion API that shipped in VS Code. It surfaces two suggestion patterns that mirror the Monaco playground in this repository:

- Predictive logging: offers to scaffold a `console.log` on the next line to help validate the current change.
- Try/catch wrapping: when code is selected, proposes wrapping it in a defensive `try/catch` block that rethrows errors.

## Features

The provider watches for inline completion triggers (automatic or manual) and synthesises ghost text inline completions. It keeps track of the last accepted suggestion so repeated acceptances cycle through different ideas. Accepting a suggestion can also trigger follow-up commands like generating telemetry or explaining the intent.

The extension is activated on startup so the inline completion provider is available across all file types.

## Development

```bash
cd extensions/next-edit-inline-completions
npm install
npm run compile
```

Launch VS Code with the **Run Extension** task to debug in a new Extension Development Host window.

## Commands

- `Next Edit: Explain Active Suggestion` (`nextEditInlineCompletions.explainSuggestion`) surfaces contextual documentation for the last suggestion that was shown.
- `Next Edit: Generate Telemetry Stub` (`nextEditInlineCompletions.generateTelemetry`) appends a telemetry logging comment at the current cursor position.

## Packaging

Run `npm run compile` before packaging with `vsce package`. The `.vscodeignore` file excludes sources and build artefacts so only the compiled extension is published.
