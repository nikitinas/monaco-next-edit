type MonacoNamespace = typeof import('monaco-editor');

import {
  type Command,
  type Disposable,
  EditSuggestionTriggerKind,
} from '../api/index.js';
import { registerPredictiveEditingDemo } from '../demo/mockExtension.js';
import { loadMonaco } from '../monaco/monacoLoader.js';
import type { editor as MonacoEditor } from 'monaco-editor';
import type {
  MonacoEditSuggestionSession,
  MonacoEditSuggestionSessionChangeEvent,
  RichEditSuggestion,
} from '../monaco/monacoNextEditSuggestionService.js';

type Monaco = Awaited<ReturnType<typeof loadMonaco>>;

const SAMPLE_SNIPPETS = [
  `export interface TodoItem {
  id: string;
  title: string;
  completed: boolean;
}

export function toggleTodo(items: TodoItem[], targetId: string): TodoItem[] {
  return items.map((item) => {
    if (item.id === targetId) {
      return { ...item, completed: !item.completed };
    }
    return item;
  });
}
`,
  `type Request = {
  readonly method: 'GET' | 'POST';
  readonly url: string;
  readonly body?: Record<string, unknown>;
};

export async function fetchJson<T>(request: Request): Promise<T> {
  const response = await fetch(request.url, {
    method: request.method,
    headers: { 'Content-Type': 'application/json' },
    body: request.body ? JSON.stringify(request.body) : undefined,
  });

  if (!response.ok) {
    throw new Error('Request to ' + request.url + ' failed with status ' + response.status);
  }

  return (await response.json()) as T;
}
`,
  `interface MetricsEvent {
  readonly name: string;
  readonly timestamp: number;
  readonly payload?: Record<string, unknown>;
}

export class MetricsBuffer {
  private readonly pending: MetricsEvent[] = [];

  enqueue(event: MetricsEvent): void {
    this.pending.push(event);
  }

  flush(send: (events: readonly MetricsEvent[]) => Promise<void>): Promise<void> {
    if (!this.pending.length) {
      return Promise.resolve();
    }

    const batch = [...this.pending];
    this.pending.length = 0;
    return send(batch);
  }
}
`,
];

let themeRegistered = false;

