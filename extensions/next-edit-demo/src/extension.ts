import * as vscode from 'vscode';
// Type definitions for inlineCompletionsAdditions are in vscode.proposed.inlineCompletionsAdditions.d.ts
// TypeScript automatically picks them up - no runtime import needed

/**
 * Demo extension that provides "next edit" suggestions using VS Code's InlineCompletionItemProvider API.
 * 
 * This demonstrates how to show inline completion suggestions at positions OTHER than the cursor,
 * similar to GitHub Copilot's "next edit" feature. Suggestions can be accepted with TAB.
 */
export function activate(context: vscode.ExtensionContext) {
    console.log('Next Edit Demo extension is now active!');

    // Create output channel for debugging
    const outputChannel = vscode.window.createOutputChannel('Next Edit Demo');
    outputChannel.appendLine('Next Edit Demo extension activated');
    outputChannel.show(true); // Show output channel automatically

    // Check and log VS Code settings for inline completions
    const config = vscode.workspace.getConfiguration('editor');
    const inlineSuggestEnabled = config.get('inlineSuggest.enabled', true);
    const inlineSuggestEditsEnabled = config.get('inlineSuggest.edits.enabled', false);
    const suggestOnTriggerCharacters = config.get('suggestOnTriggerCharacters', true);
    
    outputChannel.appendLine(`VS Code Settings:`);
    outputChannel.appendLine(`  editor.inlineSuggest.enabled: ${inlineSuggestEnabled}`);
    outputChannel.appendLine(`  editor.inlineSuggest.edits.enabled: ${inlineSuggestEditsEnabled} ⚠️ CRITICAL FOR NEXT-EDIT SUGGESTIONS`);
    outputChannel.appendLine(`  editor.suggestOnTriggerCharacters: ${suggestOnTriggerCharacters}`);
    
    if (!inlineSuggestEnabled) {
        outputChannel.appendLine(`  ⚠️  WARNING: Inline suggestions are disabled! Enable with: editor.inlineSuggest.enabled = true`);
        vscode.window.showWarningMessage(
            'Next Edit Demo: Inline suggestions are disabled. Enable "editor.inlineSuggest.enabled" in settings.'
        );
    }
    
    if (!inlineSuggestEditsEnabled) {
        outputChannel.appendLine(`  ❌ CRITICAL: Inline edits are disabled! Next-edit suggestions will NOT work!`);
        outputChannel.appendLine(`  To enable: Set "editor.inlineSuggest.edits.enabled": true in settings.json`);
        vscode.window.showErrorMessage(
            'Next Edit Demo: Inline edits are disabled. Enable "editor.inlineSuggest.edits.enabled" in settings for next-edit suggestions to work!'
        );
    }

    // Register the inline completion provider
    const provider = new NextEditCompletionProvider(outputChannel);
    const disposable = vscode.languages.registerInlineCompletionItemProvider(
        { pattern: '**/*' }, // Works for all file types
        provider
    );

    context.subscriptions.push(disposable, outputChannel);

    // Register commands
    const triggerCommand = vscode.commands.registerCommand('nextEditDemo.trigger', () => {
        outputChannel.appendLine('Manual trigger command invoked');
        vscode.window.showInformationMessage('Next Edit suggestions are shown automatically as you type. Try typing code!');
    });

    const insertCommand = vscode.commands.registerCommand('nextEditDemo.insertSuggestion', async () => {
        await provider.insertDemoSuggestion();
    });

    const modifyCommand = vscode.commands.registerCommand('nextEditDemo.modifySuggestion', async () => {
        await provider.modifyDemoSuggestion();
    });

    const deleteCommand = vscode.commands.registerCommand('nextEditDemo.deleteSuggestion', async () => {
        await provider.deleteDemoSuggestion();
    });

    const remoteCommand = vscode.commands.registerCommand('nextEditDemo.remoteSuggestion', async () => {
        await provider.remoteDemoSuggestion();
    });

    const modifyTwoLinesAfterCommand = vscode.commands.registerCommand('nextEditDemo.modifyTwoLinesAfter', async () => {
        await provider.modifyTwoLinesAfterDemo();
    });

    context.subscriptions.push(
        triggerCommand,
        insertCommand,
        modifyCommand,
        deleteCommand,
        remoteCommand,
        modifyTwoLinesAfterCommand
    );

    outputChannel.appendLine('Extension setup complete');
    outputChannel.appendLine('');
    outputChannel.appendLine('✅ Using Inline Completions Additions API for Next-Edit Suggestions');
    outputChannel.appendLine('This extension uses the stabilized inlineCompletionsAdditions API:');
    outputChannel.appendLine('  - isInlineEdit: true (marks as next-edit suggestion)');
    outputChannel.appendLine('  - showRange: allows display when cursor is within 4 lines');
    outputChannel.appendLine('  - displayLocation: visual indicator of where edit will be applied');
    outputChannel.appendLine('');
    outputChannel.appendLine('These APIs are available in VS Code 1.99+ (stable).');
    outputChannel.appendLine('See CURSOR_PROMPT_FOR_COPILOT.md for how we discovered this.');
}

export function deactivate() {
    // Cleanup if needed
}

/**
 * InlineCompletionItemProvider that provides suggestions at positions other than the cursor.
 * 
 * Key feature: The Range parameter in InlineCompletionItem can be different from the cursor position,
 * allowing suggestions to appear elsewhere in the document (e.g., on the next line, or at a different location).
 */
class NextEditCompletionProvider implements vscode.InlineCompletionItemProvider {
    constructor(private outputChannel: vscode.OutputChannel) { }

