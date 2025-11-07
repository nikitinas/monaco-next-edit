import * as vscode from 'vscode';

const EXPLAIN_COMMAND = 'nextEditInlineCompletions.explainSuggestion';
const TELEMETRY_COMMAND = 'nextEditInlineCompletions.generateTelemetry';
const OUTPUT_CHANNEL_NAME = 'Next Edit Inline Completions';

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
  private readonly outputChannel: vscode.OutputChannel;

  constructor(outputChannel: vscode.OutputChannel) {
    this.outputChannel = outputChannel;
  }

  async provideInlineCompletionItems(
    document: vscode.TextDocument,
    position: vscode.Position,
    context: vscode.InlineCompletionContext,
    token: vscode.CancellationToken
  ): Promise<vscode.InlineCompletionList | vscode.InlineCompletionItem[] | undefined> {
    const timestamp = new Date().toISOString();
    const fileName = document.fileName.split('/').pop() || document.fileName;
    const lineInfo = `Line ${position.line + 1}, Column ${position.character + 1}`;
    
    this.outputChannel.appendLine(`[${timestamp}] provideInlineCompletionItems invoked`);
    this.outputChannel.appendLine(`  File: ${fileName}`);
    this.outputChannel.appendLine(`  Position: ${lineInfo}`);
    this.outputChannel.appendLine(`  Context: ${context.triggerKind === vscode.InlineCompletionTriggerKind.Automatic ? 'Automatic' : 'Manual'}`);

    if (token.isCancellationRequested) {
      this.outputChannel.appendLine('  Cancelled: token was already cancelled');
      return undefined;
    }

    const indent = this.getIndent(document, position.line);
    const suggestions: NextEditInlineCompletionItem[] = [];
    
    const renameSuggestion = this.createRenameSuggestion(document, position);
    if (renameSuggestion) {
      suggestions.push(renameSuggestion);
      this.outputChannel.appendLine(`  Created rename suggestion: ${renameSuggestion.metadata.label}`);
    }

    const multilineSuggestion = this.createMultilineSuggestion(document, position, indent);
    if (multilineSuggestion) {
      suggestions.push(multilineSuggestion);
      this.outputChannel.appendLine(`  Created multiline suggestion: ${multilineSuggestion.metadata.label}`);
    }

    const replacementSuggestion = this.createReplacementSuggestion(document, position);
    if (replacementSuggestion) {
      suggestions.push(replacementSuggestion);
      this.outputChannel.appendLine(`  Created replacement suggestion: ${replacementSuggestion.metadata.label}`);
    }

    const deletionSuggestion = this.createDeletionSuggestion(document, position);
    if (deletionSuggestion) {
      suggestions.push(deletionSuggestion);
      this.outputChannel.appendLine(`  Created deletion suggestion: ${deletionSuggestion.metadata.label}`);
    }

    const tryCatchSuggestion = this.createTryCatchSuggestion(document, position, indent);
    if (tryCatchSuggestion) {
      suggestions.push(tryCatchSuggestion);
      this.outputChannel.appendLine(`  Created try/catch suggestion: ${tryCatchSuggestion.metadata.label}`);
    }

    if (suggestions.length === 0) {
      this.outputChannel.appendLine('  No suggestions generated');
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
        this.outputChannel.appendLine(`  Prioritized previously accepted suggestion: ${accepted.metadata.id}`);
      }
    }

    this.outputChannel.appendLine(`  Returning ${suggestions.length} suggestion(s)`);
    return new vscode.InlineCompletionList(suggestions);
  }

  handleDidShowCompletionItem(completionItem: vscode.InlineCompletionItem): void {
    if (completionItem instanceof NextEditInlineCompletionItem) {
      this.lastShownSuggestionId = completionItem.metadata.id;
      const timestamp = new Date().toISOString();
      this.outputChannel.appendLine(`[${timestamp}] Suggestion shown: ${completionItem.metadata.id} - ${completionItem.metadata.label}`);
    }
  }

  handleDidAcceptCompletionItem(completionItem: vscode.InlineCompletionItem): void {
    if (completionItem instanceof NextEditInlineCompletionItem) {
      this.lastAcceptedSuggestionId = completionItem.metadata.id;
      const timestamp = new Date().toISOString();
      this.outputChannel.appendLine(`[${timestamp}] Suggestion accepted: ${completionItem.metadata.id} - ${completionItem.metadata.label}`);
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

  private createReplacementSuggestion(
    document: vscode.TextDocument,
    position: vscode.Position
  ): NextEditInlineCompletionItem | undefined {
    const lineText = document.lineAt(position.line).text;
    const textBeforeCursor = lineText.substring(0, position.character);
    const textAfterCursor = lineText.substring(position.character);

    let replacementText: string | undefined;
    let range: vscode.Range | undefined;
    let suggestionLabel: string | undefined;
    let suggestionDetail: string | undefined;
    let suggestionExplanation: string | undefined;

    // Pattern 1: Replace deprecated APIs
    const varMatch = lineText.match(/\bvar\b/);
    if (varMatch) {
      const startPos = lineText.indexOf(varMatch[0]);
      const endPos = startPos + varMatch[0].length;
      range = new vscode.Range(
        new vscode.Position(position.line, startPos),
        new vscode.Position(position.line, endPos)
      );
      replacementText = 'const';
      suggestionLabel = 'Replace var with const';
      suggestionDetail = 'Use const for better scoping';
      suggestionExplanation = 'Replaces var with const to prevent accidental reassignment and improve code quality.';
    }
    // Replace == with ===
    else if (lineText.includes(' == ')) {
      const eqMatch = lineText.match(/\s==\s/);
      if (eqMatch) {
        const startPos = lineText.indexOf(eqMatch[0]);
        const endPos = startPos + eqMatch[0].length;
        range = new vscode.Range(
          new vscode.Position(position.line, startPos),
          new vscode.Position(position.line, endPos)
        );
        replacementText = ' === ';
        suggestionLabel = 'Replace == with ===';
        suggestionDetail = 'Use strict equality';
        suggestionExplanation = 'Replaces loose equality (==) with strict equality (===) to avoid type coercion issues.';
      }
    }
    // Replace XMLHttpRequest with fetch
    else if (lineText.includes('XMLHttpRequest')) {
      const xhrMatch = lineText.match(/\bXMLHttpRequest\b/);
      if (xhrMatch) {
        const startPos = lineText.indexOf(xhrMatch[0]);
        const endPos = startPos + xhrMatch[0].length;
        range = new vscode.Range(
          new vscode.Position(position.line, startPos),
          new vscode.Position(position.line, endPos)
        );
        replacementText = 'fetch';
        suggestionLabel = 'Replace XMLHttpRequest with fetch API';
        suggestionDetail = 'Use modern fetch API';
        suggestionExplanation = 'Replaces the deprecated XMLHttpRequest with the modern fetch API for better browser support and cleaner code.';
      }
    }
    // Convert function to arrow function
    else {
      const funcMatch = lineText.match(/function\s+(\w+)\s*\(/);
      if (funcMatch) {
        const startPos = lineText.indexOf(funcMatch[0]);
        const endPos = startPos + funcMatch[0].length;
        range = new vscode.Range(
          new vscode.Position(position.line, startPos),
          new vscode.Position(position.line, endPos)
        );
        replacementText = `const ${funcMatch[1]} = (`;
        suggestionLabel = 'Convert function to arrow function';
        suggestionDetail = 'Modernize function syntax';
        suggestionExplanation = 'Converts a traditional function declaration to an arrow function for more concise syntax.';
      }
    }

    // Pattern 2: Replace console.log with proper logging
    if (!replacementText && lineText.includes('console.log')) {
      const consoleMatch = lineText.match(/console\.log\([^)]*\)/);
      if (consoleMatch) {
        const startPos = lineText.indexOf(consoleMatch[0]);
        const endPos = startPos + consoleMatch[0].length;
        range = new vscode.Range(
          new vscode.Position(position.line, startPos),
          new vscode.Position(position.line, endPos)
        );
        replacementText = "logger.debug('message', data)";
        suggestionLabel = 'Replace console.log with logger';
        suggestionDetail = 'Use proper logging framework';
        suggestionExplanation = 'Replaces console.log with a proper logging framework call for better production logging.';
      }
    }

    // Pattern 3: Replace string concatenation with template literals
    if (!replacementText && lineText.includes("'") && lineText.includes('+')) {
      const concatMatch = lineText.match(/(['"])([^'"]+)\1\s*\+\s*(['"])([^'"]+)\3/);
      if (concatMatch) {
        const startPos = lineText.indexOf(concatMatch[0]);
        const endPos = startPos + concatMatch[0].length;
        range = new vscode.Range(
          new vscode.Position(position.line, startPos),
          new vscode.Position(position.line, endPos)
        );
        replacementText = `\`${concatMatch[2]}${concatMatch[4]}\``;
        suggestionLabel = 'Replace string concatenation with template literal';
        suggestionDetail = 'Use modern template literals';
        suggestionExplanation = 'Replaces string concatenation with template literals for better readability and performance.';
      }
    }

    if (!replacementText || !range) {
      return undefined;
    }

    const id = 'next-edit-inline.replacement';
    const metadata: SuggestionMetadata = {
      id,
      label: suggestionLabel!,
      detail: suggestionDetail!,
      explanation: suggestionExplanation!,
    };

    return new NextEditInlineCompletionItem(metadata, replacementText, range);
  }

  private createDeletionSuggestion(
    document: vscode.TextDocument,
    position: vscode.Position
  ): NextEditInlineCompletionItem | undefined {
    const lineText = document.lineAt(position.line).text.trim();
    const lineLower = lineText.toLowerCase();

    let deletionRange: vscode.Range | undefined;
    let suggestionLabel: string | undefined;
    let suggestionDetail: string | undefined;
    let suggestionExplanation: string | undefined;

    // Pattern 1: Remove console.log statements
    if (lineLower.includes('console.log') || lineLower.includes('console.debug') || lineLower.includes('console.info')) {
      const consoleMatch = lineText.match(/console\.(log|debug|info|warn)\([^)]*\);?/);
      if (consoleMatch) {
        const startPos = lineText.indexOf(consoleMatch[0]);
        const endPos = startPos + consoleMatch[0].length;
        deletionRange = new vscode.Range(
          new vscode.Position(position.line, startPos),
          new vscode.Position(position.line, endPos)
        );
        suggestionLabel = 'Remove console.log statement';
        suggestionDetail = 'Clean up debug code';
        suggestionExplanation = 'Removes console.log statements that are typically used for debugging and should not be in production code.';
      }
    }
    // Pattern 2: Remove TODO comments
    else if (lineLower.includes('todo') || lineLower.includes('fixme') || lineLower.includes('hack')) {
      const todoMatch = lineText.match(/\/\/\s*(TODO|FIXME|HACK|XXX):\s*.*/i);
      if (todoMatch) {
        const startPos = lineText.indexOf(todoMatch[0]);
        const endPos = startPos + todoMatch[0].length;
        deletionRange = new vscode.Range(
          new vscode.Position(position.line, startPos),
          new vscode.Position(position.line, endPos)
        );
        suggestionLabel = 'Remove TODO comment';
        suggestionDetail = 'Clean up resolved TODOs';
        suggestionExplanation = 'Removes TODO/FIXME comments that have been resolved or are no longer needed.';
      }
    }
    // Pattern 3: Remove unused variable declarations
    else if (lineLower.match(/^\s*(var|let|const)\s+\w+\s*=\s*[^;]+;\s*$/)) {
      const varMatch = lineText.match(/^\s*((var|let|const)\s+\w+\s*=\s*[^;]+;)\s*$/);
      if (varMatch) {
        deletionRange = new vscode.Range(
          new vscode.Position(position.line, 0),
          new vscode.Position(position.line, lineText.length)
        );
        suggestionLabel = 'Remove unused variable';
        suggestionDetail = 'Clean up dead code';
        suggestionExplanation = 'Removes variable declarations that appear to be unused or unnecessary.';
      }
    }
    // Pattern 4: Remove empty lines or whitespace-only lines
    else if (lineText.trim() === '' && position.character === 0) {
      deletionRange = new vscode.Range(
        new vscode.Position(position.line, 0),
        new vscode.Position(position.line + 1, 0)
      );
      suggestionLabel = 'Remove empty line';
      suggestionDetail = 'Clean up formatting';
      suggestionExplanation = 'Removes empty lines to improve code formatting and reduce unnecessary whitespace.';
    }
    // Pattern 5: Remove debugger statements
    else if (lineLower.includes('debugger')) {
      const debuggerMatch = lineText.match(/debugger\s*;?/);
      if (debuggerMatch) {
        const startPos = lineText.indexOf(debuggerMatch[0]);
        const endPos = startPos + debuggerMatch[0].length;
        deletionRange = new vscode.Range(
          new vscode.Position(position.line, startPos),
          new vscode.Position(position.line, endPos)
        );
        suggestionLabel = 'Remove debugger statement';
        suggestionDetail = 'Remove debugging breakpoint';
        suggestionExplanation = 'Removes debugger statements that should not be committed to version control.';
      }
    }

    if (!deletionRange) {
      return undefined;
    }

    const id = 'next-edit-inline.deletion';
    const metadata: SuggestionMetadata = {
      id,
      label: suggestionLabel!,
      detail: suggestionDetail!,
      explanation: suggestionExplanation!,
    };

    // For deletion, we use empty string as insertText
    return new NextEditInlineCompletionItem(metadata, '', deletionRange);
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

  private createRenameSuggestion(
    document: vscode.TextDocument,
    position: vscode.Position
  ): NextEditInlineCompletionItem | undefined {
    // Get the current line text up to the cursor
    const lineText = document.lineAt(position.line).text;
    const textBeforeCursor = lineText.substring(0, position.character);
    
    // Look for a word/identifier before the cursor (e.g., "var x", "let data", "const user")
    const wordMatch = textBeforeCursor.match(/(\b\w+)\s*$/);
    if (!wordMatch) {
      return undefined;
    }

    const currentWord = wordMatch[1];
    
    // Skip if it's a keyword or very short
    const keywords = ['var', 'let', 'const', 'function', 'class', 'if', 'for', 'while', 'return', 'this', 'true', 'false', 'null', 'undefined'];
    if (keywords.includes(currentWord) || currentWord.length < 3) {
      return undefined;
    }

    // Generate a better name suggestion based on common patterns
    let suggestedName: string | undefined;
    if (currentWord === 'data' || currentWord === 'item') {
      suggestedName = 'value';
    } else if (currentWord === 'temp' || currentWord === 'tmp') {
      suggestedName = 'result';
    } else if (currentWord.endsWith('s') && currentWord.length > 4) {
      // Plural to singular
      suggestedName = currentWord.slice(0, -1);
    } else if (currentWord.length > 4 && !currentWord.includes('_') && !currentWord.includes('-')) {
      // Add descriptive suffix for generic names
      if (currentWord === 'value' || currentWord === 'result') {
        suggestedName = `${currentWord}Data`;
      }
    }

    if (!suggestedName) {
      return undefined;
    }

    const id = 'next-edit-inline.rename';
    const range = new vscode.Range(
      new vscode.Position(position.line, position.character - currentWord.length),
      position
    );
    const metadata: SuggestionMetadata = {
      id,
      label: `Rename "${currentWord}" to "${suggestedName}"`,
      detail: 'Improve variable naming for better readability',
      explanation: `Suggests renaming "${currentWord}" to "${suggestedName}" to follow better naming conventions and improve code readability.`,
    };

    return new NextEditInlineCompletionItem(metadata, suggestedName, range);
  }

  private createMultilineSuggestion(
    document: vscode.TextDocument,
    position: vscode.Position,
    indent: string
  ): NextEditInlineCompletionItem | undefined {
    const lineText = document.lineAt(position.line).text.trim();
    const lineLower = lineText.toLowerCase();

    let multilineText: string | undefined;
    let suggestionLabel: string | undefined;
    let suggestionDetail: string | undefined;
    let suggestionExplanation: string | undefined;

    // Check for function declarations
    if (lineLower.includes('function ') || lineLower.match(/^\s*(async\s+)?function\s+\w+/)) {
      const funcMatch = lineText.match(/(?:async\s+)?function\s+(\w+)\s*\(/);
      const funcName = funcMatch ? funcMatch[1] : 'function';
      multilineText = `\n${indent}/**\n${indent} * ${funcName}\n${indent} * @param {*} param\n${indent} * @returns {*}\n${indent} */`;
      suggestionLabel = 'Add JSDoc comment for function';
      suggestionDetail = 'Document function parameters and return value';
      suggestionExplanation = `Adds a JSDoc comment block above the function to document its purpose, parameters, and return value.`;
    }
    // Check for class declarations
    else if (lineLower.includes('class ') && lineLower.match(/^\s*class\s+\w+/)) {
      const classMatch = lineText.match(/class\s+(\w+)/);
      const className = classMatch ? classMatch[1] : 'Class';
      multilineText = `\n${indent}/**\n${indent} * ${className}\n${indent} */`;
      suggestionLabel = 'Add JSDoc comment for class';
      suggestionDetail = 'Document class purpose and usage';
      suggestionExplanation = `Adds a JSDoc comment block above the class to document its purpose and usage.`;
    }
    // Check for TODO comments
    else if (lineLower.includes('todo') || lineLower.includes('fixme')) {
      multilineText = `\n${indent}// TODO: Implement this functionality\n${indent}// 1. Step one\n${indent}// 2. Step two\n${indent}// 3. Step three`;
      suggestionLabel = 'Expand TODO with implementation steps';
      suggestionDetail = 'Add structured implementation plan';
      suggestionExplanation = `Expands the TODO comment with a structured implementation plan including step-by-step guidance.`;
    }
    // Check for if statements that might need else
    else if (lineLower.match(/^\s*if\s*\(/) && !lineLower.includes('else')) {
      multilineText = `\n${indent} else {\n${indent}  // Handle else case\n${indent}}`;
      suggestionLabel = 'Add else clause';
      suggestionDetail = 'Complete conditional logic';
      suggestionExplanation = `Adds an else clause to handle the alternative case in the conditional statement.`;
    }
    // Check for empty object/array assignments
    else if (lineText.match(/=\s*\{\}\s*;?\s*$/) || lineText.match(/=\s*\[\]\s*;?\s*$/)) {
      multilineText = `\n${indent}  // Initialize with default values`;
      suggestionLabel = 'Add initialization comment';
      suggestionDetail = 'Document object/array initialization';
      suggestionExplanation = `Adds a comment to document the initialization of an empty object or array.`;
    }

    if (!multilineText) {
      return undefined;
    }

    const id = 'next-edit-inline.multiline';
    const range = new vscode.Range(position, position);
    const metadata: SuggestionMetadata = {
      id,
      label: suggestionLabel!,
      detail: suggestionDetail!,
      explanation: suggestionExplanation!,
    };

    return new NextEditInlineCompletionItem(metadata, multilineText, range);
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
  try {
    console.log('[Next Edit] Extension activation started');
    const outputChannel = vscode.window.createOutputChannel(OUTPUT_CHANNEL_NAME);
    outputChannel.appendLine('Next Edit Inline Completions extension activated');
    outputChannel.appendLine(`Activation time: ${new Date().toISOString()}`);
    outputChannel.show(true); // Show the output channel automatically
    console.log('[Next Edit] Output channel created and shown');

    const provider = new NextEditInlineCompletionProvider(outputChannel);
    console.log('[Next Edit] Provider created');

    context.subscriptions.push(outputChannel);
    context.subscriptions.push(
      vscode.languages.registerInlineCompletionItemProvider({ pattern: '**/*' }, provider)
    );
    outputChannel.appendLine('Inline completion provider registered for all file patterns (**/*)');
    console.log('[Next Edit] Inline completion provider registered');

    context.subscriptions.push(
      vscode.commands.registerCommand(EXPLAIN_COMMAND, (id?: string) => {
        outputChannel.appendLine(`[${new Date().toISOString()}] Command invoked: ${EXPLAIN_COMMAND}`);
        provider.explainSuggestion(id);
      })
    );
    outputChannel.appendLine(`Command registered: ${EXPLAIN_COMMAND}`);
    console.log(`[Next Edit] Command registered: ${EXPLAIN_COMMAND}`);

    context.subscriptions.push(
      vscode.commands.registerCommand(TELEMETRY_COMMAND, (id?: string) => {
        outputChannel.appendLine(`[${new Date().toISOString()}] Command invoked: ${TELEMETRY_COMMAND}`);
        provider.generateTelemetry(id);
      })
    );
    outputChannel.appendLine(`Command registered: ${TELEMETRY_COMMAND}`);
    outputChannel.appendLine('Extension setup complete');
    console.log(`[Next Edit] Command registered: ${TELEMETRY_COMMAND}`);
    console.log('[Next Edit] Extension activation complete');
    
    // Show a notification to confirm activation
    void vscode.window.showInformationMessage('Next Edit Inline Completions extension activated!', 'Open Output').then(selection => {
      if (selection === 'Open Output') {
        outputChannel.show();
      }
    });
  } catch (error) {
    console.error('[Next Edit] Activation error:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    vscode.window.showErrorMessage(`Next Edit extension activation failed: ${errorMessage}`);
  }
}

export function deactivate(): void {
  // VS Code disposes registered subscriptions automatically.
  // Output channel will be disposed as part of the subscription.
}
