import * as vscode from 'vscode';

/**
 * Tracks sequential completion items and which ones have been accepted.
 */
export class SequentialCompletionTracker {
    // Map: document URI + original match position key -> sequence of items
    private sequences = new Map<string, {
        items: Array<{ item: vscode.InlineCompletionItem; range: vscode.Range; text: string }>;
        acceptedIndices: Set<number>;
        lastCheckTime: number;
        originalMatchPosition: vscode.Position;
    }>();

    constructor(private outputChannel: vscode.OutputChannel) {}

    private getKey(document: vscode.TextDocument, position: vscode.Position): string {
        return `${document.uri.toString()}:${position.line}:${position.character}`;
    }

    /**
     * Registers a sequence of items for a position.
     */
    registerSequence(
        document: vscode.TextDocument,
        originalPosition: vscode.Position,
        items: vscode.InlineCompletionItem[]
    ): void {
        const key = this.getKey(document, originalPosition);
        const sequence = items.map(item => ({
            item,
            range: item.range!,
            text: typeof item.insertText === 'string' ? item.insertText : ''
        }));
        
        this.sequences.set(key, {
            items: sequence,
            acceptedIndices: new Set(),
            lastCheckTime: Date.now(),
            originalMatchPosition: originalPosition
        });
        
        this.outputChannel.appendLine(`    📋 Registered sequence with ${items.length} items at position ${originalPosition.line + 1}:${originalPosition.character + 1}`);
    }

    /**
     * Finds a sequence that might be relevant for the current position.
     * Checks all sequences for this document and finds one where items might still be pending.
     */
    findRelevantSequence(
        document: vscode.TextDocument,
        currentPosition: vscode.Position
    ): { key: string; sequence: { items: Array<{ item: vscode.InlineCompletionItem; range: vscode.Range; text: string }>; acceptedIndices: Set<number>; originalMatchPosition: vscode.Position } } | null {
        const uri = document.uri.toString();
        
        // Check all sequences for this document
        for (const [key, sequence] of this.sequences.entries()) {
            if (!key.startsWith(uri + ':')) {
                continue;
            }

            // Check which items have been accepted by examining the document
            for (let i = 0; i < sequence.items.length; i++) {
                if (sequence.acceptedIndices.has(i)) {
                    continue; // Already marked as accepted
                }

                const { range: originalRange, text } = sequence.items[i];
                
                // Check if the document contains the accepted text at the expected range
                // Note: The range might be outdated if the document changed, so we need to check the actual line
                try {
                    // Get the current line(s) at the range position
                    const startLine = document.lineAt(originalRange.start.line);
                    const endLine = originalRange.end.line === originalRange.start.line 
                        ? startLine 
                        : document.lineAt(originalRange.end.line);
                    
                    // Create a range that covers the full line(s) to check
                    // This handles cases where the line length changed after previous edits
                    const checkRange = new vscode.Range(
                        new vscode.Position(originalRange.start.line, originalRange.start.character),
                        new vscode.Position(originalRange.end.line, endLine.text.length)
                    );
                    
                    const currentText = document.getText(checkRange);
                    // Normalize both texts for comparison (handle EOL differences)
                    const normalizedCurrent = currentText.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trimEnd();
                    const normalizedExpected = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trimEnd();
                    
                    this.outputChannel.appendLine(`    🔍 Checking item ${i + 1}: range=${checkRange.start.line + 1}:${checkRange.start.character}-${checkRange.end.line + 1}:${checkRange.end.character}, current="${normalizedCurrent.substring(0, 50)}${normalizedCurrent.length > 50 ? '...' : ''}", expected="${normalizedExpected.substring(0, 50)}${normalizedExpected.length > 50 ? '...' : ''}"`);
                    
                    if (normalizedCurrent === normalizedExpected) {
                        // This item has been accepted
                        sequence.acceptedIndices.add(i);
                        this.outputChannel.appendLine(`    ✅ Item ${i + 1} in sequence has been accepted`);
                    } else {
                        this.outputChannel.appendLine(`    ⏳ Item ${i + 1} not yet accepted (texts don't match, length: current=${normalizedCurrent.length}, expected=${normalizedExpected.length})`);
                    }
                } catch (e) {
                    this.outputChannel.appendLine(`    ⚠️  Error checking item ${i + 1}: ${e}`);
                }
            }

            // Check if there are any unaccepted items
            const hasUnaccepted = sequence.items.some((_, i) => !sequence.acceptedIndices.has(i));
            if (hasUnaccepted) {
                // If there are unaccepted items, check if current position is near any of the item ranges
                // Be lenient - check if position is within 10 lines of any item range
                for (const item of sequence.items) {
                    const lineDistance = Math.abs(item.range.start.line - currentPosition.line);
                    if (item.range.contains(currentPosition) || lineDistance <= 10) {
                        this.outputChannel.appendLine(`    🔍 Found relevant sequence: ${sequence.items.length} items, ${sequence.acceptedIndices.size} accepted, position distance: ${lineDistance}`);
                        return { key, sequence };
                    }
                }
                // If no item range is close, but we're in the same general area (within 20 lines of original match), still return it
                const distanceFromOriginal = Math.abs(sequence.originalMatchPosition.line - currentPosition.line);
                if (distanceFromOriginal <= 20) {
                    this.outputChannel.appendLine(`    🔍 Found relevant sequence by original position: ${sequence.items.length} items, ${sequence.acceptedIndices.size} accepted, distance from original: ${distanceFromOriginal}`);
                    return { key, sequence };
                }
            }
        }

        return null;
    }