    async provideInlineCompletionItems(
        document: vscode.TextDocument,
        position: vscode.Position,
        context: vscode.InlineCompletionContext,
        token: vscode.CancellationToken
    ): Promise<vscode.InlineCompletionList | undefined> {
        const timestamp = new Date().toISOString();
        const fileName = document.fileName.split('/').pop() || document.fileName;
        const triggerKind = context.triggerKind === vscode.InlineCompletionTriggerKind.Automatic ? 'Automatic' : 'Manual';

        // Log the request with full details
        this.outputChannel.appendLine(`\n${'='.repeat(80)}`);
        this.outputChannel.appendLine(`[${timestamp}] provideInlineCompletionItems CALLED`);
        this.outputChannel.appendLine(`  File: ${fileName}`);
        this.outputChannel.appendLine(`  Language: ${document.languageId}`);
        this.outputChannel.appendLine(`  Position: Line ${position.line + 1}, Column ${position.character + 1}`);
        this.outputChannel.appendLine(`  Trigger: ${triggerKind}`);
        this.outputChannel.appendLine(`  Selected Completion: ${context.selectedCompletionInfo?.text || 'none'}`);
        this.outputChannel.appendLine(`  Document line count: ${document.lineCount}`);
        // CRITICAL: Log context flags that determine if inline edits are requested
        // Note: These properties are not exposed in the public API, so they may be undefined
        // But we can check the setting directly to know if inline edits are enabled
        const contextIncludeInlineEdits = (context as any).includeInlineEdits;
        const contextIncludeInlineCompletions = (context as any).includeInlineCompletions;
        this.outputChannel.appendLine(`  ⚠️  Context.includeInlineEdits: ${contextIncludeInlineEdits ?? 'undefined (not exposed in API)'}`);
        this.outputChannel.appendLine(`  ⚠️  Context.includeInlineCompletions: ${contextIncludeInlineCompletions ?? 'undefined (not exposed in API)'}`);
        
        // Check setting directly as fallback
        const config = vscode.workspace.getConfiguration('editor');
        const inlineSuggestEditsEnabled = config.get('inlineSuggest.edits.enabled', false);
        this.outputChannel.appendLine(`  ⚠️  Setting editor.inlineSuggest.edits.enabled: ${inlineSuggestEditsEnabled}`);
        
        if (!inlineSuggestEditsEnabled && contextIncludeInlineEdits === undefined) {
            this.outputChannel.appendLine(`  ❌ WARNING: editor.inlineSuggest.edits.enabled is false - inline edits may not be requested!`);
        }
        
        // Log current line content
        const currentLine = document.lineAt(position.line);
        this.outputChannel.appendLine(`  Current line: "${currentLine.text}"`);
        this.outputChannel.appendLine(`  Line trimmed: "${currentLine.text.trim()}"`);
        
        // Log next line if it exists
        if (position.line + 1 < document.lineCount) {
            const nextLine = document.lineAt(position.line + 1);
            this.outputChannel.appendLine(`  Next line: "${nextLine.text}" (length: ${nextLine.text.length}, trimmed: ${nextLine.text.trim().length})`);
        } else {
            this.outputChannel.appendLine(`  Next line: does not exist`);
        }

        if (token.isCancellationRequested) {
            this.outputChannel.appendLine(`  ❌ CANCELLED: Token was already cancelled`);
            return undefined;
        }

        const suggestions: vscode.InlineCompletionItem[] = [];

        // Example 1: Suggest adding a comment/implementation on the next line
        // This is the most common "next edit" pattern - suggestion appears below cursor
        this.outputChannel.appendLine(`  🔍 Checking next-line suggestion...`);
        const nextLineSuggestion = this.createNextLineSuggestion(document, position);
        if (nextLineSuggestion) {
            suggestions.push(nextLineSuggestion);
            this.outputChannel.appendLine(`  ✅ Created next-line suggestion`);
            this.logSuggestionDetails(nextLineSuggestion, 'next-line');
        } else {
            this.outputChannel.appendLine(`  ❌ No next-line suggestion (pattern didn't match)`);
        }
        /*
                // Example 2: Suggest adding a comment above the current line
                // Shows suggestion at a position above the cursor
                this.outputChannel.appendLine(`  🔍 Checking above-line suggestion...`);
                const aboveLineSuggestion = this.createAboveLineSuggestion(document, position);
                if (aboveLineSuggestion) {
                    suggestions.push(aboveLineSuggestion);
                    this.outputChannel.appendLine(`  ✅ Created above-line suggestion`);
                    this.logSuggestionDetails(aboveLineSuggestion, 'above-line');
                } else {
                    this.outputChannel.appendLine(`  ❌ No above-line suggestion (pattern didn't match or line not empty)`);
                }*/

        // Example 3: Suggest adding code at the end of the same line
        // Shows suggestion at a different column on the same line
        this.outputChannel.appendLine(`  🔍 Checking same-line suggestion...`);
        const sameLineSuggestion = this.createSameLineSuggestion(document, position);
        if (sameLineSuggestion) {
            suggestions.push(sameLineSuggestion);
            this.outputChannel.appendLine(`  ✅ Created same-line suggestion`);
            this.logSuggestionDetails(sameLineSuggestion, 'same-line');
        } else {
            this.outputChannel.appendLine(`  ❌ No same-line suggestion (pattern didn't match)`);
        }

        // Example 4: Suggest adding a closing brace at a different location
        // Shows suggestion several lines away from cursor
        this.outputChannel.appendLine(`  🔍 Checking closing-brace suggestion...`);
        const closingBraceSuggestion = this.createClosingBraceSuggestion(document, position);
        if (closingBraceSuggestion) {
            suggestions.push(closingBraceSuggestion);
            this.outputChannel.appendLine(`  ✅ Created closing-brace suggestion`);
            this.logSuggestionDetails(closingBraceSuggestion, 'closing-brace');
        } else {
            this.outputChannel.appendLine(`  ❌ No closing-brace suggestion (pattern didn't match or target line not empty)`);
        }

        // Example 5: Suggest replacing text on the same line (MODIFY)
        this.outputChannel.appendLine(`  🔍 Checking modify/replace suggestion...`);
        const modifySuggestion = this.createModifySuggestion(document, position);
        if (modifySuggestion) {
            suggestions.push(modifySuggestion);
            this.outputChannel.appendLine(`  ✅ Created modify suggestion`);
            this.logSuggestionDetails(modifySuggestion, 'modify');
        } else {
            this.outputChannel.appendLine(`  ❌ No modify suggestion (pattern didn't match)`);
        }

        // Example 6: Suggest deleting text on the current line (DELETE)
        this.outputChannel.appendLine(`  🔍 Checking delete suggestion...`);
        const deleteSuggestion = this.createDeleteSuggestion(document, position);
        if (deleteSuggestion) {
            suggestions.push(deleteSuggestion);
            this.outputChannel.appendLine(`  ✅ Created delete suggestion`);
            this.logSuggestionDetails(deleteSuggestion, 'delete');
        } else {
            this.outputChannel.appendLine(`  ❌ No delete suggestion (pattern didn't match)`);
        }

        // Example 7: Suggest modifying text 2 lines after the cursor (MODIFY REMOTE)
        this.outputChannel.appendLine(`  🔍 Checking modify-two-lines-after suggestion...`);
        const modifyTwoLinesAfterSuggestion = this.createModifyTwoLinesAfter(document, position);
        if (modifyTwoLinesAfterSuggestion) {
            suggestions.push(modifyTwoLinesAfterSuggestion);
            this.outputChannel.appendLine(`  ✅ Created modify-two-lines-after suggestion`);
            this.logSuggestionDetails(modifyTwoLinesAfterSuggestion, 'modify-two-lines-after');
        } else {
            this.outputChannel.appendLine(`  ❌ No modify-two-lines-after suggestion (pattern didn't match or line doesn't exist)`);
        }

        // Example 8: Suggest cleaning up whitespace in lines below if 'cleanup' is typed at beginning of line
        this.outputChannel.appendLine(`  🔍 Checking cleanup suggestion below...`);
        const cleanupSuggestion = this.createCleanupSuggestion(document, position, 2);
        if (cleanupSuggestion) {
            suggestions.push(cleanupSuggestion);
            this.outputChannel.appendLine(`  ✅ Created cleanup suggestion below`);
            this.logSuggestionDetails(cleanupSuggestion, 'cleanup below');
        } else {
            this.outputChannel.appendLine(`  ❌ No cleanup suggestion below (pattern didn't match or no whitespace to cleanup)`);
        }

        // Example 9: Suggest cleaning up whitespace in lines below if 'cleanup' is typed at beginning of line
        this.outputChannel.appendLine(`  🔍 Checking cleanup suggestion above...`);
        const cleanupSuggestion2 = this.createCleanupSuggestion(document, position, -5);
        if (cleanupSuggestion2) {
            suggestions.push(cleanupSuggestion2);
            this.outputChannel.appendLine(`  ✅ Created cleanup suggestion above`);
            this.logSuggestionDetails(cleanupSuggestion2, 'cleanup above');
        } else {
            this.outputChannel.appendLine(`  ❌ No cleanup suggestion above (pattern didn't match or no whitespace to cleanup)`);
        }

        if (suggestions.length === 0) {
            this.outputChannel.appendLine(`  ⚠️  NO SUGGESTIONS CREATED - returning undefined`);
            this.outputChannel.appendLine(`${'='.repeat(80)}\n`);
            return undefined;
        }

        this.outputChannel.appendLine(`  🎉 Returning ${suggestions.length} suggestion(s) to VS Code`);
        
        // Log details about each suggestion being returned
        suggestions.forEach((suggestion, index) => {
            this.outputChannel.appendLine(`  Suggestion ${index + 1} details:`);
            if (suggestion.range) {
                this.outputChannel.appendLine(`    Range: Line ${suggestion.range.start.line + 1}:${suggestion.range.start.character} to ${suggestion.range.end.line + 1}:${suggestion.range.end.character}`);
            }
            const item = suggestion as any;
            this.outputChannel.appendLine(`    isInlineEdit: ${item.isInlineEdit || 'not set'}`);
            if (item.showRange) {
                const sr = item.showRange;
                this.outputChannel.appendLine(`    showRange: Line ${sr.start.line + 1} to ${sr.end.line + 1}`);
                this.outputChannel.appendLine(`    Cursor in showRange: ${sr.contains(position)}`);
            }
            if (item.displayLocation) {
                this.outputChannel.appendLine(`    displayLocation: ${item.displayLocation.label} at line ${item.displayLocation.range.start.line + 1}`);
                this.outputChannel.appendLine(`    displayLocation.jumpToEdit: ${item.displayLocation.jumpToEdit}`);
            }
        });
        
        // Diagnostic: Check for potential blockers
        this.outputChannel.appendLine(`  🔍 Diagnostic checks:`);
        this.outputChannel.appendLine(`    - Setting enabled: ${inlineSuggestEditsEnabled ? '✅' : '❌'}`);
        this.outputChannel.appendLine(`    - Suggestion created: ✅`);
        this.outputChannel.appendLine(`    - If suggestion doesn't appear, possible reasons:`);
        this.outputChannel.appendLine(`      1. Regular inline completion visible (takes precedence)`);
        this.outputChannel.appendLine(`      2. Peek widget open (hides inline edits)`);
        this.outputChannel.appendLine(`      3. displayLocation range not in viewport`);
        this.outputChannel.appendLine(`      4. Another extension's completion provider active`);
        
        this.outputChannel.appendLine(`${'='.repeat(80)}\n`);
        
        // Return the list of suggestions
        // Note: VS Code will show these as ghost text at the specified ranges
        // Enable forward stability like GitHub Copilot does
        const completionList = new vscode.InlineCompletionList(suggestions);
        // @ts-ignore - enableForwardStability is not in the type definitions but exists in the API
        completionList.enableForwardStability = true;
        return completionList;
    }

