# Testing Guide for Next Edit Inline Completions Extension

This guide shows you how to test all 4 types of suggestions provided by the extension.

## Prerequisites

1. Make sure the extension is compiled: `npm run compile`
2. Run the extension using F5 or the "Run Extension" configuration
3. A new VS Code window (Extension Development Host) will open
4. Open the Output panel (View → Output) and select "Next Edit Inline Completions" to see logs

## Suggestion Types

### 1. Rename Suggestion (Single Word)

**How to trigger:**
- Type a variable name that matches the rename patterns
- The suggestion appears as you type

**Test cases:**

```javascript
// Test 1: Generic name "data" → "value"
let data

// Test 2: Generic name "item" → "value"  
const item

// Test 3: Temporary variable "temp" → "result"
var temp

// Test 4: Plural to singular (e.g., "items" → "item")
let items

// Test 5: Generic "value" → "valueData"
const value
```

**What to do:**
1. Type one of the patterns above (e.g., `let data`)
2. Place cursor after the word
3. Wait for inline completion to trigger (or press Ctrl+Space)
4. You should see: "Rename 'data' to 'value'"

---

### 2. Multiline Suggestion (Content-Based)

**How to trigger:**
- Type specific patterns that match the multiline detection rules
- Suggestions appear based on line content

**Test cases:**

#### A. Function Declaration → JSDoc Comment
```javascript
function calculateTotal(price, tax) {
  // Place cursor at the start of this line
  // Suggestion: Adds JSDoc comment above
}
```

#### B. Class Declaration → JSDoc Comment
```javascript
class UserService {
  // Place cursor at the start of this line
  // Suggestion: Adds JSDoc comment above
}
```

#### C. TODO Comment → Expanded Implementation Steps
```javascript
// TODO: fix this
// Place cursor after this line
// Suggestion: Expands with structured steps
```

#### D. If Statement → Else Clause
```javascript
if (condition) {
  // some code
}
// Place cursor after the closing brace
// Suggestion: Adds else clause
```

#### E. Empty Object/Array → Initialization Comment
```javascript
const config = {};
// Place cursor after this line
// Suggestion: Adds initialization comment

const items = [];
// Place cursor after this line  
// Suggestion: Adds initialization comment
```

**What to do:**
1. Type one of the patterns above
2. Place cursor at the appropriate position (usually at the end of the line or after)
3. Wait for inline completion or press Ctrl+Space
4. You should see the multiline suggestion appear

---

### 3. Logging Suggestion

**How to trigger:**
- Always available (no specific conditions)
- Appears when typing anywhere in the code

**Test case:**
```javascript
function test() {
  // Place cursor anywhere in this function
  // Type or wait for suggestion
}
```

**What to do:**
1. Open any code file
2. Place cursor anywhere in the code
3. Wait for inline completion or press Ctrl+Space
4. You should see: "Insert logging for the current change"
5. Accepting it adds: `console.log('next edit prediction', { /* TODO: insert symbols */ });`

---

### 4. Try/Catch Suggestion

**How to trigger:**
- Select some code (highlight text)
- Place cursor within the selection
- Suggestion wraps the selection in try/catch

**Test case:**
```javascript
function riskyOperation() {
  // Select these lines:
  const result = apiCall();
  processResult(result);
  return result;
  
  // Place cursor anywhere in the selection
  // Suggestion: Wraps selection in try/catch
}
```

**What to do:**
1. Select multiple lines of code (drag to highlight)
2. Place cursor anywhere within the selection
3. Wait for inline completion or press Ctrl+Space
4. You should see: "Wrap selection in try/catch"
5. Accepting it wraps the code in a try/catch block

---

## Complete Test File

Create a file `test-suggestions.js` with this content to test all suggestions:

```javascript
// Test 1: Rename suggestion - type "let data" and place cursor after "data"
let data

// Test 2: Multiline - Function JSDoc
function calculateTotal(price, tax) {
  return price + tax;
}

// Test 3: Multiline - Class JSDoc
class UserService {
  getUser() {}
}

// Test 4: Multiline - TODO expansion
// TODO: implement this feature

// Test 5: Multiline - If/else
if (condition) {
  doSomething();
}

// Test 6: Multiline - Empty object
const config = {};

// Test 7: Logging - place cursor here and wait
function testLogging() {
  // Cursor here
}

// Test 8: Try/catch - SELECT the code below, then place cursor in selection
function testTryCatch() {
  const result = riskyCall();
  process(result);
  return result;
}
```

## Tips for Testing

1. **Check the Output Panel**: Open "Next Edit Inline Completions" output channel to see detailed logs of when suggestions are created and shown.

2. **Trigger Inline Completions**: 
   - Automatic: VS Code shows suggestions as you type
   - Manual: Press `Ctrl+Space` (or `Cmd+Space` on Mac) to trigger manually
   - Settings: Check `editor.inlineSuggest.enabled` is true

3. **Accept Suggestions**:
   - Press `Tab` to accept
   - Press `Ctrl+Right Arrow` to accept word by word
   - Press `Esc` to dismiss

4. **View Suggestion Details**:
   - Use the command: "Next Edit: Explain Active Suggestion" from Command Palette
   - Or check the status bar message

5. **Multiple Suggestions**: If multiple suggestions are available, you can cycle through them using arrow keys or accept the first one.

## Troubleshooting

- **No suggestions appearing?** Check the Output panel for logs
- **Suggestions not triggering?** Make sure you're in a code file (not plain text)
- **Extension not loaded?** Check the Developer Console (Help → Toggle Developer Tools) for errors
- **Still not working?** Verify the extension compiled successfully: `npm run compile`

