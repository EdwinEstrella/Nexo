# Apply Progress: Replace Native Dialogs with App UI

## Status

- Mode: Standard
- Artifact store: openspec
- Workload boundary: single local change with explicit `size:exception`
- Progress: 12/12 tasks complete
- Next recommended phase: `sdd-verify`

## Completed Tasks

- [x] 1.1 Created `components/app-dialogs.js` with `window.NexoDialogs.confirm`, `prompt`, `alert`, and `notify` Promise APIs.
- [x] 1.2 Created `components/app-dialogs.css` for modal, prompt, toast, focus-trap, and z-index behavior.
- [x] 1.3 Added `scripts/check-native-dialogs.cjs` and `npm run check:native-dialogs`.
- [x] 2.1 Loaded shared dialog CSS and script in `portal.html` and `dashboard.html`.
- [x] 2.2 Replaced native feedback and decision usage in `portal.html` with internal dialog helpers backed by `NexoDialogs`.
- [x] 2.3 Replaced sidebar logout confirmation with awaited `window.NexoDialogs.confirm`.
- [x] 2.4 Removed the page-local dashboard modal and routed admin decisions/feedback through `NexoDialogs`.
- [x] 3.1 Verified destructive/security flows use awaited app modal decisions.
- [x] 3.2 Verified normal success/status messages use in-app toast delivery.
- [x] 3.3 Verified prompt cancel returns `null` and confirm cancel returns `false` through the shared service contract.
- [x] 4.1 Removed dead dashboard modal markup/script and native dialog call sites.
- [x] 4.2 No README update was needed; behavior is represented by shared service names and the checker script.

## Verification Evidence

- `npm run check:native-dialogs` passed and reported: `No forbidden native dialog APIs found.`
- `node --check components/app-dialogs.js`, `node --check scripts/check-native-dialogs.cjs`, and `node --check components/sidebar.js` passed.
- Inline scripts from `portal.html` and `dashboard.html` were parsed with `new Function(...)`; syntax check passed.

## Deviations

None. Implementation follows the shared renderer service, app modal/toast, awaitable confirm/prompt, and static checker design.

## Issues

None.