    /**
     * Creates a suggestion that appears on the NEXT LINE after the cursor position.
     * This demonstrates showing suggestions at a position other than the cursor.
     * 
     * Key: The Range specifies where the suggestion appears, which can be different from cursor.
     */
    private createNextLineSuggestion(
        document: vscode.TextDocument,
        cursorPosition: vscode.Position
    ): vscode.InlineCompletionItem | undefined {
        const currentLine = document.lineAt(cursorPosition.line);
        const lineText = currentLine.text.trim();

        // Trigger when user types "function", "const", "class", etc. on current line
        const pattern = /\b(function|const|let|var|class|async\s+function)\s+\w+/;
        const matches = lineText.match(pattern);
        if (!matches) {
            this.outputChannel.appendLine(`    Pattern check failed: "${lineText}" doesn't match ${pattern}`);
            return undefined;
        }

        this.outputChannel.appendLine(`    Pattern matched: "${matches[0]}"`);

        const indent = this.getIndent(document, cursorPosition.line);
        const nextLine = cursorPosition.line + 1;

        // Calculate the target position (next line, or end of current line if next doesn't exist)
        let targetPosition: vscode.Position;
        let insertText: string;

        if (nextLine >= document.lineCount) {
            // Next line doesn't exist - suggest at end of current line (will create new line)
            this.outputChannel.appendLine(`    Next line doesn't exist, suggesting at end of current line`);
            targetPosition = new vscode.Position(
                cursorPosition.line,
                currentLine.text.length
            );
            insertText = `\n${indent}  // TODO: implement function body`;
        } else {
            // Next line exists - suggest at the beginning of it
            const nextLineText = document.lineAt(nextLine);
            this.outputChannel.appendLine(`    Next line exists: "${nextLineText.text}"`);

            // Only suggest if the next line is empty
            if (nextLineText.text.trim().length > 0) {
                this.outputChannel.appendLine(`    Next line is not empty, skipping suggestion`);
                return undefined;
            }

            this.outputChannel.appendLine(`    Next line is empty, creating suggestion`);
            targetPosition = new vscode.Position(nextLine, 0);
            insertText = `${indent}  // TODO: implement function body`;
        }

        // The range specifies where the suggestion will appear (different from cursor!)
        // Using proposed API properties to enable next-edit suggestions:
        const range = new vscode.Range(targetPosition, targetPosition);
        
        // WORKAROUND: VS Code doesn't implement showRange filtering, so we filter here
        // Calculate showRange (4 lines before/after target)
        const showRange = new vscode.Range(
            Math.max(targetPosition.line - 4, 0),  // Start 4 lines before the edit
            0,
            targetPosition.line + 4,  // End 4 lines after the edit
            Number.MAX_SAFE_INTEGER
        );
        
        this.outputChannel.appendLine(`    ShowRange calculation:`);
        this.outputChannel.appendLine(`      Target line: ${targetPosition.line + 1}`);
        this.outputChannel.appendLine(`      Cursor line: ${cursorPosition.line + 1}`);
        this.outputChannel.appendLine(`      ShowRange: lines ${showRange.start.line + 1} to ${showRange.end.line + 1}`);
        this.outputChannel.appendLine(`      Cursor in showRange: ${showRange.contains(cursorPosition)}`);
        
        // Filter: Only return suggestion if cursor is within showRange
        // NOTE: This is a workaround because VS Code doesn't check showRange
        if (!showRange.contains(cursorPosition)) {
            this.outputChannel.appendLine(`    ❌ Cursor not in showRange - filtering out suggestion`);
            return undefined;
        }
        
        const item = new vscode.InlineCompletionItem(insertText, range);
        
        // Proposed API: Mark as inline edit to enable next-edit functionality
        item.isInlineEdit = true;
        
        // Set showRange (even though VS Code doesn't use it, we set it for completeness)
        item.showRange = showRange;
        
        // Proposed API: Visual indicator showing where the edit will be applied
        // NOTE: When jumpToEdit: false, targetRange = displayLocation.range
        // When jumpToEdit: true, targetRange = editRange
        // For next-line suggestions, we want targetRange to be the edit location (next line)
        // so cursorAtInlineEdit can check if cursor is within 1 line of it
        item.displayLocation = {
            range: range,
            label: 'Next edit: TODO comment',
            kind: 0, // InlineCompletionDisplayLocationKind.Code
            jumpToEdit: false  // Changed: false makes targetRange = displayLocation.range, which helps with cursorAtInlineEdit check
        };
        
        this.outputChannel.appendLine(`    ✅ Created next-line suggestion with proposed API properties:`);
        this.outputChannel.appendLine(`      Range: ${range.start.line + 1}:${range.start.character} -> ${range.end.line + 1}:${range.end.character}`);
        this.outputChannel.appendLine(`      ShowRange: ${showRange.start.line + 1} to ${showRange.end.line + 1} (cursor within 4 lines)`);
        this.outputChannel.appendLine(`      isInlineEdit: true`);
        this.outputChannel.appendLine(`      displayLocation: ${item.displayLocation.label}`);
        
        return item;
    }

