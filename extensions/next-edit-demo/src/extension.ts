import * as vscode from 'vscode';
// Type definitions for inlineCompletionsAdditions are in vscode.proposed.inlineCompletionsAdditions.d.ts
// TypeScript automatically picks them up - no runtime import needed

/**
 * Demo extension that provides inline completion suggestions using VS Code's InlineCompletionItemProvider API.
 * 
 * This extension parses commands from the current line and generates inline completion suggestions.
 * Supported commands:
 * - insert <text> at <line>:<column>
 * - replace "<src>" with "<dst>" at <line>-<line>
 * - delete "<text>" at <line>:<start>-<end>
 * - delete <line>-<line>:<column>
 */
export function activate(context: vscode.ExtensionContext) {
    console.log('Inline Completions Demo extension is now active!');

    // Create output channel for debugging
    const outputChannel = vscode.window.createOutputChannel('Inline Completions Demo');
    outputChannel.appendLine('Inline Completions Demo extension activated');
    outputChannel.show(true); // Show output channel automatically

    // Check and log VS Code settings for inline completions
    const config = vscode.workspace.getConfiguration('editor');
    const inlineSuggestEnabled = config.get('inlineSuggest.enabled', true);
    const inlineSuggestEditsEnabled = config.get('inlineSuggest.edits.enabled', false);
    
    outputChannel.appendLine(`VS Code Settings:`);
    outputChannel.appendLine(`  editor.inlineSuggest.enabled: ${inlineSuggestEnabled}`);
    outputChannel.appendLine(`  editor.inlineSuggest.edits.enabled: ${inlineSuggestEditsEnabled} ⚠️ CRITICAL FOR INLINE COMPLETION SUGGESTIONS`);
    
    if (!inlineSuggestEnabled) {
        outputChannel.appendLine(`  ⚠️  WARNING: Inline suggestions are disabled! Enable with: editor.inlineSuggest.enabled = true`);
        vscode.window.showWarningMessage(
            'Inline Completions Demo: Inline suggestions are disabled. Enable "editor.inlineSuggest.enabled" in settings.'
        );
    }
    
    if (!inlineSuggestEditsEnabled) {
        outputChannel.appendLine(`  ❌ CRITICAL: Inline edits are disabled! Inline completion suggestions will NOT work!`);
        outputChannel.appendLine(`  To enable: Set "editor.inlineSuggest.edits.enabled": true in settings.json`);
        vscode.window.showErrorMessage(
            'Inline Completions Demo: Inline edits are disabled. Enable "editor.inlineSuggest.edits.enabled" in settings for inline completion suggestions to work!'
        );
    }

    // Register the inline completion provider
    const provider = new CommandBasedCompletionProvider(outputChannel);
    const disposable = vscode.languages.registerInlineCompletionItemProvider(
        { pattern: '**/*' }, // Works for all file types
        provider
    );

    context.subscriptions.push(disposable, outputChannel);

    // Register command to insert sample commands
    const insertSampleCommandsCommand = vscode.commands.registerCommand('inlineCompletionsDemo.insertSampleCommands', () => {
        insertSampleCommands(outputChannel);
    });
    context.subscriptions.push(insertSampleCommandsCommand);

    outputChannel.appendLine('Extension setup complete');
    outputChannel.appendLine('');
    outputChannel.appendLine('✅ Command-based Inline Completion Suggestions');
    outputChannel.appendLine('Supported commands:');
    outputChannel.appendLine('  - insert <text> at <line>:<column>');
    outputChannel.appendLine('  - replace "<src>" with "<dst>" [at|in] <line>[-<line>]');
    outputChannel.appendLine('  - replace all "<src>" with "<dst>" [at|in] <line>[-<line>]');
    outputChannel.appendLine('  - replace <N> "<src>" with "<dst>" [at|in] <line>[-<line>]');
    outputChannel.appendLine('  - delete "<text>" [at|in] <line>:<start>-<end>');
    outputChannel.appendLine('  - delete "<text>" [at|in] <line>[-<end>]');
    outputChannel.appendLine('  - delete all "<text>" [at|in] <line>[-<end>]');
    outputChannel.appendLine('  - delete <N> "<text>" [at|in] <line>[-<end>]');
    outputChannel.appendLine('  - delete <line>-<line>:<column>');
}

export function deactivate() {
    // Cleanup if needed
}

