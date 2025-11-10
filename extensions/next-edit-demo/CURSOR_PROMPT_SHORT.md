# Short Prompt for Cursor Agent (GitHub Copilot Workspace)

---

## How does GitHub Copilot make "next edit" suggestions appear on different lines?

I'm building a VS Code extension that uses `InlineCompletionItemProvider` to show suggestions at positions other than the cursor (like Copilot's "next edit" feature). 

**Problem:** VS Code only displays suggestions at/near the cursor. Same-line suggestions work, but next-line suggestions are filtered out.

**Questions:**
1. How does Copilot's `inlineCompletionProvider.ts` create suggestions with `Range` on different lines?
2. What makes VS Code display these suggestions when regular extensions can't?
3. Are there special properties on `InlineCompletionItem` or `InlineCompletionList`?
4. Does Copilot use internal APIs or special registration?

Please examine `src/extension/inlineEdits/vscode-node/inlineCompletionProvider.ts` and show me:
- How it creates next-line suggestions
- Any special configurations or workarounds
- Why it works for Copilot but not regular extensions

---

