# Proposal: Replace Native Dialogs with App UI

## Intent

Eliminate all OS/browser-native dialogs, alerts, confirms, prompts, Windows popups, and native notifications because they steal focus from the desktop app and force users to dismiss UI outside the app context.

## Scope

### In Scope
- Replace `alert`, `confirm`, and `prompt` usage with internal app UI.
- Provide confirm-style flows through an app modal that resolves the user's response asynchronously.
- Route status, error, deletion, printing, payment, settings, inactivity, and auth messages through in-app feedback.

### Out of Scope
- Redesigning full page layouts unrelated to dialogs.
- Changing business rules for loans, payments, settings, authentication, or printing.
- Replacing system print dialogs required by the OS/browser print pipeline.

## Capabilities

### New Capabilities
- `app-dialogs`: Internal app-owned dialogs, confirmations, prompts, and notifications that never use OS/browser-native blocking UI.

### Modified Capabilities
- None; no existing OpenSpec capabilities are present.

## Approach

Create a shared renderer-level dialog service/component with `notify`, `confirm`, and prompt/input flows. Replace direct native calls across renderer code with awaited app UI promises. Preserve existing decision points and message semantics while keeping focus inside the app window.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `portal.html` | Modified | Replace many native alerts/confirms/prompts across loans, payments, printing, settings, inactivity, and auth flows. |
| `components/sidebar.js` | Modified | Replace logout native confirmation. |
| `dashboard.html` | Modified | Reuse or align existing `AdminModal` behavior with the shared app-dialog contract. |
| Renderer styles/scripts | New/Modified | Add shared modal/toast/prompt UI if no reusable component exists. |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Blocking flows continue before user choice | Med | Implement confirm/prompt APIs as promises and await every replacement. |
| Important errors become easy to miss | Med | Use modal severity for destructive/security-critical flows and non-blocking toasts only for safe status messages. |
| Inconsistent UI between pages | Med | Centralize dialog behavior and styling. |
| Print pipeline still opens OS UI | Low | Treat required print UI as out of scope; avoid extra native alerts around it. |

## Rollback Plan

Revert the shared dialog component/service and replacement call sites. Because business logic is unchanged, rollback restores previous native dialog behavior without data migration.

## Dependencies

- Existing renderer DOM/CSS patterns.
- Electron renderer/preload boundaries must remain respected.

## Success Criteria

- [ ] No application code calls `alert`, `confirm`, `prompt`, `Notification`, or Electron native dialog APIs for user messaging.
- [ ] Confirm and prompt flows wait for app-modal responses before continuing.
- [ ] User-facing messages remain visible within the app window without stealing OS focus.
