import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Types for JSON-based suggestions
 */
export interface JsonEdit {
    // New simplified format: line-only edits
    startLine?: number; // 0-based, relative to match start
    endLine?: number;    // 0-based, relative to match start, inclusive
    newText?: string; // Optional: if omitted, means complete deletion (no text inserted)
    expectedText?: string; // Optional: expected text at startLine for robust matching (searches ±10 lines if not found)
    
    // Legacy format: column-based edits (for backward compatibility)
    start?: { line: number; col: number };
    end?: { line: number; col: number };
}

export interface JsonSuggestionMatch {
    text: string;
    cursorAtLine: number;
    file?: string; // Optional exact filename match (short filename with extension, e.g., "app.ts")
}

export interface JsonSuggestion {
    match: JsonSuggestionMatch;
    edits: JsonEdit[];
}

export type JsonSuggestions = JsonSuggestion[];

/**
 * Provider for JSON-based inline completion suggestions.
 * Handles loading, caching, and matching suggestions from suggestions.json files.
 */
export class JsonSuggestionsProvider {
    private jsonSuggestionsCache: JsonSuggestions | null = null;
    private jsonSuggestionsCacheTime: number = 0;
    private readonly CACHE_TTL = 5000; // Cache for 5 seconds

    constructor(private outputChannel: vscode.OutputChannel) { }

    /**
     * Loads suggestions.json from the workspace root.
     * Uses caching to avoid reading the file on every request.
     */
    async loadJsonSuggestions(): Promise<JsonSuggestions | null> {
        const now = Date.now();
        
        // Check cache first
        if (this.jsonSuggestionsCache && (now - this.jsonSuggestionsCacheTime) < this.CACHE_TTL) {
            return this.jsonSuggestionsCache;
        }

        try {
            const workspaceFolders = vscode.workspace.workspaceFolders;
            if (!workspaceFolders || workspaceFolders.length === 0) {
                return null;
            }

            // Try each workspace folder
            for (const folder of workspaceFolders) {
                const suggestionsPath = path.join(folder.uri.fsPath, 'suggestions.json');
                
                if (fs.existsSync(suggestionsPath)) {
                    const fileContent = fs.readFileSync(suggestionsPath, 'utf-8');
                    const suggestions = JSON.parse(fileContent) as JsonSuggestions;
                    
                    // Validate structure
                    if (Array.isArray(suggestions)) {
                        this.jsonSuggestionsCache = suggestions;
                        this.jsonSuggestionsCacheTime = now;
                        this.outputChannel.appendLine(`  📄 Loaded ${suggestions.length} suggestion(s) from suggestions.json`);
                        return suggestions;
                    } else {
                        this.outputChannel.appendLine(`  ⚠️  suggestions.json is not an array`);
                        return null;
                    }
                }
            }

            return null;
        } catch (error) {
            this.outputChannel.appendLine(`  ❌ Error loading suggestions.json: ${error}`);
            return null;
        }
    }

    /**
     * Checks if a filename matches exactly (case-sensitive).
     * If no filename specified, matches all files.
     */
    private matchesFilename(filename: string, expectedFilename?: string): boolean {
        // If no filename specified, match all files
        if (!expectedFilename) {
            return true;
        }

        // Exact match (case-sensitive)
        return filename === expectedFilename;
    }

