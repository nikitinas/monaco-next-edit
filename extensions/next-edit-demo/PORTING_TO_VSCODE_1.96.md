# Porting inlineCompletionsAdditions API to VS Code 1.96 Fork

## Difficulty Assessment: **LOW TO MODERATE** ✅

Porting the `inlineCompletionsAdditions` API from VS Code 1.99 to a 1.96 fork is **significantly easier** than porting to 1.80. The version gap is only ~3-4 months, meaning the architecture is nearly identical.

## Version Gap Analysis

- **Source**: VS Code 1.99 (March 2025)
- **Target**: VS Code 1.96 (circa December 2024 / January 2025)
- **Gap**: ~3-4 months of development
- **API Introduction**: 1.97 (February 2025) - just 1-2 versions ahead

## Key Advantages Over 1.80 Port

### ✅ **Architecture Compatibility**
- Editor model structure is **identical**
- Protocol serialization is **unchanged**
- Extension host architecture is **the same**
- View/rendering system is **compatible**

### ✅ **Minimal Changes Required**
- Most infrastructure already exists
- Just need to add the new API properties
- No architectural refactoring needed

### ✅ **Smaller Code Surface**
- Only need to add new properties to existing interfaces
- No major refactoring of existing code
- Can follow the same patterns as 1.99

---

## Components Required for Porting

### 1. **API Proposal System** (Low Complexity)

**Location**: `src/vs/platform/extensions/common/extensionsApiProposals.ts`

**What to add**:
```typescript
inlineCompletionsAdditions: {
    proposal: 'https://raw.githubusercontent.com/microsoft/vscode/main/src/vscode-dts/vscode.proposed.inlineCompletionsAdditions.d.ts',
}
```

**Status**: Should work identically to 1.99

**Effort**: ~30 minutes

---

### 2. **Extension Host API Layer** (Low-Medium Complexity)

**Location**: `src/vs/workbench/api/common/extHostLanguageFeatures.ts`

**Key Changes**:

#### a. InlineCompletionAdapter Class
- Add `_isAdditionsProposedApiEnabled` flag (same as 1.99)
- Check `isProposedApiEnabled(extension, 'inlineCompletionsAdditions')`
- Convert new properties: `isInlineEdit`, `showRange`, `displayLocation`

**Code to port** (~100 lines, identical to 1.99):
```typescript
// In constructor
this._isAdditionsProposedApiEnabled = isProposedApiEnabled(this._extension, 'inlineCompletionsAdditions');

// In provideInlineCompletions method
showRange: (this._isAdditionsProposedApiEnabled && item.showRange) 
    ? typeConvert.Range.from(item.showRange) 
    : undefined,
isInlineEdit: this._isAdditionsProposedApiEnabled ? item.isInlineEdit : false,
hint: (item.displayLocation && this._isAdditionsProposedApiEnabled) ? {
    range: typeConvert.Range.from(item.displayLocation.range),
    content: item.displayLocation.label,
    style: item.displayLocation.kind ? typeConvert.InlineCompletionHintStyle.from(item.displayLocation.kind) : languages.InlineCompletionHintStyle.Code,
    jumpToEdit: item.displayLocation.jumpToEdit ?? false,
} : undefined,
```

**Status**: Should work with minimal changes

**Effort**: ~2-3 hours

---

### 3. **Protocol Definitions** (Low Complexity)

**Location**: `src/vs/workbench/api/common/extHost.protocol.ts` or similar

**What to add**:
- `showRange?: IRange` to `IdentifiableInlineCompletion`
- `isInlineEdit?: boolean`
- `hint?: InlineCompletionHint`
- `enableForwardStability?: boolean`

**Status**: Protocol system is identical

**Effort**: ~1-2 hours

---

### 4. **Main Thread API Layer** (Low Complexity)

**Location**: `src/vs/workbench/api/browser/mainThreadLanguageFeatures.ts`

**What to add**:
- Forward new protocol properties to editor
- Handle `enableForwardStability` flag

**Status**: Should be straightforward

**Effort**: ~1-2 hours

---

### 5. **Editor Model Layer** (Low-Medium Complexity)

