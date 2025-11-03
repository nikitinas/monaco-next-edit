import type { editor as MonacoEditor, Range as MonacoRange, Selection as MonacoSelection } from 'monaco-editor';

type Monaco = typeof import('monaco-editor');

import {
  CancellationToken,
  DocumentSelector,
  DocumentFilter,
  Disposable,
  Event,
  NextEditRegistrationOptions,
  NextEditSuggestion,
  NextEditSuggestionContext,
  NextEditSuggestionProvider,
  NextEditSuggestionService,
  NextEditSuggestionSession,
  NextEditSuggestionSessionChangeEvent,
  NextEditTextEdit,
  NextEditTriggerKind,
  Position,
  Selection,
  TextDocument,
} from '../api/index.js';

type ProviderResult<T> = T | undefined | null | Promise<T | undefined | null>;

interface RegisteredProvider {
  readonly selector: DocumentSelector;
  readonly provider: NextEditSuggestionProvider;
  readonly options?: NextEditRegistrationOptions;
}

class Emitter<T> implements Disposable {
  private readonly listeners = new Set<(e: T) => void>();

  readonly event: Event<T> = (listener: (e: T) => void): Disposable => {
    this.listeners.add(listener);
    return {
      dispose: () => {
        this.listeners.delete(listener);
      },
    };
  };

  fire(e: T): void {
    for (const listener of Array.from(this.listeners)) {
      listener(e);
    }
  }

  dispose(): void {
    this.listeners.clear();
  }
}

class CancellationTokenSource implements Disposable {
  private isCancelled = false;
  private readonly listeners = new Set<() => void>();
  readonly token: CancellationToken;

  constructor() {
    const source = this;
    const listeners = this.listeners;
    this.token = {
      get isCancellationRequested() {
        return source.isCancelled;
      },
      onCancellationRequested: (listener: () => void): Disposable => {
        if (source.isCancelled) {
          listener();
          return { dispose: () => undefined };
        }
        listeners.add(listener);
        return {
          dispose: () => listeners.delete(listener),
        };
      },
    };
  }

  cancel(): void {
    if (this.isCancelled) {
      return;
    }
    this.isCancelled = true;
    for (const listener of Array.from(this.listeners)) {
      listener();
    }
    this.listeners.clear();
  }

  dispose(): void {
    this.cancel();
  }
}

class MonacoTextDocument implements TextDocument {
  constructor(private readonly monaco: Monaco, private readonly model: MonacoEditor.ITextModel) {}

  get uri(): string {
    return this.model.uri.toString();
  }

  get languageId(): string {
    return this.model.getLanguageId();
  }

  get version(): number {
    return this.model.getVersionId();
  }

  getText(range?: { start: Position; end: Position }): string {
    if (!range) {
      return this.model.getValue();
    }
    return this.model.getValueInRange(toMonacoRange(this.monaco, range));
  }
}

function toMonacoRange(monaco: Monaco, range: { start: Position; end: Position }): MonacoRange {
  return new monaco.Range(
    range.start.line + 1,
    range.start.character + 1,
    range.end.line + 1,
    range.end.character + 1
  );
}

function fromMonacoSelection(monaco: Monaco, selection: MonacoSelection | null | undefined): Selection {
  const sel = selection ?? new monaco.Selection(1, 1, 1, 1);
  return {
    start: {
      line: sel.startLineNumber - 1,
      character: sel.startColumn - 1,
    },
    end: {
      line: sel.endLineNumber - 1,
      character: sel.endColumn - 1,
    },
    anchor: {
      line: sel.selectionStartLineNumber - 1,
      character: sel.selectionStartColumn - 1,
    },
    active: {
      line: sel.positionLineNumber - 1,
      character: sel.positionColumn - 1,
    },
  };
}

function documentMatchesSelector(document: TextDocument, selector: DocumentSelector): boolean {
  if (Array.isArray(selector)) {
    return selector.some((candidate) => documentMatchesSelector(document, candidate));
  }
  if (typeof selector === 'string') {
    const matches = selector === '*' || selector === document.languageId;
    console.log('[DocumentMatch] String selector:', { selector, documentLanguage: document.languageId, matches });
    return matches;
  }
  const filter = selector as DocumentFilter;
  if (filter.language && filter.language !== document.languageId) {
    console.log('[DocumentMatch] Filter mismatch:', { filterLanguage: filter.language, documentLanguage: document.languageId });
    return false;
  }
  if (filter.scheme) {
    const matches = document.uri.startsWith(`${filter.scheme}://`);
    console.log('[DocumentMatch] Scheme check:', { scheme: filter.scheme, uri: document.uri, matches });
    return matches;
  }
  console.log('[DocumentMatch] Filter matches:', { filter, documentLanguage: document.languageId });
  return true;
}

