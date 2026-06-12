# Delta for app-dialogs

## ADDED Requirements

### Requirement: Internal app dialog surface

The system MUST provide internal app-owned UI for feedback and decisions, and MUST NOT use OS/browser/Electron-native dialogs or notifications for application messaging.

#### Scenario: Show feedback inside the app
- GIVEN the app needs to display an error, warning, success, or status message
- WHEN the message is triggered
- THEN the message appears within the app UI
- AND no native dialog or notification is shown

#### Scenario: Block native UI messaging
- GIVEN application code attempts to use a native alert, confirm, prompt, or notification for app feedback
- WHEN the flow runs
- THEN the user sees no native OS/browser/Electron dialog
- AND the message is handled by internal app UI instead

### Requirement: Awaited confirm-style decisions

The system MUST route confirm-style flows through internal modal UI and MUST await the user decision before continuing the action.

#### Scenario: Confirm destructive action
- GIVEN a destructive action requires confirmation
- WHEN the confirmation is shown
- THEN the app presents an internal modal
- AND the action does not continue until the user chooses a response

#### Scenario: Cancel stops the action
- GIVEN the confirmation modal is open
- WHEN the user cancels or dismisses it
- THEN the protected action does not run
- AND the app remains in the current state

### Requirement: Replace prompts with in-app input

The system MUST collect user input through internal app UI instead of native prompt dialogs.

#### Scenario: Request text input
- GIVEN the app needs text from the user
- WHEN the input flow starts
- THEN the app shows internal input UI
- AND the result is returned asynchronously to the caller

#### Scenario: Empty or dismissed input
- GIVEN the input UI is open
- WHEN the user dismisses it or submits no value
- THEN the app handles the canceled input without using a native prompt

### Requirement: No native UI APIs in app feedback paths

The system MUST NOT use `alert`, `confirm`, `prompt`, `Notification`, or Electron native dialog APIs for user-facing app feedback or decisions.

#### Scenario: Search for prohibited APIs
- GIVEN renderer code handles user-facing feedback or decision flows
- WHEN the code is reviewed or tested
- THEN prohibited native UI APIs are absent from those paths

#### Scenario: Preserve business action semantics
- GIVEN an existing flow currently uses native UI for feedback
- WHEN it is migrated to internal UI
- THEN the underlying business action and message meaning remain unchanged
- AND only the presentation mechanism changes
