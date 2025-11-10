/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

// Proposed API for inline completions additions (next edit suggestions)
// Based on GitHub Copilot's implementation

import * as vscode from 'vscode';

declare module 'vscode' {
    export enum InlineCompletionDisplayLocationKind {
        Code = 0,
        Command = 1,
    }

    export interface InlineCompletionDisplayLocation {
        range: Range;
        label: string;
        kind: InlineCompletionDisplayLocationKind;
        jumpToEdit?: boolean;
    }

    export interface InlineCompletionItem {
        /**
         * If set to `true`, this item is treated as inline edit (next edit suggestion).
         * This enables displaying suggestions at positions other than the cursor.
         */
        isInlineEdit?: boolean;

        /**
         * A range specifying when the edit can be shown based on the cursor position.
         * If the cursor is within this range, the inline edit can be displayed.
         * This allows suggestions to appear when the cursor is nearby (e.g., within 4 lines).
         */
        showRange?: Range;

        /**
         * Whether to show the inline edit menu.
         */
        showInlineEditMenu?: boolean;

        /**
         * Command to execute when the suggestion is accepted.
         */
        action?: Command;

        /**
         * Visual indicator showing where the edit will be applied.
         * This is displayed separately from the cursor position.
         */
        displayLocation?: InlineCompletionDisplayLocation;
    }
}

