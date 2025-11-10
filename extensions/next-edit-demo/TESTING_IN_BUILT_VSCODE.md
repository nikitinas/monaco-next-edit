# Testing Your Extension in Built VS Code

## VS Code from Source is Now Running! 🎉

A new VS Code window should have opened - this is VS Code built from source.

## Step 1: Open Your Extension Workspace

In the **built VS Code window** that just opened:

1. File → Open Folder
2. Navigate to: `/Users/Anatoly.Nikitin/Workspace/monaco-next-edit`
3. Click "Open"

## Step 2: Launch Extension Development Host

1. In the built VS Code, open your extension workspace
2. Press `F5` (or Run → Start Debugging)
3. This opens a **third** VS Code window - the Extension Development Host
4. Your extension runs in this window!

## Step 3: Test Your Extension

In the Extension Development Host window:

1. Open a new file (e.g., `test.ts`)
2. Type: `function test() {`
3. Run the command: `Next Edit Demo: Insert Suggestion (Next Line)`
4. Check if the suggestion appears on the next line

## Step 4: Add Debugging to VS Code Source

Now you can add breakpoints in VS Code's code!

### Open VS Code Source in VS Code

1. In your **regular VS Code** (not the built one), open:

   ```
   /Users/Anatoly.Nikitin/Workspace/vscode
   ```

2. Navigate to:

   ```
   src/vs/editor/contrib/inlineCompletions/browser/model/inlineCompletionsModel.ts
   ```

3. Set breakpoints at:
   - **Line 508**: Where inline edit is selected
   - **Line 512**: Where it might be cleared due to visible completions
   - **Line 625**: `cursorAtInlineEdit` calculation

### Add Logging

Add this code around line 508 in `inlineCompletionsModel.ts`:

```typescript
for (const completion of c.inlineCompletions) {
  if (!completion.isInlineEdit) {
    if (completion.isVisible(this.textModel, cursorPosition)) {
      visibleCompletions.push(completion);
      console.log("[NEXT-EDIT-DEBUG] ❌ Regular completion visible:", {
        text: completion.insertText?.substring(0, 50),
        range: completion.editRange.toString(),
      });
    }
  } else {
    inlineEdit = completion;
    const cursorAtEdit = LineRange.fromRangeInclusive(completion.targetRange)
      .addMargin(1, 1)
      .contains(cursorPosition.lineNumber);
    console.log("[NEXT-EDIT-DEBUG] ✅ Inline edit found:", {
      targetRange: completion.targetRange.toString(),
      cursorLine: cursorPosition.lineNumber,
      cursorAtInlineEdit: cursorAtEdit,
      hasDisplayLocation: !!completion.hint,
      displayLocationRange: completion.hint?.range?.toString(),
    });
  }
}

if (visibleCompletions.length !== 0) {
  console.log(
    "[NEXT-EDIT-DEBUG] ❌ HIDING inline edit -",
    visibleCompletions.length,
    "regular completions visible"
  );
  inlineEdit = undefined;
} else if (inlineEdit) {
  console.log("[NEXT-EDIT-DEBUG] ✅ Inline edit WILL BE SHOWN");
}
```

### View Logs

1. In the Extension Development Host window
2. Help → Toggle Developer Tools
3. Go to Console tab
4. Look for `[NEXT-EDIT-DEBUG]` messages

## Step 5: Debug with Breakpoints

1. In VS Code source (regular VS Code), set breakpoints
2. Run → Start Debugging (F5)
3. This launches the built VS Code with debugging
4. Test your extension
5. Breakpoints will hit!

## What to Look For

The logs/breakpoints will tell you:

1. ✅ **Is inline edit being selected?** (line 508)

   - Should see: `[NEXT-EDIT-DEBUG] ✅ Inline edit found`

2. ❌ **Is it being cleared?** (line 512)

   - If you see: `[NEXT-EDIT-DEBUG] ❌ HIDING inline edit`
   - That's the problem! A regular completion is visible

3. ✅ **What's cursorAtInlineEdit?** (line 625)

   - Should be `true` for next-line suggestions

4. ✅ **Is displayLocation set?**
   - Check `hasDisplayLocation: true`

## Quick Test Checklist

- [ ] Built VS Code is running
- [ ] Extension workspace opened in built VS Code
- [ ] Extension Development Host launched (F5)
- [ ] Tested the demo command
- [ ] Checked Developer Tools console for logs
- [ ] Added breakpoints in VS Code source (optional)

## If You Need to Rebuild

If you modify VS Code source code:

```bash
cd /Users/Anatoly.Nikitin/Workspace/vscode
npm run watch  # Faster incremental builds
```

Then restart the built VS Code.

## Next Steps

Once you see the debug logs, you'll know exactly why the suggestion isn't displaying. Most likely:

- A regular inline completion is visible (takes precedence)
- Or `cursorAtInlineEdit` is false
- Or `displayLocation` isn't being processed correctly

Good luck debugging! 🚀
