/** @jsxImportSource @opentui/solid */
import { expect, test } from "bun:test"
import { testRender } from "@opentui/solid"
import { Host } from "@opencode/plugin/host"
import { createSignal } from "solid-js"
import type { Context, KeymapLayer, SlotClaim } from "@opencode/plugin/tui/context"
import plugin from "../src/tui"

// OpenCode resolves local directories from their root, not package exports.
test("the local plugin directory exposes its TUI entrypoint", () => {
  expect(Host.resolve({ directory: new URL("..", import.meta.url).pathname }).tui).toEndWith("/tui.tsx")
})

// Mount the actual slot contribution against child and root session metadata.
test("renders the editor on the native child slot, not on a root session", async () => {
  let slot: SlotClaim | undefined
  let switched: string | undefined
  let dispatched: string | undefined
  const layers: KeymapLayer[] = []
  const [modes, setModes] = createSignal<{ id: symbol; mode: string }[]>([])
  // Model the host's reactive, last-pushed-wins input-mode stack.
  const mode = {
    current: () => modes().at(-1)?.mode ?? "base",
    push: (name: string) => {
      const id = Symbol(name)
      setModes((items) => [...items, { id, mode: name }])
      return () => setModes((items) => items.filter((item) => item.id !== id))
    },
  }
  const context = {
    options: {},
    data: { session: { get: (id: string) => (id === "child" ? { parentID: "parent", location: { directory: "/example" } } : {}), status: () => "idle" } },
    storage: { memory: (_: string, options: { initial: { id: string } }) => [options.initial, () => {}] },
    keymap: { layer: (factory: () => KeymapLayer) => layers.push(factory()), mode, dispatch: (id: string) => { dispatched = id } },
    client: {
      session: { prompt: async () => {}, switchAgent: async (input: { agent: string }) => { switched = input.agent } },
      agent: { list: async () => ({ data: [
        { id: "build", mode: "primary" },
        { id: "plan", mode: "primary" },
        { id: "general", mode: "subagent" },
      ] }) },
    },
    theme: { text: { base: "#ffffff", muted: "#888888", feedback: { error: { base: "#ff0000" }, info: { base: "#00ff00" } } } },
    ui: {
      slot: (claim: SlotClaim) => { slot = claim; return () => {} },
      dialog: { select: async () => "plan" },
      router: { current: () => ({ type: "session", sessionID: "child" }) },
    },
  } as unknown as Context
  plugin.setup(context)
  expect(slot).toBeDefined()
  if (!slot) throw new Error("Slot was not registered")
  const render = slot.render as (input: { sessionID: string }) => ReturnType<SlotClaim["render"]>

  const child = await testRender(() => render({ sessionID: "child" }), { width: 80, height: 12 })
  try {
    await child.renderOnce()
    expect(child.captureCharFrame()).toContain("Chat with this subagent")
    expect(child.captureCharFrame()).toContain("Agent: default (unselected)")
    expect(child.captureCharFrame()).toContain("Change (Shift+Tab, idle only)")
    expect(layers.find((layer) => layer.mode === "opencode-subagent-chat")).toMatchObject({
      priority: 10,
      commands: [
        { bind: "escape", title: "Return to subagent picker" },
        { bind: "shift+tab", title: "Switch subagent agent" },
        { bind: "ctrl+p", title: "Open command palette" },
      ],
    })
    layers.find((layer) => layer.mode === "opencode-subagent-chat")?.commands?.find((command) => command.bind === "ctrl+p")?.run()
    expect(dispatched).toBe("command.palette.show")
    const palette = layers.find((layer) => layer.mode === "global")?.commands?.find((command) => command.id === "opencode-subagent-chat.agent")
    expect(palette?.enabled).toBeInstanceOf(Function)
    expect((palette?.enabled as () => boolean)()).toBe(true)
    await palette?.run()
    await child.renderOnce()
    expect(switched).toBe("plan")
    expect(child.captureCharFrame()).toContain("Agent: plan")
    expect(child.captureCharFrame()).toContain("Subagent agent set to plan")

    // A late or reopened picker must not split editor focus from keyboard mode.
    layers.find((layer) => layer.mode === "composer")?.commands?.[0]?.run()
    expect(mode.current()).toBe("opencode-subagent-chat")
    const closePicker = mode.push("composer")
    await child.renderOnce()
    expect(mode.current()).toBe("opencode-subagent-chat")
    expect(modes().filter((item) => item.mode === "opencode-subagent-chat")).toHaveLength(1)

    // Dialogs and forms keep input; returning to the picker restores chat.
    const closeModal = mode.push("modal")
    await child.renderOnce()
    expect(mode.current()).toBe("modal")
    const closeForm = mode.push("form")
    await child.renderOnce()
    expect(mode.current()).toBe("form")
    closeForm()
    closeModal()
    await child.renderOnce()
    expect(mode.current()).toBe("opencode-subagent-chat")

    // Esc is an intentional handoff, not a mode loss to recover automatically.
    layers.find((layer) => layer.mode === "opencode-subagent-chat")?.commands?.[0]?.run()
    await child.renderOnce()
    expect(mode.current()).toBe("composer")
    closePicker()
    expect(mode.current()).toBe("base")
  } finally {
    child.renderer.destroy()
  }

  const root = await testRender(() => render({ sessionID: "root" }), { width: 80, height: 12 })
  try {
    await root.renderOnce()
    expect(root.captureCharFrame()).not.toContain("Chat with this subagent")
  } finally {
    root.renderer.destroy()
  }
})

