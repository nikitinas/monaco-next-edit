import * as vscode from 'vscode';
// Type definitions for inlineCompletionsAdditions are in vscode.proposed.inlineCompletionsAdditions.d.ts
// TypeScript automatically picks them up - no runtime import needed
import { JsonSuggestionsProvider } from './jsonSuggestionsProvider';

/**
 * Demo extension that provides inline completion suggestions using VS Code's InlineCompletionItemProvider API.
 * 
 * This extension supports two ways to generate suggestions:
 * 1. Command-based: Parses commands from the current line and generates inline completion suggestions.
 *    Supported commands:
 *    - insert <text> at <line>[:<column>] (column defaults to 0 if omitted)
 *    - replace <line>[-<line>] with "<text>" (replace entire lines)
 *    - replace "<src>" with "<dst>" at <line>[-<line>] (column not needed)
 *    - delete <line> (delete entire line)
 *    - delete <line>-<line> (delete entire lines)
 *    - delete "<text>" at <line>:<start>-<end>
 *    - delete <line>-<line>:<column>
 * 
 * 2. JSON-based: Loads suggestions from suggestions.json in the workspace root.
 *    Format: Array of { match: { text: string, cursorAtLine: number }, edits: [...] }
 *    Line numbers in edits are relative to the beginning of the matching text.
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
    const inlineSuggestEditsEnabled = config.get('inlineSuggest.edits.experimental.enabled', false);
    
    outputChannel.appendLine(`VS Code Settings:`);
    outputChannel.appendLine(`  editor.inlineSuggest.enabled: ${inlineSuggestEnabled}`);
    outputChannel.appendLine(`  editor.inlineSuggest.edits.experimental.enabled: ${inlineSuggestEditsEnabled} ⚠️ CRITICAL FOR INLINE COMPLETION SUGGESTIONS`);
    
    if (!inlineSuggestEnabled) {
        outputChannel.appendLine(`  ⚠️  WARNING: Inline suggestions are disabled! Enable with: editor.inlineSuggest.enabled = true`);
        vscode.window.showWarningMessage(
            'Inline Completions Demo: Inline suggestions are disabled. Enable "editor.inlineSuggest.enabled" in settings.'
        );
    }
    
    if (!inlineSuggestEditsEnabled) {
        outputChannel.appendLine(`  ❌ CRITICAL: Inline edits are disabled! Inline completion suggestions will NOT work!`);
        outputChannel.appendLine(`  To enable: Set "editor.inlineSuggest.experimental.edits.enabled": true in settings.json`);
        vscode.window.showErrorMessage(
            'Inline Completions Demo: Inline edits are disabled. Enable "editor.inlineSuggest.edits.experimental.enabled" in settings for inline completion suggestions to work!'
        );
    }

    // Register the inline completion provider
    const provider = new JsonSuggestionsProvider(outputChannel);
    const disposable = vscode.languages.registerInlineCompletionItemProvider(
        { pattern: '**/*' }, // Works for all file types
        provider
    );

    context.subscriptions.push(disposable);

    // Register command to insert sample commands
    const insertCommandsDisposable = vscode.commands.registerCommand('inlineCompletionsDemo.insertSampleCommands', () => {
        insertSampleCommands(outputChannel);
    });
    context.subscriptions.push(insertCommandsDisposable);

    outputChannel.appendLine('Extension setup complete');
    outputChannel.appendLine('  - Inline completion provider registered');
    outputChannel.appendLine('  - Command "inlineCompletionsDemo.insertSampleCommands" registered');
    outputChannel.appendLine('');
    outputChannel.appendLine('Usage:');
    outputChannel.appendLine('  1. Open a file in the workspace');
    outputChannel.appendLine('  2. Type a command (see insertSampleCommands for examples) or use suggestions.json');
    outputChannel.appendLine('  3. Press TAB to see inline completion suggestions');
    outputChannel.appendLine('');
    outputChannel.appendLine('Supported commands:');
    outputChannel.appendLine('  - insert <text> at <line>[:<column>]');
    outputChannel.appendLine('  - replace <line>[-<line>] with "<text>"');
    outputChannel.appendLine('  - replace "<src>" with "<dst>" [at|in] <line>[-<line>]');
    outputChannel.appendLine('  - replace <N> "<src>" with "<dst>" [at|in] <line>[-<line>]');
    outputChannel.appendLine('  - delete <line>');
    outputChannel.appendLine('  - delete <line>-<line>');
    outputChannel.appendLine('  - delete "<text>" [at|in] <line>[-<end>]');
    outputChannel.appendLine('  - delete <N> "<text>" [at|in] <line>[-<end>]');
    outputChannel.appendLine('  - delete "<text>" [at|in] <line>:<start>-<end>');
    outputChannel.appendLine('  - delete <N> "<text>" [at|in] <line>:<start>-<end>');
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
        '// Insert at line start (column can be omitted, defaults to 0)',
        'insert "lala" at 6',
        'insert "start of line" at 10',
        '// Insert multiline text (use \\n for line breaks)',
        'insert "line1\\nline2\\nline3" at 5:10',
        '',
        '// REPLACE COMMANDS',
        '// Replace entire lines (simple syntax)',
        'replace 10-14 with "some text"',
        'replace 11 with "new line"',
        '// Replace with multiline text (use \\n for line breaks)',
        'replace 10-14 with "line1\\nline2\\nline3"',
        'replace 11 with "first\\nsecond"',
        '',
        '// Replace all occurrences (default)',
        'replace "var" with "const" at 1-10',
        'replace "str" with "string" in 12-15',
        'replace "a" with "b" at 14',
        '',
        '// Replace first N occurrences',
        'replace 2 "debug" with "info" at 1-10',
        'replace 3 "temp" with "result" in 5-20',
        '',
        '// DELETE COMMANDS',
        '// Delete entire lines (simple syntax)',
        'delete 8',
        'delete 8-15',
        '',
        '// Delete with text and line range (all occurrences by default)',
        'delete "console.log" at 1-10',
        'delete "TODO" in 5-15',
        'delete "text" at 14',
        '',
        '// Delete first N occurrences',
        'delete 2 "old" at 1-10',
        'delete 3 "temp" in 5-20',
        '',
        '// Delete with text and column range',
        'delete " " at 14:2-16',
        'delete 5 "x" in 5:0-50',
        '',
        '// Delete by position (without text)',
        'delete 12-13:4',
        '',
        '// Note: Commands are case-insensitive',
        '// You can use "at" or "in" interchangeably',
        '// Line numbers are 1-based (as shown in editor)',
        '// Column numbers are 0-based (first character is column 0)',
        '// Use \\n in quoted strings to insert line breaks (multiline text)',
        '// Example: "line1\\nline2" will insert two lines'
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
    src?: string; // Optional: if undefined, replace entire lines
    dst: string;
    startLine: number;
    endLine: number;
    count?: number | 'all'; // Number of matches to replace: 'all' = all (default), number = first N
    replaceLines?: boolean; // If true, replace entire lines instead of text matches
}

interface DeleteCommand {
    type: 'delete';
    text?: string; // Optional text to delete
    line?: number; // For delete with text: single line number, or for simple delete: single line
    startLine?: number; // For delete with text: start line (when range specified), or for delete without text: start line
    endLine?: number; // For delete with text: end line (when range specified), or for delete without text: end line
    startColumn?: number; // For delete with text: start column (optional)
    endColumn?: number; // For delete with text: end column (optional)
    column?: number; // For delete without text: column number
    count?: number | 'all'; // Number of matches to delete: 'all' = all (default), number = first N
    deleteLines?: boolean; // If true, delete entire lines (simple delete command)
}

type ParsedCommand = InsertCommand | ReplaceCommand | DeleteCommand;
