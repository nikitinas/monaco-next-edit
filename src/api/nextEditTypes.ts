/*
 * Proposed VS Code Next Edit Suggestions API (type-only surface).
 * This file deliberately avoids importing VS Code internals so it can be
 * consumed independently and backed by Monaco for prototyping.
 */

/**
 * Disposable resource returned from APIs that need explicit cleanup, such as removing event listeners.
 */
export interface Disposable {
  dispose(): void;
}

/**
 * Registers an event listener and returns a disposable that removes the listener when disposed.
 */
export interface Event<T> {
  (listener: (e: T) => void): Disposable;
}

/**
 * Token passed to long-running operations so they can react to cancellation requests.
 */
export interface CancellationToken {
  readonly isCancellationRequested: boolean;
  onCancellationRequested(listener: () => void): Disposable;
}

/**
 * Minimal text document abstraction shared across the Next Edit Suggestion API surface.
 */
export interface TextDocument {
  readonly uri: string;
  readonly languageId: string;
  readonly version: number;
  getText(range?: Range): string;
}

/**
 * Zero-based position within a document.
 */
export interface Position {
  readonly line: number;
  readonly character: number;
}

/**
 * Half-open range describing a span of text. The end is exclusive.
 */
export interface Range {
  readonly start: Position;
  readonly end: Position;
}

/**
 * Range where the `anchor` indicates the start of the selection and `active` indicates the caret position.
 */
export interface Selection extends Range {
  readonly anchor: Position;
  readonly active: Position;
}

/**
 * Command that can be invoked by the editor, optionally carrying arguments.
 */
export interface Command {
  readonly title: string;
  readonly command: string;
  readonly arguments?: readonly unknown[];
}

/**
 * Markdown value rendered by the editor, optionally supporting codicon theme icons.
 */
export interface MarkdownString {
  readonly value: string;
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
  readonly language?: string;
  readonly scheme?: string;
}

/**
 * Utility that allows providers to return synchronously or asynchronously.
 */
export type ProviderResult<T> = T | undefined | null | Promise<T | undefined | null>;

/**
 * Describes how the Next Edit Suggestion service was triggered.
 */
export const enum NextEditTriggerKind {
  Invoke = 0,
  Automatic = 1,
}

/**
 * Context information supplied when requesting next edit suggestions.
 */
export interface NextEditSuggestionContext {
  readonly triggerKind: NextEditTriggerKind;
  readonly lastAcceptedSuggestionId?: string;
}

/**
 * Edit to apply to the document if a suggestion is accepted.
 */
export interface NextEditTextEdit {
  readonly range: Range;
  readonly insertText: string;
}

/**
 * Customization hooks for how preview ghost text should be displayed.
 */
export interface GhostTextOptions {
  readonly style?: 'subtle' | 'strong';
  readonly inlineClassName?: string;
}

/**
 * Additional presentation metadata shown while previewing a suggestion.
 */
export interface NextEditPreview {
  readonly emphasisRanges?: readonly Range[];
  readonly ghostTextOptions?: GhostTextOptions;
}

/**
 * A suggested change produced by a provider, including edits and optional commands to run afterward.
 */
export interface NextEditSuggestion {
  readonly id: string;
  readonly label: string;
  readonly detail?: string;
  readonly documentation?: MarkdownString;
  readonly source?: string;
  readonly edits: readonly NextEditTextEdit[];
  readonly preview?: NextEditPreview;
  readonly commands?: readonly Command[];
}

/**
 * Container returned by providers with suggested edits and optional telemetry payloads.
 */
export interface NextEditSuggestionList {
  readonly suggestions: readonly NextEditSuggestion[];
  readonly isIncomplete?: boolean;
  readonly telemetry?: Record<string, unknown>;
}

/**
 * Provider that supplies next edit suggestions for matching documents.
 */
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

/**
 * Additional options that influence how a provider is executed by the service.
 */
export interface NextEditRegistrationOptions {
  readonly captureDocumentChanges?: boolean;
}

/**
 * Event payload describing how the active suggestion session has changed.
 */
export interface NextEditSuggestionSessionChangeEvent {
  readonly activeSuggestion: NextEditSuggestion | undefined;
  readonly allSuggestions: readonly NextEditSuggestion[];
}

/**
 * Active suggestion session exposing navigation and acceptance controls.
 */
export interface NextEditSuggestionSession {
  readonly activeSuggestion?: NextEditSuggestion;
  readonly suggestions: readonly NextEditSuggestion[];
  readonly activeIndex: number;
  reveal(): void;
  accept(suggestion?: NextEditSuggestion): Promise<boolean>;
  discard(): void;
  selectNext(): void;
  selectPrevious(): void;
  setActiveIndex(index: number): void;
  readonly onDidChange: Event<NextEditSuggestionSessionChangeEvent>;
}

/**
 * Entry point used by editors to register providers and control Next Edit suggestion sessions.
 */
export interface NextEditSuggestionService {
  registerProvider(
    selector: DocumentSelector,
    provider: NextEditSuggestionProvider,
    options?: NextEditRegistrationOptions
  ): Disposable;
  invoke(triggerKind?: NextEditTriggerKind): Promise<NextEditSuggestionSession | undefined>;
  getActiveSession(): NextEditSuggestionSession | undefined;
  acceptActiveSuggestion(): Promise<boolean>;
  discardActiveSuggestion(): void;
  selectNextSuggestion(): void;
  selectPreviousSuggestion(): void;
  setActiveSuggestionIndex(index: number): void;
  dispose(): void;
}

