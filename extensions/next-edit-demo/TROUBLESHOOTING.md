# Troubleshooting: Next-Line Suggestions Not Appearing

## Critical Setting: `editor.inlineSuggest.edits.enabled`

**This is likely the issue!** VS Code only requests inline edits from providers when this setting is enabled.

### How to Check

1. Open VS Code Settings (Cmd+, / Ctrl+,)
2. Search for: `editor.inlineSuggest.edits.enabled`
3. Make sure it's **checked/enabled**

Or add to your `settings.json`:
```json
{
  "editor.inlineSuggest.edits.enabled": true
}
```

### Why This Matters

VS Code determines `context.includeInlineEdits` based on this setting:
- `editor.inlineSuggest.edits.enabled: true` → `context.includeInlineEdits = true` → VS Code requests inline edits
- `editor.inlineSuggest.edits.enabled: false` → `context.includeInlineEdits = false` → VS Code **skips** inline edits

**Location in VS Code source**: `src/vs/editor/contrib/inlineCompletions/browser/model/inlineCompletionsModel.ts:128`
```typescript
this._inlineEditsEnabled = inlineSuggest.map(v => !!v.edits.enabled);
```

And then at line 404:
```typescript
includeInlineEdits: this._inlineEditsEnabled.read(reader),
```

## Check the Logs

After adding the logging for `context.includeInlineEdits`, check the "Next Edit Demo" output channel:

1. Open Output panel (View → Output)
2. Select "Next Edit Demo" from the dropdown
3. Look for: `⚠️  Context.includeInlineEdits: true/false`

If it shows `false`, that's the problem!

## Other Things to Check

### 1. Regular Inline Completions Taking Precedence

If there's a regular inline completion visible (like from another extension), inline edits are hidden.

**Check**: Look for any ghost text at the cursor position from other extensions.

### 2. Peek Widgets Visible

If peek widgets (like hover, definition peek) are visible, inline edits are hidden.

**Check**: Close any open peek widgets.

### 3. Viewport Visibility

The `displayLocation.range` must be in the viewport for the Custom view to render.

**Check**: Make sure the next line is visible on screen.

### 4. Provider Registration

Make sure the provider is registered correctly. Check the extension activation logs.

## Testing Steps

1. **Enable the setting**:
   ```json
   "editor.inlineSuggest.edits.enabled": true
   ```

2. **Reload the Extension Development Host** (F5)

3. **Open a new file** and type:
   ```javascript
   function test() {
   ```

4. **Check the logs** in "Next Edit Demo" output channel:
   - Should see `Context.includeInlineEdits: true`
   - Should see suggestions being created
   - Should see `✅ Created next-line suggestion`

5. **Check if suggestion appears**:
   - Should see a label/hint on the next line
   - Should be able to press Tab to accept

## If Still Not Working

1. Check all the logs carefully
2. Verify `context.includeInlineEdits` is `true`
3. Verify suggestions are being created (check logs)
4. Check if any regular inline completions are visible
5. Try the demo commands instead of typing:
   - `Next Edit Demo: Insert Suggestion (Next Line)`


