# Inline Completions Demo Extension

A VS Code extension that provides inline completion suggestions using two methods: a command-based language or JSON configuration files. Generate inline completion suggestions that can be applied at positions other than the cursor.

## Overview

This extension supports two ways to generate inline completion suggestions:

1. **Command-based**: Type commands in your editor to generate suggestions on-the-fly
2. **JSON-based**: Define suggestions in a `suggestions.json` file in your workspace root

Suggestions can be accepted with **TAB**, just like regular inline completions.

## Requirements

- **VS Code 1.99 or later** - The inlineCompletionsAdditions API is available in stable VS Code 1.99+
- **Enable inline edits** - Set `editor.inlineSuggest.edits.experimental.enabled` to `true` in your VS Code settings

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
   - Search for `inlineSuggest.edits.experimental.enabled`
   - Check the box to enable it

## JSON-Based Suggestions

You can define suggestions in a `suggestions.json` file in your workspace root. The extension will automatically load and use these suggestions when the document matches the specified criteria.

### JSON Format

```json
[
  {
    "match": {
      "text": "function test() {\n",
      "cursorLine": 2,
      "file": "app.ts"
    },
    "edits": [
      {
        "start": { "line": 1, "col": 0 },
        "end": { "line": 1, "col": 0 },
        "newText": "  // TODO: implement test\n"
      }
    ]
  }
]
```

### Match Criteria

- **`text`** (required): The text pattern to search for in the document
- **`cursorLine`** (required): The cursor line number relative to where the match text starts (1-based)
- **`file`** (optional): Exact filename match (short filename with extension, e.g., `"app.ts"`). If omitted, matches all files

### Edit Specification

- **`start`**: Start position `{ line: number, col: number }` - line and column are relative to the match text start
- **`end`**: End position `{ line: number, col: number }` - line and column are relative to the match text start
- **`newText`**: The text to insert (use `\n` for line breaks)

### How It Works

1. The extension searches for the `text` pattern in the document
2. When found, it checks if the cursor is on the expected line relative to the match start
3. If `file` is specified, it also checks that the current file's name matches exactly
4. If all criteria match, it creates suggestions from the `edits` array
5. Line numbers in edits are automatically shifted based on where the match was found

### Example

Given this `suggestions.json`:

```json
[
  {
    "match": {
      "text": "function test() {\n",
      "cursorLine": 2,
      "file": "app.ts"
    },
    "edits": [
      {
        "start": { "line": 1, "col": 0 },
        "end": { "line": 1, "col": 0 },
        "newText": "  // TODO: implement test\n"
      }
    ]
  }
]
```

When you:
1. Open `app.ts`
2. Type `function test() {` and press Enter (cursor moves to line 2)
3. The extension will suggest inserting `  // TODO: implement test` on the next line

### Multiple Edits

You can specify multiple edits in a single suggestion:

```json
{
  "match": {
    "text": "var ",
    "cursorLine": 1,
    "file": "utils.js"
  },
  "edits": [
    {
      "start": { "line": 0, "col": 0 },
      "end": { "line": 0, "col": 4 },
      "newText": "const "
    },
    {
      "start": { "line": 0, "col": 10 },
      "end": { "line": 0, "col": 10 },
      "newText": " = null"
    }
  ]
}
```

### File Matching

