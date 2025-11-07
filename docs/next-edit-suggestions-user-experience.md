## Next Edit Suggestions – User Experience

This guide describes the Next Edit Suggestions feature from an editor user's perspective: how suggestions surface, how keyboard navigation works, and how various edit shapes are visualized before acceptance.

### When Suggestions Appear
- **Manual trigger**: Running the `Predict Next Edit` command (or its bound shortcut) asks the active provider for suggestions scoped to the current cursor selection.
- **Automatic follow-up**: After a suggestion is accepted, the editor may automatically request another prediction to keep momentum; providers decide whether to respond based on context.
- **Session lifetime**: A visible suggestion session stays active until you accept, discard, or type through the preview. Typing outside the suggested ranges cancels the preview and the session.

### Navigating with Tab
- **Focus transfer**: Pressing `Tab` while a suggestion session is active moves the caret to the first edit in the active suggestion, letting you inspect the proposed change in place.
- **Cycling edits**: Continued `Tab` presses walk the caret through every range the suggestion will touch (insertions, replacements, deletions). Shift+Tab walks backwards.
- **Exit behavior**: Leaving the last range brings the caret back to its starting position so you can continue typing without applying the edit.

### Accepting Suggestions
- **Single keystroke acceptance**: `Tab` (from the original caret position) or `Enter` accepts the active suggestion and applies all edits in one undo stop.
- **Partial acceptance**: Not supported in the initial release—accepting applies every range previewed in the session. Discard (Escape) dismisses the entire suggestion.
- **Post-accept workflow**: After acceptance, the preview clears, the caret moves to the location where the edit leaves focus, and automatic follow-up (if enabled) can surface the next suggestion.

### Visualizing Different Edit Shapes
- **Single word replacement**: Inline ghost text overlays the word in a dimmed style with the replacement text shown ahead of the caret so you can compare both versions before applying.
- **Single line replacement**: The full line shows a muted diff—deleted text strikes through, and inserted text appears as ghost text aligned in place. Line gutters display a subtle change marker.
- **Multiline replacement**: Blocks wrap in a diff-style preview. Added lines use ghost text with faint background; removed lines appear collapsed with an inline badge indicating the count of lines that will be deleted.
- **Insertions**: Ghost text appears at the insertion point with a scaffolding caret to show where the text will land. A faint connector line links multi-range insertions.
- **Deletions**: Removed segments receive a translucent strike-through. The gutter shows a removal indicator, and the caret pauses on each deletion when tab-cycling ranges.

### Summary of Keyboard Shortcuts
- `Tab`: Jump to the next edit range or accept when invoked from the original caret position.
- `Shift+Tab`: Jump to the previous edit range.
- `Enter`: Accept the active suggestion without range navigation.
- `Escape`: Discard the current suggestion session.
