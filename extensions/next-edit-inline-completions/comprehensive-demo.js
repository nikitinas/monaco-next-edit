// ============================================
// COMPREHENSIVE DEMO FILE
// Next Edit Inline Completions Extension
// ============================================
//
// This file contains examples for ALL suggestion types:
// 1. Rename Suggestions (Single Word)
// 2. Multiline Suggestions (Content-Based)
// 3. Replacement Suggestions (Pattern-Based)
// 4. Deletion Suggestions (Cleanup)
// 5. Try/Catch Suggestions (Selection-Based)
//
// Instructions:
// 1. Run extension: F5 or "Run Extension" configuration
// 2. Open this file in Extension Development Host
// 3. Follow test cases below
// 4. Check Output panel: "Next Edit Inline Completions"

// ============================================
// 1. RENAME SUGGESTIONS (Single Word)
// ============================================
// Trigger: Type variable name, place cursor after word, trigger completion

// Test 1.1: Generic name "data" → "value"
let data

// Test 1.2: Generic name "item" → "value"
const item

// Test 1.3: Temporary variable "temp" → "result"
var temp

// Test 1.4: Temporary variable "tmp" → "result"
let tmp

// Test 1.5: Plural to singular "items" → "item"
const items

// Test 1.6: Plural to singular "users" → "user"
let users

// Test 1.7: Generic "value" → "valueData"
const value

// Test 1.8: Generic "result" → "resultData"
var result

// ============================================
// 2. MULTILINE SUGGESTIONS (Content-Based)
// ============================================
// Trigger: Based on line content, place cursor appropriately

// Test 2.1: Function Declaration → JSDoc Comment
// Place cursor at start of function line, trigger completion
function calculateTotal(price, tax) {
  return price + tax;
}

// Test 2.2: Async Function → JSDoc Comment
async function fetchUserData(userId) {
  return await api.getUser(userId);
}

// Test 2.3: Class Declaration → JSDoc Comment
// Place cursor at start of class line, trigger completion
class UserService {
  constructor() {}
  getUser() {}
}

// Test 2.4: TODO Comment → Expanded Implementation Steps
// Place cursor after this line, trigger completion
// TODO: implement authentication

// Test 2.5: FIXME Comment → Expanded Implementation Steps
// FIXME: fix memory leak

// Test 2.6: If Statement → Else Clause
// Place cursor after closing brace, trigger completion
if (user.isActive) {
  processUser(user);
}

// Test 2.7: If Statement (no else) → Else Clause
if (condition) {
  doSomething();
}

// Test 2.8: Empty Object → Initialization Comment
// Place cursor after this line, trigger completion
const config = {};

// Test 2.9: Empty Array → Initialization Comment
const items = [];

// ============================================
// 3. REPLACEMENT SUGGESTIONS (Pattern-Based)
// ============================================
// Trigger: Detects patterns and suggests replacements

// Test 3.1: Replace var with const
// Place cursor anywhere on line, trigger completion
var userName = 'John';

// Test 3.2: Replace == with ===
// Place cursor anywhere on line, trigger completion
if (x == y) {
  // code
}

// Test 3.3: Replace XMLHttpRequest with fetch
// Place cursor anywhere on line, trigger completion
const xhr = new XMLHttpRequest();

// Test 3.4: Convert function to arrow function
// Place cursor anywhere on function line, trigger completion
function processData(data) {
  return data.map(x => x * 2);
}

// Test 3.5: Replace console.log with logger
// Place cursor anywhere on line, trigger completion
console.log('Debug info', data);

// Test 3.6: Replace string concatenation with template literal
// Place cursor anywhere on line, trigger completion
const message = 'Hello' + ' ' + 'World';

// ============================================
// 4. DELETION SUGGESTIONS (Cleanup)
// ============================================
// Trigger: Detects code that should be removed

// Test 4.1: Remove console.log statement
// Place cursor anywhere on line, trigger completion
console.log('Debug: user data', userData);

// Test 4.2: Remove console.debug statement
console.debug('Processing started');

// Test 4.3: Remove console.info statement
console.info('User logged in');

// Test 4.4: Remove TODO comment
// Place cursor anywhere on line, trigger completion
// TODO: Remove this after testing

// Test 4.5: Remove FIXME comment
// FIXME: This needs refactoring

// Test 4.6: Remove HACK comment
// HACK: Temporary workaround

// Test 4.7: Remove unused variable
// Place cursor anywhere on line, trigger completion
const unusedVar = 42;

// Test 4.8: Remove empty line
// Place cursor at start of empty line, trigger completion
// (empty line here)

// Test 4.9: Remove debugger statement
// Place cursor anywhere on line, trigger completion
debugger;

// ============================================
// 5. TRY/CATCH SUGGESTIONS (Selection-Based)
// ============================================
// Trigger: SELECT code, place cursor in selection, trigger completion

// Test 5.1: Wrap selected code in try/catch
// SELECT the three lines below, then place cursor in selection
function riskyOperation() {
  const result = apiCall();
  processResult(result);
  return result;
}

// Test 5.2: Wrap multiple statements
// SELECT these lines:
function processData() {
  const data = fetchData();
  const processed = transform(data);
  saveToDatabase(processed);
  notifyUser();
}

// Test 5.3: Wrap single statement
// SELECT this line:
const result = dangerousFunction();

// ============================================
// COMBINED SCENARIOS
// ============================================

// Scenario 1: Modernize old code
var oldData = fetchData();
if (oldData == null) {
  console.log('No data found');
  // TODO: handle error case
}

// Scenario 2: Clean up debug code
function debugFunction() {
  console.log('Entering function');
  const temp = calculate();
  console.debug('Result:', temp);
  debugger;
  return temp;
}

// Scenario 3: Improve code quality
var items = [];
function processItems(items) {
  if (items.length == 0) {
    return;
  }
  // Process items
}

// ============================================
// QUICK REFERENCE
// ============================================
// - Trigger completion: Ctrl+Space (Cmd+Space on Mac)
// - Accept suggestion: Tab
// - View details: Command Palette → "Next Edit: Explain Active Suggestion"
// - Check logs: Output panel → "Next Edit Inline Completions"
// - Generate telemetry: Command Palette → "Next Edit: Generate Telemetry Stub"