function mount(options: Record<string, unknown>) {
  let slot: SlotClaim | undefined
  const layers: KeymapLayer[] = []
  const context = {
    options,
    data: { session: { get: (id: string) => (id === "child" ? { parentID: "parent", agent: "build", location: { directory: "/example" } } : {}), status: () => "idle" } },
    storage: { memory: (_: string, options: { initial: { id: string } }) => [options.initial, () => {}] },
    keymap: { layer: (factory: () => KeymapLayer) => layers.push(factory()), mode: { current: () => "composer", push: () => () => {} }, dispatch: () => {} },
    client: { session: { prompt: async () => {}, switchAgent: async () => {} }, agent: { list: async () => ({ data: [] }) } },
    theme: { text: { base: "#ffffff", muted: "#888888", feedback: { error: { base: "#ff0000" }, info: { base: "#00ff00" } } } },
    ui: {
      slot: (claim: SlotClaim) => { slot = claim; return () => {} },
      dialog: { select: async () => undefined },
      router: { current: () => ({ type: "session", sessionID: "child" }) },
    },
  } as unknown as Context
  plugin.setup(context)
  if (!slot) throw new Error("Slot was not registered")
  return { slot, layers }
}

test("switchAgentKey changes the shortcut and its hint", async () => {
  const { slot, layers } = mount({ switchAgentKey: "alt+tab" })
  const render = slot.render as (input: { sessionID: string }) => ReturnType<SlotClaim["render"]>
  const child = await testRender(() => render({ sessionID: "child" }), { width: 80, height: 12 })
  try {
    await child.renderOnce()
    expect(child.captureCharFrame()).toContain("Change (Alt+Tab, idle only)")
    expect(
      layers
        .find((layer) => layer.mode === "opencode-subagent-chat")
        ?.commands?.find((command) => command.title === "Switch subagent agent")?.bind,
    ).toBe("alt+tab")
  } finally {
    child.renderer.destroy()
  }
})

test("switchAgentKey false removes the shortcut", async () => {
  const { slot, layers } = mount({ switchAgentKey: false })
  const render = slot.render as (input: { sessionID: string }) => ReturnType<SlotClaim["render"]>
  const child = await testRender(() => render({ sessionID: "child" }), { width: 80, height: 12 })
  try {
    await child.renderOnce()
    expect(child.captureCharFrame()).toContain("Change (idle only)")
    expect(
      layers
        .find((layer) => layer.mode === "opencode-subagent-chat")
        ?.commands?.some((command) => command.title === "Switch subagent agent"),
    ).toBe(false)
  } finally {
    child.renderer.destroy()
  }
})
