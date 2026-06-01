# Prompt Manager Pro Roadmap

## Product Positioning

If Prompt Manager remains a personal prompt bookmark manager, it is hard to justify a `$99/month` price.

To support premium pricing, it should evolve into an AI workflow asset management system for creators, consultants, marketing teams, training teams, and internal business teams. The product should help users reuse prompts faster, improve prompt quality, measure what works, and eventually manage shared prompt assets across teams.

## Market Signals

Comparable products and scripts suggest that paid value clusters around:

- Cross-site prompt insertion inside AI tools and work apps.
- Private prompt libraries, lists, tags, folders, and favorites.
- Tone, writing style, and "continue/improve" actions.
- Modular prompt building and reusable prompt components.
- Version history, review, rollback, and production prompt control.
- Team sharing, comments, permissions, and collaboration.
- Usage analytics, A/B testing, and prompt performance tracking.
- Security, sensitive information detection, and audit controls.

Reference products reviewed:

- AIPRM: https://app.aiprm.com/pricing
- Modular Prompt Library: https://www.modularprompt.com/
- Prompt Manage: https://www.promptmanage.com/en
- WhatsThePrompt: https://whatstheprompt.com/
- PromptDrive: https://promptdrive.ai/

## Current Baseline

The current extension already includes:

- Prompt CRUD.
- Categories and tags.
- Favorites.
- Template variables using `{{variable}}`.
- Popup search and copy.
- Options management page.
- AI polish through configurable API.
- Import and export.
- WebDAV sync.
- Save selected webpage text as a prompt.
- Right-click insert prompt into editable fields.

## Layer 1: Daily Use Stickiness

Goal: make the extension something users rely on every day.

Recommended features:

1. Slash command expansion
   - Users type commands such as `/review`, `/email`, or `/xiaohongshu`.
   - The extension expands the matching prompt directly inside the active input field.

2. In-page floating prompt panel
   - A small prompt button appears beside active text fields.
   - Users can search, preview, fill variables, and insert prompts without opening the extension popup.

3. Usage history and lightweight performance tracking
   - Track when a prompt was used, where it was used, and how often.
   - Add a simple rating/satisfaction signal.

4. Enhanced variables
   - Support placeholders such as:
     - `{{topic:Enter article topic}}`
     - `{{tone|professional,casual,sharp}}`
     - `{{word_count:number:800}}`
   - Render variable forms instead of raw browser prompts.

5. Final prompt preview
   - After filling variables, show the final prompt before inserting or copying.

## Layer 2: Individual Pro Value

Goal: make the product worth paying for as a professional solo user.

Recommended features:

1. Prompt version history
   - Save historical versions when a prompt changes.
   - Allow comparing, restoring, and marking a production version.

2. Prompt test bench
   - Let users test one prompt or multiple versions against sample inputs.
   - Store outputs for comparison.

3. AI prompt diagnosis and optimization
   - Go beyond simple polish.
   - Analyze:
     - missing context,
     - unclear instructions,
     - reusable variables,
     - output format gaps,
     - model fit.

4. Sensitive information detection
   - Warn before saving or inserting prompts that contain emails, phone numbers, API keys, ID numbers, or likely secrets.

5. Advanced organization
   - Score prompts.
   - Sort by score, use count, last used, and updated time.
   - Archive low-value prompts.

Industry template libraries are intentionally excluded from the first Pro build. They can become a separate content product later.

## Layer 3: Team and `$99/month` Value

Goal: justify team-level pricing.

Future features:

1. Team workspaces.
2. Shared prompt libraries.
3. Roles and permissions.
4. Review and approval flow.
5. Team usage analytics.
6. Organization-level cloud sync.
7. Audit logs.
8. Prompt API and MCP access.
9. Enterprise security features.

This layer requires a real backend, account system, billing, cloud storage, and permission model. It should not be mixed into the first Pro extension-only iteration.

## Recommended Pricing Model

- Free:
  - Local prompt library.
  - Basic categories and tags.
  - Basic right-click save and insert.
  - Import and export.

- Pro, `$9-$19/month`:
  - Slash commands.
  - Floating in-page panel.
  - Enhanced variables.
  - Version history.
  - Usage analytics.
  - AI diagnosis.
  - Sensitive information warnings.

- Team, `$49-$99/month`:
  - Shared library.
  - Permissions.
  - Comments and approval.
  - Team analytics.
  - Cloud sync and audit logs.

- Enterprise:
  - SSO.
  - Private deployment.
  - Advanced audit.
  - API and MCP.
  - Custom retention and compliance controls.

## First Pro Iteration Scope

The next implementation should focus on:

- Input enhancement.
- Variable enhancement.
- Usage analytics.
- Version history.
- Slash command expansion.
- In-page floating search panel.
- Variable form upgrade.

This satisfies the first practical Pro milestone without requiring team infrastructure or billing.