    /**
     * Finds a matching JSON suggestion based on filename, text, and cursor line.
     * Returns the first matching suggestion.
     */
    findMatchingJsonSuggestion(
        document: vscode.TextDocument,
        position: vscode.Position,
        suggestions: JsonSuggestions
    ): JsonSuggestion | null {
        const documentText = document.getText();
        const cursorLine = position.line; // 0-based line number
        const fileName = path.basename(document.fileName);

        for (const suggestion of suggestions) {
            const matchText = suggestion.match.text;
            const normalizedMatchText = this.normalizeEOL(matchText, document);
            const expectedCursorLine = suggestion.match.cursorAtLine - 1; // Convert to 0-based
            const expectedFile = suggestion.match.file;

            // Check filename first (if specified)
            if (!this.matchesFilename(fileName, expectedFile)) {
                continue;
            }

            // Find all occurrences of the match text in the document
            let searchIndex = 0;
            while (true) {
                const matchIndex = documentText.indexOf(normalizedMatchText, searchIndex);
                if (matchIndex === -1) {
                    break;
                }

                // Calculate which line this match starts on
                const textBeforeMatch = documentText.substring(0, matchIndex);
                const matchStartLine = (textBeforeMatch.match(/\n/g) || []).length;

                // Calculate the expected cursor line relative to the match start
                const actualCursorLine = matchStartLine + expectedCursorLine;

                // Check if cursor is on the expected line relative to the match
                if (cursorLine === actualCursorLine) {
                    const filenameInfo = expectedFile ? `, file="${expectedFile}"` : '';
                    this.outputChannel.appendLine(`    ✅ Match found: text="${matchText.substring(0, 50)}${matchText.length > 50 ? '...' : ''}", cursorLine=${cursorLine + 1}, matchStartLine=${matchStartLine + 1}${filenameInfo}`);
                    return suggestion;
                }

                searchIndex = matchIndex + 1;
            }
        }

        return null;
    }

    /**
     * Normalizes EOL sequences in text to match the document's EOL.
     */
    private normalizeEOL(text: string, document: vscode.TextDocument): string {
        const eol = document.eol === vscode.EndOfLine.CRLF ? '\r\n' : '\n';
        // Normalize all line endings to the document's EOL
        return text.replace(/\r\n|\r|\n/g, eol);
    }

