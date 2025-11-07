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

### Tab Navigation Widget
- **Inline badge**: A pill-shaped `Tab` badge appears at the right edge of the current line whenever the active suggestion has an edit at the caret position. Its presence signals that pressing `Tab` will jump into a previewed edit.
- **Viewport jump hints**: When the next edit range falls above or below the visible viewport, the badge detaches and floats near the top or bottom edge of the editor with an arrow indicating the direction of travel. Pressing `Tab` scrolls the editor to reveal that range and places the caret there.
- **Visibility rules**: The widget only renders while a suggestion session is active, hides if you move the caret manually, and reappears when you return to the session’s anchor position.
- **Focus states**: Hovering or keyboard focus emphasizes the badge so screen readers announce “Press Tab to preview next edit.”

### Handling Groups of Similar Edits
- **Batch previews**: The UI summarizes repetitive edits—such as whitespace or punctuation fixes across several lines—by showing one inline preview and a badge like “+3 similar edits.” Pressing `Tab` cycles through every occurrence so you can spot-check before acceptance.
- **Line-count limit**: Suggestions may include at most five lines of changes (sum of insertions and deletions). If a provider returns more, the editor truncates the preview to the first five lines and presents a tooltip suggesting you rerun the provider with narrower scope.
- **Acceptance granularity**: Accepting a summarized suggestion applies all grouped edits together. If you need finer control, discard and request targeted edits for the subset you want.

### Post-Accept Cursor Behavior
- **Automatic advance**: When the accepted edit leaves the caret inside the modified range (e.g., text inserted at the caret), the cursor remains at that location. If another edit from the same session is pending and sits within three lines of the current view, the editor automatically positions the cursor at the next edit to maintain flow.
- **Manual confirmation**: If the next edit is outside the current viewport or belongs to a different file/language block, the editor keeps the caret at the end of the applied edit and waits for you to press `Tab` to navigate. The Tab widget floats to indicate where you’ll move next.

### Accepting Suggestions
- **Single keystroke acceptance**: Pressing `Tab` from the original caret position applies the active suggestion in a single undo stop.
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
- `Escape`: Discard the current suggestion session.