    /**
     * Creates a suggestion that appears ABOVE the current line (at a different position).
     */
    private createAboveLineSuggestion(
        document: vscode.TextDocument,
        cursorPosition: vscode.Position
    ): vscode.InlineCompletionItem | undefined {
        const currentLine = document.lineAt(cursorPosition.line);
        const lineText = currentLine.text.trim();

        // Trigger when user types a function call without a comment above
        const pattern = /\w+\s*\(/;
        if (!lineText.match(pattern)) {
            this.outputChannel.appendLine(`    Pattern check failed: "${lineText}" doesn't match function call pattern`);
            return undefined;
        }

        this.outputChannel.appendLine(`    Function call pattern matched`);

        // Check if there's already a comment above
        if (cursorPosition.line > 0) {
            const prevLine = document.lineAt(cursorPosition.line - 1);
            const prevLineText = prevLine.text.trim();
            if (prevLineText.startsWith('//') || prevLineText.startsWith('/*')) {
                this.outputChannel.appendLine(`    Line above already has comment: "${prevLineText}"`);
                return undefined; // Already has a comment
            }
            this.outputChannel.appendLine(`    Line above: "${prevLineText}" (no comment)`);
        }

        // Suggest adding a comment on the line above
        const aboveLine = cursorPosition.line - 1;
        if (aboveLine < 0) {
            // If we're at the first line, suggest at the beginning of current line
            const indent = this.getIndent(document, cursorPosition.line);
            const range = new vscode.Range(
                new vscode.Position(cursorPosition.line, 0),
                new vscode.Position(cursorPosition.line, 0)
            );
            const insertText = `${indent}// TODO: add documentation\n${indent}`;
            const item = new vscode.InlineCompletionItem(insertText, range);
            item.isInlineEdit = true;
            item.showRange = new vscode.Range(
                cursorPosition.line,
                0,
                cursorPosition.line,
                Number.MAX_SAFE_INTEGER
            );
            item.displayLocation = {
                range: range,
                label: 'Next edit: add documentation',
                kind: 0,
                jumpToEdit: false
            };
            return item;
        }

        const aboveLineText = document.lineAt(aboveLine);
        const indent = this.getIndent(document, cursorPosition.line);

        // Only suggest if the line above is empty
        if (aboveLineText.text.trim().length > 0) {
            this.outputChannel.appendLine(`    Line above is not empty: "${aboveLineText.text.trim()}"`);
            return undefined;
        }

        this.outputChannel.appendLine(`    Line above is empty, creating suggestion`);

        const range = new vscode.Range(
            new vscode.Position(aboveLine, 0),
            new vscode.Position(aboveLine, 0)
        );
        const insertText = `${indent}// TODO: add documentation\n`;

        // WORKAROUND: Filter based on showRange since VS Code doesn't check it
        const showRange = new vscode.Range(
            Math.max(aboveLine - 4, 0),
            0,
            Math.max(cursorPosition.line + 4, 0),
            Number.MAX_SAFE_INTEGER
        );
        
        if (!showRange.contains(cursorPosition)) {
            this.outputChannel.appendLine(`    ❌ Cursor not in showRange - filtering out suggestion`);
            return undefined;
        }
        
        const item = new vscode.InlineCompletionItem(insertText, range);
        
        // Proposed API: Enable next-edit for above-line suggestions
        item.isInlineEdit = true;
        item.showRange = showRange;
        item.displayLocation = {
            range: range,
            label: 'Next edit: add documentation above',
            kind: 0,
            jumpToEdit: true
        };
        
        return item;
    }

    /**
     * Creates a suggestion on the same line but at a different column position.
     */
    private createSameLineSuggestion(
        document: vscode.TextDocument,
        cursorPosition: vscode.Position
    ): vscode.InlineCompletionItem | undefined {
        const currentLine = document.lineAt(cursorPosition.line);
        const lineText = currentLine.text;

        // Trigger when user types "if (" and suggest adding "else" at the end of the line
        if (lineText.includes('if (') && !lineText.includes('else')) {
            this.outputChannel.appendLine(`    Found "if (" without "else"`);
            const lineEnd = currentLine.range.end;
            const range = new vscode.Range(lineEnd, lineEnd);
            const insertText = ' else { /* else case */ }';
            const item = new vscode.InlineCompletionItem(insertText, range);
            
            // Proposed API: Enable next-edit for same-line suggestions
            item.isInlineEdit = true;
            item.showRange = new vscode.Range(
                cursorPosition.line,
                0,
                cursorPosition.line,
                Number.MAX_SAFE_INTEGER
            );
            item.displayLocation = {
                range: range,
                label: 'Next edit: add else clause',
                kind: 0,
                jumpToEdit: false
            };
            
            return item;
        }

        this.outputChannel.appendLine(`    No "if (" pattern or already has "else"`);
        return undefined;
    }

    /**
     * Creates a suggestion for a closing brace at a different location.
     */
    private createClosingBraceSuggestion(
        document: vscode.TextDocument,
        cursorPosition: vscode.Position
    ): vscode.InlineCompletionItem | undefined {
        const currentLine = document.lineAt(cursorPosition.line);
        const lineText = currentLine.text.trim();

        // Trigger when user types an opening brace
        if (!lineText.endsWith('{') && !lineText.match(/\{\s*$/)) {
            this.outputChannel.appendLine(`    Line doesn't end with "{"`);
            return undefined;
        }

        this.outputChannel.appendLine(`    Found opening brace pattern`);

        // Find where the closing brace should go (after some lines)
        const indent = this.getIndent(document, cursorPosition.line);
        const closingBraceLine = cursorPosition.line + 3; // Suggest 3 lines down

        if (closingBraceLine >= document.lineCount) {
            // If that line doesn't exist yet, suggest at a position that would create it
            const lastLine = document.lineCount - 1;
            const lastLineText = document.lineAt(lastLine);
            const range = new vscode.Range(
                new vscode.Position(lastLine, lastLineText.text.length),
                new vscode.Position(lastLine, lastLineText.text.length)
            );
            const insertText = `\n${indent}}`;
            
            // WORKAROUND: Filter based on showRange since VS Code doesn't check it
            const showRange = new vscode.Range(
                Math.max(cursorPosition.line - 4, 0),
                0,
                Math.max(lastLine + 4, 0),
                Number.MAX_SAFE_INTEGER
            );
            
            if (!showRange.contains(cursorPosition)) {
                this.outputChannel.appendLine(`    ❌ Cursor not in showRange - filtering out suggestion`);
                return undefined;
            }
            
            const item = new vscode.InlineCompletionItem(insertText, range);
            
            // Proposed API: Enable next-edit for remote suggestions
            item.isInlineEdit = true;
            item.showRange = showRange;
            item.displayLocation = {
                range: range,
                label: 'Next edit: closing brace',
                kind: 0,
                jumpToEdit: true
            };
            
            return item;
        }

        const targetLine = document.lineAt(closingBraceLine);
        if (targetLine.text.trim().length > 0) {
            this.outputChannel.appendLine(`    Target line ${closingBraceLine + 1} is not empty: "${targetLine.text.trim()}"`);
            return undefined; // Line is not empty
        }
        
        this.outputChannel.appendLine(`    Target line ${closingBraceLine + 1} is empty, creating suggestion`);

        const range = new vscode.Range(
            new vscode.Position(closingBraceLine, 0),
            new vscode.Position(closingBraceLine, 0)
        );
        const insertText = `${indent}}`;

        // WORKAROUND: Filter based on showRange since VS Code doesn't check it
        const showRange = new vscode.Range(
            Math.max(cursorPosition.line - 4, 0),
            0,
            Math.max(closingBraceLine + 4, 0),
            Number.MAX_SAFE_INTEGER
        );
        
        if (!showRange.contains(cursorPosition)) {
            this.outputChannel.appendLine(`    ❌ Cursor not in showRange - filtering out suggestion`);
            return undefined;
        }

        const item = new vscode.InlineCompletionItem(insertText, range);
        
        // Proposed API: Enable next-edit for remote suggestions
        item.isInlineEdit = true;
        item.showRange = showRange;
        item.displayLocation = {
            range: range,
            label: 'Next edit: closing brace',
            kind: 0,
            jumpToEdit: true
        };

        return item;
    }

    /**
     * Creates a MODIFY/REPLACE suggestion on the same line.
     * Replaces text at a different position than the cursor.
     */
    private createModifySuggestion(
        document: vscode.TextDocument,
        cursorPosition: vscode.Position
    ): vscode.InlineCompletionItem | undefined {
        const currentLine = document.lineAt(cursorPosition.line);
        const lineText = currentLine.text;

        // Look for "var" keyword to replace with "const"
        const varMatch = lineText.match(/\bvar\s+/);
        if (varMatch) {
            const startPos = lineText.indexOf(varMatch[0]);
            const endPos = startPos + varMatch[0].length;

            this.outputChannel.appendLine(`    Found "var" at position ${startPos}-${endPos}`);

            const range = new vscode.Range(
                new vscode.Position(cursorPosition.line, startPos),
                new vscode.Position(cursorPosition.line, endPos)
            );
            const insertText = 'const ';
            
            this.outputChannel.appendLine(`    Creating replace suggestion: "var" -> "const"`);
            const item = new vscode.InlineCompletionItem(insertText, range);
            
            // Proposed API: Enable next-edit for modify suggestions
            item.isInlineEdit = true;
            // For same-line suggestions, showRange can be the same line
            item.showRange = new vscode.Range(
                cursorPosition.line,
                0,
                cursorPosition.line,
                Number.MAX_SAFE_INTEGER
            );
            item.displayLocation = {
                range: range,
                label: 'Next edit: replace var with const',
                kind: 0,
                jumpToEdit: false // Same line, no need to jump
            };
            
            return item;
        }

        // Look for "==" to replace with "==="
        const eqMatch = lineText.match(/\s==\s/);
        if (eqMatch) {
            const startPos = lineText.indexOf(eqMatch[0]);
            const endPos = startPos + eqMatch[0].length;

            this.outputChannel.appendLine(`    Found "==" at position ${startPos}-${endPos}`);

            const range = new vscode.Range(
                new vscode.Position(cursorPosition.line, startPos),
                new vscode.Position(cursorPosition.line, endPos)
            );
            const insertText = ' === ';
            
            this.outputChannel.appendLine(`    Creating replace suggestion: "==" -> "==="`);
            const item = new vscode.InlineCompletionItem(insertText, range);
            
            // Proposed API: Enable next-edit for modify suggestions
            item.isInlineEdit = true;
            item.showRange = new vscode.Range(
                cursorPosition.line,
                0,
                cursorPosition.line,
                Number.MAX_SAFE_INTEGER
            );
            item.displayLocation = {
                range: range,
                label: 'Next edit: replace == with ===',
                kind: 0,
                jumpToEdit: false
            };
            
            return item;
        }

        this.outputChannel.appendLine(`    No modify pattern found`);
        return undefined;
    }

    /**
     * Creates a MODIFY/REPLACE suggestion 2 lines AFTER the cursor position.
     * This demonstrates modifying code at a remote location (not at cursor).
     */
    private createModifyTwoLinesAfter(
        document: vscode.TextDocument,
        cursorPosition: vscode.Position
    ): vscode.InlineCompletionItem | undefined {
        const targetLine = cursorPosition.line + 2;
        
        // Check if target line exists
        if (targetLine >= document.lineCount) {
            this.outputChannel.appendLine(`    Target line ${targetLine + 1} doesn't exist (document has ${document.lineCount} lines)`);
            return undefined;
        }

        const targetLineObj = document.lineAt(targetLine);
        const targetLineText = targetLineObj.text;

        this.outputChannel.appendLine(`    Checking line ${targetLine + 1}: "${targetLineText}"`);

        // Look for patterns to modify on the target line
        // Pattern 1: "var" -> "const"
        const varMatch = targetLineText.match(/\bvar\s+/);
        if (varMatch) {
            const startPos = targetLineText.indexOf(varMatch[0]);
            const endPos = startPos + varMatch[0].length;

            this.outputChannel.appendLine(`    Found "var" at position ${startPos}-${endPos} on line ${targetLine + 1}`);

            const range = new vscode.Range(
                new vscode.Position(targetLine, startPos),
                new vscode.Position(targetLine, endPos)
            );
            const insertText = 'const ';

            // Calculate showRange: allow display when cursor is within 4 lines of the edit
            const showRange = new vscode.Range(
                Math.max(targetLine - 4, 0),
                0,
                Math.max(targetLine + 4, 0),
                Number.MAX_SAFE_INTEGER
            );

            this.outputChannel.appendLine(`    ShowRange calculation:`);
            this.outputChannel.appendLine(`      Target line: ${targetLine + 1}`);
            this.outputChannel.appendLine(`      Cursor line: ${cursorPosition.line + 1}`);
            this.outputChannel.appendLine(`      ShowRange: lines ${showRange.start.line + 1} to ${showRange.end.line + 1}`);
            this.outputChannel.appendLine(`      Cursor in showRange: ${showRange.contains(cursorPosition)}`);

            // Filter: Only return suggestion if cursor is within showRange
            if (!showRange.contains(cursorPosition)) {
                this.outputChannel.appendLine(`    ❌ Cursor not in showRange - filtering out suggestion`);
                return undefined;
            }

            this.outputChannel.appendLine(`    Creating replace suggestion: "var" -> "const" on line ${targetLine + 1}`);
            const item = new vscode.InlineCompletionItem(insertText, range);

            // Proposed API: Enable next-edit for remote modify suggestions
            item.isInlineEdit = true;
            item.showRange = showRange;
            item.displayLocation = {
                range: range,
                label: `Next edit: replace var with const (line ${targetLine + 1})`,
                kind: 0, // InlineCompletionDisplayLocationKind.Code
                jumpToEdit: true  // Jump to the edit location since it's remote
            };

            return item;
        }

        // Pattern 2: "==" -> "==="
        const eqMatch = targetLineText.match(/\s==\s/);
        if (eqMatch) {
            const startPos = targetLineText.indexOf(eqMatch[0]);
            const endPos = startPos + eqMatch[0].length;

            this.outputChannel.appendLine(`    Found "==" at position ${startPos}-${endPos} on line ${targetLine + 1}`);

            const range = new vscode.Range(
                new vscode.Position(targetLine, startPos),
                new vscode.Position(targetLine, endPos)
            );
            const insertText = ' === ';

            // Calculate showRange
            const showRange = new vscode.Range(
                Math.max(targetLine - 4, 0),
                0,
                Math.max(targetLine + 4, 0),
                Number.MAX_SAFE_INTEGER
            );

            if (!showRange.contains(cursorPosition)) {
                this.outputChannel.appendLine(`    ❌ Cursor not in showRange - filtering out suggestion`);
                return undefined;
            }

            this.outputChannel.appendLine(`    Creating replace suggestion: "==" -> "===" on line ${targetLine + 1}`);
            const item = new vscode.InlineCompletionItem(insertText, range);

            item.isInlineEdit = true;
            item.showRange = showRange;
            item.displayLocation = {
                range: range,
                label: `Next edit: replace == with === (line ${targetLine + 1})`,
                kind: 0,
                jumpToEdit: true
            };

            return item;
        }

        // Pattern 3: Add error handling to a function call
        const functionCallMatch = targetLineText.match(/(\w+)\s*\([^)]*\)\s*;?\s*$/);
        if (functionCallMatch && !targetLineText.includes('try') && !targetLineText.includes('catch')) {
            const indent = this.getIndent(document, targetLine);
            const functionCall = functionCallMatch[0].trim();
            const startPos = targetLineText.indexOf(functionCall);
            const endPos = startPos + functionCall.length;

            this.outputChannel.appendLine(`    Found function call "${functionCall}" on line ${targetLine + 1} without error handling`);

            const range = new vscode.Range(
                new vscode.Position(targetLine, startPos),
                new vscode.Position(targetLine, endPos)
            );
            // Wrap in try-catch
            const insertText = `try {\n${indent}    ${functionCall}\n${indent}} catch (error) {\n${indent}    console.error('Error:', error);\n${indent}}`;

            const showRange = new vscode.Range(
                Math.max(targetLine - 4, 0),
                0,
                Math.max(targetLine + 4, 0),
                Number.MAX_SAFE_INTEGER
            );

            if (!showRange.contains(cursorPosition)) {
                this.outputChannel.appendLine(`    ❌ Cursor not in showRange - filtering out suggestion`);
                return undefined;
            }

            this.outputChannel.appendLine(`    Creating error handling suggestion on line ${targetLine + 1}`);
            const item = new vscode.InlineCompletionItem(insertText, range);

            item.isInlineEdit = true;
            item.showRange = showRange;
            item.displayLocation = {
                range: range,
                label: `Next edit: add error handling (line ${targetLine + 1})`,
                kind: 0,
                jumpToEdit: true
            };

            return item;
        }

        this.outputChannel.appendLine(`    No modify pattern found on line ${targetLine + 1}`);
        return undefined;
    }

    /**
     * Creates a DELETE suggestion on the current line.
     * Suggests deleting text at a position on the same line.
     */
    private createDeleteSuggestion(
        document: vscode.TextDocument,
        cursorPosition: vscode.Position
    ): vscode.InlineCompletionItem | undefined {
        const currentLine = document.lineAt(cursorPosition.line);
        const lineText = currentLine.text.trim();

        // Look for console.log statements to delete
        const consoleMatch = lineText.match(/console\.(log|debug|info|warn)\([^)]*\);?/);
        if (consoleMatch) {
            const fullLineText = currentLine.text;
            const startPos = fullLineText.indexOf(consoleMatch[0]);
            const endPos = startPos + consoleMatch[0].length;

            this.outputChannel.appendLine(`    Found console statement at position ${startPos}-${endPos}`);

            const range = new vscode.Range(
                new vscode.Position(cursorPosition.line, startPos),
                new vscode.Position(cursorPosition.line, endPos)
            );
            // Empty string means delete
            const insertText = '';
            
            this.outputChannel.appendLine(`    Creating delete suggestion for: "${consoleMatch[0]}"`);
            const item = new vscode.InlineCompletionItem(insertText, range);
            
            // Proposed API: Enable next-edit for delete suggestions
            item.isInlineEdit = true;
            item.showRange = new vscode.Range(
                cursorPosition.line,
                0,
                cursorPosition.line,
                Number.MAX_SAFE_INTEGER
            );
            item.displayLocation = {
                range: range,
                label: 'Next edit: delete console.log',
                kind: 0,
                jumpToEdit: false
            };
            
            return item;
        }

        // Look for TODO comments to delete
        const todoMatch = lineText.match(/\/\/\s*(TODO|FIXME|HACK|XXX):\s*.*/i);
        if (todoMatch) {
            const fullLineText = currentLine.text;
            const startPos = fullLineText.indexOf(todoMatch[0]);
            const endPos = startPos + todoMatch[0].length;

            this.outputChannel.appendLine(`    Found TODO comment at position ${startPos}-${endPos}`);

            const range = new vscode.Range(
                new vscode.Position(cursorPosition.line, startPos),
                new vscode.Position(cursorPosition.line, endPos)
            );
            const insertText = '';
            
            this.outputChannel.appendLine(`    Creating delete suggestion for: "${todoMatch[0]}"`);
            const item = new vscode.InlineCompletionItem(insertText, range);
            
            // Proposed API: Enable next-edit for delete suggestions
            item.isInlineEdit = true;
            item.showRange = new vscode.Range(
                cursorPosition.line,
                0,
                cursorPosition.line,
                Number.MAX_SAFE_INTEGER
            );
            item.displayLocation = {
                range: range,
                label: 'Next edit: delete TODO comment',
                kind: 0,
                jumpToEdit: false
            };
            
            return item;
        }

        this.outputChannel.appendLine(`    No delete pattern found`);
        return undefined;
    }

