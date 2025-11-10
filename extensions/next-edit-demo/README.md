# Next Edit Demo Extension

A VS Code extension that provides "next edit" suggestions using a command-based language. Type commands in your editor to generate inline completion suggestions that can be applied at positions other than the cursor.

## Overview

This extension parses commands from the current line and generates inline completion suggestions based on those commands. Suggestions can be accepted with **TAB**, just like regular inline completions.

## Requirements

- **VS Code 1.99 or later** - The inlineCompletionsAdditions API is available in stable VS Code 1.99+
- **Enable inline edits** - Set `editor.inlineSuggest.edits.enabled` to `true` in your VS Code settings

## Installation

1. Ensure you have VS Code 1.99 or later installed

2. Compile the extension:

   ```bash
   cd extensions/next-edit-demo
   npm install
   npm run compile
   ```

3. Press `F5` in VS Code to open a new Extension Development Host window

4. Enable inline edits in settings:
   - Open Settings (Ctrl+, / Cmd+,)
   - Search for `inlineSuggest.edits.enabled`
   - Check the box to enable it

## Command Language Specification

The extension supports a command-based language for generating inline completion suggestions. Commands are typed on a single line and parsed automatically.

### General Syntax Rules

- Commands are case-insensitive
- Text arguments can be quoted with `"` or `'`, or unquoted
- Line numbers are 1-based (as displayed in the editor)
- Column numbers are 0-based (first character is column 0)
- The keyword `at` or `in` can be used interchangeably before target ranges

### Command Types

#### 1. Insert Command

Inserts text at a specific position.

**Syntax:**

```
insert <text> at <line>:<column>
```

**Parameters:**

- `<text>` - Text to insert (quoted or unquoted)
- `<line>` - Target line number (1-based)
- `<column>` - Target column number (0-based)

**Examples:**

```
insert lala at 12:3
insert "hello world" at 5:10
insert '// TODO: implement' at 20:0
```

#### 2. Replace Command

Replaces occurrences of source text with destination text within a line range.

**Syntax:**

```
replace [all|<N>] "<src>" with "<dst>" [at|in] <startLine>-<endLine>
```

**Parameters:**

- `[all|<N>]` - Optional count specification:
  - Omitted: Replaces first occurrence (default)
  - `all`: Replaces all occurrences
  - `<N>`: Replaces first N occurrences (e.g., `2`, `3`)
- `"<src>"` - Source text to find (must be quoted)
- `"<dst>"` - Destination text to replace with (must be quoted)
- `[at|in]` - Optional keyword (can use either `at` or `in`)
- `<startLine>-<endLine>` - Line range to search in (1-based)

**Examples:**

```
replace "str" with "string" at 12-15
replace all "var" with "const" in 1-10
replace 2 "==" with "===" at 5-8
replace "old" with "new" in 20-25
```

**Behavior:**

- Searches for all occurrences of `<src>` in the specified line range
- Processes matches according to the count specification
- Creates a combined edit if multiple matches are processed

#### 3. Delete Command

Deletes text or characters at specified positions.

**Syntax Variants:**

**3a. Delete with text and column range:**

```
delete [all|<N>] "<text>" [at|in] <line>:<startColumn>-<endColumn>
```

**3b. Delete with text and line range:**

```
delete [all|<N>] "<text>" [at|in] <startLine>-<endLine>
```

**3c. Delete without text (by position):**

```
delete <startLine>-<endLine>:<column>
```

**Parameters:**

- `[all|<N>]` - Optional count specification (same as replace)
- `"<text>"` - Text to delete (must be quoted for text-based deletion)
- `[at|in]` - Optional keyword (can use either `at` or `in`)
- `<line>` - Target line number (1-based)
- `<startColumn>-<endColumn>` - Column range to search within (0-based)
- `<startLine>-<endLine>` - Line range to search in (1-based)
- `<column>` - Column position to delete character at (0-based)

**Examples:**

```
delete " " at 14:2-16
delete "console.log" in 5-10
delete all "TODO" at 1-20
delete 2 "debug" in 10-15
delete 12-13:4
```

**Behavior:**

- For text-based deletion: Searches for the specified text and deletes it
- For position-based deletion: Deletes the character at the specified column in the specified line range
- Processes matches according to the count specification
- Creates a combined edit if multiple matches are processed

## Usage

1. Open any file in VS Code
2. Type a command on a new line (see examples above)
3. The extension will parse the command and generate an inline completion suggestion
4. Press **TAB** to accept the suggestion

### Example Workflow

1. Type: `replace "var" with "const" at 1-10`
2. An inline completion suggestion appears showing the replacement
3. Press **TAB** to apply the replacement

## Output Channel

The extension logs all activity to the "Next Edit Demo" output channel. Open it via:

- View → Output → Select "Next Edit Demo" from the dropdown

The output channel shows:

- Command parsing results
- Match finding details
- Suggestion creation status
- Any errors or warnings

## Troubleshooting

### Suggestions Not Appearing

1. **Check inline edits are enabled:**

   - Open Settings (Ctrl+, / Cmd+,)
   - Search for `inlineSuggest.edits.enabled`
   - Ensure it's checked

2. **Check inline suggestions are enabled:**

   - Open Settings
   - Search for `inlineSuggest.enabled`
   - Ensure it's checked

3. **Check the output channel:**

   - View → Output → "Next Edit Demo"
   - Look for error messages or warnings

4. **Verify command syntax:**
   - Ensure the command is typed correctly
   - Check that line numbers are valid (within document bounds)
   - Verify quoted strings are properly formatted

### Common Issues

**"No valid command found"**

- Check command syntax matches one of the supported formats
- Ensure keywords are spelled correctly
- Verify quotes are balanced

**"Invalid line range"**

- Line numbers must be within document bounds
- Start line must be ≤ end line
- Line numbers are 1-based (as shown in editor)

**"Text not found"**

- Verify the source text exists in the specified range
- Check for exact matches (case-sensitive)
- Ensure the text is properly quoted

**"Cursor not in showRange"**

- Suggestions only appear when cursor is within 4 lines of the target
- Move cursor closer to the target location
- Or adjust the command to target a location near the cursor

## Technical Details

### API Used

The extension uses VS Code's `InlineCompletionItemProvider` API with the **inlineCompletionsAdditions** API (stabilized in VS Code 1.99+). Key properties:

- **`isInlineEdit: true`** - Marks the suggestion as a next-edit suggestion
- **`showRange`** - Allows display when cursor is within 4 lines of the edit
- **`displayLocation`** - Visual indicator showing where the edit will be applied

### Limitations

- Inline completions support only a single range per suggestion
- For multiple matches, a combined edit is created spanning from first to last match
- Suggestions are filtered if cursor is not within 4 lines of the target (showRange)

## Reference

- [VS Code InlineCompletionItemProvider API](https://code.visualstudio.com/api/references/vscode-api#InlineCompletionItemProvider)
- [VS Code Inline Completions Additions API](https://code.visualstudio.com/api/references/vscode-api#InlineCompletionItem)
