import type { editor as MonacoEditor, Range as MonacoRange, Selection as MonacoSelection } from 'monaco-editor';

type Monaco = typeof import('monaco-editor');

import {
  CancellationToken,
  Command,
  DocumentSelector,
  DocumentFilter,
  Disposable,
  Event,
  EditSuggestion,
  EditSuggestionAcceptedEvent,
  EditSuggestionContext,
  EditSuggestionProvider,
  EditSuggestionService,
  EditSuggestionTriggerKind,
  EditSuggestionsDiscardedEvent,
  Position,
  Selection,
  TextDocument,
  TextEdit,
} from '../api/index.js';

type ProviderResult<T> = T | undefined | null | Promise<T | undefined | null>;

export interface RichMarkdownString {
  readonly value: string;
  readonly supportThemeIcons?: boolean;
  readonly isTrusted?: boolean;
}

export interface RichGhostTextOptions {
  readonly inlineClassName?: string;
  readonly style?: 'subtle' | 'strong' | 'default';
  readonly color?: string;
}

export interface RichEditSuggestionPreview {
  readonly emphasisRanges?: readonly Selection[];
  readonly ghostTextOptions?: RichGhostTextOptions;
}

export interface RichEditSuggestion extends EditSuggestion {
  readonly label?: string;
  readonly detail?: string;
  readonly documentation?: RichMarkdownString;
  readonly preview?: RichEditSuggestionPreview;
  readonly source?: string;
  readonly commands?: readonly Command[];
}

export interface MonacoEditSuggestionSessionChangeEvent {
  readonly activeSuggestion?: RichEditSuggestion;
  readonly allSuggestions: readonly RichEditSuggestion[];
}

export interface MonacoEditSuggestionSession extends Disposable {
  readonly suggestions: readonly RichEditSuggestion[];
  readonly activeSuggestion?: RichEditSuggestion;
  readonly activeIndex: number;
  readonly onDidChange: Event<MonacoEditSuggestionSessionChangeEvent>;
  reveal(): void;
  accept(suggestion?: RichEditSuggestion): Promise<boolean>;
  discard(): void;
  selectNext(): void;
  selectPrevious(): void;
  setActiveIndex(index: number): void;
}

type RichEditSuggestionProvider = EditSuggestionProvider & {
  resolveEditSuggestion?(
    suggestion: EditSuggestion,
    token: CancellationToken
  ): ProviderResult<EditSuggestion | undefined>;
};

interface RegisteredProvider {
  readonly selector: DocumentSelector;
  readonly provider: RichEditSuggestionProvider;
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
  edits: readonly TextEdit[]
): void {
  const operations = edits.map<MonacoEditor.IIdentifiedSingleEditOperation>((edit) => ({
    range: toMonacoRange(monaco, edit.range),
    text: edit.newText,
    forceMoveMarkers: true,
  }));
  editor.pushUndoStop();
  editor.executeEdits('nextEditSuggestion', operations);
  editor.pushUndoStop();
}

