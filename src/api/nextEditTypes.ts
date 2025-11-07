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
 * Markdown-formatted content shown in suggestion documentation.
 */
export interface MarkdownString {
  /**
   * Markdown content to render.
   */
  readonly value: string;
  /**
   * When true, indicates the content may contain theme icon syntax (e.g. `$(zap)`).
   */
  readonly supportThemeIcons?: boolean;
  /**
   * When true, allows command URIs to be executed from the rendered content.
   */
  readonly isTrusted?: boolean;
}

/**
 * Controls how ghost text previews are rendered.
 */
export interface GhostTextOptions {
  /**
   * CSS class applied to the inline ghost text decoration.
   */
  readonly inlineClassName?: string;
  /**
   * Hint for the editor about the prominence of the ghost text styling.
   */
  readonly style?: 'subtle' | 'strong' | 'default';
  /**
   * Optional foreground color override expressed as a CSS color.
   */
  readonly color?: string;
}

/**
 * Preview metadata rendered alongside a suggestion.
 */
export interface EditSuggestionPreview {
  /**
   * Ranges that should be emphasized in the editor while the suggestion is focused.
   */
  readonly emphasisRanges?: readonly Range[];
  /**
   * Options that control the appearance of the inline ghost text.
   */
  readonly ghostTextOptions?: GhostTextOptions;
}

/**
 * Edit to apply to the document if a suggestion is accepted.
 */
export interface TextEdit {
  /**
   * Range of text that should be replaced.
   */
  readonly range: Range;
  /**
   * Replacement text to insert at the given range.
   */
  readonly newText: string;
}

/**
 * Edit primitive used by the Next Edit Suggestions API.
 */
export interface EditTextEdit {
  /**
   * Range of the edit.
   */
  readonly range: Range;
  /**
   * Text to insert at the given range.
   */
  readonly insertText: string;
}

/**
 * Describes how the Next Edit Suggestion service was triggered.
 */
export const enum EditTriggerKind {
  Invoke = 0,
  Automatic = 1,
}

/**
 * Backwards-compatible alias for consumers using the earlier enum name.
 */
export { EditTriggerKind as EditSuggestionTriggerKind };

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
 * A suggested change produced by a provider, displayed as ghost text.
 */
export interface EditSuggestion {
  /**
   * Stable identifier for correlating the suggestion across acceptance calls.
   */
  readonly id: string;
  /**
   * Human-readable label surfaced in UI pickers and status areas.
   */
  readonly label: string;
  /**
   * Optional secondary detail text.
   */
  readonly detail?: string;
  /**
   * Rich documentation explaining the suggestion.
   */
  readonly documentation?: MarkdownString;
  /**
   * One or more edits that apply the suggestion to the document.
   */
  readonly edits: readonly EditTextEdit[];
  /**
   * Preview metadata used to highlight important ranges.
   */
  readonly preview?: EditSuggestionPreview;
  /**
   * Identifier describing the provider or model that produced the suggestion.
   */
  readonly source?: string;
  /**
   * Commands surfaced alongside the suggestion (for example, "Explain this suggestion").
   */
  readonly commands?: readonly Command[];
}

/**
 * Container returned by providers with suggested edits.
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
   * Optional telemetry payload forwarded to the host.
   */
  readonly telemetry?: Record<string, unknown>;
}

/**
 * Additional options supplied when registering a provider.
 */
export interface EditRegistrationOptions {
  /**
   * When true, requests that the host capture document changes while a provider runs.
   */
  readonly captureDocumentChanges?: boolean;
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
   * Optionally resolves additional information for a suggestion when it becomes active.
   */
  resolveEditSuggestion?(
    suggestion: EditSuggestion,
    token: CancellationToken
  ): ProviderResult<EditSuggestion | undefined>;
}

/**
 * Event payload fired when a suggestion is accepted.
 */
export interface EditSuggestionAcceptedEvent {
  /**
   * The suggestion that was accepted.
   */
  readonly suggestion: EditSuggestion;
}

/**
 * Event payload fired when suggestions are discarded without being accepted.
 */