function applyMonacoEdits(
  monaco: Monaco,
  editor: MonacoEditor.IStandaloneCodeEditor,
  edits: readonly NextEditTextEdit[]
): void {
  const operations = edits.map<MonacoEditor.IIdentifiedSingleEditOperation>((edit) => ({
    range: toMonacoRange(monaco, edit.range),
    text: edit.insertText,
    forceMoveMarkers: true,
  }));
  editor.pushUndoStop();
  editor.executeEdits('nextEditSuggestion', operations);
  editor.pushUndoStop();
}

function previewDecorationsFromSuggestion(
  monaco: Monaco,
  suggestion: NextEditSuggestion
): MonacoEditor.IModelDeltaDecoration[] {
  const decorations: MonacoEditor.IModelDeltaDecoration[] = [];
  const ghostClassName = suggestion.preview?.ghostTextOptions?.inlineClassName ?? 'next-edit-ghost-text';

  console.log('[PreviewDecorations] Creating decorations for suggestion:', suggestion.label, 'with', suggestion.edits.length, 'edits');
  console.log('[PreviewDecorations] Ghost class name:', ghostClassName);

  for (const edit of suggestion.edits) {
    const range = toMonacoRange(monaco, edit.range);
    if (!range.isEmpty()) {
      decorations.push({
        range,
        options: {
          inlineClassName: 'next-edit-diff-range',
        },
      });
    }

    const lines = edit.insertText.split(/\r?\n/);
    if (lines.length === 1) {
      decorations.push({
        range,
        options: {
          inlineClassName: ghostClassName,
          after: {
            content: lines[0],
            inlineClassName: ghostClassName,
          },
        },
      });
    } else {
      lines.forEach((line, index) => {
        const deltaRange = new monaco.Range(
          range.startLineNumber + index,
          index === 0 ? range.startColumn : 1,
          range.startLineNumber + index,
          index === 0 ? range.startColumn : 1
        );
        decorations.push({
          range: deltaRange,
          options: {
            after: {
              content: line,
              inlineClassName: ghostClassName,
            },
          },
        });
      });
    }
  }

  if (suggestion.preview?.emphasisRanges) {
    for (const emphasis of suggestion.preview.emphasisRanges) {
      decorations.push({
        range: toMonacoRange(monaco, emphasis),
        options: {
          inlineClassName: 'next-edit-emphasis-range',
        },
      });
    }
  }

  return decorations;
}

class MonacoNextEditSuggestionSession implements NextEditSuggestionSession, Disposable {
  private readonly changeEmitter = new Emitter<NextEditSuggestionSessionChangeEvent>();
  private decorationIds: string[] = [];
  private disposed = false;
  private activeIndexValue = 0;
  private readonly suggestionsInternal: NextEditSuggestion[];

  readonly onDidChange: Event<NextEditSuggestionSessionChangeEvent> = this.changeEmitter.event;

  constructor(
    private readonly editor: MonacoEditor.IStandaloneCodeEditor,
    private readonly monaco: Monaco,
    suggestions: readonly NextEditSuggestion[],
    private readonly onAccept: (suggestion: NextEditSuggestion) => Promise<boolean>,
    private readonly onDiscard: () => void,
    private readonly onSelect: (index: number, suggestion: NextEditSuggestion) => void
  ) {
    this.suggestionsInternal = suggestions.map((s) => ({ ...s }));
    this.render();
  }

  get suggestions(): readonly NextEditSuggestion[] {
    return this.suggestionsInternal;
  }

  get activeSuggestion(): NextEditSuggestion | undefined {
    return this.suggestionsInternal[this.activeIndexValue];
  }

  get activeIndex(): number {
    return this.activeIndexValue;
  }

  reveal(): void {
    const suggestion = this.activeSuggestion;
    if (!suggestion) {
      return;
    }
    const primaryEdit = suggestion.edits[0];
    if (!primaryEdit) {
      return;
    }
    const range = toMonacoRange(this.monaco, primaryEdit.range);
    this.editor.revealRangeInCenter(range, this.monaco.editor.ScrollType.Smooth);
  }