    /**
     * Creates a cleanup suggestion that removes whitespace from lines below the cursor.
     * Triggers when 'cleanup' is typed at the beginning of the current line.
     */
    private createCleanupSuggestion(
        document: vscode.TextDocument,
        position: vscode.Position,
        lineOffset: number,
        removeLimit: number = 10
    ): vscode.InlineCompletionItem | undefined {
        const cleanupPattern = lineOffset >= 0 ? /^cleanup below\b/ : /^cleanup above\b/;
        const currentLineObj = document.lineAt(position.line);
        if (cleanupPattern.test(currentLineObj.text.trim())) {
            this.outputChannel.appendLine(`    'cleanup' detected at line ${position.line + 1}`);
            // Calculate target lines (current+2 to current+4)
            const startLine = position.line + lineOffset;
            const endLine = position.line + lineOffset + 2; 
            if (startLine < document.lineCount) {
                // We'll generate a WorkspaceEdit that replaces each of these lines with trimmed version
                const edits: { range: vscode.Range, newText: string }[] = [];
                let totalRemovedCount = 0; // Track total whitespaces removed across all lines
                for (let line = startLine; line <= endLine && line < document.lineCount; line++) {
                    const lineObj = document.lineAt(line);
                    const remainingLimit = removeLimit - totalRemovedCount;
                    if (remainingLimit <= 0) {
                        this.outputChannel.appendLine(`    Reached total limit of ${removeLimit} whitespaces, skipping remaining lines`);
                        break;
                    }
                    const result = this.removeWhitespaceLimited(lineObj.text, remainingLimit);
                    const trimmed = result.text;
                    const removedFromLine = result.removedCount;
                    totalRemovedCount += removedFromLine;
                    if (lineObj.text !== trimmed) {
                        edits.push({
                            range: new vscode.Range(
                                new vscode.Position(line, 0),
                                new vscode.Position(line, lineObj.text.length)
                            ),
                            newText: trimmed
                        });
                        this.outputChannel.appendLine(`    Will cleanup line ${line + 1}: "${lineObj.text}" -> "${trimmed}" (removed ${removedFromLine} whitespaces, total: ${totalRemovedCount}/${removeLimit})`);
                    }
                }
                if (edits.length > 0) {
                    // We'll only suggest if there are nontrivial whitespace to remove
                    // Build a combined text edit (simulate inline edit as a multi-line edit)
                    // We'll use just the first edit as range for the suggestion, but VS Code only supports single edit
                    // So join all replaced lines together
                    const range = new vscode.Range(
                        new vscode.Position(edits[0].range.start.line, 0),
                        new vscode.Position(edits[edits.length - 1].range.end.line, edits[edits.length - 1].range.end.character)
                    );
                    // Rebuild the content for all affected lines (old -> cleaned)
                    let finalText = '';
                    let cur = edits[0].range.start.line;
                    for (let i = 0; i < edits.length; ++i) {
                        while (cur < edits[i].range.start.line) {
                            // Just keep linebreaks for missing lines
                            finalText += document.lineAt(cur).text + '\n';
                            cur++;
                        }
                        finalText += edits[i].newText;
                        if (edits[i].range.start.line < document.lineCount - 1) finalText += '\n';
                        cur++;
                    }
                    // Adjust for possible skipped lines at end
                    while (cur <= edits[edits.length - 1].range.end.line) {
                        if (cur < document.lineCount) {
                            finalText += document.lineAt(cur).text;
                            if (cur < edits[edits.length - 1].range.end.line) finalText += '\n';
                        }
                        cur++;
                    }

                    const item = new vscode.InlineCompletionItem(finalText, range);
                    item.isInlineEdit = true;
                    // Mark larger showRange to ensure it's visible
                    item.showRange = new vscode.Range(
                        Math.max(position.line, 0),
                        0,
                        Math.min(endLine, document.lineCount - 1),
                        Number.MAX_SAFE_INTEGER
                    );
                    item.displayLocation = {
                        range: range,
                        label: `Cleanup whitespace in lines ${startLine + 1}-${Math.min(endLine + 1, document.lineCount)}`,
                        kind: 0,
                        jumpToEdit: true
                    };
                    this.outputChannel.appendLine(`    Created cleanup suggestion: lines ${startLine + 1}-${Math.min(endLine + 1, document.lineCount)}`);
                    return item;
                } else {
                    this.outputChannel.appendLine(`    No whitespace found in target lines to cleanup`);
                }
            } else {
                this.outputChannel.appendLine(`    Not enough lines below to cleanup (${startLine + 1} > document.lineCount)`);
            }
        } else {
            this.outputChannel.appendLine(`    No 'cleanup' at beginning of line`);
        }
        return undefined;
    }

