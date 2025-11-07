# Comprehensive Demo Guide - Next Edit Inline Completions

This guide provides a complete overview of all 5 suggestion types with detailed test cases.

## Quick Start

1. **Compile extension**: `npm run compile`
2. **Run extension**: Press `F5` or use "Run Extension" configuration
3. **Open test file**: Open `comprehensive-demo.js` in Extension Development Host
4. **Check logs**: View → Output → "Next Edit Inline Completions"

---

## Suggestion Types Overview

| Type | Trigger | Description |
|------|---------|-------------|
| **Rename** | Type word, cursor after word | Suggests better variable names |
| **Multiline** | Content-based patterns | Adds multiline code blocks |
| **Replacement** | Pattern detection | Replaces deprecated/old patterns |
| **Deletion** | Cleanup patterns | Removes unnecessary code |
| **Try/Catch** | Select code, cursor in selection | Wraps code in try/catch |

---

## 1. Rename Suggestions

**Purpose**: Improve variable naming for better readability

### Test Cases

| Input | Suggested Output | Pattern |
|-------|-----------------|---------|
| `let data` | `value` | Generic name |
| `const item` | `value` | Generic name |
| `var temp` | `result` | Temporary variable |
| `let tmp` | `result` | Temporary variable |
| `const items` | `item` | Plural to singular |
| `let users` | `user` | Plural to singular |
| `const value` | `valueData` | Add descriptive suffix |
| `var result` | `resultData` | Add descriptive suffix |

### How to Test

1. Type one of the patterns above (e.g., `let data`)
2. Place cursor after the word
3. Trigger completion (Ctrl+Space)
4. Accept suggestion (Tab)

---

## 2. Multiline Suggestions

**Purpose**: Add structured code blocks based on context

### Test Cases

#### 2.1 Function JSDoc
```javascript
function calculateTotal(price, tax) {
  // Place cursor at start of function line
  // Suggestion: Adds JSDoc comment above
}
```

#### 2.2 Class JSDoc
```javascript
class UserService {
  // Place cursor at start of class line
  // Suggestion: Adds JSDoc comment above
}
```

#### 2.3 TODO Expansion
```javascript
// TODO: implement authentication
// Place cursor after line
// Suggestion: Expands with structured steps
```

#### 2.4 If/Else
```javascript
if (condition) {
  // code
}
// Place cursor after closing brace
// Suggestion: Adds else clause
```

#### 2.5 Empty Object/Array
```javascript
const config = {};
// Place cursor after line
// Suggestion: Adds initialization comment
```

---

## 3. Replacement Suggestions

**Purpose**: Modernize code by replacing deprecated patterns

### Test Cases

| Pattern | Replacement | Example |
|---------|------------|---------|
| `var` | `const` | `var x = 1;` → `const x = 1;` |
| `==` | `===` | `if (x == y)` → `if (x === y)` |
| `XMLHttpRequest` | `fetch` | `new XMLHttpRequest()` → `fetch` |
| `function name()` | `const name = (` | `function test()` → `const test = (` |
| `console.log()` | `logger.debug()` | `console.log(x)` → `logger.debug('message', data)` |
| String concat | Template literal | `'a' + 'b'` → `` `ab` `` |

### How to Test

1. Type one of the patterns
2. Place cursor anywhere on the line
3. Trigger completion
4. Accept to replace

---

## 4. Deletion Suggestions

**Purpose**: Clean up debug code and unnecessary statements

### Test Cases

| Pattern | Action | Example |
|---------|--------|---------|
| `console.log()` | Remove | `console.log('debug');` → (deleted) |
| `console.debug()` | Remove | `console.debug(x);` → (deleted) |
| `console.info()` | Remove | `console.info(msg);` → (deleted) |
| `// TODO:` | Remove | `// TODO: fix` → (deleted) |
| `// FIXME:` | Remove | `// FIXME: bug` → (deleted) |
| `// HACK:` | Remove | `// HACK: workaround` → (deleted) |
| Unused variable | Remove | `const unused = 1;` → (deleted) |
| Empty line | Remove | (empty line) → (deleted) |
| `debugger;` | Remove | `debugger;` → (deleted) |

### How to Test

1. Type one of the patterns
2. Place cursor anywhere on the line
3. Trigger completion
4. Accept to delete

---

## 5. Try/Catch Suggestions

