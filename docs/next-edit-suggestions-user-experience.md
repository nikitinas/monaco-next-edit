## Next Edit Suggestions – User Experience

This guide describes the Next Edit Suggestions experience from a user’s point of view: when suggestions appear, how to preview them, and what to expect when applying changes.

### Suggestion Lifecycle
- **Manual trigger**: Run `Predict Next Edit` (command or shortcut) to request suggestions for the current selection or caret position.
- **Idle invocation**: After roughly 1.5 s of inactivity in an area where a prior suggestion was accepted, the editor re-queries providers. A subtle pulse on the Tab badge indicates fresh suggestions without stealing focus.
- **Automatic follow-up**: Accepting a suggestion can prompt an immediate re-request so you can stay in flow; providers decide whether to provide follow-up edits.
- **Session lifetime**: A session stays active until you accept, discard, or type through any previewed range. Moving the caret outside the session cancels the preview.
- **Scope limit**: Each suggestion may include at most five lines of edits (combined insertions and deletions). Over-limit edits are truncated with guidance to refine the request.

### Previewing and Navigating
- **Tab traversal**: Press `Tab` to jump into the first edit range of the active suggestion; `Shift+Tab` walks backward. Each press advances to the next range so you can inspect insertions, replacements, or deletions in context.
- **Return to origin**: Leaving the final range returns the caret to its starting position so you can resume typing without applying the suggestion.
- **Grouped edits**: Repetitive changes (e.g., whitespace fixes) appear as a single inline preview with a “+N similar edits” badge. Tab cycling visits every occurrence before acceptance.

### Tab Widget Behavior
- **Inline badge**: While the caret sits on a range covered by the active suggestion, a pill-shaped `Tab` badge appears at the end of the line, signaling that Tab will move the caret into the preview.
- **Viewport hints**: If the next range sits above or below the visible area, the badge floats near the viewport edge with an arrow pointing toward the offscreen edit. Pressing `Tab` scrolls and positions the caret there.
- **Visibility rules**: The badge only shows during an active session, hides when you manually move the caret, and reappears when you return to the session anchor. Hover and keyboard focus amplify the badge so assistive tech announces “Press Tab to preview next edit.”

### Accepting and Post-Accept Flow
- **Single-step acceptance**: Press `Tab` from the original caret position to apply the active suggestion in a single undo stop. Escape discards the session; partial acceptance is not supported.
- **Grouped edits**: Accepting applies all ranges in the group. To skip subsets, discard and request a narrower suggestion.
- **Cursor placement**: If the applied edit leaves the caret inside the modified text, it stays there. When the next suggestion range is within three lines of the viewport, the editor automatically moves the caret forward; otherwise it waits for you to press `Tab`, with the floating badge indicating the destination.

### Visual Treatment of Edits
- **Word or token replacement**: Dimmed inline ghost text shows the proposed replacement ahead of the caret for direct comparison.
- **Single-line changes**: Entire lines display a muted diff—deleted text struck through, inserted text shown as ghost text—with a subtle gutter marker.
- **Multiline blocks**: Added lines appear with a faint background, removed sections collapse into a placeholder with a badge showing the number of deleted lines.
- **Insertions**: Ghost text renders at the insertion point with a scaffold caret; multi-range insertions connect via a faint guide line.
- **Deletions**: Removed spans display translucent strike-through styling, and Tab traversal pauses on each deletion for review.

### Keyboard Reference
- `Tab`: Preview the next range or accept when pressed from the origin.
- `Shift+Tab`: Move to the previous range in the session.
- `Escape`: Dismiss the current suggestion session.