function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function formatMarkdown(value: string): string {
  const escaped = escapeHtml(value);
  return escaped.replace(/`([^`]+)`/g, '<code>$1</code>').replace(/\n/g, '<br />');
}

function renderSuggestionFeed(
  session: MonacoEditSuggestionSession | undefined,
  event: MonacoEditSuggestionSessionChangeEvent | undefined,
  listElement: HTMLOListElement,
  statusElement: HTMLElement,
  docElement: HTMLElement
): void {
  const suggestions = (event?.allSuggestions ?? session?.suggestions ?? []) as readonly RichEditSuggestion[];
  const active = (event?.activeSuggestion ?? session?.activeSuggestion) as RichEditSuggestion | undefined;

  console.log('renderSuggestionFeed called with:', {
    hasSession: !!session,
    hasEvent: !!event,
    suggestionsCount: suggestions.length,
    suggestions: suggestions.map((suggestion: RichEditSuggestion) => suggestion.label ?? suggestion.id),
  });

  if (!suggestions.length) {
    listElement.innerHTML = '';
    statusElement.textContent = 'Click "Generate Next Edit Suggestions" to populate the feed.';
    docElement.innerHTML =
      '<p class="suggestion-doc-empty">Documentation for the active suggestion will appear here.</p>';
    return;
  }

  statusElement.textContent = suggestions.length === 1 ? '1 suggestion available.' : `${suggestions.length} suggestions available.`;

  const activeIndex = session?.activeIndex ?? (active ? suggestions.indexOf(active) : -1);
  const markup = suggestions
    .map((suggestion: RichEditSuggestion, index: number) => {
      const label = escapeHtml(suggestion.label ?? suggestion.id);
      const detail = suggestion.detail ? `<span class="suggestion-detail">${escapeHtml(suggestion.detail)}</span>` : '';
      const commands = suggestion.commands && suggestion.commands.length
        ? `<span class="suggestion-commands">${suggestion.commands
            .map((command: Command) => escapeHtml(command.title))
            .join(' ? ')}</span>`
        : '';
      const classes = ['suggestion-item'];
      if (index === activeIndex) {
        classes.push('active');
      }
      return `<li class="${classes.join(' ')}"><span class="suggestion-label">${label}</span>${detail}${commands}</li>`;
    })
    .join('');

  console.log('Rendering markup:', markup);
  console.log('List element before innerHTML:', {
    element: listElement,
    id: listElement.id,
    className: listElement.className,
    isConnected: listElement.isConnected,
    parentElement: listElement.parentElement?.tagName,
    currentInnerHTML: listElement.innerHTML.substring(0, 100)
  });
  listElement.innerHTML = markup;
  const computedStyle = window.getComputedStyle(listElement);
  const firstChild = listElement.firstElementChild as HTMLElement | null;
  const firstChildStyle = firstChild ? window.getComputedStyle(firstChild) : null;
  const secondChild = listElement.children[1] as HTMLElement | null;
  const secondChildStyle = secondChild ? window.getComputedStyle(secondChild) : null;
  
  console.log('List element after innerHTML:', {
    innerHTMLLength: listElement.innerHTML.length,
    children: listElement.children.length,
    firstChild: listElement.firstElementChild?.tagName,
    firstChildText: listElement.firstElementChild?.textContent?.substring(0, 50),
    listElementVisible: listElement.offsetParent !== null,
    listElementDisplay: computedStyle.display,
    listElementVisibility: computedStyle.visibility,
    listElementOpacity: computedStyle.opacity,
    listElementHeight: computedStyle.height,
    listElementWidth: computedStyle.width,
    listElementColor: computedStyle.color,
    listElementBackgroundColor: computedStyle.backgroundColor,
    firstChildVisible: firstChild ? firstChild.offsetParent !== null : null,
    firstChildDisplay: firstChildStyle?.display,
    firstChildVisibility: firstChildStyle?.visibility,
    firstChildOpacity: firstChildStyle?.opacity,
    firstChildHeight: firstChildStyle?.height,
    firstChildWidth: firstChildStyle?.width,
    firstChildBackgroundColor: firstChildStyle?.backgroundColor,
    firstChildColor: firstChildStyle?.color,
    secondChildVisible: secondChild ? secondChild.offsetParent !== null : null,
    secondChildDisplay: secondChildStyle?.display,
    secondChildHeight: secondChildStyle?.height,
    secondChildBackgroundColor: secondChildStyle?.backgroundColor
  });
  
  // Force a reflow to ensure rendering
  void listElement.offsetHeight;
  
  // Also log the actual DOM structure
  console.log('DOM structure:', {
    listElementHTML: listElement.outerHTML.substring(0, 200),
    firstChildHTML: firstChild?.outerHTML.substring(0, 150),
    parentElement: listElement.parentElement?.tagName,
    parentDisplay: listElement.parentElement ? window.getComputedStyle(listElement.parentElement).display : null,
    parentVisibility: listElement.parentElement ? window.getComputedStyle(listElement.parentElement).visibility : null
  });

  if (active?.documentation?.value) {
    docElement.innerHTML = formatMarkdown(active.documentation.value);
  } else {
    docElement.innerHTML =
      '<p class="suggestion-doc-empty">Focus a suggestion to view contextual documentation.</p>';
  }
}

function defineTheme(monaco: Monaco): void {
  if (themeRegistered) {
    return;
  }
  monaco.editor.defineTheme('next-edit-nightfall', {
    base: 'vs-dark',
    inherit: true,
    rules: [
      { token: 'comment', foreground: '64748b' },
      { token: 'string', foreground: 'facc15' },
      { token: 'keyword', foreground: '38bdf8' },
      { token: 'number', foreground: 'f472b6' },
      { token: 'type.identifier', foreground: 'a5b4fc' },
    ],
    colors: {
      'editor.background': '#0b1120',
      'editorLineNumber.foreground': '#475569',
      'editorLineNumber.activeForeground': '#e2e8f0',
      'editorCursor.foreground': '#38bdf8',
      'editor.selectionBackground': '#1e293b',
      'editor.inactiveSelectionBackground': '#1e293baa',
      'editor.selectionHighlightBackground': '#1e293b99',
      'scrollbarSlider.background': '#1f293773',
    },
  });
  themeRegistered = true;
}

export async function startDemoSite(): Promise<void> {
  const monaco = await loadMonaco();
  const editorContainer = document.getElementById('editor');
  const suggestionListElement = document.getElementById('suggestion-list');
  const suggestionStatusElement = document.getElementById('suggestion-status');
  const suggestionDocElement = document.getElementById('suggestion-documentation');
  const populateButton = document.getElementById('populate-editor');
  const invokeButton = document.getElementById('invoke-suggestions');

  if (
    !(editorContainer instanceof HTMLElement) ||
    !(suggestionListElement instanceof HTMLOListElement) ||
    !(suggestionStatusElement instanceof HTMLElement) ||
    !(suggestionDocElement instanceof HTMLElement)
  ) {
    throw new Error('Demo layout is missing required elements.');
  }

  const suggestionList = suggestionListElement as HTMLOListElement;
  const suggestionStatus = suggestionStatusElement as HTMLElement;
  const suggestionDoc = suggestionDocElement as HTMLElement;

  defineTheme(monaco);

  const editor = monaco.editor.create(editorContainer, {
    value: SAMPLE_SNIPPETS[0],
    language: 'typescript',
    automaticLayout: true,
    theme: 'next-edit-nightfall',
    fontSize: 15,
    minimap: { enabled: false },
    padding: { top: 16, bottom: 16 },
    scrollbar: { verticalScrollbarSize: 12, horizontalScrollbarSize: 12 },
    renderWhitespace: 'selection',
  });

  if (typeof window !== 'undefined') {
    (window as typeof window & { __demoEditor?: MonacoEditor.IStandaloneCodeEditor }).__demoEditor = editor;
  }

  let sampleIndex = 0;
  let sessionSubscription: Disposable | undefined;

  const registration = registerPredictiveEditingDemo(editor);
  const service = registration.service;

  function attachSession(session: MonacoEditSuggestionSession | undefined): void {
    sessionSubscription?.dispose();
    sessionSubscription = undefined;

    if (!session) {
      renderSuggestionFeed(undefined, undefined, suggestionList, suggestionStatus, suggestionDoc);
      return;
    }

    console.log('attachSession called with session:', {
      suggestionsCount: session.suggestions.length,
      activeIndex: session.activeIndex,
      activeSuggestion: session.activeSuggestion?.label
    });

    // Render immediately with the session's current state
      renderSuggestionFeed(
        session,
        { activeSuggestion: session.activeSuggestion, allSuggestions: session.suggestions },
        suggestionList,
        suggestionStatus,
        suggestionDoc
      );
    
    // Subscribe to changes for when suggestions are resolved (e.g., documentation is added)
    sessionSubscription = session.onDidChange((sessionEvent: MonacoEditSuggestionSessionChangeEvent) => {
      console.log('Session change event fired:', {
        suggestionsCount: sessionEvent.allSuggestions.length,
        activeSuggestion: sessionEvent.activeSuggestion?.label,
      });
      renderSuggestionFeed(session, sessionEvent, suggestionList, suggestionStatus, suggestionDoc);
    });
  }

  function loadSample(index: number): void {
    sampleIndex = index % SAMPLE_SNIPPETS.length;
    const snippet = SAMPLE_SNIPPETS[sampleIndex];
    const model = editor.getModel();
    if (model) {
      model.pushEditOperations(
        [],
        [
          {
            range: model.getFullModelRange(),
            text: snippet,
          },
        ],
        () => null
      );
    } else {
      editor.setValue(snippet);
    }
    const lastLine = editor.getModel()?.getLineCount() ?? 1;
    editor.setPosition({ lineNumber: lastLine, column: editor.getModel()?.getLineMaxColumn(lastLine) ?? 1 });
    editor.focus();
    service.discardActiveSuggestion();
    attachSession(undefined);
  }

    populateButton?.addEventListener('click', () => {
      loadSample(sampleIndex + 1);
    });

    invokeButton?.addEventListener('click', async () => {
      suggestionStatus.textContent = 'Generating suggestions...';
      try {
        const session = await service.invoke(EditSuggestionTriggerKind.Invoke);
        console.log('Invoke result:', session ? `Session with ${session.suggestions.length} suggestions` : 'No session');
        if (!session) {
          suggestionStatus.textContent = 'No suggestions available for the current selection.';
          attachSession(undefined);
          return;
        }
        console.log('Attaching session with suggestions:', session.suggestions.map((suggestion: RichEditSuggestion) => suggestion.label ?? suggestion.id));
        attachSession(session);
        // Note: renderSuggestionFeed in attachSession already sets the status text
        // to show the count of suggestions, so we don't need to overwrite it here.
      } catch (error) {
        console.error('Failed to invoke suggestions', error);
        suggestionStatus.textContent = 'Something went wrong while generating suggestions.';
      }
    });

  window.addEventListener('resize', () => editor.layout());

  window.addEventListener('beforeunload', () => {
    sessionSubscription?.dispose();
    registration.dispose();
    editor.dispose();
    if (typeof window !== 'undefined') {
      delete (window as typeof window & { __demoEditor?: MonacoEditor.IStandaloneCodeEditor }).__demoEditor;
    }
  });

  renderSuggestionFeed(undefined, undefined, suggestionList, suggestionStatus, suggestionDoc);
}

declare global {
  interface Window {
    startDemoSite?: () => Promise<void>;
    __demoEditor?: MonacoEditor.IStandaloneCodeEditor;
  }
}

if (typeof window !== 'undefined') {
  window.startDemoSite = startDemoSite;
}