    /**
     * Creates inline completion suggestions from JSON edits.
     * Shifts line numbers based on where the match text was found.
     */
    createSuggestionsFromJson(
        document: vscode.TextDocument,
        position: vscode.Position,
        suggestion: JsonSuggestion
    ): vscode.InlineCompletionItem[] {
        const documentText = document.getText();
        const matchText = suggestion.match.text;
        const normalizedMatchText = this.normalizeEOL(matchText, document);
        const expectedCursorLine = suggestion.match.cursorAtLine - 1; // Convert to 0-based

        // Find the match that corresponds to the current cursor position
        let searchIndex = 0;
        let matchStartLine = -1;

        while (true) {
            const matchIndex = documentText.indexOf(normalizedMatchText, searchIndex);
            if (matchIndex === -1) {
                break;
            }

            const textBeforeMatch = documentText.substring(0, matchIndex);
            const calculatedMatchStartLine = (textBeforeMatch.match(/\n/g) || []).length;
            const actualCursorLine = calculatedMatchStartLine + expectedCursorLine;

            if (position.line === actualCursorLine) {
                matchStartLine = calculatedMatchStartLine;
                break;
            }

            searchIndex = matchIndex + 1;
        }

        if (matchStartLine === -1) {
            this.outputChannel.appendLine(`    ❌ Could not find match position for cursor`);
            return [];
        }

        this.outputChannel.appendLine(`    📍 Match found at line ${matchStartLine + 1}, cursor at line ${position.line + 1}`);
        this.outputChannel.appendLine(`    📄 Document context around match:`);
        for (let i = Math.max(0, matchStartLine - 2); i <= Math.min(document.lineCount - 1, matchStartLine + 5); i++) {
            const marker = i === position.line ? '👉' : '  ';
            this.outputChannel.appendLine(`      ${marker} Line ${i + 1}: "${document.lineAt(i).text}"`);
        }

        // First, parse all edits and collect their ranges
        interface ParsedEdit {
            range: vscode.Range;
            newText: string;
            actualStartLine: number;
            actualEndLine: number;
        }

        const parsedEdits: ParsedEdit[] = [];

        for (const edit of suggestion.edits) {
            let range: vscode.Range;
            let actualStartLine: number;
            let actualEndLine: number;
            
            // Check if using new simplified format (line-only)
            if (edit.startLine !== undefined && edit.endLine !== undefined) {
                // Shift line numbers relative to match start
                actualStartLine = matchStartLine + edit.startLine;
                actualEndLine = matchStartLine + edit.endLine;

                this.outputChannel.appendLine(`    🔍 Processing edit: startLine=${edit.startLine}, endLine=${edit.endLine} (relative to match)`);
                
                // If expectedText is provided, try to find the matching line
                if (edit.expectedText !== undefined) {
                    const expectedTextNormalized = edit.expectedText.trim();
                    let foundLine = actualStartLine;
                    let found = false;
                    
                    // First, check if the expected line matches
                    if (actualStartLine >= 0 && actualStartLine < document.lineCount) {
                        const currentLineText = document.lineAt(actualStartLine).text.trim();
                        if (currentLineText === expectedTextNormalized) {
                            found = true;
                            this.outputChannel.appendLine(`    ✅ Expected text found at line ${actualStartLine + 1}: "${currentLineText}"`);
                        }
                    }
                    
                    // If not found, search within ±10 lines
                    if (!found) {
                        this.outputChannel.appendLine(`    🔍 Expected text not found at line ${actualStartLine + 1}, searching ±10 lines...`);
                        this.outputChannel.appendLine(`    🔍 Looking for: "${expectedTextNormalized}"`);
                        
                        const searchStart = Math.max(0, actualStartLine - 10);
                        const searchEnd = Math.min(document.lineCount - 1, actualStartLine + 10);
                        
                        for (let lineNum = searchStart; lineNum <= searchEnd; lineNum++) {
                            try {
                                const lineText = document.lineAt(lineNum).text.trim();
                                if (lineText === expectedTextNormalized) {
                                    foundLine = lineNum;
                                    found = true;
                                    const offset = foundLine - actualStartLine;
                                    this.outputChannel.appendLine(`    ✅ Found expected text at line ${foundLine + 1} (offset: ${offset > 0 ? '+' : ''}${offset} lines)`);
                                    
                                    // Adjust endLine by the same offset
                                    actualEndLine = actualEndLine + offset;
                                    break;
                                }
                            } catch (e) {
                                // Skip invalid line numbers
                                continue;
                            }
                        }
                        
                        if (!found) {
                            this.outputChannel.appendLine(`    ⚠️  Expected text "${expectedTextNormalized}" not found within ±10 lines of line ${actualStartLine + 1}`);
                            this.outputChannel.appendLine(`    ⚠️  Skipping this edit`);
                            continue;
                        }
                    }
                    
                    actualStartLine = foundLine;
                }
                
                this.outputChannel.appendLine(`    🔍 Match start line: ${matchStartLine + 1}, Actual lines: ${actualStartLine + 1} to ${actualEndLine + 1}`);

                // Validate line numbers
                if (actualStartLine < 0 || actualEndLine >= document.lineCount || actualStartLine > actualEndLine) {
                    this.outputChannel.appendLine(`    ⚠️  Skipping edit: invalid line range ${actualStartLine + 1}-${actualEndLine + 1} (document has ${document.lineCount} lines)`);
                    continue;
                }

                // Replace entire lines: from start of startLine to end of endLine
                const startLineObj = document.lineAt(actualStartLine);
                const endLineObj = document.lineAt(actualEndLine);
                
                this.outputChannel.appendLine(`    📄 Start line ${actualStartLine + 1} text: "${startLineObj.text}"`);
                this.outputChannel.appendLine(`    📄 End line ${actualEndLine + 1} text: "${endLineObj.text}"`);
                this.outputChannel.appendLine(`    📏 End line length: ${endLineObj.text.length}`);
                
                // For deletion (when newText is missing/empty), include the newline after the last line
                // to completely remove the lines without leaving a blank line
                const isDeletion = edit.newText === undefined || edit.newText === '';
                
                if (isDeletion) {
                    if (actualEndLine + 1 < document.lineCount) {
                        // Include the newline after the last deleted line by extending to the start of the next line
                        // This ensures the lines are completely removed without leaving a blank line
                        range = new vscode.Range(
                            new vscode.Position(actualStartLine, 0),
                            new vscode.Position(actualEndLine + 1, 0)
                        );
                        this.outputChannel.appendLine(`    🗑️  Deletion edit: including newline after line ${actualEndLine + 1}, range extends to start of line ${actualEndLine + 2}`);
                    } else {
                        // Deleting the last line(s) of the document
                        // The last line might not have a trailing newline, so we delete from start to end
                        // and include the newline from the previous line if it exists
                        if (actualStartLine > 0) {
                            const prevLine = document.lineAt(actualStartLine - 1);
                            // Start from the end of previous line (includes its newline) to end of last line
                            range = new vscode.Range(
                                new vscode.Position(actualStartLine - 1, prevLine.text.length),
                                new vscode.Position(actualEndLine, endLineObj.text.length)
                            );
                            this.outputChannel.appendLine(`    🗑️  Deletion edit: deleting last line(s) ${actualStartLine + 1}-${actualEndLine + 1}, including newline from line ${actualStartLine}`);
                        } else {
                            // Deleting all lines from the start - just delete from start to end
                            range = new vscode.Range(
                                new vscode.Position(actualStartLine, 0),
                                new vscode.Position(actualEndLine, endLineObj.text.length)
                            );
                            this.outputChannel.appendLine(`    🗑️  Deletion edit: deleting all lines from start`);
                        }
                    }
                } else {
                    // Normal replacement: from start of first line to end of last line
                    range = new vscode.Range(
                        new vscode.Position(actualStartLine, 0),
                        new vscode.Position(actualEndLine, endLineObj.text.length)
                    );
                }
            } else if (edit.start && edit.end) {
                // Legacy format: column-based edits
                actualStartLine = matchStartLine + edit.start.line;
                actualEndLine = matchStartLine + edit.end.line;

                // Validate line numbers
                if (actualStartLine < 0 || actualEndLine >= document.lineCount || actualStartLine > actualEndLine) {
                    this.outputChannel.appendLine(`    ⚠️  Skipping edit: invalid line range ${actualStartLine + 1}-${actualEndLine + 1}`);
                    continue;
                }

                // Get the actual line to validate column
                const startLineObj = document.lineAt(actualStartLine);
                const endLineObj = document.lineAt(actualEndLine);

                const startCol = Math.min(edit.start.col, startLineObj.text.length);
                const endCol = actualEndLine === actualStartLine 
                    ? Math.min(edit.end.col, endLineObj.text.length)
                    : endLineObj.text.length;

                range = new vscode.Range(
                    new vscode.Position(actualStartLine, startCol),
                    new vscode.Position(actualEndLine, endCol)
                );
            } else {
                this.outputChannel.appendLine(`    ⚠️  Skipping edit: invalid format (must have startLine/endLine or start/end)`);
                continue;
            }

            // Handle missing newText: means complete deletion (no text inserted)
            const newTextValue = edit.newText !== undefined ? edit.newText : '';
            
            // Normalize EOL sequences in the replacement text
            const normalizedText = this.normalizeEOL(newTextValue, document);

            parsedEdits.push({
                range,
                newText: normalizedText,
                actualStartLine,
                actualEndLine
            });
        }

        if (parsedEdits.length === 0) {
            this.outputChannel.appendLine(`    ⚠️  No valid edits found`);
            return [];
        }

        // Check if all edits are already applied (document already matches expected state)
        // If so, don't create suggestions
        let allEditsAlreadyApplied = true;
        const eol = document.eol === vscode.EndOfLine.LF ? '\n' : '\r\n';
        
        for (const edit of parsedEdits) {
            try {
                // Get the current line(s) at the range position
                const startLine = document.lineAt(edit.range.start.line);
                const endLine = edit.range.end.line === edit.range.start.line 
                    ? startLine 
                    : document.lineAt(edit.range.end.line);
                
                // Create a range that covers the full line(s) to check
                const checkRange = new vscode.Range(
                    new vscode.Position(edit.range.start.line, edit.range.start.character),
                    new vscode.Position(edit.range.end.line, endLine.text.length)
                );
                
                const currentText = document.getText(checkRange);
                const normalizedCurrent = currentText.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trimEnd();
                const normalizedExpected = edit.newText.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trimEnd();
                
                if (normalizedCurrent !== normalizedExpected) {
                    allEditsAlreadyApplied = false;
                    break;
                }
            } catch (e) {
                // If we can't check, assume not applied
                allEditsAlreadyApplied = false;
                break;
            }
        }

        if (allEditsAlreadyApplied) {
            this.outputChannel.appendLine(`    ✅ All edits are already applied - no suggestions needed`);
            return [];
        }

        // For sequential completion, create separate suggestions for each edit
        // The sequential tracker will handle returning them one at a time
        const suggestions: vscode.InlineCompletionItem[] = [];
        const showRange = new vscode.Range(
            0,
            0,
            document.lineCount - 1,
            Number.MAX_SAFE_INTEGER
        );

        // Keep edits in their original order from JSON (don't sort)
        this.outputChannel.appendLine(`    📋 Edit order (preserving JSON order):`);
        parsedEdits.forEach((edit, idx) => {
            const preview = edit.newText.length > 0 
                ? `"${edit.newText.substring(0, 50)}${edit.newText.length > 50 ? '...' : ''}"`
                : '(deletion - no text)';
            this.outputChannel.appendLine(`      ${idx + 1}. Line ${edit.actualStartLine + 1}: ${preview}`);
        });

        for (let i = 0; i < parsedEdits.length; i++) {
            const edit = parsedEdits[i];
            
            // Check if this specific edit is already applied
            try {
                const startLine = document.lineAt(edit.range.start.line);
                const endLine = edit.range.end.line === edit.range.start.line 
                    ? startLine 
                    : document.lineAt(edit.range.end.line);
                
                const checkRange = new vscode.Range(
                    new vscode.Position(edit.range.start.line, edit.range.start.character),
                    new vscode.Position(edit.range.end.line, endLine.text.length)
                );
                
                const currentText = document.getText(checkRange);
                const normalizedCurrent = currentText.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trimEnd();
                const normalizedExpected = edit.newText.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trimEnd();
                
                if (normalizedCurrent === normalizedExpected) {
                    this.outputChannel.appendLine(`    ⏭️  Skipping edit ${i + 1} - already applied`);
                    continue;
                }
            } catch (e) {
                // If we can't check, include it
            }
            
            this.outputChannel.appendLine(`    📝 Creating edit ${i + 1} of ${parsedEdits.length}:`);
            this.outputChannel.appendLine(`      Range: Line ${edit.actualStartLine + 1}:${edit.range.start.character} to ${edit.actualEndLine + 1}:${edit.range.end.character}`);
            if (edit.newText.length > 0) {
                this.outputChannel.appendLine(`      New text length: ${edit.newText.length}`);
                this.outputChannel.appendLine(`      New text preview: "${edit.newText.substring(0, 100)}${edit.newText.length > 100 ? '...' : ''}"`);
            } else {
                this.outputChannel.appendLine(`      Deletion edit: removing lines ${edit.actualStartLine + 1} to ${edit.actualEndLine + 1} (no replacement text)`);
            }

            const item = new vscode.InlineCompletionItem(edit.newText, edit.range);
            item.isInlineEdit = true;
            item.showRange = showRange;
            suggestions.push(item);
        }

        this.outputChannel.appendLine(`    📦 Created ${suggestions.length} separate suggestion(s) for sequential completion`);

        this.outputChannel.appendLine(`    📊 Total suggestions created: ${suggestions.length}`);
        return suggestions;
    }
}
