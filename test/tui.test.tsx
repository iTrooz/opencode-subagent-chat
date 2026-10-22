/** @jsxImportSource @opentui/solid */
import { expect, test } from "bun:test"
import { testRender } from "@opentui/solid"
import { Host } from "@opencode/plugin/host"
import type { Context, SlotClaim } from "@opencode/plugin/tui/context"
import plugin from "../src/tui"

// OpenCode resolves local directories from their root, not package exports.
test("the local plugin directory exposes its TUI entrypoint", () => {
  expect(Host.resolve({ directory: new URL("..", import.meta.url).pathname }).tui).toEndWith("/tui.tsx")
})

// Mount the actual slot contribution against child and root session metadata.
test("renders the editor on the native child slot, not on a root session", async () => {
  let slot: SlotClaim | undefined
  const context = {
    data: { session: { get: (id: string) => (id === "child" ? { parentID: "parent" } : {}) } },
    keymap: { layer: () => {}, mode: { push: () => () => {} } },
    client: { session: { prompt: async () => {} } },
    theme: { text: { base: "#ffffff", muted: "#888888", feedback: { error: { base: "#ff0000" }, info: { base: "#00ff00" } } } },
    ui: { slot: (claim: SlotClaim) => { slot = claim; return () => {} } },
  } as unknown as Context
  plugin.setup(context)
  expect(slot).toBeDefined()
  if (!slot) throw new Error("Slot was not registered")
  const render = slot.render as (input: { sessionID: string }) => ReturnType<SlotClaim["render"]>

  const child = await testRender(() => render({ sessionID: "child" }), { width: 80, height: 12 })
  try {
    await child.renderOnce()
    expect(child.captureCharFrame()).toContain("Chat with this subagent")
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
