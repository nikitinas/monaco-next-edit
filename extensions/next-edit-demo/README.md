# Next Edit Suggestions Demo Extension

A simple VS Code extension that demonstrates how to display inline completion suggestions at positions **other than the cursor position**, using the same VS Code APIs that GitHub Copilot uses.

## Features

This extension shows "next edit" suggestions that appear:

- **On the next line** - When you type a function/class declaration, it suggests adding a TODO comment on the next line
- **Above the current line** - When you type a function call, it suggests adding a documentation comment above
- **At the end of the same line** - When you type an `if` statement, it suggests adding an `else` clause
- **At a different location** - When you open a brace, it suggests the closing brace at a different position

All suggestions can be **accepted with TAB**, just like regular inline completions.

## How It Works

The extension uses VS Code's `InlineCompletionItemProvider` API with the **inlineCompletionsAdditions** API (stabilized in VS Code 1.99+). This API enables suggestions at positions other than the cursor, just like GitHub Copilot.

### Key Features

The extension uses three key API properties:

- **`isInlineEdit: true`** - Marks the suggestion as a next-edit suggestion
- **`showRange`** - Allows display when cursor is within 4 lines of the edit
- **`displayLocation`** - Visual indicator showing where the edit will be applied

### Key Code Pattern

```typescript
// Create a suggestion at a position OTHER than the cursor
const targetPosition = new vscode.Position(cursorPosition.line + 1, 0); // Next line
const range = new vscode.Range(targetPosition, targetPosition);
const item = new vscode.InlineCompletionItem("// TODO: implement", range);

// Enable next-edit functionality with stabilized API
item.isInlineEdit = true;
item.showRange = new vscode.Range(
  Math.max(cursorPosition.line - 4, 0),
  0,
  Math.max(targetPosition.line + 4, 0),
  Number.MAX_SAFE_INTEGER
);
item.displayLocation = {
  range: range,
  label: "Next edit: TODO comment",
  kind: 0, // InlineCompletionDisplayLocationKind.Code
  jumpToEdit: true,
};

return item;
```

## Requirements

- **VS Code 1.99 or later** - The inlineCompletionsAdditions API is available in stable VS Code 1.99+
- The extension declares the API proposal in `package.json` via `enabledApiProposals`

## Installation

1. Ensure you have VS Code 1.99 or later installed

2. Compile the extension:

   ```bash
   cd extensions/next-edit-demo
   npm install
   npm run compile
   ```

3. Press `F5` in VS Code to open a new Extension Development Host window

4. Open any code file and start typing. The suggestions will appear automatically.

## Testing

### Using Demo Commands

The extension includes demo commands that automatically insert patterns and trigger suggestions:

1. Open a new file in the Extension Development Host
2. Open Command Palette (Ctrl+Shift+P / Cmd+Shift+P)
3. Type "Next Edit Demo" and select one of:
   - **Demo: Insert Suggestion (Next Line)** - Inserts a function declaration and triggers a next-line suggestion
   - **Demo: Modify Suggestion (Same Line)** - Inserts `var` and triggers a replace suggestion (var → const)
   - **Demo: Delete Suggestion (Current Line)** - Inserts `console.log` and triggers a delete suggestion
   - **Demo: Remote Suggestion (Different Line)** - Inserts an `if` statement and triggers a closing brace suggestion on a different line
4. Press **TAB** to accept any suggestion

### Manual Testing

1. Open a new file in the Extension Development Host
2. Type `function myFunction() {` - you should see a suggestion on the next line
3. Type `someFunction()` - you should see a suggestion above the line
4. Type `if (condition) {` - you should see an `else` suggestion at the end of the line
5. Press **TAB** to accept any suggestion

### Troubleshooting

If commands are not found:

1. Make sure the extension is compiled: `npm run compile` in the `extensions/next-edit-demo` directory
2. **Reload the Extension Development Host window** - Close it and press F5 again, or use "Developer: Reload Window" command
3. Check the "Next Edit Demo" output channel for any errors

## Reference

This extension is based on the same APIs used by GitHub Copilot. See:

- [VS Code InlineCompletionItemProvider API](https://code.visualstudio.com/api/references/vscode-api#InlineCompletionItemProvider)
- [GitHub Copilot Implementation](https://github.com/microsoft/vscode-copilot-chat/blob/main/src/extension/inlineEdits/vscode-node/inlineCompletionProvider.ts)

## Output Channel

The extension logs all activity to the "Next Edit Demo" output channel. Open it via:

- View → Output → Select "Next Edit Demo" from the dropdown
