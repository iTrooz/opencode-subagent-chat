/** @jsxImportSource @opentui/solid */
import { Plugin } from "@opencode/plugin/tui"
import type { Context } from "@opencode/plugin/tui/context"
import type { TextareaRenderable } from "@opentui/core"
import { createSignal, onCleanup, onMount, Show } from "solid-js"
import { createSubmit } from "./submit"

// Keep the native transcript and picker; render input only for the displayed child.
export default Plugin.define({
  id: "child-session-chat",
  setup(context) {
    return context.ui.slot({
      append: "session.composer.top",
      render: ({ sessionID }) => (
        <Show {...{ get when() { return context.data.session.get(sessionID)?.parentID } }}>
          <ChildChat context={context} sessionID={sessionID} />
        </Show>
      ),
    })
  },
})

// A dedicated input mode prevents the picker's arrows and Enter from taking over the editor.
export function ChildChat(props: { context: Context; sessionID: string }) {
  let editor: TextareaRenderable | undefined
  let leaveMode: (() => void) | undefined
  const [status, setStatus] = createSignal("")
  const [failed, setFailed] = createSignal(false)
  const [draft, setDraft] = createSignal("")
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

  function activate() {
    if (!editor || editor.isDestroyed) return
    if (!leaveMode) leaveMode = props.context.keymap.mode.push("child-session-chat")
    editor.focus()
  }

  function backToPicker() {
    editor?.blur()
    leaveMode?.()
    leaveMode = undefined
  }

  props.context.keymap.layer(() => ({
    mode: "composer",
    commands: [{ bind: "ctrl+g", title: "Focus subagent chat", run: activate }],
  }))
  props.context.keymap.layer(() => ({
    mode: "child-session-chat",
    commands: [{ bind: "escape", title: "Return to subagent picker", run: backToPicker }],
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
