# Next Edit Suggestions - VS Code Limitations

## The Challenge

VS Code's `InlineCompletionItemProvider` API has limitations when it comes to displaying suggestions at positions **far from the cursor**. The API is primarily designed for suggestions at or very close to the cursor position.

## Why Only Same-Line Suggestions Show

VS Code filters inline completion suggestions based on:
1. **Proximity to cursor** - Suggestions too far from the cursor may be filtered out
2. **Range validation** - The range must be valid and within reasonable bounds
3. **Editor settings** - `editor.inlineSuggest.enabled` must be true

## Current Implementation

The extension attempts to work around this by:
1. **Including cursor in range** - For next-line suggestions, the range starts at the cursor and extends to the target position
2. **Enable forward stability** - Using `enableForwardStability = true` like GitHub Copilot
3. **Checking settings** - Verifying that inline suggestions are enabled

## GitHub Copilot's Approach

GitHub Copilot likely uses:
1. **Internal VS Code APIs** - May have access to APIs not available to regular extensions
2. **Special handling** - VS Code may have special support for Copilot's "next edit" feature
3. **Multiple providers** - May use a combination of inline completions and other mechanisms

## Workarounds

### Option 1: Use Range Starting at Cursor
```typescript
// Range includes cursor position
const range = new vscode.Range(cursorPosition, targetPosition);
const insertText = currentLineText.substring(cursorPosition.character) + "\n" + suggestionText;
```

### Option 2: Use Text Edits Instead
For true "next edit" functionality, consider using:
- `vscode.workspace.applyEdit()` with `TextEdit`
- Code actions (`CodeActionProvider`)
- Custom UI overlays

### Option 3: Check VS Code Version
Newer versions of VS Code may have better support. Check:
- VS Code version >= 1.74 (when inline completions were enhanced)
- Experimental features may need to be enabled

## Testing

1. Check the output channel logs to see if suggestions are being created
2. Verify `editor.inlineSuggest.enabled` is `true` in settings
3. Try suggestions that are very close to the cursor first
4. Check if VS Code filters the suggestions (they're created but not shown)

## Future Improvements

- Monitor VS Code API updates for better "next edit" support
- Consider using Code Actions for suggestions far from cursor
- Implement custom UI for displaying suggestions at arbitrary positions

