# Debugging: Suggestion Created But Not Displaying

## Your Situation

✅ Suggestion is being **created correctly**
✅ All properties are set: `isInlineEdit: true`, `showRange`, `displayLocation`
✅ Suggestion is being **returned to VS Code**
❌ But it's **not appearing** in the editor

## Why This Happens

Even when a suggestion is created and returned, VS Code may not display it due to:

### 1. **Regular Inline Completion Takes Precedence** ⚠️ MOST LIKELY

**Location**: `vscode/src/vs/editor/contrib/inlineCompletions/browser/model/inlineCompletionsModel.ts:512-515`

```typescript
if (visibleCompletions.length !== 0) {
  // Don't show the inline edit if there is a visible completion
  inlineEdit = undefined;
}
```

**What to check**:

- Look for any **ghost text** at the cursor position
- This could be from:
  - GitHub Copilot (regular completions)
  - Other AI completion extensions
  - VS Code's built-in IntelliSense

**Solution**:

- Temporarily disable other completion extensions
- Or wait until no regular completion is visible
- Or trigger when cursor is in a position where no completion would appear

### 2. **Peek Widgets Open**

**Location**: `inlineCompletionsModel.ts:619-621`

```typescript
if (this._hasVisiblePeekWidgets.read(reader)) {
  return undefined;
}
```

**What to check**:

- Close any hover tooltips
- Close any "Go to Definition" peek windows
- Close any other peek widgets

### 3. **Viewport Check Failing**

**Location**: `inlineEditsCustomView.ts:158`

The Custom view checks if `displayLocation.range` fits in the viewport:

```typescript
const fitsInsideViewport = this.fitsInsideViewport(
  new LineRange(startLineNumber, endLineNumber + 1),
  displayLocation.content,
  undefined
);
```

**What to check**:

- Make sure line 12 (where the suggestion is) is **visible on screen**
- Scroll so the next line is in view

### 4. **Context.includeInlineEdits is False**

Even though the setting is enabled, VS Code might not be requesting inline edits if:

- The context was created with `includeInlineEdits: false`
- This happens when VS Code thinks it should only request regular completions

**What to check**:

- The setting `editor.inlineSuggest.edits.experimental.enabled` must be `true` ✅ (you have this)
- But VS Code might still not request them in certain scenarios

## How to Test

### Test 1: Disable Other Extensions

1. Open Extension Development Host
2. Disable GitHub Copilot and other completion extensions
3. Try the demo command again
4. See if suggestion appears

### Test 2: Check for Ghost Text

1. Type `function test() {`
2. Look carefully at the cursor position
3. Do you see any gray ghost text?
4. If yes, that's blocking the inline edit

### Test 3: Ensure Viewport Visibility

1. Make sure line 12 is visible on screen
2. Scroll if needed
3. Try the command again

### Test 4: Try Different Trigger

Instead of the command, try:

1. Type `function test() {` naturally
2. Wait a moment
3. See if suggestion appears automatically

## Expected Behavior

When working correctly, you should see:

- A **label/hint** on line 12 showing "Next edit: TODO comment"
- This appears as a small badge/pill on that line
- Clicking it or pressing Tab should accept the suggestion

## If Still Not Working

The issue might be that VS Code's internal filtering is rejecting the suggestion even though it's created. This could be due to:

1. **Internal validation** we're not aware of
2. **Provider priority** - other providers might be taking precedence
3. **Timing** - suggestion might be created but then immediately filtered out

Try adding a breakpoint in VS Code's source code at:

- `inlineCompletionsModel.ts:508` - where inline edit is assigned
- `inlineCompletionsModel.ts:512` - where it might be cleared due to visible completions
