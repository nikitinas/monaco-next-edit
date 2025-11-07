import * as vscode from 'vscode';

const EXPLAIN_COMMAND = 'nextEditInlineCompletions.explainSuggestion';
const TELEMETRY_COMMAND = 'nextEditInlineCompletions.generateTelemetry';

interface SuggestionMetadata {
  readonly id: string;
  readonly label: string;
  readonly detail: string;
  readonly explanation: string;
}

class NextEditInlineCompletionItem extends vscode.InlineCompletionItem {
  constructor(
    public readonly metadata: SuggestionMetadata,
    insertText: string | vscode.SnippetString,
    range?: vscode.Range
  ) {
    super(insertText, range);
    this.filterText = metadata.label;
  }
}

class NextEditInlineCompletionProvider implements vscode.InlineCompletionItemProvider {
  private lastAcceptedSuggestionId: string | undefined;
  private lastShownSuggestionId: string | undefined;
  private readonly suggestionMetadata = new Map<string, SuggestionMetadata>();

  async provideInlineCompletionItems(
    document: vscode.TextDocument,
    position: vscode.Position,
    context: vscode.InlineCompletionContext,
    token: vscode.CancellationToken
  ): Promise<vscode.InlineCompletionList | vscode.InlineCompletionItem[] | undefined> {
    if (token.isCancellationRequested) {
      return undefined;
    }

    const indent = this.getIndent(document, position.line);
    const suggestions: NextEditInlineCompletionItem[] = [];
    const loggingSuggestion = this.createLoggingSuggestion(position, indent);
    if (loggingSuggestion) {
      suggestions.push(loggingSuggestion);
    }

    const tryCatchSuggestion = this.createTryCatchSuggestion(document, position, indent);
    if (tryCatchSuggestion) {
      suggestions.push(tryCatchSuggestion);
    }

    if (suggestions.length === 0) {
      return undefined;
    }

    for (const item of suggestions) {
      this.suggestionMetadata.set(item.metadata.id, item.metadata);
    }

    if (this.lastAcceptedSuggestionId) {
      const acceptedIndex = suggestions.findIndex(
        (item) => item.metadata.id === this.lastAcceptedSuggestionId
      );
      if (acceptedIndex >= 0) {
        const [accepted] = suggestions.splice(acceptedIndex, 1);
        suggestions.push(accepted);
      }
    }

    return new vscode.InlineCompletionList(suggestions);
  }

  handleDidShowCompletionItem(completionItem: vscode.InlineCompletionItem): void {
    if (completionItem instanceof NextEditInlineCompletionItem) {
      this.lastShownSuggestionId = completionItem.metadata.id;
    }
  }

  handleDidAcceptCompletionItem(completionItem: vscode.InlineCompletionItem): void {
    if (completionItem instanceof NextEditInlineCompletionItem) {
      this.lastAcceptedSuggestionId = completionItem.metadata.id;
    }
  }

  explainSuggestion(id?: string): void {
    const metadata = this.resolveMetadata(id ?? this.lastShownSuggestionId);
    if (!metadata) {
      void vscode.window.showInformationMessage(
        'No active inline suggestion to explain. Trigger inline completions to see predictions.'
      );
      return;
    }

    void vscode.window.showInformationMessage(metadata.label, { modal: false }, 'View Details').then(
      (selection) => {
        if (selection === 'View Details') {
          void vscode.window.showInformationMessage(metadata.explanation);
        }
      }
    );
    void vscode.window.setStatusBarMessage(`Next Edit: ${metadata.detail}`, 3000);
  }

  async generateTelemetry(id?: string): Promise<void> {
    const metadata = this.resolveMetadata(id ?? this.lastShownSuggestionId);
    if (!metadata) {
      void vscode.window.showInformationMessage(
        'No inline suggestion metadata available for telemetry.'
      );
      return;
    }

    const editor = vscode.window.activeTextEditor;
    if (!editor || editor.document.languageId === 'plaintext') {
      void vscode.window.showInformationMessage(
        'Open a code file to insert a telemetry stub for the suggestion.'
      );
      return;
    }

    const snippet = new vscode.SnippetString(
      `console.log('[telemetry] accepted next edit suggestion: ${metadata.id}');`
    );
    await editor.insertSnippet(snippet, editor.selection.active);
    void vscode.window.setStatusBarMessage(
      `Telemetry snippet inserted for ${metadata.label}`,
      3000
    );
  }

  private resolveMetadata(id: string | undefined): SuggestionMetadata | undefined {
    if (!id) {
      return undefined;
    }
    return this.suggestionMetadata.get(id);
  }

  private createLoggingSuggestion(
    position: vscode.Position,
    indent: string
  ): NextEditInlineCompletionItem | undefined {
    const id = 'next-edit-inline.logging';
    const range = new vscode.Range(position, position);
    const insertText = `\n${indent}console.log('next edit prediction', { /* TODO: insert symbols */ });`;
    const metadata: SuggestionMetadata = {
      id,
      label: 'Insert logging for the current change',
      detail: 'Predictive logging similar to JetBrains AI Assistant',
      explanation:
        'Inserts a `console.log` scaffold so you can observe state after applying the predicted edit. Replace the placeholder with relevant symbols.',
    };

    return new NextEditInlineCompletionItem(metadata, insertText, range);
  }

  private createTryCatchSuggestion(
    document: vscode.TextDocument,
    position: vscode.Position,
    indent: string
  ): NextEditInlineCompletionItem | undefined {
    const editor = vscode.window.activeTextEditor;
    if (!editor || editor.document.uri.toString() !== document.uri.toString()) {
      return undefined;
    }

    const selection = editor.selection;
    if (selection.isEmpty || !selection.contains(position)) {
      return undefined;
    }

    const id = 'next-edit-inline.try-catch';
    const normalized = this.normalizeSelectionText(document.getText(selection), indent);
    const wrapped = `${indent}try {\n${normalized}\n${indent}} catch (error) {\n${indent}  throw error;\n${indent}}`;
    const range = new vscode.Range(selection.start, selection.end);
    const metadata: SuggestionMetadata = {
      id,
      label: 'Wrap selection in try/catch',
      detail: 'Protect the highlighted statements and rethrow the error',
      explanation:
        'Surrounds the current selection with a defensive `try/catch` block so you can safely observe failures while still propagating the error.',
    };

    return new NextEditInlineCompletionItem(metadata, wrapped, range);
  }

  private normalizeSelectionText(text: string, indent: string): string {
    if (!text.trim()) {
      return `${indent}  // TODO: provide implementation`;
    }

    return text
      .split(/\r?\n/)
      .map((line) => {
        const trimmed = line.trimEnd();
        if (!trimmed) {
          return indent;
        }
        return `${indent}  ${trimmed}`;
      })
      .join('\n');
  }

  private getIndent(document: vscode.TextDocument, line: number): string {
    if (line < 0 || line >= document.lineCount) {
      return '';
    }
    const text = document.lineAt(line).text;
    const match = text.match(/^\s*/);
    return match ? match[0] : '';
  }
}

export function activate(context: vscode.ExtensionContext): void {
  const provider = new NextEditInlineCompletionProvider();

  context.subscriptions.push(
    vscode.languages.registerInlineCompletionItemProvider({ pattern: '**/*' }, provider)
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(EXPLAIN_COMMAND, (id?: string) => provider.explainSuggestion(id))
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(TELEMETRY_COMMAND, (id?: string) => provider.generateTelemetry(id))
  );
}

export function deactivate(): void {
  // No-op: VS Code disposes registered subscriptions automatically.
}