/**
 * Inserts sample commands at the current cursor position to help users learn the syntax.
 */
async function insertSampleCommands(outputChannel: vscode.OutputChannel): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
        vscode.window.showErrorMessage('No active editor');
        return;
    }

    const position = editor.selection.active;
    const eol = editor.document.eol === vscode.EndOfLine.CRLF ? '\r\n' : '\n';
    
    const sampleCommands = [
        '// Inline Completions Demo - Sample Commands',
        '// Type these commands and press TAB to see suggestions',
        '',
        '// INSERT COMMANDS',
        '// Insert text at a specific position',
        'insert "Hello World" at 5:10',
        'insert lala at 12:3',
        '',
        '// REPLACE COMMANDS',
        '// Replace first occurrence (default)',
        'replace "var" with "const" at 1-10',
        'replace "str" with "string" in 12-15',
        'replace "a" with "b" at 14',
        '',
        '// Replace all occurrences',
        'replace all "==" with "===" at 1-20',
        'replace all "old" with "new" in 5-15',
        '',
        '// Replace first N occurrences',
        'replace 2 "debug" with "info" at 1-10',
        'replace 3 "temp" with "result" in 5-20',
        '',
        '// DELETE COMMANDS',
        '// Delete with text and line range (first occurrence)',
        'delete "console.log" at 1-10',
        'delete "TODO" in 5-15',
        'delete "text" at 14',
        '',
        '// Delete all occurrences',
        'delete all " " at 1-20',
        'delete all "debug" in 5-15',
        '',
        '// Delete first N occurrences',
        'delete 2 "old" at 1-10',
        'delete 3 "temp" in 5-20',
        '',
        '// Delete with text and column range',
        'delete " " at 14:2-16',
        'delete all "x" in 5:0-50',
        '',
        '// Delete by position (without text)',
        'delete 12-13:4',
        '',
        '// Note: Commands are case-insensitive',
        '// You can use "at" or "in" interchangeably',
        '// Line numbers are 1-based (as shown in editor)',
        '// Column numbers are 0-based (first character is column 0)'
    ];

    const textToInsert = sampleCommands.join(eol) + eol;

    await editor.edit(editBuilder => {
        editBuilder.insert(position, textToInsert);
    });

    outputChannel.appendLine('Sample commands inserted at cursor position');
    vscode.window.showInformationMessage('Sample commands inserted! Type any command and press TAB to see suggestions.');
}

/**
 * Command types parsed from user input
 */
interface InsertCommand {
    type: 'insert';
    text: string;
    line: number;
    column: number;
}

interface ReplaceCommand {
    type: 'replace';
    src: string;
    dst: string;
    startLine: number;
    endLine: number;
    count?: number | 'all'; // Number of matches to replace: undefined/1 = first, 'all' = all, number = first N
}

interface DeleteCommand {
    type: 'delete';
    text?: string; // Optional text to delete
    line?: number; // For delete with text: single line number
    startLine?: number; // For delete with text: start line (when range specified), or for delete without text: start line
    endLine?: number; // For delete with text: end line (when range specified), or for delete without text: end line
    startColumn?: number; // For delete with text: start column (optional)
    endColumn?: number; // For delete with text: end column (optional)
    column?: number; // For delete without text: column number
    count?: number | 'all'; // Number of matches to delete: undefined/1 = first, 'all' = all, number = first N
}

type ParsedCommand = InsertCommand | ReplaceCommand | DeleteCommand;

/**
 * InlineCompletionItemProvider that parses commands from the current line
 * and generates suggestions based on those commands.
 */
class CommandBasedCompletionProvider implements vscode.InlineCompletionItemProvider {
    constructor(private outputChannel: vscode.OutputChannel) { }