    /**
     * Helper to get the indentation of a line.
     */
    private getIndent(document: vscode.TextDocument, line: number): string {
        if (line < 0 || line >= document.lineCount) {
            return '';
        }
        const text = document.lineAt(line).text;
        const match = text.match(/^\s*/);
        return match ? match[0] : '';
    }

    /**
     * Removes up to removeLimit whitespace characters from a string.
     * Stops removing once the limit is reached.
     * Returns both the processed text and the count of removed whitespaces.
     */
    private removeWhitespaceLimited(text: string, removeLimit: number): { text: string; removedCount: number } {
        if (removeLimit <= 0) {
            return { text, removedCount: 0 };
        }
        
        let result = '';
        let removedCount = 0;
        
        for (let i = 0; i < text.length; i++) {
            const char = text[i];
            if (/\s/.test(char) && removedCount < removeLimit) {
                removedCount++;
                // Skip this whitespace character
            } else {
                result += char;
            }
        }
        
        return { text: result, removedCount };
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
        this.outputChannel.appendLine(`    📝 Text preview: "${textPreview}"`);
        this.outputChannel.appendLine(`    📏 Text length: ${typeof insertText === 'string' ? insertText.length : 'N/A'} chars`);
    }

    /**
     * Demo command: Insert a pattern that triggers an INSERT suggestion on the next line.
     */
    async insertDemoSuggestion(): Promise<void> {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showErrorMessage('No active editor');
            return;
        }

