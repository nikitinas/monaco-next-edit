import type { editor as MonacoEditor } from 'monaco-editor';

import {
  CancellationToken,
  Command,
  MarkdownString,
  NextEditSuggestion,
  NextEditSuggestionContext,
  NextEditSuggestionList,
  NextEditSuggestionProvider,
  NextEditSuggestionService,
  NextEditTextEdit,
  NextEditTriggerKind,
  Range,
  Selection,
  TextDocument,
} from '../api/index.js';
import { MonacoNextEditSuggestionService } from '../monaco/index.js';
import { getMonaco } from '../monaco/monacoLoader.js';

/**
 * Demonstrates how a VS Code extension could use the proposed API surface.
 * This module intentionally depends only on Monaco primitives and the proposed
 * NextEditSuggestionService, making it suitable for inclusion in either a web
 * playground or VS Code core once the API solidifies.
 */

export interface DemoRegistration {
  readonly service: NextEditSuggestionService;
  dispose(): void;
}

export function registerPredictiveEditingDemo(editor: MonacoEditor.IStandaloneCodeEditor): DemoRegistration {
  const monaco = getMonaco();
  const service = new MonacoNextEditSuggestionService(editor, monaco);
  const provider = new PredictiveNextEditProvider();
  const registration = service.registerProvider({ language: editor.getModel()?.getLanguageId() ?? '*' }, provider);

  const triggerCommandId = 'demo.nextEditSuggestions.invoke';
  editor.addAction({
    id: triggerCommandId,
    label: 'Predict Next Edit',
    keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyMod.Alt | monaco.KeyCode.Enter],
    precondition: undefined,
    keybindingContext: undefined,
    contextMenuGroupId: 'navigation',
    contextMenuOrder: 1.5,
    run: async () => {
      await service.invoke(NextEditTriggerKind.Invoke);
    },
  });

  const acceptAction = editor.addAction({
    id: 'demo.nextEditSuggestions.accept',
    label: 'Accept Predicted Edit',
    keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyMod.Alt | monaco.KeyCode.KeyL],
    contextMenuGroupId: 'navigation',
    run: async () => {
      await service.acceptActiveSuggestion();
    },
  });

  const nextAction = editor.addAction({
    id: 'demo.nextEditSuggestions.next',
    label: 'Next Predicted Edit',
    keybindings: [monaco.KeyCode.Tab],
    contextMenuGroupId: 'navigation',
    run: async () => {
      service.selectNextSuggestion();
    },
  });

  const previousAction = editor.addAction({
    id: 'demo.nextEditSuggestions.previous',
    label: 'Previous Predicted Edit',
    keybindings: [monaco.KeyMod.Shift | monaco.KeyCode.Tab],
    contextMenuGroupId: 'navigation',
    run: async () => {
      service.selectPreviousSuggestion();
    },
  });

  let autoTriggerHandle: ReturnType<typeof setTimeout> | undefined;
  const modelChangeDisposable = editor.onDidChangeModelContent(() => {
    if (autoTriggerHandle) {
      clearTimeout(autoTriggerHandle);
    }
    autoTriggerHandle = setTimeout(() => {
      void service.invoke(NextEditTriggerKind.Automatic);
    }, 300);
  });

  return {
    service,
    dispose: () => {
      registration.dispose();
      acceptAction.dispose();
      nextAction.dispose();
      previousAction.dispose();
      modelChangeDisposable.dispose();
      if (autoTriggerHandle) {
        clearTimeout(autoTriggerHandle);
      }
      service.dispose();
    },
  };
}

class PredictiveNextEditProvider implements NextEditSuggestionProvider {
  readonly id = 'demo.predictiveNextEdit';