**Purpose**: Wrap selected code in error handling

### Test Cases

#### 5.1 Multiple Statements
```javascript
// SELECT these lines:
const result = apiCall();
processResult(result);
return result;

// Place cursor in selection
// Suggestion: Wraps in try/catch
```

#### 5.2 Single Statement
```javascript
// SELECT this line:
const data = riskyOperation();

// Place cursor in selection
// Suggestion: Wraps in try/catch
```

### How to Test

1. Select code (drag to highlight)
2. Place cursor within selection
3. Trigger completion
4. Accept to wrap in try/catch

---

## Complete Test Scenarios

### Scenario 1: Modernize Legacy Code

**Before:**
```javascript
var data = fetchData();
if (data == null) {
  console.log('No data');
  // TODO: handle error
}
```

**After applying suggestions:**
```javascript
const data = fetchData();
if (data === null) {
  // Error handling code
}
```

### Scenario 2: Clean Up Debug Code

**Before:**
```javascript
function process() {
  console.log('Starting');
  const temp = calculate();
  console.debug('Result:', temp);
  debugger;
  return temp;
}
```

**After applying suggestions:**
```javascript
function process() {
  const result = calculate();
  return result;
}
```

### Scenario 3: Improve Code Quality

**Before:**
```javascript
var items = [];
function processItems(items) {
  if (items.length == 0) return;
  // process
}
```

**After applying suggestions:**
```javascript
const items = [];
function processItems(items) {
  if (items.length === 0) return;
  // process
}
```

---

## Keyboard Shortcuts

| Action | Shortcut |
|--------|----------|
| Trigger completion | `Ctrl+Space` (Mac: `Cmd+Space`) |
| Accept suggestion | `Tab` |
| Accept word-by-word | `Ctrl+Right Arrow` |
| Dismiss suggestion | `Esc` |
| View suggestion details | Command Palette → "Next Edit: Explain Active Suggestion" |

---

## Troubleshooting

### No suggestions appearing?

1. **Check Output panel**: View → Output → "Next Edit Inline Completions"
   - Look for "provideInlineCompletionItems invoked" messages
   - Check which suggestions are being created

2. **Verify settings**:
   - `editor.inlineSuggest.enabled` should be `true`
   - File should be a code file (not plain text)

3. **Check extension status**:
   - Developer Console: Help → Toggle Developer Tools
   - Look for errors or activation messages

### Suggestions not triggering?

- **Manual trigger**: Press `Ctrl+Space` (or `Cmd+Space` on Mac)
- **Automatic trigger**: Type code and wait (may take a moment)
- **Check file type**: Make sure you're in a `.js`, `.ts`, or similar code file

### Extension not loading?

1. Check compilation: `npm run compile`
2. Reload window: Command Palette → "Developer: Reload Window"
3. Check Developer Console for errors

---

## Output Logging

The extension logs all activity to the Output panel:

- ✅ **Activation**: Extension loaded and registered
- ✅ **Invocation**: `provideInlineCompletionItems` called
- ✅ **Creation**: Each suggestion type created
- ✅ **Display**: Suggestions shown to user
- ✅ **Acceptance**: Suggestions accepted by user

Example log output:
```
[2024-01-01T12:00:00.000Z] provideInlineCompletionItems invoked
  File: test.js
  Position: Line 5, Column 10
  Context: Automatic
  Created rename suggestion: Rename "data" to "value"
  Created replacement suggestion: Replace var with const
  Returning 2 suggestion(s)
[2024-01-01T12:00:01.000Z] Suggestion shown: next-edit-inline.rename - Rename "data" to "value"
```

---

## Best Practices for Testing

1. **Test one suggestion type at a time** to avoid confusion
2. **Check the Output panel** to see what's being detected
3. **Use the test file** (`comprehensive-demo.js`) for systematic testing
4. **Try edge cases** to see how the extension handles them
5. **Check suggestion explanations** using the "Explain Active Suggestion" command

---

## Summary

The extension provides 5 types of suggestions:

1. **Rename** - Improves variable names (8 patterns)
2. **Multiline** - Adds structured code blocks (5 patterns)
3. **Replacement** - Modernizes code patterns (6 patterns)
4. **Deletion** - Cleans up code (9 patterns)
5. **Try/Catch** - Adds error handling (selection-based)

**Total: 28+ different suggestion patterns** across 5 categories!

