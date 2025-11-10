# showRange Workaround Implementation

## The Problem

According to VS Code source code analysis, the `showRange` property is **not implemented** in VS Code's filtering logic. While it's defined in the API and passed through the protocol, VS Code never checks it when deciding whether to display inline edits.

## The Solution

We implement the filtering logic ourselves in the provider. Before returning a suggestion, we check if the cursor is within the `showRange`, and only return the suggestion if it is.

## Implementation

### Before (Not Working)

```typescript
const item = new InlineCompletionItem(insertText, range);
item.showRange = showRange; // VS Code ignores this!
return item;
```

### After (Working)

```typescript
// Calculate showRange
const showRange = new Range(
  Math.max(targetPosition.line - 4, 0),
  0,
  targetPosition.line + 4,
  Number.MAX_SAFE_INTEGER
);

// Filter: Only return if cursor is within showRange
if (!showRange.contains(cursorPosition)) {
  return undefined; // Don't show suggestion
}

const item = new InlineCompletionItem(insertText, range);
item.showRange = showRange; // Still set it for completeness
return item;
```

## Updated Methods

All suggestion methods that use `showRange` now implement this filtering:

- ✅ `createNextLineSuggestion()` - Filters based on cursor position
- ✅ `createAboveLineSuggestion()` - Filters based on cursor position
- ✅ `createClosingBraceSuggestion()` - Filters based on cursor position

## Behavior

- **Cursor within 4 lines of target**: Suggestion is returned and displayed
- **Cursor outside 4 lines**: Suggestion is filtered out (returns `undefined`)
- **Cursor moves**: Provider is re-called, filtering happens again

## Limitations

1. **Re-requesting required**: When cursor moves, VS Code must re-request suggestions for filtering to work
2. **Performance**: Filtering happens on every request (but it's fast)
3. **Not ideal**: Ideally VS Code would implement `showRange` checking

## Future

When VS Code implements `showRange` checking, we can remove this workaround and rely on VS Code's built-in filtering.

## Reference

Based on VS Code source code analysis showing that `showRange` is not checked in:

- `src/vs/editor/contrib/inlineCompletions/browser/model/inlineCompletionsModel.ts:507-509`