function previewDecorationsFromSuggestion(
  monaco: Monaco,
  suggestion: RichEditSuggestion,
  editor: MonacoEditor.IStandaloneCodeEditor
): MonacoEditor.IModelDeltaDecoration[] {
  const decorations: MonacoEditor.IModelDeltaDecoration[] = [];
  const ghostClassName = suggestion.preview?.ghostTextOptions?.inlineClassName ?? 'next-edit-ghost-text';

  const labelForLogging = suggestion.label ?? suggestion.id;
  console.log('[PreviewDecorations] Creating decorations for suggestion:', labelForLogging, 'with', suggestion.edits.length, 'edits');
  console.log('[PreviewDecorations] Ghost class name:', ghostClassName);

  // Get the current selection/cursor position and model
  const selection = editor.getSelection();
  const model = editor.getModel();
  
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

    const lines = edit.newText.split(/\r?\n/);
    
    // Find the first non-empty line to show as ghost text
    let ghostTextContent = '';
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].trim().length > 0) {
        ghostTextContent = lines[i];
        break;
      }
    }
    
    if (ghostTextContent.length > 0 && model) {
      // Determine the best position for ghost text
      // Monaco's 'after' content works best at the end of a line (within line bounds)
      // or at a position where text can be inserted inline
      let ghostLineNumber = range.startLineNumber;
      let ghostColumn: number;
      
      // If the range is at the start of a line (column 1), place at the end of that line
      if (range.startColumn === 1 && range.isEmpty()) {
        const lineLength = model.getLineLength(ghostLineNumber);
        ghostColumn = lineLength + 1; // End of line
      } else {
        // Use the range's end position
        ghostColumn = range.endColumn;
      }
      
      // Ensure we don't exceed the line bounds
      const maxColumn = model.getLineMaxColumn(ghostLineNumber);
      if (ghostColumn > maxColumn) {
        ghostColumn = maxColumn;
      }
      
      const ghostRange = new monaco.Range(ghostLineNumber, ghostColumn, ghostLineNumber, ghostColumn);
      
      console.log('[PreviewDecorations] Creating ghost text decoration:', {
        range: ghostRange.toString(),
        content: ghostTextContent.substring(0, 50),
        className: ghostClassName,
        lineLength: model.getLineLength(ghostLineNumber),
        maxColumn: model.getLineMaxColumn(ghostLineNumber)
      });
      
      decorations.push({
        range: ghostRange,
        options: {
          inlineClassName: ghostClassName,
          after: {
            content: ghostTextContent,
            inlineClassName: ghostClassName,
          },
        },
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

class GhostTextContentWidget implements MonacoEditor.IContentWidget {
  private domNode: HTMLElement;
  private position: MonacoEditor.IContentWidgetPosition | null = null;
  private isBetweenLines: boolean;

  constructor(
    private readonly monaco: Monaco,
    private readonly content: string,
    private readonly className: string,
    isBetweenLines: boolean = false
  ) {
    this.isBetweenLines = isBetweenLines;
    
    // Use a div for between-lines rendering (full line), span for inline
    this.domNode = isBetweenLines ? document.createElement('div') : document.createElement('span');
    this.domNode.className = className;
    this.domNode.textContent = content;
    this.domNode.style.color = 'rgba(148, 163, 184, 0.65)';
    this.domNode.style.fontStyle = 'italic';
    
    if (isBetweenLines) {
      // Style the div to appear as a full line between existing lines
      this.domNode.style.display = 'block';
      this.domNode.style.width = '100%';
      this.domNode.style.height = '1.5em'; // Match line height
      this.domNode.style.lineHeight = '1.5em';
      this.domNode.style.whiteSpace = 'pre';
      // Ensure it doesn't collapse
      this.domNode.style.minHeight = '1.5em';
    }
  }

  getId(): string {
    return 'next-edit-ghost-text-widget';
  }

  getDomNode(): HTMLElement {
    return this.domNode;
  }

  getPosition(): MonacoEditor.IContentWidgetPosition | null {
    return this.position;
  }

  updatePosition(position: MonacoEditor.IContentWidgetPosition): void {
    this.position = position;
  }

  updateContent(content: string): void {
    this.domNode.textContent = content;
  }

  dispose(): void {
    if (this.domNode.parentNode) {
      this.domNode.parentNode.removeChild(this.domNode);
    }
  }
}

class MonacoNextEditSuggestionSession implements MonacoEditSuggestionSession {
  private readonly changeEmitter = new Emitter<MonacoEditSuggestionSessionChangeEvent>();
  private decorationIds: string[] = [];
  private ghostTextWidget: GhostTextContentWidget | null = null;
  private disposed = false;
  private activeIndexValue = 0;
  private readonly suggestionsInternal: RichEditSuggestion[];

  readonly onDidChange: Event<MonacoEditSuggestionSessionChangeEvent> = this.changeEmitter.event;

  constructor(
    private readonly editor: MonacoEditor.IStandaloneCodeEditor,
    private readonly monaco: Monaco,
    suggestions: readonly RichEditSuggestion[],
    private readonly onAccept: (suggestion: RichEditSuggestion) => Promise<boolean>,
    private readonly onDiscard: () => void,
    private readonly onSelect: (index: number, suggestion: RichEditSuggestion) => void
  ) {
    this.suggestionsInternal = suggestions.map((s) => ({ ...s }));
    this.render();
  }

  get suggestions(): readonly RichEditSuggestion[] {
    return this.suggestionsInternal;
  }

  get activeSuggestion(): RichEditSuggestion | undefined {
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

  async accept(suggestion?: EditSuggestion): Promise<boolean> {
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
    if (this.ghostTextWidget) {
      this.editor.removeContentWidget(this.ghostTextWidget);
      this.ghostTextWidget.dispose();
      this.ghostTextWidget = null;
    }
  }

  updateSuggestion(index: number, suggestion: RichEditSuggestion): void {
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
      console.log('[Session Render] No active suggestion, clearing decorations and widget');
      this.decorationIds = this.editor.deltaDecorations(this.decorationIds, []);
      if (this.ghostTextWidget) {
        this.editor.removeContentWidget(this.ghostTextWidget);
        this.ghostTextWidget.dispose();
        this.ghostTextWidget = null;
      }
      return;
    }
    
    console.log('[Session Render] Rendering suggestion:', suggestion.label ?? suggestion.id);
    
    // Apply decorations for diff ranges and emphasis
    const decorations = previewDecorationsFromSuggestion(this.monaco, suggestion, this.editor);
    this.decorationIds = this.editor.deltaDecorations(this.decorationIds, decorations);
    
    // Extract ghost text content from the first edit
    const model = this.editor.getModel();
    const selection = this.editor.getSelection();
    if (!model) {
      return;
    }
    
    // Find ghost text content from the suggestion and determine its position
    let ghostTextContent = '';
    let ghostTextLineOffset = 0; // How many lines after the edit range this content should appear
    const ghostClassName = suggestion.preview?.ghostTextOptions?.inlineClassName ?? 'next-edit-ghost-text';
    
      for (const edit of suggestion.edits) {
        const lines = edit.newText.split(/\r?\n/);
      // Check if the first line is empty (starts with newline)
      const startsWithNewline = lines.length > 1 && lines[0].trim().length === 0;
      
      // Find the first non-empty line
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].trim().length > 0) {
          ghostTextContent = lines[i];
          ghostTextLineOffset = startsWithNewline ? 1 : 0; // If starts with newline, content is on next line
          break;
        }
      }
      if (ghostTextContent) break;
    }
    
    if (ghostTextContent) {
      // Determine position for ghost text widget
      // For multi-line inserts that start with newline, position on the next line
      const editRange = suggestion.edits[0]?.range;
      const editLineNumber = editRange ? editRange.start.line + 1 : (selection?.positionLineNumber || 1);
      const editColumn = editRange ? editRange.start.character + 1 : (selection?.positionColumn || 1);
      
      // Calculate target line: if insert starts with newline, use next line; otherwise use same line
      const targetLineNumber = editLineNumber + ghostTextLineOffset;
      const maxLineNumber = model.getLineCount();
      
      // If target line doesn't exist yet, we can still position there (Monaco will create it visually)
      const ghostLineNumber = Math.min(targetLineNumber, maxLineNumber + 1);
      
      // For content on a new line, start at column 1 (or with indentation)
      // For content on the same line, use end of line or edit column
      let ghostColumn: number;
      if (ghostTextLineOffset > 0) {
        // Content is on a new line (between lines) - preserve full content with indentation
        // For between-lines rendering, we use a full-width div that includes indentation
        // Position at column 1, and the div will handle the indentation visually
        ghostColumn = 1;
        // Keep the full content including indentation for between-lines rendering
        // The div will display it as a full line
      } else {
        // Content is on the same line - position at end of line or edit position
        const lineLength = model.getLineLength(ghostLineNumber);
        ghostColumn = editColumn <= lineLength ? lineLength + 1 : editColumn;
      }
      
      console.log('[Session Render] Creating ghost text widget:', {
        content: ghostTextContent.substring(0, 50),
        position: { lineNumber: ghostLineNumber, column: ghostColumn },
        lineOffset: ghostTextLineOffset,
        className: ghostClassName,
        editRange: editRange ? { start: editRange.start, end: editRange.end } : null
      });
      
      // Remove existing widget if any
      if (this.ghostTextWidget) {
        this.editor.removeContentWidget(this.ghostTextWidget);
        this.ghostTextWidget.dispose();
      }
      
      // Create new widget - if it's on a new line (between lines), use div for full line rendering
      const isBetweenLines = ghostTextLineOffset > 0;
      this.ghostTextWidget = new GhostTextContentWidget(this.monaco, ghostTextContent, ghostClassName, isBetweenLines);
      
      // For between-lines rendering, position at the start of the new line (column 1)
      // For inline rendering, use the calculated column
      const widgetColumn = isBetweenLines ? 1 : ghostColumn;
      
      this.ghostTextWidget.updatePosition({
        position: { lineNumber: ghostLineNumber, column: widgetColumn },
        preference: isBetweenLines 
          ? [this.monaco.editor.ContentWidgetPositionPreference.BELOW]
          : [this.monaco.editor.ContentWidgetPositionPreference.EXACT],
      });
      
      this.editor.addContentWidget(this.ghostTextWidget);
      console.log('[Session Render] Ghost text widget added to editor at line', ghostLineNumber, isBetweenLines ? '(between lines)' : '(inline)');
    } else {
      // No ghost text to show, remove widget if exists
      if (this.ghostTextWidget) {
        this.editor.removeContentWidget(this.ghostTextWidget);
        this.ghostTextWidget.dispose();
        this.ghostTextWidget = null;
      }
    }
    
    const active = this.activeSuggestion;
    if (active) {
      this.changeEmitter.fire({
        activeSuggestion: active,
        allSuggestions: this.suggestionsInternal,
      });
    }
  }
}

