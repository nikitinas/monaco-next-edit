# Porting inlineCompletionsAdditions API to VS Code 1.80 Fork

## Difficulty Assessment: **MODERATE TO HIGH** ⚠️

Porting the `inlineCompletionsAdditions` API from VS Code 1.99 to a 1.80 fork requires implementing multiple layers of the VS Code architecture. This is a **non-trivial** effort that touches core editor functionality.

## Version Gap Analysis

- **Source**: VS Code 1.99 (March 2025)
- **Target**: VS Code 1.80 (circa 2023)
- **Gap**: ~17 months of development, multiple major versions

## Components Required for Porting

### 1. **API Proposal System** (Medium Complexity)

**Location**: `src/vs/platform/extensions/common/extensionsApiProposals.ts`

**What to add**:
```typescript
inlineCompletionsAdditions: {
    proposal: 'https://raw.githubusercontent.com/microsoft/vscode/main/src/vscode-dts/vscode.proposed.inlineCompletionsAdditions.d.ts',
}
```

**Dependencies**: 
- API proposal system must exist (likely present in 1.80)
- `isProposedApiEnabled()` function

**Effort**: ~1-2 hours (if proposal system exists)

---

### 2. **Extension Host API Layer** (High Complexity)

**Location**: `src/vs/workbench/api/common/extHostLanguageFeatures.ts`

**Key Changes**:

#### a. InlineCompletionAdapter Class
- Add `_isAdditionsProposedApiEnabled` flag
- Check `isProposedApiEnabled(extension, 'inlineCompletionsAdditions')`
- Convert `isInlineEdit`, `showRange`, `displayLocation` properties
- Handle `enableForwardStability` in `InlineCompletionList`

**Code to port** (~150 lines):
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

**Dependencies**:
- `isProposedApiEnabled()` function
- Type conversion utilities (`typeConvert`)
- Protocol definitions

**Effort**: ~4-6 hours

---

### 3. **Protocol Definitions** (Medium Complexity)

**Location**: `src/vs/workbench/api/common/extHost.protocol.ts` or similar

**What to add**:
- `showRange?: IRange` to `IdentifiableInlineCompletion`
- `isInlineEdit?: boolean`
- `hint?: InlineCompletionHint` (for displayLocation)
- `enableForwardStability?: boolean` to `IdentifiableInlineCompletions`

**Dependencies**: Protocol serialization system

**Effort**: ~2-3 hours

---

### 4. **Main Thread API Layer** (Medium Complexity)

**Location**: `src/vs/workbench/api/browser/mainThreadLanguageFeatures.ts`

**What to add**:
- Forward protocol properties to editor
- Handle `enableForwardStability` flag

**Effort**: ~2-3 hours

---

### 5. **Editor Model Layer** (High Complexity)

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

**Effort**: ~1 hour

#### b. Data Conversion (`provideInlineCompletions.ts`)

**What to add**:
- Pass `isInlineEdit`, `showRange`, `hint` to `InlineSuggestData` constructor
- Update `toInlineSuggestData()` function

**Effort**: ~2-3 hours

#### c. Model Logic (`inlineCompletionsModel.ts`)

**Critical Change** (~20 lines):
```typescript
// In _inlineCompletionItems derived
for (const completion of c.inlineCompletions) {
    if (!completion.isInlineEdit) {
        if (completion.isVisible(this.textModel, cursorPosition)) {
            visibleCompletions.push(completion);
        }
    } else {
        // OPTIONAL: Add showRange check here (currently not implemented in 1.99)
        // if (completion.showRange && !completion.showRange.containsPosition(cursorPosition)) {
        //     continue; // Skip if cursor not in showRange
        // }
        inlineEdit = completion;
    }
}
```

**Dependencies**:
- `InlineEditItem` class must support `isInlineEdit` property
- Context filtering for `includeInlineEdits`

**Effort**: ~4-6 hours

#### d. Context Filtering (`inlineCompletionsSource.ts`)

**What to add**:
- Check `context.includeInlineEdits` flag
- Skip inline edits if flag is false

**Effort**: ~2-3 hours

