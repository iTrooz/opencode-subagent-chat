/** @jsxImportSource @opentui/solid */
import { Plugin } from "@opencode/plugin/tui"
import type { Context } from "@opencode/plugin/tui/context"
import type { TextareaRenderable } from "@opentui/core"
import { createEffect, createSignal, onCleanup, onMount, Show, untrack } from "solid-js"
import { createAgentSwitch } from "./agent"
import { formatKey, resolveOptions } from "./options"
import { createSubmit } from "./submit"

// Keep the native transcript and picker; render input only for the displayed child.
export default Plugin.define({
  id: "opencode-subagent-chat",
  setup(context) {
    const options = resolveOptions(context.options)
    return context.ui.slot({
      append: "session.composer.top",
      render: ({ sessionID }) => (
        <Show {...{ get when() { return context.data.session.get(sessionID)?.parentID } }}>
          <ChildChat context={context} sessionID={sessionID} switchAgentKey={options.switchAgentKey} />
        </Show>
      ),
    })
  },
})

// A dedicated input mode prevents the picker's arrows and Enter from taking over the editor.
export function ChildChat(props: { context: Context; sessionID: string; switchAgentKey: string | undefined }) {
  let editor: TextareaRenderable | undefined
  let leaveMode: (() => void) | undefined
  const [status, setStatus] = createSignal("")
  const [failed, setFailed] = createSignal(false)
  const [draft, setDraft] = createSignal("")
  const [chatActive, setChatActive] = createSignal(false)
  const [selectedAgent, setSelectedAgent] = createSignal<string>()
  const [original] = props.context.storage.memory(`original-agent.${props.sessionID}`, {
    initial: { id: props.context.data.session.get(props.sessionID)?.agent ?? "" },
  })
  const feedback = (message: string, error?: boolean) => {
    setFailed(!!error)
    setStatus(message)
  }
  const submit = createSubmit({
    client: props.context.client,
    sessionID: props.sessionID,
    draft,
    clear: (sent) => {
      if (editor?.plainText !== sent) return
      editor.clear()
      setDraft("")
    },
    status: feedback,
  })
  const switchAgent = createAgentSwitch({
    client: props.context.client,
    sessionID: props.sessionID,
    session: () => {
      const session = props.context.data.session.get(props.sessionID)
      return session ? { ...session, agent: selectedAgent() ?? session.agent } : undefined
    },
    status: () => props.context.data.session.status(props.sessionID),
    sending: () => submit.busy,
    original: original.id,
    select: (options) => props.context.ui.dialog.select(options),
    feedback,
    onSelected: setSelectedAgent,
  })

  // Prefer the confirmed selection until session events refresh the shared cache.
  createEffect(() => {
    if (selectedAgent() && props.context.data.session.get(props.sessionID)?.agent === selectedAgent()) {
      setSelectedAgent(undefined)
    }
  })

  // Reopening the native picker can place its mode above an existing chat mode.
  function activate() {
    if (!editor || editor.isDestroyed) return
    if (!leaveMode || props.context.keymap.mode.current() !== "opencode-subagent-chat") {
      leaveMode?.()
      leaveMode = props.context.keymap.mode.push("opencode-subagent-chat")
    }
    setChatActive(true)
    editor.focus()
  }

  // Yield deliberately until the user focuses chat again.
  function backToPicker() {
    setChatActive(false)
    editor?.blur()
    leaveMode?.()
    leaveMode = undefined
  }

  // Reclaim only picker input; modal and form modes must retain their priority.
  createEffect(() => {
    if (!chatActive() || props.context.keymap.mode.current() !== "composer") return
    untrack(activate)
  })

  props.context.keymap.layer(() => ({
    mode: "composer",
    commands: [{ bind: "ctrl+g", title: "Focus subagent chat", run: activate }],
  }))
  props.context.keymap.layer(() => ({
    mode: "opencode-subagent-chat",
    priority: 10,
    commands: [
      { bind: "escape", title: "Return to subagent picker", run: backToPicker },
      ...(props.switchAgentKey
        ? [{ bind: props.switchAgentKey, title: "Switch subagent agent", run: switchAgent }]
        : []),
      { bind: "ctrl+p", title: "Open command palette", run: () => props.context.keymap.dispatch("command.palette.show") },
    ],
  }))
  props.context.keymap.layer(() => ({
    mode: "global",
    commands: [{
      id: "opencode-subagent-chat.agent",
      title: "Change this subagent's agent",
      group: "Subagent",
      palette: true,
      enabled: () => {
        const route = props.context.ui.router.current()
        return route.type === "session" && route.sessionID === props.sessionID
      },
      run: switchAgent,
    }],
  }))

  // Wait until the host picker has installed its composer mode before focusing chat.
  onMount(() => {
    const timer = setTimeout(activate, 0)
    onCleanup(() => clearTimeout(timer))
  })
  onCleanup(backToPicker)

  return (
    <box flexDirection="column" paddingLeft={1} paddingRight={1} flexShrink={0}>
      <text fg={props.context.theme.text.muted}>
        Chat with this subagent · Enter send · Esc picker · Ctrl+G return to chat
      </text>
      <box
        onMouseUp={(event) => {
          if (event.button === 0) void switchAgent()
        }}
      >
        <text
          {...{
            fg: props.context.theme.text.muted,
            get children() {
              const agent = selectedAgent() ?? props.context.data.session.get(props.sessionID)?.agent ?? "default (unselected)"
              return `Agent: ${agent} · ${props.switchAgentKey ? `Change (${formatKey(props.switchAgentKey)}, idle only)` : "Change (idle only)"}`
            },
          }}
        />
      </box>
      <textarea
        ref={(value: TextareaRenderable) => (editor = value)}
        minHeight={1}
        maxHeight={4}
        width="100%"
        placeholder="Follow up with this subagent…"
        textColor={props.context.theme.text.base}
        placeholderColor={props.context.theme.text.muted}
        onMouseDown={() => activate()}
        onContentChange={() => setDraft(editor?.plainText ?? "")}
        onSubmit={() => void submit.send()}
      />
      <Show {...{ get when() { return status() } }}>
        <text {...{
          get fg() { return failed() ? props.context.theme.text.feedback.error.base : props.context.theme.text.feedback.info.base },
          get children() { return status() },
        }} />
      </Show>
    </box>
  )
}
