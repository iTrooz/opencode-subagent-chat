# Native subagent chat for OpenCode V2

Adds a follow-up editor **to the existing child-session view**, above the built-in subagent picker. No separate screen, parent relay, core patch, or automatic parent notification.

## Install

Ask AI :)

## Use

From a parent session, open its subagent picker (`Ctrl+X`, then Down), select an existing child, and type in the editor above the picker. **Enter** sends to the displayed child; **Esc** returns keyboard control to the picker; **Ctrl+G** focuses the chat again. Click the editor to focus it. Parent navigation remains the picker's own navigation. The root session has no chat editor.

The **Agent** row shows the child's selected agent. Press the configured switch-agent key (**Shift+Tab** by default) while chatting to choose Build, Plan, or the child's original agent.

## Configuration

The switch-agent shortcut defaults to `shift+tab`, which is also OpenCode's `agent.cycle` default. If that conflicts with another binding, set your own key in the plugin options:

```jsonc
{
  "package": "github:iTrooz/opencode-subagent-chat#274b721cd61863d4bc0d5df5ad024cb5888484aa",
  "options": {
    "switchAgentKey": "alt+tab"
  }
}
```

Set `switchAgentKey` to `false` or `"none"` to disable the shortcut. The **Change this subagent's agent** palette command and clicking the agent row still work.

## Licence

[GPL-2.0-only OR GPL-3.0-or-later with proxy being me (iTrooz)](https://itrooz.fr/posts/gpl_licence/)