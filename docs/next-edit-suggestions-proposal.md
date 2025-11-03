## Next Edit Suggestions API Proposal

### Background
- Developers increasingly expect copilots to predict the next meaningful edit in their workflow (e.g. JetBrains AI Assistant).
- VS Code extensions today can offer code actions, inline suggestions, or snippets, but they cannot surface structured "next edit" predictions that combine inline preview, multi-range edits, rich rationale, and fast acceptance.
- Native support is required to enable consistent UX, keyboard binding, conflict resolution, and telemetry for predictive edit flows.

### Goals
- Provide a first-class API so extensions can register next edit suggestion providers without touching DOM internals.
- Ensure the core editor controls rendering, acceptance, conflict resolution, and cancellation semantics.
- Support previews across one or more ranges with inline ghost text and diff overlays similar to JetBrains AI Assistant.
- Integrate with undo/redo and respect existing VS Code concepts: `TextDocument`, `TextEdit`, `WorkspaceEdit`, cancellation tokens.
- Allow asynchronous streaming of updated suggestions as the extension refines predictions.

### Non-Goals
- Replace inline completions or code actions.
- Mandate AI usage ? providers may be heuristic or rule-based.
- Specify UI chrome beyond what the editor already controls (toolbars, badges, etc.).

### Proposed API Surface

```ts
export namespace vscode.nextEdits {
  export interface NextEditSuggestionProvider {
    readonly id: string;
    provideNextEditSuggestions(
      document: TextDocument,
      selection: Selection,
      context: NextEditSuggestionContext,
      token: CancellationToken
    ): ProviderResult<NextEditSuggestionList>;

    resolveNextEditSuggestion?(
      suggestion: NextEditSuggestion,
      token: CancellationToken
    ): ProviderResult<NextEditSuggestion | undefined>;
  }

  export interface NextEditSuggestionList {
    readonly suggestions: readonly NextEditSuggestion[];
    readonly isIncomplete?: boolean;
    readonly telemetry?: Record<string, unknown>;
  }

  export interface NextEditSuggestion {
    readonly id: string;
    readonly label: string;
    readonly detail?: string;
    readonly documentation?: MarkdownString;
    readonly edits: readonly NextEditTextEdit[];
    readonly preview?: NextEditPreview;
    readonly source?: string;
    readonly commands?: readonly Command[];
  }

  export interface NextEditTextEdit {
    readonly range: Range;
    readonly insertText: string;
  }

  export interface NextEditPreview {
    readonly emphasisRanges?: readonly Range[];
    readonly ghostTextOptions?: GhostTextOptions;
  }

  export interface NextEditSuggestionContext {
    readonly triggerKind: NextEditTriggerKind;
    readonly lastAcceptedSuggestionId?: string;
  }

  export const enum NextEditTriggerKind {
    Invoke = 0,
    Automatic = 1,
  }

  export function registerNextEditSuggestionProvider(
    selector: DocumentSelector,
    provider: NextEditSuggestionProvider,
    options?: NextEditRegistrationOptions
  ): Disposable;

  export interface NextEditRegistrationOptions {
    readonly captureDocumentChanges?: boolean;
  }

  export interface NextEditSuggestionSession {
    readonly activeSuggestion?: NextEditSuggestion;
    readonly suggestions: readonly NextEditSuggestion[];
    readonly reveal(): void;
    readonly accept(suggestion?: NextEditSuggestion): Thenable<boolean>;
    readonly discard(): void;
    onDidChange: Event<NextEditSuggestionSessionChangeEvent>;
  }

  export function getActiveSuggestionSession(): NextEditSuggestionSession | undefined;
}
```

### Lifecycle
1. User triggers "Predict Next Edit" (keyboard shortcut or command) or auto mode fires after accepted edits.
2. VS Code core constructs a `NextEditSuggestionContext`, obtains a provider (highest priority based on selector), and calls `provideNextEditSuggestions`.
3. Provider returns a `NextEditSuggestionList` (possibly streaming incomplete results). Core renders the inline preview in the editor using new ghost text/diff overlay primitives.
4. User can:
   - Accept (apply edits as single undo stop).
   - Cycle between suggestions.
   - Open detail view (markdown doc, commands).
   - Reject (dismiss session).
5. Core fires telemetry, updates `lastAcceptedSuggestionId`, and optionally triggers another automatic request.

### UX Shape (Parity with JetBrains)
- Inline preview overlay that shows inserted/removed text with subtle styling.
- Minimap indicator + status bar pill summarizing suggestion label.
- Quick fix-style palette listing available suggestions.
- Keyboard shortcuts: `Ctrl+Alt+]` cycle forward, `Ctrl+Alt+Enter` accept.

### Core Responsibilities
- Diff computation: apply each suggestion's `edits` virtually to compute preview diff using `monaco.editor.ITextModel.applyEdits` on a cloned model.
- Rendering: create decoration sets for ghost text, highlight emphasis ranges, show inline diff markers.
- Conflict handling: reconcile with pending unsaved changes; re-request provider if edit range overlaps with fresh user input.
- Cancellation: propagate `CancellationToken` to providers upon new trigger or when the document changes.

### Extension Ergonomics
- Providers may be stateless (compute suggestions on demand) or maintain context (e.g. conversation with AI service).
- `resolveNextEditSuggestion` may lazily load documentation or additional commands when the user focuses a suggestion.
- Extensions can emit commands (e.g. "Explain Edit") bound to palette entries without handling DOM.

### Implementation Notes Using Monaco
- Monaco already exposes `ITextModel`, `IStandaloneCodeEditor`, `applyEdits`, and decoration APIs. The proposal maps each suggestion to a detached model that generates diff decorations.
- `ghostTextOptions` align with Monaco's `editor.inlineSuggest` support but allow per-suggestion overrides.
- The reference implementation can be composed as `createNextEditSuggestionController(editor: IStandaloneCodeEditor)` that manages providers, sessions, and decorations.
- VS Code core would instantiate the controller for each editor widget, delegating provider resolution to the extension host bridge.

### Why a New API vs Code Actions / Inline Completions
- Code actions require explicit invocation and typically mutate the document immediately; they cannot preview multi-range edits non-destructively.
- Inline completions focus on single insertions at the caret; next edit suggestions often span multiple ranges and may include deletions.
- Separate API streamlines UX, analytics, and provider capabilities tailored for predictive editing.

### Open Questions
- Should partial acceptance (per range) be supported initially?
- What telemetry events are required to measure quality without exposing user content?
- Do we need ordering guarantees for streaming updates (e.g. chunk tags)?

