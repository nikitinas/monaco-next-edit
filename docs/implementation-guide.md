# VS Code Next Edit Suggestions API - Implementation Guide

This guide explains how to implement the Next Edit Suggestions API in a VS Code fork. The API allows extensions to provide predictive edit suggestions that are displayed as ghost text in the editor.

## Table of Contents

1. [Overview](#overview)
2. [API Structure](#api-structure)
3. [Architecture](#architecture)
4. [Implementation Steps](#implementation-steps)
5. [Key Components](#key-components)
6. [Integration Points](#integration-points)
7. [Example Implementation](#example-implementation)

## Overview

The Next Edit Suggestions API enables extensions to provide predictive edit suggestions that appear as ghost text in the editor. Unlike inline completions (which suggest text at the cursor) or code actions (which require explicit invocation), this API allows extensions to predict the next meaningful edit based on context.

### Key Features

- **Ghost text display**: Suggestions appear as inline ghost text, similar to inline completions
- **Multi-range edits**: Supports suggestions that span multiple ranges (insertions and deletions)
- **Event-driven**: Extensions register providers and listen to acceptance/discard events
- **Simple API**: Minimal surface area - extensions provide edits, VS Code handles rendering

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

**File**: `src/vs/workbench/contrib/editSuggestions/common/editSuggestionService.ts`

```typescript
import { Emitter, Event } from "vs/base/common/event";
import { Disposable } from "vs/base/common/lifecycle";
import { ITextModel } from "vs/editor/common/model";
import {
  EditSuggestion,
  EditSuggestionList,
  EditSuggestionContext,
  EditSuggestionTriggerKind,
} from "vs/workbench/contrib/editSuggestions/common/editSuggestionTypes";

export interface IEditSuggestionService {
  readonly onDidAcceptSuggestion: Event<EditSuggestionAcceptedEvent>;
  readonly onDidDiscardSuggestions: Event<EditSuggestionsDiscardedEvent>;

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

  private providers = new Map<
    string,
    { selector: DocumentSelector; extensionHost: any }
  >();
  private activeSessions = new Map<ITextModel, EditSuggestionSession>();

  async invoke(
    model: ITextModel,
    selection: Selection,
    triggerKind: EditSuggestionTriggerKind
  ): Promise<EditSuggestionSession | undefined> {
    // Find matching provider
    const provider = this.findProvider(model);
    if (!provider) {
      return undefined;
    }

    // Cancel existing session for this model
    const existing = this.activeSessions.get(model);
    if (existing) {
      existing.dispose();
    }

    // Create context
    const context: EditSuggestionContext = {
      triggerKind,
      lastAcceptedSuggestionId: this.lastAcceptedSuggestionId,
    };

    // Call extension host
    const result = await provider.extensionHost.$provideEditSuggestions(
      provider.id,
      model.uri.toString(),
      selection,
      context,
      CancellationToken.None
    );

    if (!result || !result.suggestions.length) {
      return undefined;
    }

    // Create session
    const session = new EditSuggestionSession(model, result.suggestions, this);
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
    // Implement document selector matching logic
    // Similar to existing language feature matching
    return true;
  }

  acceptSuggestion(suggestion: EditSuggestion, model: ITextModel): void {
    // Apply edits
    const edits = suggestion.edits.map((e) => ({
      range: this.toEditorRange(e.range),
      text: e.newText,
    }));

    model.pushEditOperations([], edits, () => null);

    // Fire event
    this._onDidAcceptSuggestion.fire({ suggestion });

    // Dispose session
    const session = this.activeSessions.get(model);
    if (session) {
      session.dispose();
      this.activeSessions.delete(model);
    }
  }

  discardSuggestions(suggestions: EditSuggestion[], model: ITextModel): void {
    this._onDidDiscardSuggestions.fire({ suggestions });

    const session = this.activeSessions.get(model);
    if (session) {
      session.dispose();
      this.activeSessions.delete(model);
    }
  }
}
```

### Step 5: Create Editor Integration

Integrate with the editor to render ghost text:

**File**: `src/vs/workbench/contrib/editSuggestions/browser/editSuggestionController.ts`

```typescript
import { ICodeEditor } from "vs/editor/browser/editorBrowser";
import { IEditSuggestionService } from "../common/editSuggestionService";
import { Disposable } from "vs/base/common/lifecycle";
import { ModelDecorationOptions } from "vs/editor/common/model/textModel";

export class EditSuggestionController extends Disposable {
  private session: EditSuggestionSession | undefined;
  private decorations: string[] = [];

  constructor(
    private readonly editor: ICodeEditor,
    private readonly editSuggestionService: IEditSuggestionService
  ) {
    super();

    // Listen to service events
    this._register(
      this.editSuggestionService.onDidAcceptSuggestion((e) => {
        if (this.session?.hasSuggestion(e.suggestion)) {
          this.clearDecorations();
        }
      })
    );

    // Handle keyboard shortcuts
    this._register(
      this.editor.onKeyDown((e) => {
        if (e.keyCode === KeyCode.Tab && this.session) {
          this.accept();
          e.preventDefault();
        } else if (e.keyCode === KeyCode.Escape && this.session) {
          this.discard();
          e.preventDefault();
        }
      })
    );
  }

  async invoke(triggerKind: EditSuggestionTriggerKind): Promise<void> {
    const model = this.editor.getModel();
    if (!model) {
      return;
    }

    const selection = this.editor.getSelection();
    if (!selection) {
      return;
    }

    this.session = await this.editSuggestionService.invoke(
      model,
      selection,
      triggerKind
    );

    if (this.session) {
      this.renderSuggestions();
    }
  }

  private renderSuggestions(): void {
    if (!this.session || !this.editor.getModel()) {
      return;
    }

    const model = this.editor.getModel()!;
    const decorations: ModelDeltaDecoration[] = [];

    for (const suggestion of this.session.suggestions) {
      for (const edit of suggestion.edits) {
        const range = this.toEditorRange(edit.range);

        // Create ghost text decoration
        decorations.push({
          range,
          options: {
            className: "edit-suggestion-ghost-text",
            after: {
              content: edit.newText,
              inlineClassName: "edit-suggestion-ghost-text",
            },
            stickiness: TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges,
          },
        });
      }
    }

    this.decorations = model.deltaDecorations(this.decorations, decorations);
  }

  private accept(): void {
    if (!this.session) {
      return;
    }

    const active = this.session.activeSuggestion;
    if (active) {
      this.editSuggestionService.acceptSuggestion(
        active,
        this.editor.getModel()!
      );
    }
  }

  private discard(): void {
    if (!this.session) {
      return;
    }

    this.editSuggestionService.discardSuggestions(
      this.session.suggestions,
      this.editor.getModel()!
    );
  }

  private clearDecorations(): void {
    if (this.decorations.length && this.editor.getModel()) {
      this.editor.getModel()!.deltaDecorations(this.decorations, []);
      this.decorations = [];
    }
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
```

## Key Components

### EditSuggestionSession

Manages an active suggestion session for a specific editor:

```typescript
export class EditSuggestionSession extends Disposable {
  constructor(
    private readonly model: ITextModel,
    public readonly suggestions: EditSuggestion[],
    private readonly service: EditSuggestionService
  ) {
    super();
  }

  get activeSuggestion(): EditSuggestion | undefined {
    return this.suggestions[this.activeIndex];
  }

  get activeIndex(): number {
    return 0; // Implement navigation logic
  }

  accept(suggestion: EditSuggestion): void {
    this.service.acceptSuggestion(suggestion, this.model);
  }

  discard(): void {
    this.service.discardSuggestions(this.suggestions, this.model);
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
- **Keyboard**: Handle Tab/Enter to accept, Escape to discard
- **Navigation**: Allow cycling through multiple suggestions

### With Workbench

- **Commands**: Register commands to invoke suggestions
- **Keybindings**: Add default keybindings (e.g., `Ctrl+Alt+]` to invoke)
- **Settings**: Add settings to enable/disable automatic suggestions

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
              newText: " // TODO: implement",
            },
          ],
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
}
```

## Testing

### Unit Tests

Test individual components:

- Provider registration/unregistration
- Suggestion session management
- Edit application

### Integration Tests

Test end-to-end flow:

- Extension registration → suggestion generation → acceptance
- Multiple providers and selector matching
- Event firing

## Notes

- **Ghost text rendering**: Use Monaco's `after` decoration option for inline ghost text
- **Multi-range edits**: Support multiple `TextEdit` objects per suggestion
- **Cancellation**: Properly handle cancellation tokens when document changes
- **Performance**: Consider debouncing automatic invocations
- **Accessibility**: Ensure keyboard navigation works properly

## Future Enhancements

- Support for streaming suggestions (`isIncomplete` flag)
- Automatic invocation heuristics
- Suggestion ranking/prioritization
- Telemetry integration