export interface EditSuggestionsDiscardedEvent {
  /**
   * The suggestions that were discarded.
   */
  readonly suggestions: readonly EditSuggestion[];
}

/**
 * Event payload describing updates within an active suggestion session.
 */
export interface EditSuggestionSessionChangeEvent {
  /**
   * The suggestion currently focused by the user, if any.
   */
  readonly activeSuggestion?: EditSuggestion;
  /**
   * Snapshot of all suggestions known to the session.
   */
  readonly allSuggestions: readonly EditSuggestion[];
}

/**
 * Represents an interactive suggestion session managed by the host.
 */
export interface EditSuggestionSession {
  /**
   * Suggestions available in the session.
   */
  readonly suggestions: readonly EditSuggestion[];
  /**
   * The currently focused suggestion, if any.
   */
  readonly activeSuggestion?: EditSuggestion;
  /**
   * Zero-based index of the active suggestion.
   */
  readonly activeIndex: number;
  /**
   * Event fired when the session's active suggestion or suggestion list changes.
   */
  readonly onDidChange: Event<EditSuggestionSessionChangeEvent>;
  /**
   * Reveals the active suggestion in the editor.
   */
  reveal(): void;
  /**
   * Accepts the active suggestion (or a supplied one) and applies its edits.
   */
  accept(suggestion?: EditSuggestion): Promise<boolean>;
  /**
   * Discards the current session.
   */
  discard(): void;
  /**
   * Advances focus to the next suggestion.
   */
  selectNext(): void;
  /**
   * Moves focus to the previous suggestion.
   */
  selectPrevious(): void;
  /**
   * Sets the active suggestion to the provided index.
   */
  setActiveIndex(index: number): void;
  /**
   * Releases resources associated with the session.
   */
  dispose(): void;
}

/**
 * Entry point used by editors to register providers and drive suggestion sessions.
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
   * Invokes providers using the current editor selection.
   */
  invoke(triggerKind?: EditTriggerKind): Promise<EditSuggestionSession | undefined>;
  /**
   * Returns the session currently shown to the user, if any.
   */
  getActiveSession(): EditSuggestionSession | undefined;
  /**
   * Accepts the active suggestion, if one exists.
   */
  acceptActiveSuggestion(): Promise<boolean>;
  /**
   * Discards the active session (if any) without applying edits.
   */
  discardActiveSuggestion(): void;
  /**
   * Selects the next suggestion in the active session.
   */
  selectNextSuggestion(): void;
  /**
   * Selects the previous suggestion in the active session.
   */
  selectPreviousSuggestion(): void;
  /**
   * Sets the active suggestion to the supplied index.
   */
  setActiveSuggestionIndex(index: number): void;
  /**
   * Optional event fired when a suggestion is accepted.
   */
  readonly onDidAcceptSuggestion?: Event<EditSuggestionAcceptedEvent>;
  /**
   * Optional event fired when suggestions are discarded without being accepted.
   */
  readonly onDidDiscardSuggestions?: Event<EditSuggestionsDiscardedEvent>;
  /**
   * Disposes the service and releases all associated resources.
   */
  dispose(): void;
}

/**
 * VS Code languages namespace for edit suggestion functionality.
 * This namespace provides registration functions and events for edit suggestions.
 */
export declare namespace vscode {
  export namespace languages {
    /**
     * Registers an edit suggestion provider for the given document selector.
     *
     * @param selector A document selector that defines the documents this provider is applicable to.
     * @param provider An edit suggestion provider.
     * @param options Optional registration options supplied to the host.
     * @returns A disposable that unregisters this provider when disposed.
     */
    export function registerEditSuggestionProvider(
      selector: DocumentSelector,
      provider: EditSuggestionProvider,
      options?: EditRegistrationOptions
    ): Disposable;

    /**
     * Event fired when an edit suggestion is accepted.
     */
    export const onDidAcceptEditSuggestion: Event<EditSuggestionAcceptedEvent>;

    /**
     * Event fired when edit suggestions are discarded without being accepted.
     */
    export const onDidDiscardEditSuggestions: Event<EditSuggestionsDiscardedEvent>;
  }
}