**Location**: `src/vs/editor/contrib/inlineCompletions/browser/model/`

#### a. Type Definitions (`src/vs/editor/common/languages.ts`)

**What to add**:
```typescript
export interface InlineCompletion {
    // ... existing properties ...
    readonly isInlineEdit?: boolean;
    readonly showInlineEditMenu?: boolean;
    readonly showRange?: IRange;
    readonly hint?: InlineCompletionHint;
    readonly correlationId?: string | undefined;
}

export interface InlineCompletionHint {
    range: IRange;
    style: InlineCompletionHintStyle;
    content: string;
    jumpToEdit: boolean;
}

export enum InlineCompletionHintStyle {
    Code = 1,
    Label = 2
}
```

**Status**: Just adding properties to existing interface

**Effort**: ~30 minutes

#### b. Data Conversion (`provideInlineCompletions.ts`)

**What to add**:
- Pass `isInlineEdit`, `showRange`, `hint` to `InlineSuggestData` constructor
- Update `toInlineSuggestData()` function

**Status**: Should work with minimal changes

**Effort**: ~1-2 hours

#### c. Model Logic (`inlineCompletionsModel.ts`)

**Critical Change** (~15 lines):
```typescript
// In _inlineCompletionItems derived
for (const completion of c.inlineCompletions) {
    if (!completion.isInlineEdit) {
        if (completion.isVisible(this.textModel, cursorPosition)) {
            visibleCompletions.push(completion);
        }
    } else {
        inlineEdit = completion;
    }
}
```

**Status**: Logic is straightforward, should work as-is

**Effort**: ~2-3 hours

#### d. Context Filtering (`inlineCompletionsSource.ts`)

**What to add**:
- Check `context.includeInlineEdits` flag
- Skip inline edits if flag is false

**Status**: Should be simple addition

**Effort**: ~1-2 hours

---

### 6. **View/Rendering Layer** (Medium Complexity)

**Location**: `src/vs/editor/contrib/inlineCompletions/browser/view/`

#### a. Display Location (Hint) Rendering

**Files to create/modify**:
- `inlineEdits/inlineEditsCustomView.ts` - Renders hint indicators
- `inlineEdits/inlineEditsView.ts` - Main view logic
- `inlineEdits/inlineEditsModel.ts` - View model

**What to implement**:
- Render `hint` (displayLocation) as visual indicator
- Position hint at `hint.range`
- Handle `jumpToEdit` behavior
- Style based on `InlineCompletionHintStyle`

**Status**: This is the most complex part, but architecture is compatible

**Effort**: ~4-6 hours (vs 8-12 for 1.80)

---

### 7. **Settings Support** (Low Complexity)

**Location**: Various settings files

**What to add**:
- `editor.inlineSuggest.edits.enabled` setting
- Default: `false` (opt-in)
- UI toggle in settings

**Status**: Settings system is identical

**Effort**: ~1-2 hours

---

### 8. **Type Definitions** (Low Complexity)

**Location**: `src/vscode-dts/vscode.proposed.inlineCompletionsAdditions.d.ts`

**What to add**:
- Copy the entire proposed API type definition file from 1.99
- Should work identically

**Effort**: ~30 minutes

---

## Total Effort Estimate

| Component | Complexity | Hours |
|-----------|-----------|-------|
| API Proposal System | Low | 0.5 |
| Extension Host Layer | Low-Medium | 2-3 |
| Protocol Definitions | Low | 1-2 |
| Main Thread Layer | Low | 1-2 |
| Editor Types | Low | 0.5 |
| Data Conversion | Low-Medium | 1-2 |
| Model Logic | Low-Medium | 2-3 |
| Context Filtering | Low | 1-2 |
| View/Rendering | Medium | **4-6** |
| Settings | Low | 1-2 |
| Type Definitions | Low | 0.5 |
| **TOTAL** | | **14-24 hours** |

**Realistic Estimate**: **15-20 hours** (including testing, debugging, edge cases)

---

## Comparison: 1.96 vs 1.80

