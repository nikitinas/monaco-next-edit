# Testing Next-Line Insertion Suggestions

## Quick Test Methods

### Method 1: Using the Demo Command (Easiest)

1. **Press `F5`** to launch Extension Development Host
2. **Open any file** (or create a new one)
3. **Open Command Palette** (`Ctrl+Shift+P` / `Cmd+Shift+P`)
4. **Type**: `Next Edit Demo: Insert Suggestion`
5. **Select**: "Demo: Insert Suggestion (Next Line)"
6. The command will:
   - Insert `function demoFunction() {` at your cursor
   - Automatically trigger inline completions
   - You should see a suggestion on the next line: `// TODO: implement function body`
7. **Press TAB** to accept the suggestion

### Method 2: Manual Typing

1. **Press `F5`** to launch Extension Development Host
2. **Open any file** (or create a new one)
3. **Type one of these patterns**:
   - `function myFunction() {`
   - `const myVariable =`
   - `let myVar =`
   - `class MyClass {`
   - `async function myAsyncFunc() {`
4. **Make sure the next line is empty** (or doesn't exist)
5. The suggestion should appear on the next line automatically
6. **Press TAB** to accept

### Method 3: Step-by-Step Manual Test

1. **Open a new file** in Extension Development Host
2. **Type**: `function test() {`
3. **Press Enter** to go to the next line (make sure it's empty)
4. **Move cursor back** to the line with `function test() {`
5. **Type a space or move cursor** - this triggers the inline completion provider
6. You should see a suggestion on the next line: `  // TODO: implement function body`
7. **Press TAB** to accept

## What Triggers Next-Line Suggestions

The extension triggers next-line suggestions when:

- **Pattern matches**: Line contains `function`, `const`, `let`, `var`, `class`, or `async function` followed by a word
- **Next line is empty**: The line immediately below must be empty (or doesn't exist)
- **Cursor is within 4 lines**: Due to `showRange`, cursor must be within 4 lines of the target

## Expected Behavior

When working correctly, you should see:

1. **Visual indicator**: A label showing "Next edit: TODO comment" at the target location
2. **Ghost text**: The suggestion text appears on the next line
3. **Accept with TAB**: Pressing TAB accepts and inserts the suggestion
4. **Logs in Output**: Check "Next Edit Demo" output channel for detailed logs

## Troubleshooting

### Suggestion doesn't appear?

1. **Check VS Code version**: Must be 1.99 or later

   ```bash
   code --version
   ```

2. **Check the next line**: It must be completely empty (no spaces, no text)

3. **Check cursor position**: Cursor should be on the line with the function/const/class declaration

4. **Check Output Channel**:

   - View → Output → Select "Next Edit Demo"
   - Look for logs showing if suggestion was created
   - Check for any errors

5. **Try the demo command first**: Use "Demo: Insert Suggestion (Next Line)" to verify setup

6. **Reload Extension Host**: Close and press `F5` again

### Pattern not matching?

The pattern requires:

- A keyword: `function`, `const`, `let`, `var`, `class`, or `async function`
- Followed by whitespace
- Followed by a word (identifier)

Examples that **WILL** trigger:

- ✅ `function test() {`
- ✅ `const myVar =`
- ✅ `class MyClass {`
- ✅ `async function foo() {`

Examples that **WON'T** trigger:

- ❌ `function() {` (no identifier)
- ❌ `function test` (no opening brace or equals)
- ❌ `// function test() {` (commented out)

## Testing Checklist

- [ ] Extension activates without errors
- [ ] Demo command works ("Insert Suggestion")
- [ ] Manual typing triggers suggestion
- [ ] Suggestion appears on next line (not at cursor)
- [ ] Visual indicator (displayLocation) is visible
- [ ] TAB accepts the suggestion
- [ ] Output channel shows detailed logs
- [ ] Works with different patterns (function, const, class, etc.)

## Example Test File

Create a file with this content and test:

```javascript
// Test 1: Function declaration
function test1() {

// Test 2: Const declaration
const test2 =

// Test 3: Class declaration
class Test3 {

// Test 4: Async function
async function test4() {
```

For each test:

1. Place cursor on the declaration line
2. Make sure next line is empty
3. Trigger inline completions (type a space or move cursor)
4. Should see suggestion on next line
5. Press TAB to accept

## Debug Output

The extension logs everything to the "Next Edit Demo" output channel. Look for:

- `✅ Created next-line suggestion` - Suggestion was created
- `Range: X:Y -> X+1:0` - Shows the range (should be on next line)
- `ShowRange: A to B` - Shows when suggestion can be displayed
- `isInlineEdit: true` - Confirms proposed API is used
- `displayLocation: Next edit: TODO comment` - Visual indicator info

If you see these logs but no suggestion appears, it might be a VS Code display issue. Check VS Code version and settings.