export class MonacoNextEditSuggestionService implements EditSuggestionService, Disposable {
  private readonly providers: RegisteredProvider[] = [];
  private readonly acceptEmitter = new Emitter<EditSuggestionAcceptedEvent>();
  readonly onDidAcceptSuggestion: Event<EditSuggestionAcceptedEvent> = this.acceptEmitter.event;
  private readonly discardEmitter = new Emitter<EditSuggestionsDiscardedEvent>();
  readonly onDidDiscardSuggestions: Event<EditSuggestionsDiscardedEvent> = this.discardEmitter.event;
  private activeSession: MonacoNextEditSuggestionSession | undefined;
  private pendingRequest: CancellationTokenSource | undefined;
  private lastAcceptedSuggestionId: string | undefined;

  constructor(private readonly editor: MonacoEditor.IStandaloneCodeEditor, private readonly monaco: Monaco) {}

  registerProvider(
    selector: DocumentSelector,
    provider: EditSuggestionProvider
  ): Disposable {
    const entry: RegisteredProvider = { selector, provider: provider as RichEditSuggestionProvider };
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

  async invoke(
    triggerKind: EditSuggestionTriggerKind = EditSuggestionTriggerKind.Invoke
  ): Promise<MonacoEditSuggestionSession | undefined> {
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
    const context: EditSuggestionContext = {
      triggerKind,
      lastAcceptedSuggestionId: this.lastAcceptedSuggestionId,
    };

    console.log('[Invoke] Calling provideEditSuggestions with:', { selection, context });
    const result = await asPromise(
      provider.provider.provideEditSuggestions(document, selection, context, requestCts.token)
    );
    console.log(
      '[Invoke] Provider returned:',
      result
        ? {
            suggestionsCount: result.suggestions.length,
            suggestions: result.suggestions.map((s) =>
              'label' in s ? (s as RichEditSuggestion).label ?? s.id : s.id
            ),
          }
        : 'undefined'
    );

    if (requestCts !== this.pendingRequest || requestCts.token.isCancellationRequested) {
      console.log('[Invoke] Request was cancelled');
      return undefined;
    }

    if (!result || !result.suggestions.length) {
      console.log('[Invoke] No suggestions returned');
      return undefined;
    }
    console.log('[Invoke] Creating session with', result.suggestions.length, 'suggestions');

    const suggestions = result.suggestions.map((suggestion) => ({ ...suggestion })) as RichEditSuggestion[];

    let sessionRef: MonacoNextEditSuggestionSession;

    const handleSelect = async (index: number, suggestion: RichEditSuggestion) => {
      const resolver = provider.provider.resolveEditSuggestion;
      if (!resolver) {
        return;
      }
      const resolved = await asPromise(resolver.call(provider.provider, suggestion, requestCts.token));
      if (resolved && sessionRef) {
        const merged = { ...suggestion, ...resolved } as RichEditSuggestion;
        sessionRef.updateSuggestion(index, merged);
      }
    };

    const session = new MonacoNextEditSuggestionSession(
      this.editor,
      this.monaco,
      suggestions,
      async (suggestion) => {
        applyMonacoEdits(this.monaco, this.editor, suggestion.edits);
        this.lastAcceptedSuggestionId = suggestion.id;
        this.acceptEmitter.fire({ suggestion });
        return true;
      },
      () => {
        if (this.activeSession === sessionRef) {
          this.activeSession = undefined;
        }
        const discarded = sessionRef?.suggestions ?? [];
        if (discarded.length) {
          this.discardEmitter.fire({ suggestions: discarded });
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

  getActiveSession(): MonacoEditSuggestionSession | undefined {
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