        this.outputChannel.appendLine('\n[DEMO] Insert Suggestion Command');
        const position = editor.selection.active;
        const indent = this.getIndent(editor.document, position.line);

        // Insert a function declaration that will trigger a next-line suggestion
        const textToInsert = `function demoFunction() {`;
        await editor.edit(editBuilder => {
            editBuilder.insert(position, textToInsert);
        });

        // Move cursor to end of inserted text
        const newPosition = new vscode.Position(position.line, position.character + textToInsert.length);
        editor.selection = new vscode.Selection(newPosition, newPosition);
        editor.revealRange(new vscode.Range(newPosition, newPosition));

        this.outputChannel.appendLine(`  Inserted: "${textToInsert}"`);
        this.outputChannel.appendLine('  This should trigger a next-line suggestion. Press TAB to accept.');

        // Trigger inline completions
        await vscode.commands.executeCommand('editor.action.inlineSuggest.trigger');
    }

    /**
     * Demo command: Insert a pattern that triggers a MODIFY/REPLACE suggestion on the same line.
     */
    async modifyDemoSuggestion(): Promise<void> {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showErrorMessage('No active editor');
            return;
        }

        this.outputChannel.appendLine('\n[DEMO] Modify Suggestion Command');
        const position = editor.selection.active;

        // Insert text that will trigger a replacement suggestion
        const textToInsert = `var oldVariable = 42;`;
        await editor.edit(editBuilder => {
            editBuilder.insert(position, textToInsert);
        });

        // Move cursor to after the inserted text
        const newPosition = new vscode.Position(position.line, position.character + textToInsert.length);
        editor.selection = new vscode.Selection(newPosition, newPosition);
        editor.revealRange(new vscode.Range(newPosition, newPosition));

        this.outputChannel.appendLine(`  Inserted: "${textToInsert}"`);
        this.outputChannel.appendLine('  This should trigger a modify suggestion (var -> const). Press TAB to accept.');

        // Trigger inline completions
        await vscode.commands.executeCommand('editor.action.inlineSuggest.trigger');
    }

    /**
     * Demo command: Insert a pattern that triggers a DELETE suggestion on the current line.
     */
    async deleteDemoSuggestion(): Promise<void> {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showErrorMessage('No active editor');
            return;
        }

        this.outputChannel.appendLine('\n[DEMO] Delete Suggestion Command');
        const position = editor.selection.active;

        // Insert text that will trigger a deletion suggestion (console.log)
        const textToInsert = `console.log('debug message');`;
        await editor.edit(editBuilder => {
            editBuilder.insert(position, textToInsert);
        });

        // Move cursor to end of inserted text
        const newPosition = new vscode.Position(position.line, position.character + textToInsert.length);
        editor.selection = new vscode.Selection(newPosition, newPosition);
        editor.revealRange(new vscode.Range(newPosition, newPosition));

        this.outputChannel.appendLine(`  Inserted: "${textToInsert}"`);
        this.outputChannel.appendLine('  This should trigger a delete suggestion. Press TAB to accept.');

        // Trigger inline completions
        await vscode.commands.executeCommand('editor.action.inlineSuggest.trigger');
    }

    /**
     * Demo command: Insert a pattern that triggers a REMOTE suggestion on a different line.
     */
    async remoteDemoSuggestion(): Promise<void> {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showErrorMessage('No active editor');
            return;
        }

        this.outputChannel.appendLine('\n[DEMO] Remote Suggestion Command');
        const position = editor.selection.active;
        const indent = this.getIndent(editor.document, position.line);

        // Insert an opening brace that will trigger a closing brace suggestion on a different line
        const textToInsert = `if (condition) {`;
        await editor.edit(editBuilder => {
            editBuilder.insert(position, textToInsert);
        });

        // Add a couple of empty lines to make room for the closing brace suggestion
        const lineBreak = editor.document.eol === vscode.EndOfLine.CRLF ? '\r\n' : '\n';
        await editor.edit(editBuilder => {
            const nextLinePos = new vscode.Position(position.line + 1, 0);
            editBuilder.insert(nextLinePos, `${indent}  // Add some code here${lineBreak}${indent}  // More code${lineBreak}`);
        });

        // Move cursor to end of inserted text
        const newPosition = new vscode.Position(position.line, position.character + textToInsert.length);
        editor.selection = new vscode.Selection(newPosition, newPosition);
        editor.revealRange(new vscode.Range(newPosition, newPosition));

        this.outputChannel.appendLine(`  Inserted: "${textToInsert}"`);
        this.outputChannel.appendLine('  This should trigger a remote closing brace suggestion. Press TAB to accept.');

        // Trigger inline completions
        await vscode.commands.executeCommand('editor.action.inlineSuggest.trigger');
    }

    /**
     * Demo command: Set up code that triggers a MODIFY suggestion 2 lines after the cursor.
     */
    async modifyTwoLinesAfterDemo(): Promise<void> {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showErrorMessage('No active editor');
            return;
        }

        this.outputChannel.appendLine('\n[DEMO] Modify Two Lines After Command');
        const position = editor.selection.active;
        const indent = this.getIndent(editor.document, position.line);
        const lineBreak = editor.document.eol === vscode.EndOfLine.CRLF ? '\r\n' : '\n';

        // Insert current line content
        const currentLineText = `// Current line - cursor is here`;
        await editor.edit(editBuilder => {
            editBuilder.insert(position, currentLineText);
        });

        // Insert an empty line
        const line1Pos = new vscode.Position(position.line + 1, 0);
        await editor.edit(editBuilder => {
            editBuilder.insert(line1Pos, `${indent}  // Empty line${lineBreak}`);
        });

        // Insert the target line (2 lines after cursor) with a pattern to modify
        const line2Pos = new vscode.Position(position.line + 2, 0);
        const targetLineText = `${indent}var oldVariable = 42;${lineBreak}`;
        await editor.edit(editBuilder => {
            editBuilder.insert(line2Pos, targetLineText);
        });

        // Move cursor back to the original position (current line)
        const newPosition = new vscode.Position(position.line, position.character + currentLineText.length);
        editor.selection = new vscode.Selection(newPosition, newPosition);
        editor.revealRange(new vscode.Range(newPosition, newPosition));

        this.outputChannel.appendLine(`  Inserted setup:`);
        this.outputChannel.appendLine(`    Line ${position.line + 1}: "${currentLineText}" (cursor here)`);
        this.outputChannel.appendLine(`    Line ${position.line + 2}: (empty)`);
        this.outputChannel.appendLine(`    Line ${position.line + 3}: "${targetLineText.trim()}" (target for modification)`);
        this.outputChannel.appendLine(`  This should trigger a modify suggestion 2 lines after cursor (var -> const). Press TAB to accept.`);

        // Trigger inline completions
        await vscode.commands.executeCommand('editor.action.inlineSuggest.trigger');
    }
}

