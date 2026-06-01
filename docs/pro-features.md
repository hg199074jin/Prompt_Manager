# Prompt Manager Pro Features

This document describes the first local Pro feature set. These features are implemented inside the extension and can later be connected to a real subscription or account system.

## Slash Commands

Each prompt can define a slash command in the Options page.

Examples:

- `/review`
- `/email`
- `/xiaohongshu`

When typing in a supported webpage input field, enter the command and press `Tab` or `Enter`. The extension replaces the command with the prompt content.

If the prompt contains variables, the floating variable form opens before insertion.

## Floating Prompt Panel

On supported webpages, focusing an input field shows a small `⚡` button beside the field.

Click it to open the in-page prompt panel. The panel supports:

- searching by title,
- searching by content,
- searching by tag,
- searching by slash command,
- filling variables,
- inserting directly into the active input.

## Enhanced Variables

The original `{{variable}}` syntax still works.

Additional formats:

```text
{{topic:Enter article topic}}
{{tone|professional,casual,sharp}}
{{word_count:number:800}}
```

Rules:

- `{{name:label}}` shows a text input with a custom label.
- `{{name|a,b,c}}` shows a dropdown.
- `{{name:number:800}}` shows a number input with a default value.
- Empty values keep the original placeholder.

## Usage Analytics

The Options page has a `使用分析` button.

It shows:

- total usage count,
- most-used prompts,
- most-used websites.

Usage is recorded from:

- popup copy,
- right-click insertion,
- floating panel insertion,
- slash command expansion.

## Version History

When a prompt is edited, the previous prompt state is saved automatically.

Each prompt card has a `历史` button. It opens prior versions and allows restoring a previous version.

Tracked fields:

- title,
- content,
- category,
- tags,
- slash command,
- rating.

## Prompt Rating

Each prompt can be rated from one to five stars in the Options page.

The list can be sorted by rating, making it easier to keep the best prompts visible.

## Current Boundary

This Pro iteration is local-first. It does not yet include:

- real billing,
- accounts,
- team workspaces,
- permissions,
- approval flows,
- cloud backend.

Those belong to the future team layer.
