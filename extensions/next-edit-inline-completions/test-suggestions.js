// ============================================
// TEST FILE FOR NEXT EDIT INLINE COMPLETIONS
// ============================================
// 
// Instructions:
// 1. Run the extension (F5)
// 2. Open this file in the Extension Development Host window
// 3. Follow the test cases below
// 4. Check the Output panel: "Next Edit Inline Completions" for logs

// ============================================
// TEST 1: RENAME SUGGESTION
// ============================================
// Type one of these and place cursor after the word:
let data        // Should suggest: "value"
const item      // Should suggest: "value"
var temp        // Should suggest: "result"
let items       // Should suggest: "item" (plural to singular)
const value     // Should suggest: "valueData"

// ============================================
// TEST 2: MULTILINE - FUNCTION JSDOC
// ============================================
// Place cursor at the start of the function line, then trigger completion
function calculateTotal(price, tax) {
  return price + tax;
}

// ============================================
// TEST 3: MULTILINE - CLASS JSDOC
// ============================================
// Place cursor at the start of the class line, then trigger completion
class UserService {
  getUser() {
    return {};
  }
}

// ============================================
// TEST 4: MULTILINE - TODO EXPANSION
// ============================================
// Place cursor after this line, then trigger completion
// TODO: implement authentication

// ============================================
// TEST 5: MULTILINE - IF/ELSE
// ============================================
// Place cursor after the closing brace, then trigger completion
if (user.isActive) {
  processUser(user);
}

// ============================================
// TEST 6: MULTILINE - EMPTY OBJECT/ARRAY
// ============================================
// Place cursor after these lines, then trigger completion
const config = {};
const items = [];

// ============================================
// TEST 7: LOGGING SUGGESTION
// ============================================
// Place cursor anywhere in this function, then trigger completion
function testLogging() {
  const x = 10;
  // Cursor here - should see logging suggestion
  return x;
}

// ============================================
// TEST 8: TRY/CATCH SUGGESTION
// ============================================
// SELECT the three lines below (drag to highlight), 
// then place cursor in the selection and trigger completion
function testTryCatch() {
  const result = riskyApiCall();
  processResult(result);
  return result;
}

// ============================================
// QUICK REFERENCE
// ============================================
// - Trigger completion: Ctrl+Space (Cmd+Space on Mac)
// - Accept suggestion: Tab
// - View details: Command Palette → "Next Edit: Explain Active Suggestion"
// - Check logs: Output panel → "Next Edit Inline Completions"

