# Tasks: Replace Native Dialogs with App UI

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | 300-520 |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | PR 1 shared dialog service/styles/checker → PR 2 renderer migrations and wiring |
| Delivery strategy | ask-on-risk |
| Chain strategy | pending |

Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: pending
400-line budget risk: High

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 | Ship shared internal dialog service and enforcement | PR 1 | Base: main; includes reusable UI, promise API, and native-dialog checker |
| 2 | Replace page-specific native dialogs with shared app UI | PR 2 | Base: PR 1 branch; migrate portal/dashboard/sidebar call sites and verify flows |

## Phase 1: Shared Dialog Foundation

- [x] 1.1 Create `components/app-dialogs.js` with `window.NexoDialogs.confirm`, `prompt`, `alert`, and `notify` Promise APIs.
- [x] 1.2 Create `components/app-dialogs.css` for modal, prompt, toast, focus-trap, and z-index behavior.
- [x] 1.3 Add `scripts/check-native-dialogs.cjs` and `npm run check:native-dialogs` to block prohibited app-feedback APIs.

## Phase 2: Renderer Integration

- [x] 2.1 Load `components/app-dialogs.js` and `components/app-dialogs.css` in `portal.html` and `dashboard.html`.
- [x] 2.2 Replace `alert`, `confirm`, `prompt`, and `Notification` usage in `portal.html` with awaited `NexoDialogs` calls.
- [x] 2.3 Replace logout confirmation in `components/sidebar.js` with `await window.NexoDialogs.confirm(...)`.
- [x] 2.4 Rework `dashboard.html` admin feedback to use the shared dialog contract or remove page-local modal code.

## Phase 3: Behavior Verification

- [x] 3.1 Validate destructive and security-sensitive flows pause until modal response returns.
- [x] 3.2 Validate success/status messaging uses non-blocking toast delivery inside the app window.
- [x] 3.3 Validate dismissed prompts return `null` and canceled confirms return `false` without native dialogs.

## Phase 4: Cleanup and Docs

- [x] 4.1 Remove dead page-local dialog code and any leftover native dialog imports or helpers.
- [x] 4.2 Update inline comments or README notes if any dialog behavior assumptions changed.