---

### 6. **View/Rendering Layer** (High Complexity)

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

**Dependencies**:
- Editor decoration/overlay system
- Viewport visibility checks

**Effort**: ~8-12 hours (most complex part)

---

### 7. **Settings Support** (Low Complexity)

**Location**: Various settings files

**What to add**:
- `editor.inlineSuggest.edits.enabled` setting
- Default: `false` (opt-in)
- UI toggle in settings

**Effort**: ~2-3 hours

---

### 8. **Type Definitions** (Low Complexity)

**Location**: `src/vscode-dts/vscode.proposed.inlineCompletionsAdditions.d.ts`

**What to add**:
- Copy the entire proposed API type definition file
- Ensure it matches the implementation

**Effort**: ~1 hour

---

## Total Effort Estimate

| Component | Complexity | Hours |
|-----------|-----------|-------|
| API Proposal System | Low | 1-2 |
| Extension Host Layer | High | 4-6 |
| Protocol Definitions | Medium | 2-3 |
| Main Thread Layer | Medium | 2-3 |
| Editor Types | Low | 1 |
| Data Conversion | Medium | 2-3 |
| Model Logic | High | 4-6 |
| Context Filtering | Medium | 2-3 |
| View/Rendering | **Very High** | **8-12** |
| Settings | Low | 2-3 |
| Type Definitions | Low | 1 |
| **TOTAL** | | **29-42 hours** |

**Realistic Estimate**: **35-50 hours** (including testing, debugging, edge cases)

---

## Challenges & Risks

### 1. **Architecture Changes** (High Risk)
- VS Code 1.80 may have different internal architecture
- Editor model structure may differ
- Protocol serialization may have changed

### 2. **Missing Dependencies** (Medium Risk)
- `isProposedApiEnabled()` may not exist in 1.80
- Type conversion utilities may differ
- Editor decoration system may be different

### 3. **View/Rendering Complexity** (High Risk)
- Most complex part of the port
- Requires deep understanding of VS Code's editor rendering
- May need to adapt to 1.80's rendering system

### 4. **Testing** (Medium Risk)
- Need to test all edge cases
- Ensure backward compatibility
- Verify performance impact

### 5. **showRange Not Implemented** (Low Risk)
- Even in 1.99, `showRange` filtering is not implemented
- You can skip this or implement it yourself
- Your extension already works around this

---

## Recommended Approach

### Phase 1: Foundation (8-10 hours)
1. Add API proposal registration
2. Add type definitions
3. Add protocol definitions
4. Add basic extension host support

### Phase 2: Core Logic (10-15 hours)
1. Implement model layer changes
2. Add context filtering
3. Add data conversion
4. Basic `isInlineEdit` support

### Phase 3: Rendering (12-18 hours)
1. Implement hint rendering
2. Add viewport visibility checks
3. Handle `jumpToEdit` behavior
4. Style and UI polish

### Phase 4: Polish (5-7 hours)
1. Add settings support
2. Testing and bug fixes
3. Documentation

---

## Alternative: Minimal Port

If you only need **basic functionality** (without `displayLocation` rendering):

**Minimal Port** (~15-20 hours):
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

## Conclusion

**Difficulty**: **MODERATE TO HIGH** (35-50 hours)

**Key Factors**:
- ✅ Well-documented API structure
- ✅ Clear separation of concerns
- ⚠️ Significant architecture changes possible
- ⚠️ View/rendering layer is complex
- ⚠️ Requires deep VS Code knowledge

**Recommendation**: 
- If you have VS Code core development experience: **Feasible**
- If you're new to VS Code internals: **Consider upgrading to 1.99+ instead**
- For minimal functionality: **15-20 hours is achievable**

---

## Resources

1. **VS Code Source Code**: Your fork at `/Users/Anatoly.Nikitin/Workspace/vscode`
2. **Reference Implementation**: Current 1.99 codebase
3. **GitHub Issue**: #124024 (original proposal)
4. **Copilot Implementation**: `/Users/Anatoly.Nikitin/Workspace/vscode-copilot-chat`

