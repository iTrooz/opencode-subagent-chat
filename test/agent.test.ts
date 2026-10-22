import { expect, test } from "bun:test"
import { createAgentSwitch } from "../src/agent"

// Exercise the real selector boundary with fake clients; no existing session is mutated.
test("shows Build, Plan and the original child agent and switches only the child", async () => {
  const requests: unknown[] = []
  let agent = "general"
  const selected: string[] = []
  const messages: string[] = []
  const switchAgent = createAgentSwitch({
    client: {
      agent: { list: async () => ({ data: [
        { id: "build", mode: "primary" }, { id: "plan", mode: "primary" }, { id: "general", mode: "subagent" },
      ] }) },
      session: { switchAgent: async (input) => { requests.push(input); agent = input.agent } },
    },
    sessionID: "child-123",
    session: () => ({ agent, parentID: "parent", location: { directory: "/example" } }),
    status: () => "idle",
    sending: () => false,
    original: "general",
    select: async (options) => {
      expect(options.options.map((choice) => choice.title)).toEqual(["Build", "Plan", "Original (general)"])
      expect(options.current).toBe(agent)
      return agent === "general" ? "plan" : "general"
    },
    feedback: (message) => messages.push(message),
    onSelected: (name) => selected.push(name),
  })

  await switchAgent()
  await switchAgent()
  expect(requests).toEqual([
    { sessionID: "child-123", agent: "plan" },
    { sessionID: "child-123", agent: "general" },
  ])
  expect(messages[0]).toContain("Next reply uses its instructions and permissions")
  expect(selected).toEqual(["plan", "general"])
})

// Refuse switching while a prompt is being admitted or execution is running.
test("does not switch during execution, including when it starts inside the picker", async () => {
  let running = true
  let sending = false
  let calls = 0
  const messages: string[] = []
  const switchAgent = createAgentSwitch({
    client: {
      agent: { list: async () => ({ data: [{ id: "plan", mode: "primary" }] }) },
      session: { switchAgent: async () => { calls++ } },
    },
    sessionID: "child-123",
    session: () => ({ parentID: "parent", location: { directory: "/example" } }),
    status: () => running ? "running" : "idle",
    sending: () => sending,
    original: "",
    select: async () => { running = true; return "plan" },
    feedback: (message) => messages.push(message),
  })

  await switchAgent()
  expect(messages.at(-1)).toContain("Wait for this subagent")
  running = false
  sending = true
  await switchAgent()
  expect(calls).toBe(0)
  sending = false
  await switchAgent()
  expect(messages.at(-1)).toContain("agent was not changed")
  expect(calls).toBe(0)
})

// Surface server failures without claiming the agent changed.
test("reports switch errors and does not switch a root session", async () => {
  let parentID: string | undefined = "parent"
  let message = ""
  let error = false
  const switchAgent = createAgentSwitch({
    client: {
      agent: { list: async () => ({ data: [{ id: "build", mode: "primary" }] }) },
      session: { switchAgent: async () => { throw new Error("denied") } },
    },
    sessionID: "child-123",
    session: () => ({ parentID, location: { directory: "/example" } }),
    status: () => "idle",
    sending: () => false,
    original: "",
    select: async () => "build",
    feedback: (text, failed) => { message = text; error = !!failed },
  })

  await switchAgent()
  expect(message).toContain("denied")
  expect(error).toBe(true)
  parentID = undefined
  message = ""
  await switchAgent()
  expect(message).toBe("")
})