| Aspect | 1.96 Port | 1.80 Port |
|--------|-----------|-----------|
| **Total Hours** | 15-20 | 35-50 |
| **Architecture Changes** | None | Possible |
| **Protocol Changes** | None | Possible |
| **Rendering Complexity** | Medium | High |
| **Risk Level** | Low | Medium-High |
| **Feasibility** | ✅ High | ⚠️ Moderate |

---

## Challenges & Risks

### 1. **Minor API Differences** (Low Risk)
- Some utility functions might have slightly different signatures
- Type conversion might need minor adjustments
- Easy to fix with small adaptations

### 2. **View/Rendering** (Medium Risk)
- Still the most complex part
- But architecture is compatible, so should be straightforward
- Can copy most code from 1.99

### 3. **Testing** (Low Risk)
- Architecture is identical, so testing should be straightforward
- Edge cases should be similar

### 4. **Missing Utilities** (Very Low Risk)
- All core utilities should exist
- `isProposedApiEnabled()` definitely exists
- Type conversion utilities are the same

---

## Recommended Approach

### Phase 1: Foundation (2-3 hours)
1. Add API proposal registration
2. Add type definitions
3. Add protocol definitions
4. Add basic extension host support

### Phase 2: Core Logic (4-6 hours)
1. Implement model layer changes
2. Add context filtering
3. Add data conversion
4. Basic `isInlineEdit` support

### Phase 3: Rendering (4-6 hours)
1. Implement hint rendering (can copy from 1.99)
2. Add viewport visibility checks
3. Handle `jumpToEdit` behavior
4. Style and UI polish

### Phase 4: Polish (2-3 hours)
1. Add settings support
2. Testing and bug fixes
3. Documentation

---

## Alternative: Minimal Port

If you only need **basic functionality** (without `displayLocation` rendering):

**Minimal Port** (~6-8 hours):
- ✅ API proposal registration
- ✅ Extension host layer
- ✅ Protocol definitions
- ✅ Model logic (`isInlineEdit` only)
- ❌ Skip `displayLocation` rendering (hint)
- ❌ Skip `showRange` (already not implemented)

This would give you:
- ✅ `isInlineEdit` support
- ✅ Basic next-edit suggestions
- ❌ No visual indicators (hint/displayLocation)
- ❌ No `showRange` filtering

---

## Copy-Paste Strategy

Since 1.96 and 1.99 are so close, you can:

1. **Copy entire files** from 1.99 where possible:
   - `vscode.proposed.inlineCompletionsAdditions.d.ts` - 100% copy
   - View rendering files - mostly copy with minor adaptations
   - Model logic - mostly copy

2. **Minimal modifications** needed:
   - Add properties to existing interfaces
   - Add checks in existing functions
   - Add new rendering components

3. **Test incrementally**:
   - Start with `isInlineEdit` only
   - Add `displayLocation` rendering
   - Add `showRange` (even though it's not used)

---

## Conclusion

**Difficulty**: **LOW TO MODERATE** (15-20 hours)

**Key Factors**:
- ✅ **Architecture is identical** - biggest advantage
- ✅ **Small version gap** - minimal changes
- ✅ **Can copy most code** from 1.99
- ✅ **Low risk** - well-understood changes
- ⚠️ **Rendering still complex** - but manageable

**Recommendation**: 
- ✅ **Highly feasible** - even for developers new to VS Code internals
- ✅ **Low risk** - architecture compatibility reduces risk significantly
- ✅ **Can be done incrementally** - start simple, add features
- ✅ **Good learning opportunity** - understand VS Code internals

---

## Quick Start Guide

1. **Copy type definitions** from 1.99:
   ```bash
   cp vscode-1.99/src/vscode-dts/vscode.proposed.inlineCompletionsAdditions.d.ts \
      vscode-1.96/src/vscode-dts/
   ```

2. **Add API proposal** to `extensionsApiProposals.ts`

3. **Port Extension Host layer** - copy relevant sections from 1.99

4. **Add editor model properties** - minimal changes

5. **Port rendering** - copy view files with adaptations

6. **Test incrementally** - verify each layer works

---

## Resources

1. **VS Code 1.99 Source**: Reference implementation
2. **VS Code 1.96 Source**: Your fork
3. **GitHub Issue**: #124024 (original proposal)
4. **Copilot Implementation**: Reference usage

