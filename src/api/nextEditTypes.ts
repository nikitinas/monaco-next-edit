/*
 * Proposed VS Code Next Edit Suggestions API (type-only surface).
 * This file deliberately avoids importing VS Code internals so it can be
 * consumed independently and backed by Monaco for prototyping.
 */

/**
 * Disposable resource returned from APIs that need explicit cleanup, such as removing event listeners.
 */
export interface Disposable {
  /**
   * Releases the resource and unregisters any listeners associated with this disposable.
   */
  dispose(): void;
}

/**
 * Registers an event listener and returns a disposable that removes the listener when disposed.
 */
export interface Event<T> {
  /**
   * Subscribes the provided listener to the event and returns a disposable that removes it.
   */
  (listener: (e: T) => void): Disposable;
}

/**
 * Token passed to long-running operations so they can react to cancellation requests.
 */
export interface CancellationToken {
  /**
   * Indicates whether a cancellation has been requested.
   */
  readonly isCancellationRequested: boolean;
  /**
   * Registers a callback to invoke when cancellation is requested.
   */
  onCancellationRequested(listener: () => void): Disposable;
}

/**
 * Minimal text document abstraction shared across the Next Edit Suggestion API surface.
 */
export interface TextDocument {
  /**
   * Unique resource identifier for the document (for example, `file:///path/to/file.ts`).
   */
  readonly uri: string;
  /**
   * Language identifier that determines the document's language mode.
   */
  readonly languageId: string;
  /**
   * Monotonically increasing version number that increments when the document content changes.
   */
  readonly version: number;
  /**
   * Returns the entire document text or the subsection within the provided range.
   */
  getText(range?: Range): string;
}

/**
 * Zero-based position within a document.
 */
export interface Position {
  /**
   * Zero-based line index.
   */
  readonly line: number;
  /**
   * Zero-based character offset on the line.
   */
  readonly character: number;
}

/**
 * Half-open range describing a span of text. The end is exclusive.
 */
export interface Range {
  /**
   * Inclusive start position of the range.
   */
  readonly start: Position;
  /**
   * Exclusive end position of the range.
   */
  readonly end: Position;
}

/**
 * Range where the `anchor` indicates the start of the selection and `active` indicates the caret position.
 */
export interface Selection extends Range {
  /**
   * Fixed end of the selection; remains when extending the selection via keyboard.
   */
  readonly anchor: Position;
  /**
   * Moving end of the selection that represents the caret position.
   */
  readonly active: Position;
}

/**
 * Command that can be invoked by the editor, optionally carrying arguments.
 */
export interface Command {
  /**
   * Human-readable label describing the command for UI affordances.
   */
  readonly title: string;
  /**
   * Identifier used by the editor to dispatch the command.
   */
  readonly command: string;
  /**
   * Optional arguments supplied when executing the command.
   */
  readonly arguments?: readonly unknown[];
}

/**
 * Markdown value rendered by the editor, optionally supporting codicon theme icons.
 */
export interface MarkdownString {
  /**
   * Markdown source text to display.
   */
  readonly value: string;
  /**
   * When true, codicon theme icons embedded in the markdown should be rendered.
   */
  readonly supportThemeIcons?: boolean;
}

/**
 * Filters which documents a provider should match.
 */
export type DocumentSelector = string | DocumentFilter | readonly (string | DocumentFilter)[];

/**
 * Restricts providers to specific documents by language or URI scheme.
 */
export interface DocumentFilter {
  /**
   * Language identifier to match.
   */
  readonly language?: string;
  /**
   * URI scheme to match (for example, `file` or `vscode`).
   */
  readonly scheme?: string;
}

/**
 * Utility that allows providers to return synchronously or asynchronously.
 */
export type ProviderResult<T> = T | undefined | null | Promise<T | undefined | null>;

/**
 * Describes how the Next Edit Suggestion service was triggered.
 */
export const enum EditTriggerKind {
  Invoke = 0,
  Automatic = 1,
}

/**
 * Context information supplied when requesting next edit suggestions.
 */
export interface EditSuggestionContext {
  /**
   * Indicates whether the request was user-invoked or automatically triggered by heuristics.
   */
  readonly triggerKind: EditTriggerKind;
  /**
   * Identifier of the last suggestion accepted in the current session, if any.
   */
  readonly lastAcceptedSuggestionId?: string;
}

/**
 * Edit to apply to the document if a suggestion is accepted.
 */
export interface EditTextEdit {
  /**
   * Range of text that should be replaced.
   */
  readonly range: Range;
  /**
   * Replacement text to insert at the given range.
   */
  readonly insertText: string;
}

/**
 * Customization hooks for how preview ghost text should be displayed.
 */
export interface GhostTextOptions {
  /**
   * Strength of the preview styling, allowing for subtle or strong presentation.
   */
  readonly style?: 'subtle' | 'strong';
  /**
   * Additional inline class name applied to the rendered ghost text.
   */
  readonly inlineClassName?: string;
}

/**
 * Additional presentation metadata shown while previewing a suggestion.
 */
export interface EditPreview {
  /**
   * Ranges within the preview that should be emphasized.
   */
  readonly emphasisRanges?: readonly Range[];
  /**
   * Optional ghost text configuration for how previewed edits should appear.
   */
  readonly ghostTextOptions?: GhostTextOptions;
}