  async provideNextEditSuggestions(
    document: TextDocument,
    selection: Selection,
    context: NextEditSuggestionContext,
    token: CancellationToken
  ): Promise<NextEditSuggestionList | undefined> {
    console.log('[Provider] provideNextEditSuggestions called', { document: document.languageId, selection, context });
    const lines = document.getText().split(/\r?\n/);
    const currentLineIndex = Math.min(selection.active.line, lines.length - 1);
    const currentLine = lines[currentLineIndex] ?? '';
    const indent = currentLine.match(/^\s*/)?.[0] ?? '';
    const selectedText = document.getText({ start: selection.start, end: selection.end });

    if (token.isCancellationRequested) {
      console.log('[Provider] Cancellation requested');
      return undefined;
    }

    const suggestions: NextEditSuggestion[] = [];

    suggestions.push(createInlineLoggingSuggestion(selection, indent, currentLine.length));
    suggestions.push(createTryCatchSuggestion(selection, indent, selectedText));

    // Rank suggestions with most recently accepted suggestion at the end to avoid duplicates.
    if (context.lastAcceptedSuggestionId) {
      const idx = suggestions.findIndex((s) => s.id === context.lastAcceptedSuggestionId);
      if (idx >= 0) {
        const [recent] = suggestions.splice(idx, 1);
        suggestions.push(recent);
      }
    }

    console.log('[Provider] Returning', suggestions.length, 'suggestions:', suggestions.map(s => s.label));
    return { suggestions };
  }

  async resolveNextEditSuggestion(
    suggestion: NextEditSuggestion,
    _token: CancellationToken
  ): Promise<NextEditSuggestion | undefined> {
    const markdown: MarkdownString = {
      value: suggestion.id.includes('try-catch')
        ? 'Wraps the highlighted statements in a `try/catch` block and forwards the error to the caller.'
        : 'Inserts a console log scaffold with the values assigned on the current line to help you validate the change.',
    };

    return {
      ...suggestion,
      documentation: markdown,
      commands: createCommandsForSuggestion(suggestion),
    };
  }
}

function createInlineLoggingSuggestion(
  selection: Selection,
  indent: string,
  currentLineLength: number
): NextEditSuggestion {
  const range = createCollapsedRange(selection.active.line, currentLineLength);
  const logEdit: NextEditTextEdit = {
    range,
    insertText: `\n${indent}console.log('next edit prediction', { /* TODO: insert symbols */ });`,
  };

  return {
    id: 'demo.predictiveNextEdit.logging',
    label: 'Insert logging for the current change',
    detail: 'Predictive logging similar to JetBrains AI Assistant',
    edits: [logEdit],
    preview: {
      ghostTextOptions: {
        style: 'subtle',
        inlineClassName: 'next-edit-ghost-text',
      },
    },
  };
}

function createTryCatchSuggestion(selection: Selection, indent: string, selectedText: string): NextEditSuggestion {
  const start = selection.start;
  const end = selection.end;
  const normalizedSelection = normalizeSelectionText(selectedText, indent);
  const wrapped = `${indent}try {\n${normalizedSelection}\n${indent}} catch (error) {\n${indent}  throw error;\n${indent}}`;
  const edit: NextEditTextEdit = {
    range: { start, end },
    insertText: wrapped,
  };

  return {
    id: 'demo.predictiveNextEdit.try-catch',
    label: 'Wrap selection in try/catch',
    detail: 'Protect the selected statements and rethrow the error',
    edits: [edit],
    preview: {
      emphasisRanges: [selection],
      ghostTextOptions: {
        style: 'strong',
        inlineClassName: 'next-edit-ghost-strong',
      },
    },
  };
}

function createCommandsForSuggestion(suggestion: NextEditSuggestion): readonly Command[] | undefined {
  const commands: Command[] = [
    {
      title: 'Explain This Suggestion',
      command: 'demo.nextEditSuggestions.explain',
      arguments: [suggestion.id],
    },
  ];
  if (suggestion.id.includes('logging')) {
    commands.push({
      title: 'Generate telemetry event',
      command: 'demo.nextEditSuggestions.generateTelemetry',
      arguments: [suggestion.id],
    });
  }
  return commands;
}

function createCollapsedRange(line: number, character: number): Range {
  return {
    start: { line, character },
    end: { line, character },
  };
}

function normalizeSelectionText(text: string, indent: string): string {
  if (!text) {
    return `${indent}  // TODO: provide implementation`;
  }
  return text
    .split(/\r?\n/)
    .map((line) => {
      const trimmed = line.trimEnd();
      return trimmed ? `${indent}  ${trimmed}` : `${indent}`;
    })
    .join('\n');
}
