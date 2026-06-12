# Design: Replace Native Dialogs with App UI

## Technical Approach

Create one shared renderer component (`components/app-dialogs.js` + `components/app-dialogs.css`) loaded by `portal.html` and `dashboard.html`. It exposes `window.NexoDialogs` with awaitable `confirm`, `prompt`, `alert`, and `notify` methods, then migrate renderer call sites from `alert`, `confirm`, `window.prompt`, and page-local `AdminModal` to that service. Electron main/preload boundaries stay unchanged: main returns errors through existing IPC results, while renderer decides how to display them. System-forced print UI remains out of scope; only app-owned print feedback is migrated.

## Architecture Decisions

| Decision | Options / Tradeoff | Choice and Rationale |
|---|---|---|
| Shared renderer service | Per-page modals are faster short-term but duplicate behavior. | Use one global `window.NexoDialogs`; current app is script-tag/CommonJS-free renderer code, so a global matches existing patterns and works in both pages without bundling. |
| Modal implementation | Native `<dialog>` is in-app but has inconsistent styling/backdrop needs; custom fixed overlay needs more code. | Use a custom fixed overlay for confirm/prompt/alert and toast stack for non-blocking feedback, reusing admin modal visual language and avoiding browser-native blocking APIs. |
| Awaitable decisions | Callbacks are simple but spread control flow. | `confirm()` and `prompt()` return Promises so existing destructive flows can keep `if (!await ...) return` semantics. |
| Guardrails | Runtime monkey-patching catches usage but can hide bugs; static checks are explicit. | Add a lightweight `scripts/check-native-dialogs.cjs` plus `npm run check:native-dialogs`; optionally patch native APIs in development to warn and route basic calls to `NexoDialogs` after initialization. |

## Data Flow

```text
Renderer flow -> window.NexoDialogs.confirm/prompt/notify
              -> app-dialogs DOM overlay/toast
              -> Promise resolves with user choice/input
              -> original business action continues or returns

Main/preload IPC -> renderer receives { success/error } -> NexoDialogs.notify/alert
```

## File Changes

| File | Action | Description |
|---|---|---|
| `components/app-dialogs.js` | Create | Central dialog service, DOM creation, queueing, focus restore, Escape/backdrop cancel, Promise contracts. |
| `components/app-dialogs.css` | Create | Shared modal/toast styles above titlebar/header/sidebar z-indexes. |
| `portal.html` | Modify | Include new CSS/script and replace all native feedback/decision/input calls. |
| `dashboard.html` | Modify | Include shared component and replace `AdminModal` with `NexoDialogs`, or keep markup only if removed in implementation. |
| `components/sidebar.js` | Modify | Replace logout `confirm` with `await window.NexoDialogs.confirm(...)`. |
| `scripts/check-native-dialogs.cjs` | Create | Fails when app code uses prohibited APIs outside the dialog service/check script. |
| `package.json` | Modify | Add `check:native-dialogs` script. |

## Interfaces / Contracts

```js
window.NexoDialogs.notify({ title, message, tone: 'info'|'success'|'warning'|'error', mode: 'toast'|'modal' }) // Promise<void>
window.NexoDialogs.alert({ title, message, tone }) // Promise<void>
window.NexoDialogs.confirm({ title, message, confirmText, cancelText, tone }) // Promise<boolean>
window.NexoDialogs.prompt({ title, message, label, defaultValue, placeholder, required }) // Promise<string|null>
```

Dismissed prompts resolve `null`; canceled confirms resolve `false`; alerts/notifications never throw for normal dismissal.

## Testing Strategy

| Layer | What to Test | Approach |
|---|---|---|
| Static | No prohibited native APIs in app feedback paths | Run `npm run check:native-dialogs`. |
| Manual | Confirm/delete/payment/settings/password-code flows await user choice | Exercise migrated flows in Electron with cancel and accept paths. |
| Manual | Error/warning/success stays inside app | Trigger unavailable API/error branches and verify modal/toast UI. |

## Migration / Rollout

No data migration required. Ship as a renderer-only UI change; rollback reverts shared component and call-site replacements. Keep OS/browser print UI unchanged where forced by `webContents.print()` or `window.print()`.

## Open Questions

- [ ] Should app-wide success messages default to toast, while destructive/security and validation failures default to modal?