/**
 * A suggested change produced by a provider, including edits and optional commands to run afterward.
 */
export interface EditSuggestion {
  /**
   * Stable identifier for correlating the suggestion across resolve or acceptance calls.
   */
  readonly id: string;
  /**
   * Label shown to the user when presenting the suggestion.
   */
  readonly label: string;
  /**
   * Optional secondary text describing the suggestion.
   */
  readonly detail?: string;
  /**
   * Rich documentation rendered alongside the suggestion preview.
   */
  readonly documentation?: MarkdownString;
  /**
   * Optional source identifier to attribute the suggestion.
   */
  readonly source?: string;
  /**
   * One or more edits that apply the suggestion to the document.
   */
  readonly edits: readonly EditTextEdit[];
  /**
   * Optional preview metadata displayed before accepting the edits.
   */
  readonly preview?: EditPreview;
  /**
   * Commands to execute after the suggestion is accepted.
   */
  readonly commands?: readonly Command[];
}

/**
 * Container returned by providers with suggested edits and optional telemetry payloads.
 */
export interface EditSuggestionList {
  /**
   * Suggestions generated for the current document and selection.
   */
  readonly suggestions: readonly EditSuggestion[];
  /**
   * When true, indicates more suggestions may become available if the request is reissued.
   */
  readonly isIncomplete?: boolean;
  /**
   * Provider-supplied telemetry metadata forwarded to the host environment.
   */
  readonly telemetry?: Record<string, unknown>;
}

/**
 * Provider that supplies next edit suggestions for matching documents.
 */
export interface EditSuggestionProvider {
  /**
   * Unique identifier for the provider implementation.
   */
  readonly id: string;
  /**
   * Computes suggestions for the given document, selection, and context.
   */
  provideEditSuggestions(
    document: TextDocument,
    selection: Selection,
    context: EditSuggestionContext,
    token: CancellationToken
  ): ProviderResult<EditSuggestionList>;

  /**
   * Optionally resolves additional data for a suggestion after it has been presented.
   */
  resolveEditSuggestion?(
    suggestion: EditSuggestion,
    token: CancellationToken
  ): ProviderResult<EditSuggestion | undefined>;
}

/**
 * Additional options that influence how a provider is executed by the service.
 */
export interface EditRegistrationOptions {
  /**
   * If true, the provider receives events as the document changes during a session.
   */
  readonly captureDocumentChanges?: boolean;
}

/**
 * Event payload describing how the active suggestion session has changed.
 */
export interface EditSuggestionSessionChangeEvent {
  /**
   * Suggestion that is currently selected, if any.
   */
  readonly activeSuggestion: EditSuggestion | undefined;
  /**
   * All suggestions currently available within the session.
   */
  readonly allSuggestions: readonly EditSuggestion[];
}

/**
 * Event payload fired when a suggestion is accepted.
 */
export interface EditSuggestionAcceptedEvent {
  /**
   * The suggestion that was accepted.
   */
  readonly suggestion: EditSuggestion;
  /**
   * Whether the suggestion was successfully applied to the document.
   */
  readonly applied: boolean;
}

/**
 * Event payload fired when a suggestion session is discarded.
 */
export interface EditSuggestionDiscardedEvent {
  /**
   * The session that was discarded.
   */
  readonly session: EditSuggestionSession;
}

/**
 * Active suggestion session exposing read-only state and change notifications.
 * All session control is managed by the host (editor).
 */
export interface EditSuggestionSession {
  /**
   * Suggestion that is currently active.
   */
  readonly activeSuggestion?: EditSuggestion;
  /**
   * Full list of suggestions managed by the session.
   */
  readonly suggestions: readonly EditSuggestion[];
  /**
   * Index of the active suggestion within the `suggestions` list.
   */
  readonly activeIndex: number;
  /**
   * Event fired whenever the session's active suggestion or suggestion set changes.
   */
  readonly onDidChange: Event<EditSuggestionSessionChangeEvent>;
  /**
   * Event fired when a suggestion from this session is accepted.
   */
  readonly onDidAccept: Event<EditSuggestionAcceptedEvent>;
  /**
   * Event fired when this session is discarded without accepting any suggestion.
   */
  readonly onDidDiscard: Event<EditSuggestionDiscardedEvent>;
}

/**
 * Entry point used by editors to register providers and query suggestion session state.
 * All session control (acceptance, navigation, dismissal) is managed by the host (editor).
 */
export interface EditSuggestionService {
  /**
   * Registers a provider for the given document selector and returns a disposable to unregister it.
   */
  registerProvider(
    selector: DocumentSelector,
    provider: EditSuggestionProvider,
    options?: EditRegistrationOptions
  ): Disposable;
  /**
   * Invokes the suggestion service and returns the resulting session, if any suggestions are produced.
   * The host (editor) manages all session control; clients can query state and listen to events.
   */
  invoke(triggerKind?: EditTriggerKind): Promise<EditSuggestionSession | undefined>;
  /**
   * Returns the currently active suggestion session, if one exists.
   */
  getActiveSession(): EditSuggestionSession | undefined;
  /**
   * Disposes the service and releases all associated resources.
   */
  dispose(): void;
}

