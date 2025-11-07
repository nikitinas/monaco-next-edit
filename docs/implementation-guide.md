# VS Code Next Edit Suggestions API - Implementation Guide

This guide explains how to implement the Next Edit Suggestions API in a VS Code fork. The API allows extensions to provide predictive edit suggestions that are displayed as ghost text in the editor.

## Table of Contents

1. [Overview](#overview)
2. [API Structure](#api-structure)
3. [Architecture](#architecture)
4. [Implementation Steps](#implementation-steps)
5. [User Experience Requirements](#user-experience-requirements)
6. [Key Components](#key-components)
7. [Integration Points](#integration-points)
8. [Example Implementation](#example-implementation)

## Overview

The Next Edit Suggestions API enables extensions to provide predictive edit suggestions that appear as ghost text in the editor. Unlike inline completions (which suggest text at the cursor) or code actions (which require explicit invocation), this API allows extensions to predict the next meaningful edit based on context.

### Key Features

- **Ghost text display**: Suggestions appear as inline ghost text, similar to inline completions
- **Multi-range edits**: Supports suggestions that span multiple ranges (insertions and deletions)
- **Event-driven**: Extensions register providers and listen to acceptance/discard events
- **Simple API**: Minimal surface area - extensions provide edits, VS Code handles rendering
- **Session UX guarantees**: Idle refresh, adaptive cooldowns, and Tab badge navigation keep the user in flow without stealing focus
- **Rich previews**: Ghost text previews cover replacements, insertions, deletions, and grouped edits with consistent visual treatments

## API Structure

The API is located under `vscode.languages` namespace:

```typescript
export namespace vscode.languages {
  // Register a provider
  export function registerEditSuggestionProvider(
    selector: DocumentSelector,
    provider: EditSuggestionProvider
  ): Disposable;

  // Events
  export const onDidAcceptEditSuggestion: Event<EditSuggestionAcceptedEvent>;
  export const onDidDiscardEditSuggestions: Event<EditSuggestionsDiscardedEvent>;
}
```

### Core Interfaces

- **`EditSuggestionProvider`**: Extension implements this to provide suggestions
- **`EditSuggestion`**: Contains `id` and `edits` (array of `TextEdit`)
- **`EditSuggestionList`**: Returned by provider, contains suggestions and optional `isIncomplete` flag
- **`EditSuggestionContext`**: Provides trigger kind and last accepted suggestion ID

## Architecture

### High-Level Flow

1. **Registration**: Extension calls `vscode.languages.registerEditSuggestionProvider()` to register a provider
2. **Invocation**: VS Code invokes the provider (manually via command or automatically via heuristics)
3. **Rendering**: VS Code displays suggestions as ghost text using editor decorations
4. **Interaction**: User can accept (Tab/Enter) or discard (Escape) suggestions
5. **Events**: VS Code fires events when suggestions are accepted or discarded

### Component Responsibilities

- **Extension Host**: Manages provider registration and bridges to extension host
- **Editor Service**: Manages active suggestion sessions, handles user interactions
- **Editor Widget**: Renders ghost text using Monaco decorations
- **Extension API**: Exposes `vscode.languages` namespace to extensions

## Implementation Steps

### Step 1: Add Type Definitions

Add the API type definitions to VS Code's extension API:

**File**: `src/vscode-dts/vscode.d.ts`

Add the following interfaces and namespace declarations:

```typescript
export namespace languages {
  // ... existing language APIs ...

  export function registerEditSuggestionProvider(
    selector: DocumentSelector,
    provider: EditSuggestionProvider
  ): Disposable;

  export const onDidAcceptEditSuggestion: Event<EditSuggestionAcceptedEvent>;
  export const onDidDiscardEditSuggestions: Event<EditSuggestionsDiscardedEvent>;
}

export interface EditSuggestionProvider {
  readonly id: string;
  provideEditSuggestions(
    document: TextDocument,
    selection: Selection,
    context: EditSuggestionContext,
    token: CancellationToken
  ): ProviderResult<EditSuggestionList>;
}

export interface EditSuggestion {
  readonly id: string;
  readonly edits: readonly TextEdit[];
}

export interface EditSuggestionList {
  readonly suggestions: readonly EditSuggestion[];
  readonly isIncomplete?: boolean;
}

export interface EditSuggestionContext {
  readonly triggerKind: EditSuggestionTriggerKind;
  readonly lastAcceptedSuggestionId?: string;
}

export const enum EditSuggestionTriggerKind {
  Invoke = 0,
  Automatic = 1,
}

export interface EditSuggestionAcceptedEvent {
  readonly suggestion: EditSuggestion;
}

export interface EditSuggestionsDiscardedEvent {
  readonly suggestions: readonly EditSuggestion[];
}
```

### Step 2: Create Extension Host Service

Create a service in the extension host to manage providers:

**File**: `src/vs/workbench/api/common/extHostEditSuggestions.ts`

```typescript
import { IExtHostRpcService } from "vs/workbench/api/common/extHostRpcService";
import { ExtHostDocuments } from "vs/workbench/api/common/extHostDocuments";
import { ExtHostDocumentData } from "vs/workbench/api/common/extHostDocumentData";
import * as vscode from "vscode";

export class ExtHostEditSuggestions {
  private providers = new Map<string, vscode.EditSuggestionProvider>();
  private disposables: vscode.Disposable[] = [];

  constructor(
    private readonly rpc: IExtHostRpcService,
    private readonly documents: ExtHostDocuments
  ) {}

  registerEditSuggestionProvider(
    selector: vscode.DocumentSelector,
    provider: vscode.EditSuggestionProvider
  ): vscode.Disposable {
    // Register provider with main thread
    const handle = this.rpc.getProxy(MainContext.MainThreadEditSuggestions);
    handle.$registerProvider(provider.id, selector);

    this.providers.set(provider.id, provider);

    return new vscode.Disposable(() => {
      this.providers.delete(provider.id);
      handle.$unregisterProvider(provider.id);
    });
  }

  async $provideEditSuggestions(
    providerId: string,
    uri: string,
    selection: vscode.Selection,
    context: vscode.EditSuggestionContext,
    token: vscode.CancellationToken
  ): Promise<vscode.EditSuggestionList | undefined> {
    const provider = this.providers.get(providerId);
    if (!provider) {
      return undefined;
    }

    const document = this.documents.getDocument(uri);
    if (!document) {
      return undefined;
    }

    return provider.provideEditSuggestions(
      document.document,
      selection,
      context,
      token
    );
  }
}
```

### Step 3: Create Main Thread Service

Create a service in the main thread to coordinate with editors:

**File**: `src/vs/workbench/api/browser/mainThreadEditSuggestions.ts`

```typescript
import {
  MainContext,
  MainThreadEditSuggestionsShape,
} from "vs/workbench/api/common/extHost.protocol";
import { IExtHostContext } from "vs/workbench/api/common/extHost.protocol";
import { IEditSuggestionService } from "vs/workbench/contrib/editSuggestions/common/editSuggestionService";

export class MainThreadEditSuggestions
  implements MainThreadEditSuggestionsShape
{
  constructor(
    private readonly extHostContext: IExtHostContext,
    private readonly editSuggestionService: IEditSuggestionService
  ) {
    // Register extension host proxy
    const proxy = extHostContext.getProxy(MainContext.ExtHostEditSuggestions);

    // Bridge extension host to main thread service
    this.editSuggestionService.setExtensionHostProxy(proxy);
  }

  $registerProvider(
    providerId: string,
    selector: vscode.DocumentSelector
  ): void {
    this.editSuggestionService.registerExtensionProvider(providerId, selector);
  }

  $unregisterProvider(providerId: string): void {
    this.editSuggestionService.unregisterExtensionProvider(providerId);
  }
}
```

### Step 4: Create Core Service

Create the core service that manages suggestion sessions:

The service is also responsible for enforcing the UX contract described in `docs/next-edit-suggestions-user-experience.md`:

- Track the most recent suggestion signature so you can suppress identical re-prompts during the adaptive cooldown window (default 60 s).
- Coordinate idle invocation timers (~1.5 s after user inactivity) and immediate follow-up requests after an acceptance.
- Respect scope limits by truncating edits that exceed five combined lines and attaching guidance metadata for the controller to display.
- Remember the session anchor (caret and selection) so the controller can determine whether a Tab press should preview ranges or perform a single-step acceptance.

**File**: `src/vs/workbench/contrib/editSuggestions/common/editSuggestionService.ts`

```typescript
import { Emitter, Event } from "vs/base/common/event";
import { Disposable } from "vs/base/common/lifecycle";
import { CancellationToken } from "vs/base/common/cancellation";
import { ITextModel } from "vs/editor/common/model";
import { Selection } from "vs/editor/common/core/selection";
import type { DocumentSelector } from "vscode";
import {
  EditSuggestion,
  EditSuggestionList,
  EditSuggestionContext,
  EditSuggestionTriggerKind,
} from "vs/workbench/contrib/editSuggestions/common/editSuggestionTypes";
import { EditSuggestionSession } from "./editSuggestionSession";

export interface IEditSuggestionService {
  readonly onDidAcceptSuggestion: Event<EditSuggestionAcceptedEvent>;
  readonly onDidDiscardSuggestions: Event<EditSuggestionsDiscardedEvent>;

  setExtensionHostProxy(proxy: any): void;
  registerExtensionProvider(
    providerId: string,
    selector: DocumentSelector
  ): void;
  unregisterExtensionProvider(providerId: string): void;
  invoke(
    model: ITextModel,
    selection: Selection,
    triggerKind: EditSuggestionTriggerKind
  ): Promise<EditSuggestionSession | undefined>;
  getActiveSession(model: ITextModel): EditSuggestionSession | undefined;
}

export class EditSuggestionService
  extends Disposable
  implements IEditSuggestionService
{
  private readonly _onDidAcceptSuggestion =
    new Emitter<EditSuggestionAcceptedEvent>();
  readonly onDidAcceptSuggestion = this._onDidAcceptSuggestion.event;

  private readonly _onDidDiscardSuggestions =
    new Emitter<EditSuggestionsDiscardedEvent>();
  readonly onDidDiscardSuggestions = this._onDidDiscardSuggestions.event;

  private readonly providers = new Map<
    string,
    { selector: DocumentSelector; extensionHost: any }
  >();
  private readonly activeSessions = new Map<ITextModel, EditSuggestionSession>();
  private readonly suggestionSignatures = new Map<string, string>();
  private readonly cooldownBySignature = new Map<string, number>();
  private readonly cooldownDurationMs = 60_000;
  private readonly maxPreviewLines = 5;
  private lastAcceptedSuggestionId: string | undefined;
  private extensionHostProxy: any;

  setExtensionHostProxy(proxy: any): void {
    this.extensionHostProxy = proxy;
  }

  registerExtensionProvider(
    providerId: string,
    selector: DocumentSelector
  ): void {
    if (!this.extensionHostProxy) {
      throw new Error("Extension host proxy not initialized");
    }

    this.providers.set(providerId, {
      selector,
      extensionHost: this.extensionHostProxy,
    });
  }

  unregisterExtensionProvider(providerId: string): void {
    this.providers.delete(providerId);
  }

  getActiveSession(model: ITextModel): EditSuggestionSession | undefined {
    return this.activeSessions.get(model);
  }

  async invoke(
    model: ITextModel,
    selection: Selection,
    triggerKind: EditSuggestionTriggerKind
  ): Promise<EditSuggestionSession | undefined> {
    const provider = this.findProvider(model);
    if (!provider) {
      return undefined;
    }

    this.disposeSession(model);

    const context: EditSuggestionContext = {
      triggerKind,
      lastAcceptedSuggestionId: this.lastAcceptedSuggestionId,
    };

    const response = await provider.extensionHost.$provideEditSuggestions(
      provider.id,
      model.uri.toString(),
      selection,
      context,
      CancellationToken.None
    );

    if (!response || !response.suggestions.length) {
      return undefined;
    }

    const suggestions = this.normalizeSuggestions(response, model);
    if (!suggestions.length) {
      return undefined;
    }

    const session = new EditSuggestionSession(model, suggestions);
    this.activeSessions.set(model, session);

    return session;
  }

  private findProvider(
    model: ITextModel
  ): { id: string; extensionHost: any } | undefined {
    for (const [id, provider] of this.providers) {
      if (this.matchesSelector(model, provider.selector)) {
        return { id, extensionHost: provider.extensionHost };
      }
    }
    return undefined;
  }

  private matchesSelector(
    model: ITextModel,
    selector: DocumentSelector
  ): boolean {
    // Implement document selector matching logic similar to other language features.
    return true;
  }

  acceptSuggestion(suggestion: EditSuggestion, model: ITextModel): void {
    const edits = suggestion.edits.map((edit) => ({
      range: this.toEditorRange(edit.range),
      text: edit.newText,
    }));

    model.pushEditOperations([], edits, () => null);

    this._onDidAcceptSuggestion.fire({ suggestion });
    this.lastAcceptedSuggestionId = suggestion.id;

    const signature = this.suggestionSignatures.get(suggestion.id);
    if (signature) {
      this.cooldownBySignature.delete(signature);
      this.suggestionSignatures.delete(suggestion.id);
    }

    this.disposeSession(model);
  }

  discardSuggestions(suggestions: EditSuggestion[], model: ITextModel): void {
    this._onDidDiscardSuggestions.fire({ suggestions });

    const now = Date.now();
    for (const suggestion of suggestions) {
      const signature = this.suggestionSignatures.get(suggestion.id);
      if (signature) {
        this.cooldownBySignature.set(signature, now + this.cooldownDurationMs);
        this.suggestionSignatures.delete(suggestion.id);
      }
    }

    this.disposeSession(model);
  }

  private normalizeSuggestions(
    list: EditSuggestionList,
    model: ITextModel
  ): EditSuggestion[] {
    const now = Date.now();
    const normalized: EditSuggestion[] = [];

    for (const suggestion of list.suggestions) {
      const constrained = this.enforceScopeLimit(suggestion);
      const signature = this.computeSignature(constrained, model);

      if (this.isOnCooldown(signature, now)) {
        continue;
      }

      normalized.push(constrained);
      this.suggestionSignatures.set(constrained.id, signature);
    }

    return normalized;
  }

  private enforceScopeLimit(suggestion: EditSuggestion): EditSuggestion {
    let remaining = this.maxPreviewLines;
    const edits: EditSuggestion["edits"] = [];
    let truncated = false;

    for (const edit of suggestion.edits) {
      const impact = this.countLineImpact(edit);
      if (impact <= remaining) {
        edits.push(edit);
        remaining -= impact;
      } else {
        truncated = true;
        break;
      }
    }

    if (!truncated) {
      return suggestion;
    }

    const truncatedSuggestion = {
      ...suggestion,
      edits,
    } as EditSuggestion & { detail?: string };

    const existingDetail =
      (suggestion as unknown as { detail?: string }).detail ?? "";
    truncatedSuggestion.detail = `${existingDetail} (preview truncated to ${this.maxPreviewLines} lines)`.trim();

    return truncatedSuggestion;
  }

  private countLineImpact(
    edit: EditSuggestion["edits"][number]
  ): number {
    const deleted =
      edit.range.endLineNumber - edit.range.startLineNumber + 1;
    const inserted = Math.max(edit.newText.split(/\r\n|\r|\n/).length, 1);
    return Math.max(deleted, inserted);
  }

  private computeSignature(
    suggestion: EditSuggestion,
    model: ITextModel
  ): string {
    const fragments = suggestion.edits.map((edit) => {
      const before = model.getValueInRange(edit.range);
      return [
        edit.range.startLineNumber,
        edit.range.startColumn,
        edit.range.endLineNumber,
        edit.range.endColumn,
        before,
        edit.newText,
      ].join(":");
    });

    return `${suggestion.id}|${fragments.join("|")}`;
  }

  private isOnCooldown(signature: string, now: number): boolean {
    const expiry = this.cooldownBySignature.get(signature);
    return !!expiry && expiry > now;
  }

  private disposeSession(model: ITextModel): void {
    const session = this.activeSessions.get(model);
    if (!session) {
      return;
    }

    for (const suggestion of session.suggestions) {
      this.suggestionSignatures.delete(suggestion.id);
    }

    session.dispose();
    this.activeSessions.delete(model);
  }
}
```

### Step 5: Create Editor Integration

Integrate with the editor to render ghost text:

The controller bridges UX behaviors into Monaco. In addition to ghost text, it must:

- Drive Tab traversal (`Tab` forward, `Shift+Tab` backward) and differentiate between previewing ranges vs. single-step acceptance from the origin.
- Surface the inline Tab badge and viewport hints via editor decorations so users always know how to reveal the next range.
- Handle grouped edits by cycling through every range before accepting, keeping the caret anchored to the session origin when previews finish.
- Reschedule idle invocations on caret movement or typing so the service can fetch fresh suggestions without stealing focus.
- Respect Escape to discard, manual caret moves to suspend the badge, and selection changes that leave the session scope.

**File**: `src/vs/workbench/contrib/editSuggestions/browser/editSuggestionController.ts`

```typescript
import { ICodeEditor } from "vs/editor/browser/editorBrowser";
import { IEditSuggestionService } from "../common/editSuggestionService";
import { Disposable } from "vs/base/common/lifecycle";
import {
  IModelDeltaDecoration,
  TrackedRangeStickiness,
} from "vs/editor/common/model";
import { ModelDecorationOptions } from "vs/editor/common/model/textModel";
import { KeyCode } from "vs/base/common/keyCodes";
import { Selection } from "vs/editor/common/core/selection";
import { EditSuggestionTriggerKind } from "../common/editSuggestionTypes";

const tabBadgeDecoration: ModelDecorationOptions = {
  description: "next-edit-suggestion-tab-badge",
  className: "edit-suggestion-tab-badge",
  stickiness: TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges,
};

export class EditSuggestionController extends Disposable {
  private session: EditSuggestionSession | undefined;
  private decorations: string[] = [];
  private tabBadgeDecorations: string[] = [];
  private sessionAnchor: Selection | undefined;
  private idleInvocationHandle: ReturnType<typeof setTimeout> | undefined;

  constructor(
    private readonly editor: ICodeEditor,
    private readonly editSuggestionService: IEditSuggestionService
  ) {
    super();

    this._register(
      this.editSuggestionService.onDidAcceptSuggestion((e) => {
        if (this.session?.hasSuggestion(e.suggestion)) {
          this.clearDecorations();
          this.session = undefined;
          this.scheduleIdleInvocation(true);
        }
      })
    );

    this._register(
      this.editor.onKeyDown((e) => {
        if (!this.session) {
          return;
        }

        if (e.keyCode === KeyCode.Tab) {
          if (e.shiftKey) {
            this.previewPreviousRange();
          } else if (this.isCaretAtOrigin()) {
            this.accept();
          } else {
            this.previewNextRange();
          }
          e.preventDefault();
        } else if (e.keyCode === KeyCode.Escape) {
          this.discard();
          e.preventDefault();
        }
      })
    );

    this._register(
      this.editor.onDidChangeCursorPosition(() => {
        this.updateTabBadge();
        this.scheduleIdleInvocation();
      })
    );

    this._register(
      this.editor.onDidType(() => {
        this.scheduleIdleInvocation();
      })
    );
  }

  async invoke(triggerKind: EditSuggestionTriggerKind): Promise<void> {
    const model = this.editor.getModel();
    const selection = this.editor.getSelection();
    if (!model || !selection) {
      return;
    }

    if (triggerKind === EditSuggestionTriggerKind.Invoke) {
      this.sessionAnchor = selection;
    }

    this.session = await this.editSuggestionService.invoke(
      model,
      selection,
      triggerKind
    );

    if (this.session) {
      this.session.resetNavigation();
      this.renderSuggestions();
      this.updateTabBadge();
    } else {
      this.clearDecorations();
    }
  }

  private scheduleIdleInvocation(force = false): void {
    if (this.idleInvocationHandle) {
      clearTimeout(this.idleInvocationHandle);
      this.idleInvocationHandle = undefined;
    }

    if (!force && this.session?.isWithinPreview(this.editor.getSelection())) {
      return;
    }

    // Use VS Code's runOnceScheduler or equivalent in production.
    this.idleInvocationHandle = setTimeout(() => {
      void this.invoke(EditSuggestionTriggerKind.Automatic);
    }, 1500);
  }

  private renderSuggestions(): void {
    const model = this.editor.getModel();
    if (!this.session || !model) {
      return;
    }

    const decorations: IModelDeltaDecoration[] =
      this.session.buildPreviewDecorations();

    this.decorations = model.deltaDecorations(this.decorations, decorations);
  }

  private previewNextRange(): void {
    this.session?.focusNextRange(this.editor);
  }

  private previewPreviousRange(): void {
    this.session?.focusPreviousRange(this.editor);
  }

  private isCaretAtOrigin(): boolean {
    const selection = this.editor.getSelection();
    return (
      !!selection &&
      !!this.sessionAnchor &&
      selection.equalsSelection(this.sessionAnchor)
    );
  }

  private updateTabBadge(): void {
    const model = this.editor.getModel();
    if (!model) {
      this.tabBadgeDecorations = [];
      return;
    }

    if (!this.session) {
      this.tabBadgeDecorations = model.deltaDecorations(
        this.tabBadgeDecorations,
        []
      );
      return;
    }

    // If the active range is offscreen, render a floating badge with directional arrow.
    this.tabBadgeDecorations = model.deltaDecorations(
      this.tabBadgeDecorations,
      this.session.buildTabBadgeDecorations(tabBadgeDecoration)
    );
  }

  private accept(): void {
    const model = this.editor.getModel();
    const active = this.session?.activeSuggestion;
    if (!model || !active) {
      return;
    }

    this.editSuggestionService.acceptSuggestion(active, model);
    this.session = undefined;
    this.sessionAnchor = undefined;
    this.clearDecorations();
  }

  private discard(): void {
    const model = this.editor.getModel();
    if (!model || !this.session) {
      return;
    }

    this.editSuggestionService.discardSuggestions(
      this.session.suggestions,
      model
    );
    this.session = undefined;
    this.sessionAnchor = undefined;
    this.clearDecorations();
  }

  private clearDecorations(): void {
    const model = this.editor.getModel();
    if (!model) {
      return;
    }

    model.deltaDecorations(this.decorations, []);
    model.deltaDecorations(this.tabBadgeDecorations, []);
    this.decorations = [];
    this.tabBadgeDecorations = [];
  }
}
```

### Step 6: Register Services

Register services in the workbench:

**File**: `src/vs/workbench/contrib/editSuggestions/browser/editSuggestions.contribution.ts`

```typescript
import { registerSingleton } from "vs/platform/instantiation/common/extensions";
import { IEditSuggestionService } from "../common/editSuggestionService";
import { EditSuggestionService } from "../common/editSuggestionService";

registerSingleton(IEditSuggestionService, EditSuggestionService, true);
```

### Step 7: Add Commands

Add commands to invoke suggestions:

**File**: `src/vs/workbench/contrib/editSuggestions/browser/editSuggestionsCommands.ts`

```typescript
import { ICommandService } from "vs/platform/commands/common/commands";
import { ICodeEditorService } from "vs/editor/browser/services/codeEditorService";
import { IEditSuggestionService } from "../common/editSuggestionService";
import { EditSuggestionTriggerKind } from "../common/editSuggestionTypes";

CommandsRegistry.registerCommand(
  "editor.action.invokeEditSuggestions",
  async (accessor) => {
    const editorService = accessor.get(ICodeEditorService);
    const editSuggestionService = accessor.get(IEditSuggestionService);

    const editor = editorService.getFocusedCodeEditor();
    if (!editor) {
      return;
    }

    const controller = EditSuggestionController.get(editor);
    if (controller) {
      await controller.invoke(EditSuggestionTriggerKind.Invoke);
    }
  }
);
```

### Step 8: Add CSS Styling

Add CSS for ghost text display:

**File**: `src/vs/workbench/contrib/editSuggestions/browser/editSuggestions.css`

```css
.monaco-editor .edit-suggestion-ghost-text {
  color: rgba(148, 163, 184, 0.65);
  font-style: italic;
}

.monaco-editor .edit-suggestion-ghost-text::after {
  content: attr(data-ghost-text);
}

.monaco-editor .edit-suggestion-replace {
  text-decoration: line-through;
  color: rgba(148, 163, 184, 0.7);
}

.monaco-editor .edit-suggestion-delete {
  text-decoration: line-through;
  opacity: 0.45;
}

.monaco-editor .edit-suggestion-tab-badge::after {
  content: "Tab";
  display: inline-block;
  padding: 0 0.5rem;
  border-radius: 999px;
  background: rgba(99, 102, 241, 0.18);
  color: rgba(99, 102, 241, 0.9);
  font-size: 0.75rem;
  font-weight: 600;
}

.monaco-editor .edit-suggestion-tab-badge {
  position: absolute;
  transform: translateX(0.25rem);
}
```

## User Experience Requirements

The UX contract defined in `docs/next-edit-suggestions-user-experience.md` is normative. Engineering work should treat the following behaviors as acceptance criteria:

### Invocation Lifecycle
- **Manual trigger**: `editor.action.invokeEditSuggestions` must request suggestions immediately for the current caret/selection.
- **Idle invocation**: After ~1.5 s of inactivity (cursor movement or typing), invoke providers again unless an adaptive cooldown is in effect.
- **Automatic follow-up**: When a suggestion is accepted, schedule a follow-up request right away so the user can stay in flow.
- **Session lifetime**: Cancel the session if the user types through any previewed range, presses Escape, or leaves the anchor selection.
- **Scope limit**: Enforce the five-line limit per suggestion. Truncate additional edits and surface guidance in the preview badge.
- **Adaptive cooldown**: Track suggestion signatures (ID + ranges + text). If the same suggestion is dismissed twice consecutively, suppress auto re-requests for 60 s or until the surrounding buffer changes.

### Previewing and Navigation
- **Tab traversal**: `Tab` moves forward through preview ranges, `Shift+Tab` moves backward. Each press focuses the next range and reveals it in the viewport.
- **Return to origin**: Cycling past the final range returns the caret to the anchor so the user can type without committing.
- **Grouped edits**: All ranges in a grouped suggestion must be previewed before acceptance; use a counter badge such as “+N similar edits.”

### Tab Widget Behavior
- **Inline badge**: Render a pill-shaped Tab badge at the end of the active range while the caret sits on the anchor line.
- **Viewport hints**: When the next range is offscreen, float the badge near the viewport edge with an arrow to the destination; jumping should animate the scroll.
- **Visibility rules**: Hide the badge when the user moves away from the anchor, reshow it when they return, and expose accessible announcements (e.g., aria-label “Press Tab to preview next edit”).

### Accepting and Post-Accept Flow
- **Single-step acceptance**: From the anchor, pressing Tab applies the active suggestion in one undo stop. Escape discards the entire session.
- **Cursor placement**: Keep the caret inside the applied edit when appropriate. If the follow-up range is within three lines, advance the caret automatically; otherwise leave it and rely on the floating badge.

### Visual Treatments
- **Replacements**: Strike through the existing text and show the replacement as ghost text aligned with the existing content.
- **Insertions**: Show ghost text with a scaffold caret; connect multi-range insertions with subtle guide lines.
- **Deletions**: Use translucent strike-through styling and pause Tab traversal on each deletion.
- **Multiline blocks**: Apply faint block backgrounds for additions and collapsible placeholders for removed sections so the diff remains scannable.

## Key Components

### EditSuggestionSession

Manages an active suggestion session for a specific editor:

```typescript
import { Disposable } from "vs/base/common/lifecycle";
import { ICodeEditor } from "vs/editor/browser/editorBrowser";
import {
  IModelDeltaDecoration,
  ITextModel,
  TrackedRangeStickiness,
} from "vs/editor/common/model";
import { Range } from "vs/editor/common/core/range";
import { Selection } from "vs/editor/common/core/selection";
import { ModelDecorationOptions } from "vs/editor/common/model/textModel";
import { EditSuggestion } from "vs/workbench/contrib/editSuggestions/common/editSuggestionTypes";

interface PreviewEntry {
  suggestion: EditSuggestion;
  editIndex: number;
  range: Range;
  newText: string;
  isDeletion: boolean;
}

export class EditSuggestionSession extends Disposable {
  private readonly previewEntries: PreviewEntry[];
  private activeIndex = 0;

  constructor(
    private readonly model: ITextModel,
    public readonly suggestions: EditSuggestion[]
  ) {
    super();
    this.previewEntries = this.flattenSuggestions();
  }

  resetNavigation(): void {
    this.activeIndex = 0;
  }

  get activeSuggestion(): EditSuggestion | undefined {
    return this.previewEntries[this.activeIndex]?.suggestion;
  }

  hasSuggestion(suggestion: EditSuggestion): boolean {
    return this.suggestions.some((candidate) => candidate.id === suggestion.id);
  }

  focusNextRange(editor: ICodeEditor): void {
    if (!this.previewEntries.length) {
      return;
    }

    this.activeIndex = (this.activeIndex + 1) % this.previewEntries.length;
    this.revealActivePreview(editor);
  }

  focusPreviousRange(editor: ICodeEditor): void {
    if (!this.previewEntries.length) {
      return;
    }

    this.activeIndex =
      (this.activeIndex - 1 + this.previewEntries.length) %
      this.previewEntries.length;
    this.revealActivePreview(editor);
  }

  isWithinPreview(selection: Selection | null | undefined): boolean {
    if (!selection) {
      return false;
    }

    return this.previewEntries.some((entry) =>
      entry.range.containsRange(selection)
    );
  }

  buildPreviewDecorations(): IModelDeltaDecoration[] {
    const decorations: IModelDeltaDecoration[] = [];

    for (const entry of this.previewEntries) {
      if (entry.isDeletion) {
        decorations.push({
          range: entry.range,
          options: {
            className: "edit-suggestion-delete",
            stickiness: TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges,
          },
        });
        continue;
      }

      if (entry.range.isEmpty()) {
        const end = entry.range.getEndPosition();
        decorations.push({
          range: Range.fromPositions(end, end),
          options: {
            className: "edit-suggestion-ghost-text",
            after: {
              content: entry.newText,
              inlineClassName: "edit-suggestion-ghost-text",
            },
            stickiness: TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges,
          },
        });
        continue;
      }

      decorations.push({
        range: entry.range,
        options: {
          className: "edit-suggestion-replace",
          stickiness: TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges,
        },
      });
      decorations.push({
        range: Range.fromPositions(
          entry.range.getEndPosition(),
          entry.range.getEndPosition()
        ),
        options: {
          className: "edit-suggestion-ghost-text",
          after: {
            content: entry.newText,
            inlineClassName: "edit-suggestion-ghost-text",
          },
          stickiness: TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges,
        },
      });
    }

    return decorations;
  }

  buildTabBadgeDecorations(
    badgeOptions: ModelDecorationOptions
  ): IModelDeltaDecoration[] {
    const active = this.previewEntries[this.activeIndex];
    if (!active) {
      return [];
    }

    const end = active.range.getEndPosition();

    // Include "+N similar edits" metadata via an inline badge or accessible label when applicable.
    return [
      {
        range: Range.fromPositions(end, end),
        options: badgeOptions,
      },
    ];
  }

  private flattenSuggestions(): PreviewEntry[] {
    const entries: PreviewEntry[] = [];
    for (const suggestion of this.suggestions) {
      suggestion.edits.forEach((edit, editIndex) => {
        const range = Range.lift(edit.range);
        entries.push({
          suggestion,
          editIndex,
          range,
          newText: edit.newText,
          isDeletion: edit.newText.length === 0 && !range.isEmpty(),
        });
      });
    }
    return entries;
  }

  private revealActivePreview(editor: ICodeEditor): void {
    const active = this.previewEntries[this.activeIndex];
    if (!active) {
      return;
    }

    const position = active.range.getStartPosition();
    editor.setPosition(position);
    editor.revealRangeInCenter(active.range);
  }
}
```

## Integration Points

### With Extension Host

- **Registration**: Extensions register providers via `registerEditSuggestionProvider()`
- **Invocation**: Main thread calls extension host to get suggestions
- **Events**: Main thread fires events that extensions can listen to

### With Editor

- **Rendering**: Use Monaco's decoration API to render ghost text
- **Keyboard**: Handle Tab/Shift+Tab traversal, Tab acceptance from the anchor, Escape to discard
- **Navigation**: Cycle through grouped edits and pause on deletions for review
- **Tab badge**: Position the pill inline when in view, float it near the viewport edge with directional cues when offscreen, and expose screen-reader hints

### With Workbench

- **Commands**: Register commands to invoke suggestions
- **Keybindings**: Add default keybindings (e.g., `Ctrl+Alt+]` to invoke) and map Tab/Escape behaviors into the active session
- **Settings**: Add settings to enable/disable automatic suggestions, configure idle delay, and adjust cooldown length

## Example Implementation

### Extension Example

```typescript
import * as vscode from "vscode";

export function activate(context: vscode.ExtensionContext) {
  const provider: vscode.EditSuggestionProvider = {
    id: "my-edit-suggestion-provider",
    async provideEditSuggestions(
      document: vscode.TextDocument,
      selection: vscode.Selection,
      context: vscode.EditSuggestionContext,
      token: vscode.CancellationToken
    ): Promise<vscode.EditSuggestionList | undefined> {
      // Generate suggestions based on document and selection
      const nextEdit = document.lineAt(selection.active.line).text.includes("TODO")
        ? " // Implemented"
        : " // TODO: implement";

      const suggestions: vscode.EditSuggestion[] = [
        {
          id: "suggestion-1",
          edits: [
            {
              range: new vscode.Range(
                selection.end.line,
                selection.end.character,
                selection.end.line,
                selection.end.character
              ),
              newText: nextEdit,
            },
          ],
          detail: "Adds a TODO scaffold (auto-follows acceptance)",
        },
      ];

      return { suggestions };
    },
  };

  const disposable = vscode.languages.registerEditSuggestionProvider(
    { language: "typescript" },
    provider
  );

  context.subscriptions.push(disposable);

  // Listen to events
  vscode.languages.onDidAcceptEditSuggestion((e) => {
    console.log("Suggestion accepted:", e.suggestion.id);
  });

  vscode.languages.onDidDiscardEditSuggestions((e) => {
    console.log("Suggestions dismissed:", e.suggestions.map((s) => s.id));
  });
}
```

## Testing

### Unit Tests

Test individual components:

- Provider registration/unregistration
- Suggestion session management
- Edit application
- Signature cooldown bookkeeping (`discardSuggestions` marks cooldown, acceptance clears it)
- Scope limit enforcement and truncated detail messaging
- Session navigation helpers (`focusNextRange`, `buildPreviewDecorations`)

### Integration Tests

Test end-to-end flow:

- Extension registration → suggestion generation → acceptance
- Multiple providers and selector matching
- Event firing
- Idle invocation timing and adaptive cooldown behavior
- Tab traversal/Shift+Tab navigation with ghost text + badge updates
- Truncation guidance rendered for over-limit suggestions

## Notes

- **Ghost text rendering**: Use Monaco's `after` decoration option for inline ghost text
- **Multi-range edits**: Support multiple `TextEdit` objects per suggestion
- **Cancellation**: Properly handle cancellation tokens when document changes
- **Performance**: Consider debouncing automatic invocations
- **Accessibility**: Ensure keyboard navigation works properly
- **Tab badge**: Provide ARIA labels (`aria-label="Press Tab to preview next edit"`) and hide the badge when the caret leaves the anchor
- **Cooldown telemetry**: Log when identical suggestions enter cooldown to diagnose over-triggering providers
- **Grouped edits**: Surface `detail`/`description` metadata so the controller can show the “+N similar edits” badge

## Future Enhancements

- Support for streaming suggestions (`isIncomplete` flag)
- Automatic invocation heuristics
- Suggestion ranking/prioritization
- Telemetry integration
