# Quick Guide: Building VS Code from Source (You Already Have It!)

Since you already have `/Users/Anatoly.Nikitin/Workspace/vscode`, here's the quickest path:

## Step 1: Build VS Code

```bash
cd /Users/Anatoly.Nikitin/Workspace/vscode

# Install dependencies (first time only, takes 10-30 min)
npm install

# Build VS Code (takes 5-10 min first time)
npm run compile

# Or use watch mode for faster incremental builds
npm run watch
```

## Step 2: Run Built VS Code

```bash
# macOS
./scripts/code.sh

# This opens a new VS Code window built from source
```

## Step 3: Test Your Extension

### Option A: Extension Development Host (Easiest)

1. In the built VS Code, open your extension workspace:

   ```
   /Users/Anatoly.Nikitin/Workspace/monaco-next-edit
   ```

2. Press `F5` to launch Extension Development Host
   - This opens a **third** VS Code window
   - Your extension runs in this window
   - This window uses the **built VS Code** from source

### Option B: Install Extension

1. Package your extension:

   ```bash
   cd /Users/Anatoly.Nikitin/Workspace/monaco-next-edit/extensions/next-edit-demo
   npm install -g vsce  # if needed
   vsce package
   ```

2. In built VS Code: Extensions → "..." → "Install from VSIX..."

## Step 4: Add Debugging

Now you can add breakpoints in VS Code's source!

### Key Breakpoints to Add

1. **Open VS Code source in VS Code**:

   ```bash
   # In your regular VS Code
   code /Users/Anatoly.Nikitin/Workspace/vscode
   ```

2. **Set breakpoints in**:

   - `src/vs/editor/contrib/inlineCompletions/browser/model/inlineCompletionsModel.ts:508`
     - See if inline edit is selected
   - `src/vs/editor/contrib/inlineCompletions/browser/model/inlineCompletionsModel.ts:512`
     - See if it's being cleared due to visible completions
   - `src/vs/editor/contrib/inlineCompletions/browser/model/inlineCompletionsModel.ts:625`
     - Check `cursorAtInlineEdit` calculation

3. **Debug**:
   - In VS Code source: Run → "Start Debugging" (or F5)
   - This launches the built VS Code
   - Your extension runs in Extension Development Host
   - Breakpoints will hit!

## Quick Debugging Code to Add

Add this in `inlineCompletionsModel.ts` around line 508:

```typescript
for (const completion of c.inlineCompletions) {
  if (!completion.isInlineEdit) {
    if (completion.isVisible(this.textModel, cursorPosition)) {
      visibleCompletions.push(completion);
      console.log(
        "[NEXT-EDIT-DEBUG] Regular completion visible, will hide inline edit"
      );
    }
  } else {
    inlineEdit = completion;
    const cursorAtEdit = LineRange.fromRangeInclusive(completion.targetRange)
      .addMargin(1, 1)
      .contains(cursorPosition.lineNumber);
    console.log("[NEXT-EDIT-DEBUG] Inline edit found:", {
      targetRange: completion.targetRange.toString(),
      cursorLine: cursorPosition.lineNumber,
      cursorAtInlineEdit: cursorAtEdit,
      hasDisplayLocation: !!completion.hint,
    });
  }
}

if (visibleCompletions.length !== 0) {
  console.log(
    "[NEXT-EDIT-DEBUG] ❌ Hiding inline edit -",
    visibleCompletions.length,
    "regular completions visible"
  );
  inlineEdit = undefined;
} else if (inlineEdit) {
  console.log("[NEXT-EDIT-DEBUG] ✅ Inline edit will be shown");
}
```

Then check the Developer Tools console (Help → Toggle Developer Tools) to see the logs!

## Troubleshooting

### "npm install" fails

- Check Node.js version: `node --version` (should be 18.x or 20.x)
- Try: `npm cache clean --force` then `npm install` again

### Build is slow

- First build: 30+ minutes
- Use `npm run watch` for faster incremental builds
- Subsequent builds: 1-5 minutes

### Extension doesn't load

- Make sure you're using the **built** VS Code (`./scripts/code.sh`)
- Not the installed VS Code
- Check Developer Tools console for errors

## What This Will Tell You

With breakpoints and logging, you'll see:

1. ✅ Is the inline edit being selected? (line 508)
2. ❌ Is it being cleared due to visible completions? (line 512)
3. ✅ What's the `cursorAtInlineEdit` value? (line 625)
4. ✅ Is `displayLocation` being processed correctly?

This will solve the mystery of why your suggestion isn't displaying!