    async provideInlineCompletionItems(
        document: vscode.TextDocument,
        position: vscode.Position,
        context: vscode.InlineCompletionContext,
        token: vscode.CancellationToken
    ): Promise<vscode.InlineCompletionList | undefined> {
        if (token.isCancellationRequested) {
            return undefined;
        }

        const timestamp = new Date().toISOString();
        const fileName = document.fileName.split('/').pop() || document.fileName;

        this.outputChannel.appendLine(`\n${'='.repeat(80)}`);
        this.outputChannel.appendLine(`[${timestamp}] provideInlineCompletionItems CALLED`);
        this.outputChannel.appendLine(`  File: ${fileName}`);
        this.outputChannel.appendLine(`  Position: Line ${position.line + 1}, Column ${position.character + 1}`);

        // Get the current line and parse it for commands
        const currentLine = document.lineAt(position.line);
        const lineText = currentLine.text;
        
        this.outputChannel.appendLine(`  Current line: "${lineText}"`);

        // Parse command from current line
        const command = this.parseCommand(lineText);
        if (!command) {
            this.outputChannel.appendLine(`  ❌ No valid command found in current line`);
            this.outputChannel.appendLine(`${'='.repeat(80)}\n`);
            return undefined;
        }

        this.outputChannel.appendLine(`  ✅ Parsed command: ${JSON.stringify(command)}`);

        // Generate suggestion based on command
        const suggestion = this.createSuggestionFromCommand(document, position, command);
        if (!suggestion) {
            this.outputChannel.appendLine(`  ❌ Failed to create suggestion from command`);
            this.outputChannel.appendLine(`${'='.repeat(80)}\n`);
            return undefined;
        }

        this.outputChannel.appendLine(`  🎉 Created suggestion`);
        this.logSuggestionDetails(suggestion, command.type);
        this.outputChannel.appendLine(`${'='.repeat(80)}\n`);

        const completionList = new vscode.InlineCompletionList([suggestion]);
        // @ts-ignore - enableForwardStability is not in the type definitions but exists in the API
        completionList.enableForwardStability = true;
        return completionList;
    }

    /**
     * Parses a command from the current line text.
     * Supports:
     * - insert <text> at <line>:<column>
     * - replace "<src>" with "<dst>" at <line>[-<line>] (single line or range)
     * - delete "<text>" at <line>:<start>-<end> (with column range)
     * - delete "<text>" at <line>[-<end>] (without column, single line or range)
     * - delete <line>-<line>:<column> (without text, with column)
     */
    private parseCommand(lineText: string): ParsedCommand | undefined {
        const trimmed = lineText.trim();
        
        // Try to parse insert command: insert <text> at <line>:<column>
        const insertMatch = trimmed.match(/^insert\s+(.+?)\s+at\s+(\d+):(\d+)$/i);
        if (insertMatch) {
            const text = this.unquote(insertMatch[1]);
            const line = parseInt(insertMatch[2], 10) - 1; // Convert to 0-based
            const column = parseInt(insertMatch[3], 10);
            return { type: 'insert', text, line, column };
        }

        // Try to parse replace command with count: replace [all|<N>] "<src>" with "<dst>" [at|in] <line>[-<line>]
        // First try with "all" or number and line range
        const replaceWithCountMatch = trimmed.match(/^replace\s+(all|\d+)\s+"([^"]+)"\s+with\s+"([^"]+)"\s+(at|in)\s+(\d+)(?:-(\d+))?$/i);
        if (replaceWithCountMatch) {
            const countStr = replaceWithCountMatch[1].toLowerCase();
            const count = countStr === 'all' ? 'all' : parseInt(countStr, 10);
            const src = replaceWithCountMatch[2];
            const dst = replaceWithCountMatch[3];
            const startLine = parseInt(replaceWithCountMatch[5], 10) - 1; // Convert to 0-based
            const endLineStr = replaceWithCountMatch[6];
            const endLine = endLineStr ? parseInt(endLineStr, 10) - 1 : startLine; // If no end line, use start line
            return { type: 'replace', src, dst, startLine, endLine, count };
        }

        // Try to parse replace command without count (defaults to first): replace "<src>" with "<dst>" [at|in] <line>[-<line>]
        const replaceMatch = trimmed.match(/^replace\s+"([^"]+)"\s+with\s+"([^"]+)"\s+(at|in)\s+(\d+)(?:-(\d+))?$/i);
        if (replaceMatch) {
            const src = replaceMatch[1];
            const dst = replaceMatch[2];
            const startLine = parseInt(replaceMatch[4], 10) - 1; // Convert to 0-based
            const endLineStr = replaceMatch[5];
            const endLine = endLineStr ? parseInt(endLineStr, 10) - 1 : startLine; // If no end line, use start line
            return { type: 'replace', src, dst, startLine, endLine }; // count defaults to 1 (first occurrence)
        }

        // Try to parse delete with text and column range: delete [all|<N>] "<text>" [at|in] <line>:<start>-<end>
        const deleteWithTextAndColumnWithCountMatch = trimmed.match(/^delete\s+(all|\d+)\s+"([^"]+)"\s+(at|in)\s+(\d+):(\d+)-(\d+)$/i);
        if (deleteWithTextAndColumnWithCountMatch) {
            const countStr = deleteWithTextAndColumnWithCountMatch[1].toLowerCase();
            const count = countStr === 'all' ? 'all' : parseInt(countStr, 10);
            const text = deleteWithTextAndColumnWithCountMatch[2];
            const line = parseInt(deleteWithTextAndColumnWithCountMatch[4], 10) - 1; // Convert to 0-based
            const startColumn = parseInt(deleteWithTextAndColumnWithCountMatch[5], 10);
            const endColumn = parseInt(deleteWithTextAndColumnWithCountMatch[6], 10);
            return { type: 'delete', text, line, startColumn, endColumn, count };
        }

