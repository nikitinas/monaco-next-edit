# Building VS Code from Source for Extension Testing

## Why Build from Source?

Building VS Code from source allows you to:
- Add breakpoints in VS Code's inline completion code
- Add logging to see exactly why suggestions aren't displaying
- Modify VS Code's code to test fixes/workarounds
- Understand the exact flow of how inline edits are processed

## Prerequisites

1. **Node.js** (v18.x or v20.x recommended)
2. **Git**
3. **Python** (for building native modules)
4. **Build tools**:
   - **macOS**: Xcode Command Line Tools
   - **Linux**: build-essential, libnss3-dev, etc.
   - **Windows**: Visual Studio Build Tools

## Step 1: Clone VS Code Repository

```bash
cd /Users/Anatoly.Nikitin/Workspace
git clone https://github.com/microsoft/vscode.git
cd vscode
```

## Step 2: Install Dependencies

```bash
# Install dependencies
npm install

# This will take a while (10-30 minutes depending on your machine)
```

## Step 3: Build VS Code

```bash
# Build VS Code (this also takes a while)
npm run compile

# Or for faster incremental builds during development
npm run watch
```

## Step 4: Run VS Code from Source

### Option A: Run in Development Mode

```bash
# This opens VS Code built from source
./scripts/code.sh
```

Or on Windows:
```bash
scripts\code.bat
```

### Option B: Package and Install

```bash
# Create a packaged version
npm run gulp -- vscode-darwin-x64-min  # macOS Intel
# or
npm run gulp -- vscode-darwin-arm64-min  # macOS Apple Silicon

# The output will be in .build/electron/
```

## Step 5: Test Your Extension

### Method 1: Use Extension Development Host

1. Open your extension workspace in the built VS Code
2. Press `F5` to launch Extension Development Host
3. Your extension will run in a new window using the built VS Code

### Method 2: Install Extension in Built VS Code

1. Package your extension:
   ```bash
   cd /Users/Anatoly.Nikitin/Workspace/monaco-next-edit/extensions/next-edit-demo
   npm install -g vsce  # if not already installed
   vsce package
   ```

2. Install the `.vsix` file in your built VS Code:
   - Open built VS Code
   - Extensions view → "..." menu → "Install from VSIX..."

## Step 6: Add Debugging/Logging

Now you can add breakpoints and logging in VS Code's source code!

### Key Files to Debug

1. **Inline Completion Model**:
   ```
   src/vs/editor/contrib/inlineCompletions/browser/model/inlineCompletionsModel.ts
   ```
   - Line 503-515: Where inline edits are selected
   - Line 617-636: Where inline edit state is created
   - Line 625: `cursorAtInlineEdit` calculation

2. **Inline Completion Source**:
   ```
   src/vs/editor/contrib/inlineCompletions/browser/model/inlineCompletionsSource.ts
   ```
   - Line 238-244: Context filtering (`includeInlineEdits` check)

3. **Custom View**:
   ```
   src/vs/editor/contrib/inlineCompletions/browser/view/inlineEdits/inlineEditsViews/inlineEditsCustomView.ts
   ```
   - Line 158: Viewport check
   - Line 403-405: View determination

### Example: Add Logging

Add this in `inlineCompletionsModel.ts` around line 508:

```typescript
for (const completion of c.inlineCompletions) {
    if (!completion.isInlineEdit) {
        if (completion.isVisible(this.textModel, cursorPosition)) {
            visibleCompletions.push(completion);
            console.log('[DEBUG] Regular completion visible:', completion);
        }
    } else {
        inlineEdit = completion;
        console.log('[DEBUG] Inline edit found:', {
            targetRange: completion.targetRange,
            displayLocation: completion.hint,
            cursorAtInlineEdit: LineRange.fromRangeInclusive(completion.targetRange).addMargin(1, 1).contains(cursorPosition.lineNumber)
        });
    }
}

if (visibleCompletions.length !== 0) {
    console.log('[DEBUG] Hiding inline edit because', visibleCompletions.length, 'regular completions visible');
    inlineEdit = undefined;
}
```

## Step 7: Debug with Breakpoints

1. Open VS Code source in VS Code (meta!)
2. Set breakpoints in the key files above
3. Run your extension with `F5`
4. Trigger your extension's suggestion
5. Step through VS Code's code to see exactly what's happening

## Quick Start Script

Create a script to make this easier:

```bash
#!/bin/bash
# build-vscode.sh

cd /Users/Anatoly.Nikitin/Workspace/vscode

echo "Building VS Code..."
npm run compile

echo "Launching VS Code from source..."
./scripts/code.sh
```

## Troubleshooting

### Build Fails

- Make sure you have the right Node.js version: `node --version` (should be 18.x or 20.x)
- Try: `npm run clean` then `npm install` again
- Check VS Code's [build documentation](https://github.com/microsoft/vscode/wiki/How-to-Contribute#build-and-run)

### Extension Not Loading

- Make sure you're using the built VS Code, not the installed one
- Check the Developer Tools console for errors
- Verify your extension's `package.json` has correct `engines.vscode` version

### Performance

- First build takes 30+ minutes
- Subsequent builds are faster with `npm run watch`
- Consider using a faster machine or cloud build if needed

## Alternative: Use VS Code Insiders

If building from source is too slow, you can also:
1. Download VS Code Insiders (has more debugging features)
2. Use the same debugging approach
3. Insiders often has the latest code that matches the source

## Next Steps

Once you have VS Code built from source:
1. Add breakpoints in `inlineCompletionsModel.ts:508` to see if inline edit is being selected
2. Add breakpoints in `inlineCompletionsModel.ts:512` to see if it's being cleared
3. Add logging to see the exact state of `visibleCompletions`
4. Check `cursorAtInlineEdit` calculation at line 625

This will tell you exactly why your suggestion isn't displaying!


