# Prompt for Cursor Agent in VS Code Source Code Workspace

Copy and paste this prompt into Cursor when you have the VS Code source code open:

---

## Question: How does VS Code display inline completion items with isInlineEdit, showRange, and displayLocation?

I'm building a VS Code extension that uses the `inlineCompletionsAdditions` API to show "next edit" suggestions at positions other than the cursor (similar to GitHub Copilot). I've implemented:

- `isInlineEdit: true` on InlineCompletionItem
- `showRange` to allow display when cursor is within 4 lines
- `displayLocation` with range, label, and kind

However, the suggestions are **not appearing** on the next line as expected. They're being created (I can see them in logs), but VS Code is not displaying them.

**Questions I need answered:**

1. **How does VS Code process and filter InlineCompletionItem with isInlineEdit?**

   - Where in the VS Code codebase does it check for `isInlineEdit`?
   - Are there any additional validation or filtering steps?
   - What conditions must be met for a suggestion to be displayed?

2. **showRange implementation:**

   - How does VS Code use the `showRange` property?
   - What exactly does "cursor within showRange" mean?
   - Are there any edge cases or limitations?
   - Does VS Code validate that showRange overlaps with the cursor position?

3. **displayLocation rendering:**

   - How does VS Code render the `displayLocation`?
   - Is it a separate UI element or part of the inline completion?
   - Are there any requirements for displayLocation to work?

4. **Filtering and validation:**

   - What filtering logic applies to inline completions with `isInlineEdit: true`?
   - Are there distance limits or other constraints?
   - Does VS Code check if the range is "too far" from the cursor even with showRange?

5. **Code locations to examine:**

   - Where is the inline completion provider result processed?
   - Where are inline completions filtered/validated?
   - Where is the rendering logic for inline completions?
   - Where does VS Code check `isInlineEdit`, `showRange`, and `displayLocation`?

6. **Specific issues:**

   - If a suggestion has `range` on line 5, but cursor is on line 1, and `showRange` includes lines 1-9, should it display?
   - What happens if `range` and cursor are on different lines?
   - Are there any console errors or warnings when these properties are used incorrectly?

7. **Example scenario:**
   ```typescript
   const item = new InlineCompletionItem("// TODO", new Range(5, 0, 5, 0));
   item.isInlineEdit = true;
   item.showRange = new Range(1, 0, 9, Number.MAX_SAFE_INTEGER);
   item.displayLocation = {
     range: new Range(5, 0, 5, 0),
     label: "Next edit",
     kind: 0,
     jumpToEdit: true,
   };
   ```
   - If cursor is on line 3, should this suggestion appear?
   - What would prevent it from appearing?

**Files to examine:**

- Inline completion provider processing code
- Inline completion filtering/validation logic
- Inline completion rendering code
- Any code that checks `isInlineEdit`, `showRange`, or `displayLocation`
- Type definitions for InlineCompletionItem to see all available properties

**What I'm trying to achieve:**

- Show suggestions on the next line when user types `function test() {`
- The suggestion should appear on line 2 (next line) even though cursor is on line 1
- Using the inlineCompletionsAdditions API as documented

**Current behavior:**

- Suggestions are created (confirmed in logs)
- `isInlineEdit`, `showRange`, and `displayLocation` are set correctly
- But VS Code does not display them

Please explore the VS Code codebase and explain:

1. How VS Code processes these properties
2. What might prevent the suggestions from appearing
3. Any additional requirements or configurations needed
4. Code examples showing how VS Code handles these properties

Thank you!

---

## Follow-up Questions (if needed):

1. "Can you show me the exact code that checks if a suggestion with isInlineEdit should be displayed?"

2. "What happens when showRange is set but the range is on a different line from the cursor?"

3. "Are there any VS Code settings or configurations that affect inline edit display?"

4. "Does VS Code have any distance limits or other constraints for inline edits?"

5. "Can you find where VS Code validates or filters inline completion items before displaying them?"

6. "What's the difference between how VS Code handles regular inline completions vs. inline edits (isInlineEdit: true)?"

