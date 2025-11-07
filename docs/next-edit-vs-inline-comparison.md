## Next Edit Suggestions API vs. Inline Completion APIs

This document captures a side-by-side comparison between the proposed Next Edit Suggestions API and both the stable VS Code inline completions surface and the current upstream proposal that augments inline completions. It highlights why a dedicated API remains advantageous for multi-range, predictive editing experiences.

| Feature | Next Edit Suggestions API (`vscode.nextEdits`) | Inline Completions (stable API) | Proposed Inline Completions Additions |
| --- | --- | --- | --- |
| Primary intent | Predictive “next edit” sessions with rich preview & acceptance flow | Caret-centric ghost text completion | Inline completion with richer host hints for AI copilots |
| Edit shape | `NextEditSuggestion` carries `NextEditTextEdit[]` (multi-range, insert/delete) | Single `InlineCompletionItem` text for one range (implicit insert/replace) | Still single-range `InlineCompletionItem`; `isInlineEdit` flag only |
| Deletions / replacements | Explicit via `edits` with empty `insertText` spans | Only implicit replace of provided range; no multi-span deletions | Same as stable; no multi-span deletion |
| Presentation control | `NextEditPreview` (ghost text options, emphasis ranges, diff overlays) | Host renders single ghost text at caret | `showRange`, `displayLocation`, optional inline menu toggle |
| Session lifecycle | `NextEditSuggestionSession` (active suggestion, cycling, accept/discard, `lastAcceptedSuggestionId`) | Stateless; host swaps suggestions per caret move | Lifetime callbacks (`handleEndOfLifetime`, `handleListEndOfLifetime`), but no shared session state context |
| Navigation | Tab traversal across suggestion ranges, grouped edits | Built-in partial accept (word/line) only | Same partial accept + optional `displayLocation.jumpToEdit`; no multi-range traversal |
| Acceptance semantics | Applies all edits in one undo stop via session `accept()` | Inserts accepted text at caret; relies on typing undo stack | Same as stable; additions only expose callbacks for partial/full accept |
| Conflict handling | Core recomputes previews when doc diverges; can re-request using context | Inline suggestion auto-dismisses on edit; no multi-span conflict strategy | No new conflict model beyond existing inline behavior |
| Follow-up triggers | `triggerKind`, `lastAcceptedSuggestionId` enable automatic re-queries | No notion of follow-up requests | No change |
| Streaming / refresh | `isIncomplete`, session refresh flow envisioned | `InlineCompletionList` can be updated via provider’s `onDidChange`, but per-item streaming limited | No streaming extension; new telemetry timestamps (`requestIssuedDateTime`, etc.) |
| Provider prioritization | Selector priority handled by service; session aware | Basic registration order | Metadata (`yieldTo`, `groupId`, `excludes`, `debounceDelayMs`) tunes request orchestration |
| Telemetry hooks | Session state + per-suggestion commands | None baked in | `correlationId`, lifecycle callbacks, warning payloads |
| Commands / actions | `commands` per suggestion | Command per inline item supported | Adds list-level commands with icons, inline menu action |
| Warnings / badges | Emphasis ranges, diff overlays defined by host | None | `InlineCompletionWarning` (message + icon) |
| Multi-editor coverage | Document + selection awareness, multi-range | Active caret only | Same as stable |
| Accessibility affordances | Tab badge, viewport hints owned by host proposal | Dependent on ghost text defaults | Labels via `displayLocation`, but no multi-range guidance |

### Why the Next Edit Suggestions API Remains Advantageous

- **Native support for multi-range edits**: Providers can describe coordinated insertions, deletions, and replacements across several ranges, which the inline completion surfaces still cannot apply or preview holistically.
- **Session-centric UX**: The API models an explicit suggestion session with lifecycle, navigation, and follow-up triggers, enabling sticky context (e.g., `lastAcceptedSuggestionId`) and automatic re-queries that keep developers in flow.
- **Rich preview instrumentation**: Hosts can render diff overlays, emphasis regions, grouped edit badges, and Tab traversal affordances tied to the session—a UX that goes beyond caret ghost text.
- **Consistent acceptance semantics**: Accepting a suggestion applies all edits as a single undo stop and handles conflict resolution when the user types through a previewed range.
- **Extension ergonomics**: Providers receive structured context, telemetry hooks, and command integration tailored for predictive editing without overloading the inline completion pipeline or breaking existing extensions.

Together, these advantages let the Next Edit Suggestions API deliver a dedicated, predictable experience for multi-edit predictions while still allowing inline completions to excel at lightweight single-caret suggestions.