  async accept(suggestion?: NextEditSuggestion): Promise<boolean> {
    const target = suggestion ?? this.activeSuggestion;
    if (!target) {
      return false;
    }
    const accepted = await this.onAccept(target);
    if (accepted) {
      this.dispose();
    }
    return accepted;
  }

  discard(): void {
    if (this.disposed) {
      return;
    }
    this.dispose();
    this.onDiscard();
  }

  selectNext(): void {
    this.setActiveIndex(this.activeIndexValue + 1);
  }

  selectPrevious(): void {
    this.setActiveIndex(this.activeIndexValue - 1);
  }

  setActiveIndex(index: number): void {
    if (this.suggestionsInternal.length === 0) {
      return;
    }
    const boundedIndex = ((index % this.suggestionsInternal.length) + this.suggestionsInternal.length) %
      this.suggestionsInternal.length;
    if (boundedIndex === this.activeIndexValue) {
      return;
    }
    this.activeIndexValue = boundedIndex;
    const active = this.activeSuggestion;
    if (active) {
      this.onSelect(this.activeIndexValue, active);
    }
    this.render();
  }

  dispose(): void {
    if (this.disposed) {
      return;
    }
    this.disposed = true;
    this.decorationIds = this.editor.deltaDecorations(this.decorationIds, []);
  }

  updateSuggestion(index: number, suggestion: NextEditSuggestion): void {
    this.suggestionsInternal[index] = { ...suggestion };
    if (index === this.activeIndexValue) {
      this.render();
    }
    this.changeEmitter.fire({
      activeSuggestion: this.activeSuggestion,
      allSuggestions: this.suggestionsInternal,
    });
  }

  private render(): void {
    const suggestion = this.activeSuggestion;
    if (!suggestion) {
      console.log('[Session Render] No active suggestion, clearing decorations');
      this.decorationIds = this.editor.deltaDecorations(this.decorationIds, []);
      return;
    }
    console.log('[Session Render] Rendering suggestion:', suggestion.label);
    const decorations = previewDecorationsFromSuggestion(this.monaco, suggestion);
    console.log('[Session Render] Created', decorations.length, 'decorations:', decorations.map(d => ({
      range: d.range.toString(),
      hasAfter: !!d.options.after,
      afterContent: d.options.after?.content?.substring(0, 50),
      inlineClassName: d.options.inlineClassName
    })));
    this.decorationIds = this.editor.deltaDecorations(this.decorationIds, decorations);
    console.log('[Session Render] Applied decorations, decoration IDs:', this.decorationIds);
    const active = this.activeSuggestion;
    if (active) {
      this.changeEmitter.fire({
        activeSuggestion: active,
        allSuggestions: this.suggestionsInternal,
      });
    }
  }
}

export interface InvokeOptions {
  readonly triggerKind?: NextEditTriggerKind;
  readonly selectIndex?: number;
}

export class MonacoNextEditSuggestionService implements NextEditSuggestionService, Disposable {
  private readonly providers: RegisteredProvider[] = [];
  private activeSession: MonacoNextEditSuggestionSession | undefined;
  private pendingRequest: CancellationTokenSource | undefined;
  private lastAcceptedSuggestionId: string | undefined;

  constructor(private readonly editor: MonacoEditor.IStandaloneCodeEditor, private readonly monaco: Monaco) {}

  registerProvider(
    selector: DocumentSelector,
    provider: NextEditSuggestionProvider,
    options?: NextEditRegistrationOptions
  ): Disposable {
    const entry: RegisteredProvider = { selector, provider, options };
    this.providers.push(entry);
    return {
      dispose: () => {
        const index = this.providers.indexOf(entry);
        if (index >= 0) {
          this.providers.splice(index, 1);
        }
      },
    };
  }

