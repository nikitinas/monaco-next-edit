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
 * Describes how the Next Edit Suggestion service was triggered.
 */
export const enum EditSuggestionTriggerKind {
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
  readonly triggerKind: EditSuggestionTriggerKind;
  /**
   * Identifier of the last suggestion accepted in the current session, if any.
   */
  readonly lastAcceptedSuggestionId?: string;
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
 * A suggested change produced by a provider, displayed as ghost text.
 */
export interface EditSuggestion {
  /**
   * Stable identifier for correlating the suggestion across acceptance calls.
   */
  readonly id: string;
  /**
   * One or more edits that apply the suggestion to the document.
   */
  readonly edits: readonly TextEdit[];
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
     * @returns A disposable that unregisters this provider when disposed.
     */
    export function registerEditSuggestionProvider(
      selector: DocumentSelector,
      provider: EditSuggestionProvider
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

/**
 * Entry point used by editors to register providers and listen to suggestion events.
 * All suggestion control (acceptance, navigation, dismissal) is managed by the host (editor).
 * 
 * @deprecated This interface is for internal use. Use `vscode.languages.registerEditSuggestionProvider()` instead.
 */
export interface EditSuggestionService {
  /**
   * Registers a provider for the given document selector and returns a disposable to unregister it.
   */
  registerProvider(
    selector: DocumentSelector,
    provider: EditSuggestionProvider
  ): Disposable;
  /**
   * Event fired when a suggestion is accepted.
   */
  readonly onDidAcceptSuggestion: Event<EditSuggestionAcceptedEvent>;
  /**
   * Event fired when suggestions are discarded without being accepted.
   */
  readonly onDidDiscardSuggestions: Event<EditSuggestionsDiscardedEvent>;
  /**
   * Disposes the service and releases all associated resources.
   */
  dispose(): void;
}