- If `file` is specified, suggestions only apply to files with that exact name (case-sensitive)
- If `file` is omitted, suggestions apply to all files
- The filename is matched using the short filename with extension (e.g., `"app.ts"`, not the full path)

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
replace [<N>] "<src>" with "<dst>" [at|in] <line>[-<endLine>]
```

**Parameters:**

- `[<N>]` - Optional count specification:
  - Omitted: Replaces all occurrences (default)
  - `<N>`: Replaces first N occurrences (e.g., `2`, `3`)
- `"<src>"` - Source text to find (must be quoted)
- `"<dst>"` - Destination text to replace with (must be quoted)
- `[at|in]` - Optional keyword (can use either `at` or `in`)
- `<line>[-<endLine>]` - Line number or range to search in (1-based):
  - Single line: `<line>` (e.g., `14`)
  - Line range: `<startLine>-<endLine>` (e.g., `12-15`)

**Examples:**

```
replace "str" with "string" at 12-15
replace "a" with "b" at 14
replace "var" with "const" in 1-10
replace 2 "==" with "===" at 5-8
replace "old" with "new" in 20-25
```

**Behavior:**

- Searches for all occurrences of `<src>` in the specified line range
- By default, replaces all matching occurrences
- If a count `<N>` is specified, replaces only the first N occurrences
- Creates a combined edit if multiple matches are processed

#### 3. Delete Command

Deletes text or characters at specified positions.

**Syntax Variants:**

**3a. Delete with text and column range:**

```
delete [<N>] "<text>" [at|in] <line>:<startColumn>-<endColumn>
```

**3b. Delete with text and line range:**

```
delete [<N>] "<text>" [at|in] <line>[-<endLine>]
```

**3c. Delete without text (by position):**

```
delete <startLine>-<endLine>:<column>
```

**Parameters:**

- `[<N>]` - Optional count specification:
  - Omitted: Deletes all occurrences (default)
  - `<N>`: Deletes first N occurrences (e.g., `2`, `3`)
- `"<text>"` - Text to delete (must be quoted for text-based deletion)
- `[at|in]` - Optional keyword (can use either `at` or `in`)
- `<line>` - Target line number (1-based)
- `<startColumn>-<endColumn>` - Column range to search within (0-based)
- `<line>[-<endLine>]` - Line number or range to search in (1-based):
  - Single line: `<line>` (e.g., `14`)
  - Line range: `<startLine>-<endLine>` (e.g., `5-10`)
- `<column>` - Column position to delete character at (0-based)

**Examples:**

```
delete " " at 14:2-16
delete "console.log" in 5-10
delete "text" at 14
delete "TODO" at 1-20
delete 2 "debug" in 10-15
delete 12-13:4
```

**Behavior:**

- For text-based deletion: Searches for the specified text and deletes it
- By default, deletes all matching occurrences
- If a count `<N>` is specified, deletes only the first N occurrences
- For position-based deletion: Deletes the character at the specified column in the specified line range
- Creates a combined edit if multiple matches are processed

## Quick Start

### Option 1: JSON-Based Suggestions

1. Copy `suggestions.json.example` to `suggestions.json` in your workspace root
2. Customize the suggestions for your needs
3. Open a file and start typing - suggestions will appear automatically when patterns match

### Option 2: Command-Based Suggestions

To quickly learn the command syntax, use the built-in command to insert sample commands:

1. Open Command Palette (Ctrl+Shift+P / Cmd+Shift+P)
2. Type "Insert Sample Commands" and select **Inline Completions: Insert Sample Commands**
3. Sample commands will be inserted at your cursor position
4. Review the examples and try typing any command
5. Press **TAB** to accept suggestions

## Usage

### Using JSON-Based Suggestions

1. Create a `suggestions.json` file in your workspace root
2. Define your suggestions following the JSON format (see example above)
3. Open a file that matches your suggestion criteria
4. When the text pattern and cursor position match, suggestions will appear automatically
5. Press **TAB** to accept the suggestion

**Note:** The JSON file is cached for 5 seconds. Changes to `suggestions.json` will be picked up within 5 seconds.

### Using Command-Based Suggestions

1. Open any file in VS Code
2. Type a command on a new line (see examples above)
3. The extension will parse the command and generate an inline completion suggestion
4. Press **TAB** to accept the suggestion

### Priority

The extension checks JSON-based suggestions first. If no JSON suggestion matches, it falls back to command-based suggestions.

### Example Workflows

**JSON-Based:**
1. Create `suggestions.json` with a pattern for `function test() {`
2. Open `app.ts` and type `function test() {` followed by Enter
3. A suggestion appears automatically
4. Press **TAB** to accept

**Command-Based:**
1. Type: `replace "var" with "const" at 1-10`
2. An inline completion suggestion appears showing all replacements in the range
3. Press **TAB** to apply all replacements

## Output Channel

The extension logs all activity to the "Inline Completions Demo" output channel. Open it via:

- View → Output → Select "Inline Completions Demo" from the dropdown

The output channel shows:

- Command parsing results
- Match finding details
- Suggestion creation status
- Any errors or warnings

## Troubleshooting

### Suggestions Not Appearing

1. **Check inline edits are enabled:**

   - Open Settings (Ctrl+, / Cmd+,)
   - Search for `inlineSuggest.edits.experimental.enabled`
   - Ensure it's checked

2. **Check inline suggestions are enabled:**

   - Open Settings
   - Search for `inlineSuggest.enabled`
   - Ensure it's checked

3. **Check the output channel:**

   - View → Output → "Inline Completions Demo"
   - Look for error messages or warnings

4. **Verify command syntax (for command-based):**
   - Ensure the command is typed correctly
   - Check that line numbers are valid (within document bounds)
   - Verify quoted strings are properly formatted

5. **Check JSON suggestions (for JSON-based):**
   - Verify `suggestions.json` exists in workspace root
   - Check JSON syntax is valid
   - Ensure match criteria (text, cursorLine, file) are correct
   - Verify the cursor is on the expected line relative to the match

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

**"No matching JSON suggestion"**

- Check that `suggestions.json` exists in workspace root
- Verify the `text` pattern exists in the document
- Ensure the cursor is on the correct line relative to the match
- Check that the filename matches exactly (if `file` is specified)
- Review the output channel for detailed matching information

## Technical Details

### API Used

The extension uses VS Code's `InlineCompletionItemProvider` API with the **inlineCompletionsAdditions** API (stabilized in VS Code 1.99+). Key properties:

- **`isInlineEdit: true`** - Marks the suggestion as an inline edit suggestion
- **`showRange`** - Allows display of suggestions regardless of cursor position (covers entire document)
- **`displayLocation`** - Visual indicator showing where the edit will be applied

### Limitations

- Inline completions support only a single range per suggestion
- For multiple matches, a combined edit is created spanning from first to last match

## Reference

- [VS Code InlineCompletionItemProvider API](https://code.visualstudio.com/api/references/vscode-api#InlineCompletionItemProvider)
- [VS Code Inline Completions Additions API](https://code.visualstudio.com/api/references/vscode-api#InlineCompletionItem)
