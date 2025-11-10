# Inline Completions Additions API - Next Edit Suggestions

## Summary

The extension uses the **inlineCompletionsAdditions API** (stabilized in VS Code 1.99+) that enables true "next edit" suggestions at positions other than the cursor, just like GitHub Copilot.

## What Changed

### 1. Enabled API Proposal

- Added `"enabledApiProposals": ["inlineCompletionsAdditions"]` to `package.json`
- Updated `engines.vscode` to `^1.99.0` (minimum version that supports these APIs)
- Created `vscode.proposed.inlineCompletionsAdditions.d.ts` with type definitions

### 2. API Status

- **Stabilized**: These APIs are available in stable VS Code (1.99+)
- **No longer Insiders-only**: They work in stable releases
- **Opt-in required**: Extensions must declare `inlineCompletionsAdditions` in `enabledApiProposals`

### 2. Updated All Suggestion Methods

All suggestion creation methods now use three key proposed API properties:

#### `isInlineEdit: true`

Marks the suggestion as an inline edit (next-edit suggestion), not a regular completion.

#### `showRange`

Defines when the suggestion can be displayed based on cursor position. Allows suggestions to appear when cursor is within 4 lines of the edit location.

```typescript
item.showRange = new vscode.Range(
  Math.max(cursorPosition.line - 4, 0),
  0,
  Math.max(targetPosition.line + 4, 0),
  Number.MAX_SAFE_INTEGER
);
```

#### `displayLocation`

Visual indicator showing where the edit will be applied, displayed separately from the cursor.

```typescript
item.displayLocation = {
  range: range,
  label: "Next edit: TODO comment",
  kind: 0, // InlineCompletionDisplayLocationKind.Code
  jumpToEdit: true,
};
```

## Updated Methods

All suggestion methods now use the proposed API:

- ✅ `createNextLineSuggestion()` - Next-line insert suggestions
- ✅ `createAboveLineSuggestion()` - Above-line suggestions
- ✅ `createSameLineSuggestion()` - Same-line suggestions (else clause)
- ✅ `createClosingBraceSuggestion()` - Remote closing brace suggestions
- ✅ `createModifySuggestion()` - Same-line modify/replace suggestions
- ✅ `createDeleteSuggestion()` - Same-line delete suggestions

## How It Works

1. **Range** points to the actual edit location (can be on different lines)
2. **showRange** allows display when cursor is within 4 lines of the edit
3. **displayLocation** provides a visual indicator showing where the edit will be applied
4. **isInlineEdit** marks it as an inline edit (next-edit suggestion)

## Testing

1. Compile: `npm run compile`
2. Press `F5` to launch Extension Development Host
3. Try the demo commands:
   - **Insert Suggestion** - Should show next-line suggestion
   - **Modify Suggestion** - Should show same-line replace
   - **Delete Suggestion** - Should show same-line delete
   - **Remote Suggestion** - Should show closing brace on different line

## Expected Behavior

With the proposed API, you should now see:

- ✅ Next-line suggestions appearing when cursor is within 4 lines
- ✅ Visual indicators (displayLocation) showing where edits will be applied
- ✅ Suggestions on different lines, not just at cursor
- ✅ All suggestion types working (insert, modify, delete, remote)

## Requirements

- **VS Code 1.99+**: These APIs are available in stable VS Code 1.99 and later
- **API Declaration**: Must declare `"inlineCompletionsAdditions"` in `enabledApiProposals`
- **Type Definitions**: Include the type definitions file for TypeScript support

## Notes

- These APIs are **stabilized** and available in stable VS Code (not just Insiders)
- VS Code automatically enables these APIs when declared in `enabledApiProposals`
- If suggestions don't appear, check:
  1. VS Code version is 1.99 or later
  2. `enabledApiProposals` is correctly set in package.json
  3. Output channel logs to see if suggestions are being created

## Reference

This implementation is based on GitHub Copilot's approach, discovered by examining their source code. See `CURSOR_PROMPT_FOR_COPILOT.md` for the investigation process.
