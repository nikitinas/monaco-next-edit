# Inline Completions Presentation Modes

This document explains how inline completions are presented based on the combination of two experimental settings:

- `editor.inlineSuggest.edits.experimental.useMixedLinesDiff`
- `editor.inlineSuggest.edits.experimental.useInterleavedLinesDiff`

## Settings Overview

### `useMixedLinesDiff`

Controls whether to use inline diff rendering (mixed lines mode) when possible.

**Values:**

- `'never'` - Never use mixed lines diff mode
- `'whenPossible'` - Use mixed lines diff mode when the diff supports it
- `'afterJumpWhenPossible'` - Use mixed lines diff mode only after the user jumps to the suggestion and when the diff supports it

**Default:** `'never'`

### `useInterleavedLinesDiff`

Controls whether to use interleaved lines diff mode.

**Values:**

- `'never'` - Never use interleaved lines diff mode
- `'always'` - Always use interleaved lines diff mode when applicable
- `'afterJump'` - Use interleaved lines diff mode only after the user jumps to the suggestion

**Default:** `'never'`

## Presentation Mode Selection Logic

The editor selects a presentation mode based on the following priority order:

1. **Collapsed** - If the edit is collapsed
2. **Word Replacements** - If it's a single word replacement within one line
3. **Mixed Lines** - If `useMixedLinesDiff` allows it AND the diff supports inline rendering
4. **Interleaved Lines** - If `useInterleavedLinesDiff` allows it
5. **Side-by-Side** - Default fallback mode

### Mixed Lines Mode Prerequisites

Mixed lines mode requires that **all** diff mappings support inline diff rendering. A diff mapping supports inline diff rendering when:

- It has inner changes (character-level changes)
- All inner changes are single-line (both original and modified ranges are on single lines)

## Presentation Modes Explained

### 1. Mixed Lines Mode (`mixedLines`)

**When it's used:**

- `useMixedLinesDiff` is `'whenPossible'` OR (`'afterJumpWhenPossible'` AND user jumped to the suggestion)
- AND all diff mappings support inline diff rendering (single-line changes only)

**Visual appearance:**

- Deleted text is shown with **strikethrough** decoration in the original editor
- Inserted text appears **inline** right after the deleted text in the original editor
- Changes are highlighted with background colors (red for deletions, green for insertions)
- No separate preview editor is shown

**Example:**

```
Original: function calculate(x, y) {
Preview:  function compute(x, y, z) {
```

In mixed lines mode, you would see:

```
function ~~calculate~~compute(x, y, z) {
```

(where `calculate` is struck through and `compute` appears inline)

### 2. Interleaved Lines Mode (`interleavedLines`)

**When it's used:**

- `useInterleavedLinesDiff` is `'always'` OR (`'afterJump'` AND user jumped to the suggestion)
- AND mixed lines mode is not selected

**Visual appearance:**

- Deleted lines are shown in **view zones** inserted between the original lines
- The deleted code appears as a separate block with delete styling
- Modified lines appear below with insert styling
- Changes are displayed in an interleaved fashion (original → deleted → modified)

**Example:**

```
Original:
  function oldFunction() {
    return 1;
  }

Preview:
  function newFunction() {
    return 2;
  }
```

In interleaved lines mode, you would see:

```
  function oldFunction() {
    return 1;
  }
  [deleted code block shown here]
  function newFunction() {
    return 2;
  }
```

### 3. Side-by-Side Mode (`sideBySide`)

**When it's used:**

- Default fallback when neither mixed lines nor interleaved lines modes are selected
- OR when mixed lines mode prerequisites are not met

**Visual appearance:**

- A **separate preview editor** is displayed next to the original code
- Original code is shown on the left with delete decorations
- Modified code is shown in the preview editor on the right with insert decorations
- A visual connection (SVG path) links the original and modified sections
- The preview editor can be positioned dynamically based on content width and cursor position

**Example:**

```
[Original Editor]          [Preview Editor]
function old() {    →      function new() {
  return 1;                  return 2;
}                          }
```

## Setting Combinations Matrix

| `useMixedLinesDiff`     | `useInterleavedLinesDiff` | Result (when diff supports inline)                                           | Result (when diff doesn't support inline)                          |
| ----------------------- | ------------------------- | ---------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| `never`                 | `never`                   | **Side-by-Side**                                                             | **Side-by-Side**                                                   |
| `never`                 | `always`                  | **Interleaved Lines**                                                        | **Interleaved Lines**                                              |
| `never`                 | `afterJump`               | **Side-by-Side** (until jump) → **Interleaved Lines** (after jump)           | **Side-by-Side** (until jump) → **Interleaved Lines** (after jump) |
| `whenPossible`          | `never`                   | **Mixed Lines**                                                              | **Side-by-Side**                                                   |
| `whenPossible`          | `always`                  | **Mixed Lines** (takes priority)                                             | **Interleaved Lines**                                              |
| `whenPossible`          | `afterJump`               | **Mixed Lines** (takes priority)                                             | **Side-by-Side** (until jump) → **Interleaved Lines** (after jump) |
| `afterJumpWhenPossible` | `never`                   | **Side-by-Side** (until jump) → **Mixed Lines** (after jump)                 | **Side-by-Side**                                                   |
| `afterJumpWhenPossible` | `always`                  | **Side-by-Side** (until jump) → **Mixed Lines** (after jump, takes priority) | **Interleaved Lines**                                              |
| `afterJumpWhenPossible` | `afterJump`               | **Side-by-Side** (until jump) → **Mixed Lines** (after jump, takes priority) | **Side-by-Side** (until jump) → **Interleaved Lines** (after jump) |

## Important Notes

1. **Priority**: Mixed lines mode has higher priority than interleaved lines mode. If both settings allow their respective modes, mixed lines will be chosen (when prerequisites are met).

2. **User Interaction**: The `afterJump` and `afterJumpWhenPossible` values only activate their respective modes after the user explicitly jumps to/navigates to the inline suggestion.

3. **Diff Support**: Mixed lines mode requires that all changes are single-line. Multi-line changes will fall back to interleaved lines or side-by-side mode.

4. **Word Replacements**: Single word replacements within one line use a special "word replacements" mode that's separate from these settings.

5. **Collapsed State**: If an edit is collapsed, it always uses side-by-side mode regardless of these settings.

## Default Behavior

With default settings (`useMixedLinesDiff: 'never'`, `useInterleavedLinesDiff: 'never'`), all inline completions use **side-by-side** mode, showing a preview editor next to the original code.