        // Try to parse delete with text and column range (no count): delete "<text>" [at|in] <line>:<start>-<end>
        const deleteWithTextAndColumnMatch = trimmed.match(/^delete\s+"([^"]+)"\s+(at|in)\s+(\d+):(\d+)-(\d+)$/i);
        if (deleteWithTextAndColumnMatch) {
            const text = deleteWithTextAndColumnMatch[1];
            const line = parseInt(deleteWithTextAndColumnMatch[3], 10) - 1; // Convert to 0-based
            const startColumn = parseInt(deleteWithTextAndColumnMatch[4], 10);
            const endColumn = parseInt(deleteWithTextAndColumnMatch[5], 10);
            return { type: 'delete', text, line, startColumn, endColumn }; // count defaults to 1
        }

        // Try to parse delete with text and line range with count: delete [all|<N>] "<text>" [at|in] <line>[-<end>]
        const deleteWithTextAndLineRangeWithCountMatch = trimmed.match(/^delete\s+(all|\d+)\s+"([^"]+)"\s+(at|in)\s+(\d+)(?:-(\d+))?$/i);
        if (deleteWithTextAndLineRangeWithCountMatch) {
            const countStr = deleteWithTextAndLineRangeWithCountMatch[1].toLowerCase();
            const count = countStr === 'all' ? 'all' : parseInt(countStr, 10);
            const text = deleteWithTextAndLineRangeWithCountMatch[2];
            const startLine = parseInt(deleteWithTextAndLineRangeWithCountMatch[4], 10) - 1; // Convert to 0-based
            const endLineStr = deleteWithTextAndLineRangeWithCountMatch[5];
            const endLine = endLineStr ? parseInt(endLineStr, 10) - 1 : startLine; // If no end line, use start line
            return { type: 'delete', text, startLine, endLine, count };
        }

        // Try to parse delete with text and line range (no column, no count): delete "<text>" [at|in] <line>[-<end>]
        const deleteWithTextAndLineRangeMatch = trimmed.match(/^delete\s+"([^"]+)"\s+(at|in)\s+(\d+)(?:-(\d+))?$/i);
        if (deleteWithTextAndLineRangeMatch) {
            const text = deleteWithTextAndLineRangeMatch[1];
            const startLine = parseInt(deleteWithTextAndLineRangeMatch[3], 10) - 1; // Convert to 0-based
            const endLineStr = deleteWithTextAndLineRangeMatch[4];
            const endLine = endLineStr ? parseInt(endLineStr, 10) - 1 : startLine; // If no end line, use start line
            return { type: 'delete', text, startLine, endLine }; // count defaults to 1
        }

        // Try to parse delete without text: delete <line>-<line>:<column>
        const deleteWithoutTextMatch = trimmed.match(/^delete\s+(\d+)-(\d+):(\d+)$/i);
        if (deleteWithoutTextMatch) {
            const startLine = parseInt(deleteWithoutTextMatch[1], 10) - 1; // Convert to 0-based
            const endLine = parseInt(deleteWithoutTextMatch[2], 10) - 1; // Convert to 0-based
            const column = parseInt(deleteWithoutTextMatch[3], 10);
            return { type: 'delete', startLine, endLine, column };
        }

            return undefined;
        }

    /**
     * Removes quotes from a string if present.
     */
    private unquote(text: string): string {
        if ((text.startsWith('"') && text.endsWith('"')) || (text.startsWith("'") && text.endsWith("'"))) {
            return text.slice(1, -1);
        }
        return text;
    }

    /**
     * Creates an inline completion suggestion based on a parsed command.
     */
    private createSuggestionFromCommand(
        document: vscode.TextDocument,
        cursorPosition: vscode.Position,
        command: ParsedCommand
    ): vscode.InlineCompletionItem | undefined {
        switch (command.type) {
            case 'insert':
                return this.createInsertSuggestion(document, cursorPosition, command);
            case 'replace':
                return this.createReplaceSuggestion(document, cursorPosition, command);
            case 'delete':
                return this.createDeleteSuggestion(document, cursorPosition, command);
            default:
            return undefined;
        }
    }

    /**
     * Creates an insert suggestion.
     */
    private createInsertSuggestion(
        document: vscode.TextDocument,
        cursorPosition: vscode.Position,
        command: InsertCommand
    ): vscode.InlineCompletionItem | undefined {
        // Validate line number
        if (command.line < 0 || command.line >= document.lineCount) {
            this.outputChannel.appendLine(`    ❌ Invalid line number: ${command.line + 1} (document has ${document.lineCount} lines)`);
                return undefined;
            }

        const targetLine = document.lineAt(command.line);
        const targetPosition = new vscode.Position(command.line, Math.min(command.column, targetLine.text.length));
        const range = new vscode.Range(targetPosition, targetPosition);
        
        // Calculate showRange (4 lines before/after target)
        const showRange = new vscode.Range(
            Math.max(command.line - 4, 0),
            0,
            Math.min(command.line + 4, document.lineCount - 1),
            Number.MAX_SAFE_INTEGER
        );
        
        // Filter: Only return suggestion if cursor is within showRange
        if (!showRange.contains(cursorPosition)) {
            this.outputChannel.appendLine(`    ❌ Cursor not in showRange - filtering out suggestion`);
            return undefined;
        }
        
        const item = new vscode.InlineCompletionItem(command.text, range);
        item.isInlineEdit = true;
        item.showRange = showRange;
        item.displayLocation = {
            range: range,
            label: `Insert "${command.text}" at line ${command.line + 1}:${command.column}`,
            kind: 0, // InlineCompletionDisplayLocationKind.Code
            jumpToEdit: command.line !== cursorPosition.line
        };
        
        return item;
    }

    /**
     * Creates a replace suggestion.
     */
    private createReplaceSuggestion(
        document: vscode.TextDocument,
        cursorPosition: vscode.Position,
        command: ReplaceCommand
    ): vscode.InlineCompletionItem | undefined {
        // Validate line numbers
        if (command.startLine < 0 || command.endLine >= document.lineCount || command.startLine > command.endLine) {
            this.outputChannel.appendLine(`    ❌ Invalid line range: ${command.startLine + 1}-${command.endLine + 1}`);
            return undefined;
        }

        // Find all matches in the specified line range
        const matches: vscode.Range[] = [];
        for (let line = command.startLine; line <= command.endLine; line++) {
            const lineText = document.lineAt(line).text;
            let searchIndex = 0;
            while (true) {
                const index = lineText.indexOf(command.src, searchIndex);
                if (index === -1) break;
                matches.push(new vscode.Range(
                    new vscode.Position(line, index),
                    new vscode.Position(line, index + command.src.length)
                ));
                searchIndex = index + 1;
            }
        }

        if (matches.length === 0) {
            this.outputChannel.appendLine(`    ❌ Source text "${command.src}" not found in lines ${command.startLine + 1}-${command.endLine + 1}`);
            return undefined;
        }

        // Determine how many matches to process
        const count = command.count === undefined ? 1 : (command.count === 'all' ? matches.length : command.count);
        const matchesToProcess = matches.slice(0, Math.min(count, matches.length));
        
        this.outputChannel.appendLine(`    Found ${matches.length} match(es), processing ${matchesToProcess.length}`);

        // If only one match, use simple replacement
        if (matchesToProcess.length === 1) {
            const foundRange = matchesToProcess[0];
        const showRange = new vscode.Range(
                Math.max(foundRange.start.line - 4, 0),
            0,
                Math.min(foundRange.end.line + 4, document.lineCount - 1),
            Number.MAX_SAFE_INTEGER
        );
        
        if (!showRange.contains(cursorPosition)) {
            this.outputChannel.appendLine(`    ❌ Cursor not in showRange - filtering out suggestion`);
            return undefined;
        }
        
            const item = new vscode.InlineCompletionItem(command.dst, foundRange);
        item.isInlineEdit = true;
        item.showRange = showRange;
        item.displayLocation = {
                range: foundRange,
                label: `Replace "${command.src}" with "${command.dst}" at line ${foundRange.start.line + 1}`,
            kind: 0,
                jumpToEdit: foundRange.start.line !== cursorPosition.line
        };
        return item;
    }

        // Multiple matches: create a combined edit
        // Find the combined range (from first match start to last match end)
        const firstMatch = matchesToProcess[0];
        const lastMatch = matchesToProcess[matchesToProcess.length - 1];
        
        // Get all lines in the range
        const startLine = firstMatch.start.line;
        const endLine = lastMatch.end.line;
        
        // Build the replacement text by processing each line
        let resultText = '';
        let matchIndex = 0;
        
        for (let line = startLine; line <= endLine; line++) {
            const lineText = document.lineAt(line).text;
            let lineResult = '';
            let lastPos = 0;
            
            // Process all matches on this line
            while (matchIndex < matchesToProcess.length && matchesToProcess[matchIndex].start.line === line) {
                const match = matchesToProcess[matchIndex];
                // Add text before the match
                lineResult += lineText.substring(lastPos, match.start.character);
                // Add the replacement
                lineResult += command.dst;
                lastPos = match.end.character;
                matchIndex++;
            }
            // Add remaining text on the line
            lineResult += lineText.substring(lastPos);
            
            resultText += lineResult;
            if (line < endLine) {
                resultText += document.eol === vscode.EndOfLine.CRLF ? '\r\n' : '\n';
            }
        }

        const combinedRange = new vscode.Range(
            new vscode.Position(startLine, 0),
            new vscode.Position(endLine, document.lineAt(endLine).text.length)
        );

        const showRange = new vscode.Range(
            Math.max(startLine - 4, 0),
            0,
            Math.min(endLine + 4, document.lineCount - 1),
            Number.MAX_SAFE_INTEGER
        );
        
        if (!showRange.contains(cursorPosition)) {
            this.outputChannel.appendLine(`    ❌ Cursor not in showRange - filtering out suggestion`);
            return undefined;
        }

        const item = new vscode.InlineCompletionItem(resultText, combinedRange);
        item.isInlineEdit = true;
        item.showRange = showRange;
        item.displayLocation = {
            range: combinedRange,
            label: `Replace ${matchesToProcess.length} occurrence(s) of "${command.src}" with "${command.dst}"`,
            kind: 0,
            jumpToEdit: startLine !== cursorPosition.line
        };

        return item;
    }

    /**
     * Creates a delete suggestion.
     */
    private createDeleteSuggestion(
        document: vscode.TextDocument,
        cursorPosition: vscode.Position,
        command: DeleteCommand
    ): vscode.InlineCompletionItem | undefined {
        let targetRange: vscode.Range | undefined;

        if (command.text !== undefined && command.line !== undefined && command.startColumn !== undefined && command.endColumn !== undefined) {
            // Delete with text and column range: delete [all|<N>] "<text>" at <line>:<start>-<end>
            if (command.line < 0 || command.line >= document.lineCount) {
                this.outputChannel.appendLine(`    ❌ Invalid line number: ${command.line + 1}`);
                return undefined;
            }

            const lineText = document.lineAt(command.line).text;
            
            // Find all matches within the column range
            const matches: vscode.Range[] = [];
            let searchIndex = command.startColumn;
            while (true) {
                const index = lineText.indexOf(command.text, searchIndex);
                if (index === -1 || index >= command.endColumn) break;
                matches.push(new vscode.Range(
                    new vscode.Position(command.line, index),
                    new vscode.Position(command.line, index + command.text.length)
                ));
                searchIndex = index + 1;
            }

            if (matches.length === 0) {
                // If text not found, delete the range specified
                targetRange = new vscode.Range(
                    new vscode.Position(command.line, command.startColumn),
                    new vscode.Position(command.line, Math.min(command.endColumn, lineText.length))
                );
            } else {
                // Determine how many matches to process
                const count = command.count === undefined ? 1 : (command.count === 'all' ? matches.length : command.count);
                const matchesToProcess = matches.slice(0, Math.min(count, matches.length));
                
                this.outputChannel.appendLine(`    Found ${matches.length} match(es) in column range, processing ${matchesToProcess.length}`);

                if (matchesToProcess.length === 1) {
                    targetRange = matchesToProcess[0];
                } else {
                    // Multiple matches on same line: create combined edit
                    const firstMatch = matchesToProcess[0];
                    const lastMatch = matchesToProcess[matchesToProcess.length - 1];
                    
                    let resultText = '';
                    let lastPos = 0;
                    
                    for (const match of matchesToProcess) {
                        resultText += lineText.substring(lastPos, match.start.character);
                        // Skip the match (don't add it)
                        lastPos = match.end.character;
                    }
                    resultText += lineText.substring(lastPos);
                    
                    targetRange = new vscode.Range(
                        new vscode.Position(command.line, firstMatch.start.character),
                        new vscode.Position(command.line, lastMatch.end.character)
                    );
                    
                    // For multiple matches, we need to return early with the combined edit
                    const showRange = new vscode.Range(
                        Math.max(command.line - 4, 0),
                        0,
                        Math.min(command.line + 4, document.lineCount - 1),
                        Number.MAX_SAFE_INTEGER
                    );

                    if (!showRange.contains(cursorPosition)) {
                        this.outputChannel.appendLine(`    ❌ Cursor not in showRange - filtering out suggestion`);
                        return undefined;
                    }

                    const item = new vscode.InlineCompletionItem(resultText, targetRange);
                    item.isInlineEdit = true;
                    item.showRange = showRange;
                    item.displayLocation = {
                        range: targetRange,
                        label: `Delete ${matchesToProcess.length} occurrence(s) of "${command.text}" at line ${command.line + 1}`,
                        kind: 0,
                        jumpToEdit: command.line !== cursorPosition.line
                    };
                    return item;
                }
            }
        } else if (command.text !== undefined && command.startLine !== undefined && command.endLine !== undefined) {
            // Delete with text and line range (no column): delete [all|<N>] "<text>" at <line>-<end>
            if (command.startLine < 0 || command.endLine >= document.lineCount || command.startLine > command.endLine) {
                this.outputChannel.appendLine(`    ❌ Invalid line range: ${command.startLine + 1}-${command.endLine + 1}`);
                return undefined;
            }

            // Find all matches in the specified line range
            const matches: vscode.Range[] = [];
            for (let line = command.startLine; line <= command.endLine; line++) {
                const lineText = document.lineAt(line).text;
                let searchIndex = 0;
                while (true) {
                    const index = lineText.indexOf(command.text!, searchIndex);
                    if (index === -1) break;
                    matches.push(new vscode.Range(
                        new vscode.Position(line, index),
                        new vscode.Position(line, index + command.text!.length)
                    ));
                    searchIndex = index + 1;
                }
            }

            if (matches.length === 0) {
                this.outputChannel.appendLine(`    ❌ Text "${command.text}" not found in lines ${command.startLine + 1}-${command.endLine + 1}`);
                return undefined;
            }

            // Determine how many matches to process
            const count = command.count === undefined ? 1 : (command.count === 'all' ? matches.length : command.count);
            const matchesToProcess = matches.slice(0, Math.min(count, matches.length));
            
            this.outputChannel.appendLine(`    Found ${matches.length} match(es), processing ${matchesToProcess.length}`);

            // If only one match, use simple deletion
            if (matchesToProcess.length === 1) {
                targetRange = matchesToProcess[0];
            } else {
                // Multiple matches: create a combined edit
                const firstMatch = matchesToProcess[0];
                const lastMatch = matchesToProcess[matchesToProcess.length - 1];
                const startLine = firstMatch.start.line;
                const endLine = lastMatch.end.line;
                
                // Build the result text by removing all matches
                let resultText = '';
                let matchIndex = 0;
                
                for (let line = startLine; line <= endLine; line++) {
                    const lineText = document.lineAt(line).text;
                    let lineResult = '';
                    let lastPos = 0;
                    
                    // Process all matches on this line
                    while (matchIndex < matchesToProcess.length && matchesToProcess[matchIndex].start.line === line) {
                        const match = matchesToProcess[matchIndex];
                        // Add text before the match
                        lineResult += lineText.substring(lastPos, match.start.character);
                        // Skip the match (don't add it)
                        lastPos = match.end.character;
                        matchIndex++;
                    }
                    // Add remaining text on the line
                    lineResult += lineText.substring(lastPos);
                    
                    resultText += lineResult;
                    if (line < endLine) {
                        resultText += document.eol === vscode.EndOfLine.CRLF ? '\r\n' : '\n';
                    }
                }

                const combinedRange = new vscode.Range(
                    new vscode.Position(startLine, 0),
                    new vscode.Position(endLine, document.lineAt(endLine).text.length)
                );

                const showRange = new vscode.Range(
                    Math.max(startLine - 4, 0),
                    0,
                    Math.min(endLine + 4, document.lineCount - 1),
                    Number.MAX_SAFE_INTEGER
                );

                if (!showRange.contains(cursorPosition)) {
                    this.outputChannel.appendLine(`    ❌ Cursor not in showRange - filtering out suggestion`);
                    return undefined;
                }

                const item = new vscode.InlineCompletionItem(resultText, combinedRange);
                item.isInlineEdit = true;
                item.showRange = showRange;
                item.displayLocation = {
                    range: combinedRange,
                    label: `Delete ${matchesToProcess.length} occurrence(s) of "${command.text}"`,
                    kind: 0,
                    jumpToEdit: startLine !== cursorPosition.line
                };
                return item;
        }
        } else if (command.startLine !== undefined && command.endLine !== undefined && command.column !== undefined) {
            // Delete without text: delete <line>-<line>:<column>
            if (command.startLine < 0 || command.endLine >= document.lineCount || command.startLine > command.endLine) {
                this.outputChannel.appendLine(`    ❌ Invalid line range: ${command.startLine + 1}-${command.endLine + 1}`);
                return undefined;
            }

            // Delete character at specified column in each line
            // For simplicity, we'll delete from the first line only
            // (VS Code inline completions support single range edits)
            const line = command.startLine;
            const lineText = document.lineAt(line).text;
            if (command.column < lineText.length) {
                targetRange = new vscode.Range(
                    new vscode.Position(line, command.column),
                    new vscode.Position(line, command.column + 1)
                );
            } else {
                this.outputChannel.appendLine(`    ❌ Column ${command.column} out of range for line ${line + 1}`);
                return undefined;
            }
        } else {
            this.outputChannel.appendLine(`    ❌ Invalid delete command parameters`);
            return undefined;
        }

        if (!targetRange) {
            this.outputChannel.appendLine(`    ❌ Could not determine target range for delete`);
            return undefined;
        }

        // Calculate showRange
        const showRange = new vscode.Range(
            Math.max(targetRange.start.line - 4, 0),
            0,
            Math.min(targetRange.end.line + 4, document.lineCount - 1),
            Number.MAX_SAFE_INTEGER
        );

        // Filter: Only return suggestion if cursor is within showRange
        if (!showRange.contains(cursorPosition)) {
            this.outputChannel.appendLine(`    ❌ Cursor not in showRange - filtering out suggestion`);
            return undefined;
        }

        // Empty string means delete
        const item = new vscode.InlineCompletionItem('', targetRange);
        item.isInlineEdit = true;
        item.showRange = showRange;
        item.displayLocation = {
            range: targetRange,
            label: `Delete at line ${targetRange.start.line + 1}:${targetRange.start.character}`,
            kind: 0,
            jumpToEdit: targetRange.start.line !== cursorPosition.line
        };

        return item;
    }

    /**
     * Logs detailed information about a suggestion.
     */
    private logSuggestionDetails(suggestion: vscode.InlineCompletionItem, type: string): void {
        const range = suggestion.range;
        const insertText = suggestion.insertText;
        const textPreview = typeof insertText === 'string'
            ? insertText.substring(0, 50) + (insertText.length > 50 ? '...' : '')
            : 'Snippet';

        if (range) {
            this.outputChannel.appendLine(`    📍 Range: Line ${range.start.line + 1}:${range.start.character} to ${range.end.line + 1}:${range.end.character}`);
        } else {
            this.outputChannel.appendLine(`    📍 Range: At cursor position`);
        }
        this.outputChannel.appendLine(`    📝 Text: "${textPreview}"`);
        this.outputChannel.appendLine(`    📏 Type: ${type}`);
    }
}
