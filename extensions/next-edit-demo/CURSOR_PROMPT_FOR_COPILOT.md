# Prompt for Cursor Agent in GitHub Copilot Workspace

Copy and paste this prompt into Cursor when you have the GitHub Copilot source code open:

---

## Question: How does GitHub Copilot display "next edit" suggestions at positions other than the cursor?

I'm building a VS Code extension that demonstrates "next edit" suggestions (similar to Copilot's feature where suggestions appear on different lines, not just at the cursor). However, I'm encountering a limitation: VS Code's `InlineCompletionItemProvider` API only displays suggestions that are at or very close to the cursor position. Same-line suggestions work, but next-line suggestions are filtered out by VS Code.

**My current implementation:**

- Uses `vscode.languages.registerInlineCompletionItemProvider()`
- Returns `InlineCompletionList` with `InlineCompletionItem` objects
- Sets `enableForwardStability = true` on the completion list
- Creates suggestions with `Range` that points to positions on different lines (e.g., next line, above line)

**The problem:**

- Same-line suggestions (modify/delete on current line) work fine
- Next-line suggestions are created but not displayed by VS Code
- VS Code seems to filter out suggestions that are far from the cursor

**Questions I need answered:**

1. **How does Copilot's inline completion provider handle "next edit" suggestions?**

   - Does it use the standard `InlineCompletionItemProvider` API?
   - Are there any special properties or configurations on `InlineCompletionItem` or `InlineCompletionList`?
   - Does it use internal VS Code APIs that aren't available to regular extensions?

2. **Range handling for next-edit suggestions:**

   - How does Copilot set the `Range` for suggestions on different lines?
   - Does the range need to include the cursor position, or can it be completely separate?
   - Are there any tricks to make VS Code accept ranges far from the cursor?

3. **Special configurations or flags:**

   - Are there any VS Code settings or experimental features that need to be enabled?
   - Does Copilot use any special registration options when calling `registerInlineCompletionItemProvider`?
   - Are there any extension capabilities or contributions that enable this feature?

4. **Code examples:**

   - Can you show me the actual code from `inlineCompletionProvider.ts` (or similar) that creates next-edit suggestions?
   - How does it differ from regular inline completions at the cursor?
   - What makes VS Code display these suggestions when regular extensions can't?

5. **Alternative approaches:**
   - If the standard API doesn't support this, does Copilot use a different mechanism?
   - Are there any workarounds or hacks that make it work?
   - Does Copilot have special permissions or access that regular extensions don't?

**Specific files to examine:**

- `src/extension/inlineEdits/vscode-node/inlineCompletionProvider.ts` (the reference file mentioned)
- Any files related to "next edit" or "NES" (Next Edit Suggestions)
- Configuration files that might enable special features

**What I'm trying to achieve:**
I want to create a demo extension that shows:

- Insert suggestions on the next line (e.g., after typing `function test() {`, suggest a TODO comment on the next line)
- Modify suggestions on the same line (e.g., replace `var` with `const`)
- Delete suggestions on the current line (e.g., remove `console.log`)
- Remote suggestions on different lines (e.g., closing brace several lines away)

Currently, only same-line suggestions work. I need to understand how Copilot makes next-line suggestions visible in VS Code.

Please explore the Copilot codebase and explain:

1. The exact mechanism used for next-edit suggestions
2. Any special APIs, configurations, or workarounds
3. Code examples showing how it's implemented
4. Why it works for Copilot but not for regular extensions

Thank you!

---

## Additional Follow-up Questions (if needed):

If the initial response doesn't fully answer the question, you can ask:

1. "Can you show me the exact code that creates an InlineCompletionItem for a next-line suggestion? What properties does it have?"

2. "Are there any VS Code internal APIs or extension host APIs that Copilot uses that aren't in the public vscode.d.ts types?"

3. "Does Copilot register its provider differently? Show me the registration code."

4. "What happens when Copilot returns a suggestion with a Range on a different line? Does VS Code have special handling for Copilot?"

5. "Is there a difference between how Copilot handles suggestions at the cursor vs. suggestions on other lines?"
