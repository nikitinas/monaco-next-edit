# Analysis: Why Copilot Works But Our Extension Doesn't

## Key Findings from VS Code + Copilot Source Code Analysis

### 1. **showRange is NOT Implemented in VS Code** ✅ CONFIRMED

**Location**: `vscode/src/vs/editor/contrib/inlineCompletions/browser/model/inlineCompletionsModel.ts:503-509`

```typescript
for (const completion of c.inlineCompletions) {
  if (!completion.isInlineEdit) {
    if (completion.isVisible(this.textModel, cursorPosition)) {
      visibleCompletions.push(completion);
    }
  } else {
    inlineEdit = completion; // ⚠️ NO showRange CHECK!
  }
}
```

**Finding**: VS Code automatically selects inline edits without checking `showRange`. This is why we implemented the workaround.

### 2. **cursorAtInlineEdit Check** - The Real Constraint!

**Location**: `vscode/src/vs/editor/contrib/inlineCompletions/browser/model/inlineCompletionsModel.ts:625`

```typescript
const cursorAtInlineEdit = this.primaryPosition.map((cursorPos) =>
  LineRange.fromRangeInclusive(inlineEditResult.targetRange)
    .addMargin(1, 1)
    .contains(cursorPos.lineNumber)
);
```

**Critical Finding**: VS Code checks if cursor is within **1 line margin** of `targetRange`, not the `editRange`!

**What is targetRange?**

```typescript
// From inlineSuggestionItem.ts:61
public get targetRange(): Range {
    return this.hint?.range && !this.hint.jumpToEdit
        ? this.hint?.range  // Uses displayLocation range if jumpToEdit: false
        : this.editRange;    // Uses edit range if jumpToEdit: true
}
```

### 3. **The Problem with Our Implementation**

We're setting:

```typescript
item.displayLocation = {
  range: range, // This is the edit range (next line)
  label: "Next edit: TODO comment",
  kind: 0,
  jumpToEdit: true, // ⚠️ This causes targetRange = editRange
};
```

**What happens**:

- `jumpToEdit: true` → `targetRange = editRange` (line 2)
- `cursorAtInlineEdit` checks if cursor (line 1) is within 1 line of targetRange (line 2)
- `addMargin(1, 1)` makes it lines 1-3
- ✅ **This should work!** Cursor on line 1 is within 1 line of line 2

### 4. **Why It Might Still Not Work**

Looking at the view determination logic (`inlineEditsView.ts:403-405`):

```typescript
if (
  model.displayLocation &&
  !model.inlineEdit.inlineCompletion.identity.jumpedTo.read(reader)
) {
  return InlineCompletionViewKind.Custom;
}
```

**The Custom view requires**:

- `displayLocation` to exist ✅ (we have this)
- `jumpedTo` to be false ✅ (initially true)
- The `displayLocation.range` must be in viewport (checked in `fitsInsideViewport`)

### 5. **Copilot's Approach**

Looking at Copilot's code (`inlineCompletionProvider.ts:355-380`):

- They set `showRange` the same way we do
- They set `displayLocation` with `jumpToEdit` based on `result.displayLocation.jumpToEdit`
- **Key difference**: Copilot might be using `jumpToEdit: false` in some cases

### 6. **The Real Issue: Viewport Visibility**

**Location**: `vscode/src/vs/editor/contrib/inlineCompletions/browser/view/inlineEdits/inlineEditsViews/inlineEditsCustomView.ts:158`

```typescript
const fitsInsideViewport = this.fitsInsideViewport(
  new LineRange(startLineNumber, endLineNumber + 1),
  displayLocation.content,
  undefined
);
```

**Finding**: The Custom view checks if the displayLocation range fits in the viewport. If the next line is not visible, the Custom view might not render properly.

### 7. **Additional Constraints**

From `inlineCompletionsModel.ts:827-834`:

```typescript
if (
  s.inlineCompletion.targetRange.startLineNumber ===
  this._editorObs.cursorLineNumber.read(reader)
) {
  return true; // Show if cursor is on same line as targetRange
}
// ...
return s.cursorAtInlineEdit.read(reader); // Show if cursor within 1 line of targetRange
```

**For next-line suggestions to work**:

- Cursor must be within 1 line of `targetRange`
- OR cursor must be on the same line as `targetRange`
- Since `targetRange = editRange` when `jumpToEdit: true`, and editRange is on line 2, cursor on line 1 should work!

## Why It's Not Working - Hypothesis

1. **Viewport issue**: The next line might not be in the viewport, causing the Custom view to not render
2. **Context filtering**: `context.includeInlineEdits` might not be true
3. **Regular completion conflict**: A regular inline completion might be visible, hiding the inline edit
4. **Peek widget**: Peek widgets might be visible

## Solution: Try Setting jumpToEdit: false

If we set `jumpToEdit: false`, then `targetRange = displayLocation.range`, which means:

- `targetRange` = displayLocation range (line 2)
- `cursorAtInlineEdit` checks if cursor (line 1) is within 1 line of line 2
- This should still work!

But wait - if `jumpToEdit: false`, the `targetRange` becomes the displayLocation range, which is the same as editRange in our case. So it shouldn't matter.

## Next Steps to Debug

1. Check if `context.includeInlineEdits` is true
2. Check if any regular inline completions are visible
3. Check if the next line is in the viewport
4. Try setting `jumpToEdit: false` to see if it makes a difference
5. Check the `cursorAtInlineEdit` value in logs
