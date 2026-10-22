# Native subagent chat for OpenCode V2

Adds a follow-up editor **to the existing child-session view**, above the built-in subagent picker. No separate screen, parent relay, core patch, or automatic parent notification.

## Install

Requires OpenCode **2.1.2** (CLI and connected server). This is the version verified against source; other releases are unverified. Bun is needed only to develop or run the tests, not to load the plugin in OpenCode.

Copy this directory to a permanent path, for example `~/plugins/child-session-chat`. Add the **absolute directory path** to `~/.config/opencode/cli.json` (or `$XDG_CONFIG_HOME/opencode/cli.json`), preserving its existing settings:

```json
{
  "$schema": "https://opencode.ai/v2/cli.json",
  "plugins": ["/home/YOU/plugins/child-session-chat"]
}
```

If `plugins` already exists, append the path instead of replacing the array. CLI-only loading avoids changing server/project configuration and works with a remote V2 server. Local directory entrypoint: `tui.tsx`; published-package entrypoint: `./tui`. The TUI resolves `@opencode/plugin/tui` and OpenTUI itself; **do not install** `@opencode-ai/plugin` or edit OpenCode internals.

## Use

From a parent session, open its subagent picker (`Ctrl+X`, then Down), select an existing child, and type in the editor above the picker. **Enter** sends to the displayed child; **Esc** returns keyboard control to the picker; **Ctrl+G** focuses the chat again. Click the editor to focus it. Parent navigation remains the picker's own navigation. The root session has no chat editor.

The **Agent** row shows the child's selected agent (or `default (unselected)` when no agent is stored). Click **Change** or press **Shift+Tab** while chatting to choose Build, Plan, or the child's original agent. If your terminal does not pass Shift+Tab to OpenCode, use **Ctrl+P → Change this subagent's agent**, or click the Agent row. Outside the child-chat editor, Shift+Tab keeps its normal OpenCode behavior; Ctrl+Tab still switches session tabs. Switching is available only while the child is idle. This changes the child's instructions and permissions for subsequent work; it keeps the same session, transcript, and model. Selecting an agent does not itself send a prompt.

Submission uses `session.prompt({ sessionID: childID, text, delivery: "steer" })` and does not change the child's agent or model. Running children accept input at a safe execution boundary, without interruption. Responses use the native child transcript. A response to a direct follow-up is **not automatically reported to the parent** by a new delegation job.

Errors keep the draft. If a connection fails after server admission, the status can be ambiguous; inspect the child transcript before retrying to avoid a duplicate. Child permission requests remain handled by the parent session's UI.

## Develop

```sh
bun install --ignore-scripts
bun run test
bun run typecheck
```