    /**
     * Gets the next item in a sequence that hasn't been accepted yet.
     */
    getNextItem(
        document: vscode.TextDocument,
        currentPosition: vscode.Position
    ): vscode.InlineCompletionItem | undefined {
        const relevant = this.findRelevantSequence(document, currentPosition);
        if (!relevant) {
            return undefined;
        }

        const { sequence } = relevant;
        
        // Find the first unaccepted item
        for (let i = 0; i < sequence.items.length; i++) {
            if (!sequence.acceptedIndices.has(i)) {
                this.outputChannel.appendLine(`    🔄 Returning item ${i + 1} of ${sequence.items.length} from sequence`);
                return sequence.items[i].item;
            }
        }

        // All items accepted - clean up
        this.sequences.delete(relevant.key);
        return undefined;
    }

    /**
     * Clears sequences for a document (called when document changes significantly).
     */
    clearForDocument(document: vscode.TextDocument): void {
        const uri = document.uri.toString();
        let clearedCount = 0;
        for (const key of this.sequences.keys()) {
            if (key.startsWith(uri + ':')) {
                this.sequences.delete(key);
                clearedCount++;
            }
        }
        if (clearedCount > 0) {
            this.outputChannel.appendLine(`    🧹 Cleared ${clearedCount} sequence(s) for document`);
        }
    }

    /**
     * Checks if there are any active sequences for a document.
     */
    hasActiveSequences(document: vscode.TextDocument): boolean {
        const uri = document.uri.toString();
        for (const key of this.sequences.keys()) {
            if (key.startsWith(uri + ':')) {
                return true;
            }
        }
        return false;
    }

    /**
     * Checks if the current position is near any pending (unaccepted) edit in active sequences.
     */
    isPositionNearPendingEdit(document: vscode.TextDocument, position: vscode.Position): boolean {
        const uri = document.uri.toString();
        for (const [key, sequence] of this.sequences.entries()) {
            if (!key.startsWith(uri + ':')) {
                continue;
            }

            // Check if position is near any unaccepted item
            for (let i = 0; i < sequence.items.length; i++) {
                if (sequence.acceptedIndices.has(i)) {
                    continue; // Skip accepted items
                }

                const item = sequence.items[i];
                const lineDistance = Math.abs(item.range.start.line - position.line);
                if (item.range.contains(position) || lineDistance <= 10) {
                    return true;
                }
            }
        }
        return false;
    }
}
