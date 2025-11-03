/*
 * Proposed VS Code Next Edit Suggestions API (type-only surface).
 * This file deliberately avoids importing VS Code internals so it can be
 * consumed independently and backed by Monaco for prototyping.
 */

export interface Disposable {
  dispose(): void;
}

export interface Event<T> {
  (listener: (e: T) => void): Disposable;
}

export interface CancellationToken {
  readonly isCancellationRequested: boolean;
  onCancellationRequested(listener: () => void): Disposable;
}

export interface TextDocument {
  readonly uri: string;
  readonly languageId: string;
  readonly version: number;
  getText(range?: Range): string;
}

export interface Position {
  readonly line: number;
  readonly character: number;
}

export interface Range {
  readonly start: Position;
  readonly end: Position;
}

export interface Selection extends Range {
  readonly anchor: Position;
  readonly active: Position;
}

export interface Command {
  readonly title: string;
  readonly command: string;
  readonly arguments?: readonly unknown[];
}

export interface MarkdownString {
  readonly value: string;
  readonly supportThemeIcons?: boolean;
}

export type DocumentSelector = string | DocumentFilter | readonly (string | DocumentFilter)[];

export interface DocumentFilter {
  readonly language?: string;
  readonly scheme?: string;
}

export type ProviderResult<T> = T | undefined | null | Promise<T | undefined | null>;

export const enum NextEditTriggerKind {
  Invoke = 0,
  Automatic = 1,
}

export interface NextEditSuggestionContext {
  readonly triggerKind: NextEditTriggerKind;
  readonly lastAcceptedSuggestionId?: string;
}

export interface NextEditTextEdit {
  readonly range: Range;
  readonly insertText: string;
}

export interface GhostTextOptions {
  readonly style?: 'subtle' | 'strong';
  readonly inlineClassName?: string;
}

export interface NextEditPreview {
  readonly emphasisRanges?: readonly Range[];
  readonly ghostTextOptions?: GhostTextOptions;
}

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

export interface NextEditSuggestionList {
  readonly suggestions: readonly NextEditSuggestion[];
  readonly isIncomplete?: boolean;
  readonly telemetry?: Record<string, unknown>;
}

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

export interface NextEditRegistrationOptions {
  readonly captureDocumentChanges?: boolean;
}

export interface NextEditSuggestionSessionChangeEvent {
  readonly activeSuggestion: NextEditSuggestion | undefined;
  readonly allSuggestions: readonly NextEditSuggestion[];
}

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