  async invoke(triggerKind: NextEditTriggerKind = NextEditTriggerKind.Invoke): Promise<NextEditSuggestionSession | undefined> {
    const model = this.editor.getModel();
    if (!model) {
      console.log('[Invoke] No model found');
      return undefined;
    }
    const document = new MonacoTextDocument(this.monaco, model);
    console.log('[Invoke] Document:', { uri: document.uri, languageId: document.languageId, version: document.version });
    console.log('[Invoke] Registered providers:', this.providers.length);
    this.providers.forEach((p, i) => {
      console.log(`[Invoke] Provider ${i}:`, { selector: p.selector, id: p.provider.id });
    });
    const provider = this.pickProvider(document);
    if (!provider) {
      console.log('[Invoke] No provider found for document');
      return undefined;
    }
    console.log('[Invoke] Using provider:', provider.provider.id);

    this.cancelPendingRequest();
    const requestCts = new CancellationTokenSource();
    this.pendingRequest = requestCts;

    if (this.activeSession) {
      this.activeSession.dispose();
      this.activeSession = undefined;
    }

    const selection = fromMonacoSelection(this.monaco, this.editor.getSelection());
    const context: NextEditSuggestionContext = {
      triggerKind,
      lastAcceptedSuggestionId: this.lastAcceptedSuggestionId,
    };

    console.log('[Invoke] Calling provideNextEditSuggestions with:', { selection, context });
    const result = await asPromise(provider.provider.provideNextEditSuggestions(document, selection, context, requestCts.token));
    console.log('[Invoke] Provider returned:', result ? { suggestionsCount: result.suggestions.length, suggestions: result.suggestions.map(s => s.label) } : 'undefined');

    if (requestCts !== this.pendingRequest || requestCts.token.isCancellationRequested) {
      console.log('[Invoke] Request was cancelled');
      return undefined;
    }

    if (!result || !result.suggestions.length) {
      console.log('[Invoke] No suggestions returned');
      return undefined;
    }
    console.log('[Invoke] Creating session with', result.suggestions.length, 'suggestions');

    let sessionRef: MonacoNextEditSuggestionSession;

    const handleSelect = async (index: number, suggestion: NextEditSuggestion) => {
      if (!provider.provider.resolveNextEditSuggestion) {
        return;
      }
      const resolved = await asPromise(
        provider.provider.resolveNextEditSuggestion(suggestion, requestCts.token)
      );
      if (resolved && sessionRef) {
        sessionRef.updateSuggestion(index, resolved);
      }
    };

    const session = new MonacoNextEditSuggestionSession(
      this.editor,
      this.monaco,
      result.suggestions,
      async (suggestion) => {
        applyMonacoEdits(this.monaco, this.editor, suggestion.edits);
        this.lastAcceptedSuggestionId = suggestion.id;
        return true;
      },
      () => {
        if (this.activeSession === sessionRef) {
          this.activeSession = undefined;
        }
      },
      handleSelect
    );

    sessionRef = session;
    this.activeSession = session;

    const initial = session.activeSuggestion;
    if (initial) {
      void handleSelect(session.activeIndex, initial);
    }

    session.reveal();
    return session;
  }

  getActiveSession(): NextEditSuggestionSession | undefined {
    return this.activeSession;
  }

  async acceptActiveSuggestion(): Promise<boolean> {
    if (!this.activeSession) {
      return false;
    }
    return this.activeSession.accept();
  }

  discardActiveSuggestion(): void {
    this.activeSession?.discard();
    this.activeSession = undefined;
  }

  selectNextSuggestion(): void {
    this.activeSession?.selectNext();
  }

  selectPreviousSuggestion(): void {
    this.activeSession?.selectPrevious();
  }

  setActiveSuggestionIndex(index: number): void {
    this.activeSession?.setActiveIndex(index);
  }

  dispose(): void {
    this.cancelPendingRequest();
    this.activeSession?.dispose();
    this.activeSession = undefined;
  }

  private cancelPendingRequest(): void {
    this.pendingRequest?.cancel();
    this.pendingRequest = undefined;
  }

  private pickProvider(document: TextDocument): RegisteredProvider | undefined {
    console.log('[PickProvider] Checking', this.providers.length, 'providers');
    for (let i = this.providers.length - 1; i >= 0; i -= 1) {
      const provider = this.providers[i];
      console.log(`[PickProvider] Checking provider ${i}:`, { id: provider.provider.id, selector: provider.selector });
      if (documentMatchesSelector(document, provider.selector)) {
        console.log(`[PickProvider] Provider ${i} matches!`);
        return provider;
      }
    }
    console.log('[PickProvider] No matching provider found');
    return undefined;
  }
}

async function asPromise<T>(value: ProviderResult<T>): Promise<T | undefined> {
  return (await value) ?? undefined;
}

