export type ChildSession = {
  parentID?: string
  agent?: string
  location: { directory: string }
}

export type AgentClient = {
  agent: {
    list(input: { location: { directory: string } }): Promise<{
      data: readonly { id: string; mode: string; hidden?: boolean }[]
    }>
  }
  session: { switchAgent(input: { sessionID: string; agent: string }): Promise<void> }
}

// Change the child's actual agent only after the user selects an available agent while idle.
export function createAgentSwitch(input: {
  client: AgentClient
  sessionID: string
  session: () => ChildSession | undefined
  status: () => "idle" | "running"
  sending: () => boolean
  original: string
  select: (options: {
    title: string
    current?: string
    options: { title: string; value: string; description: string }[]
  }) => Promise<string | undefined>
  feedback: (message: string, error?: boolean) => void
  onSelected?: (agent: string) => void
}) {
  let switching = false

  return async function switchAgent() {
    if (switching || !input.session()?.parentID) return
    if (input.sending() || input.status() !== "idle") {
      input.feedback("Wait for this subagent to finish before changing its agent.")
      return
    }

    switching = true
    try {
      const current = input.session()!
      const result = await input.client.agent.list({ location: { directory: current.location.directory } })
      const options = ["build", "plan", input.original]
        .filter((id, index, ids) => id && ids.indexOf(id) === index)
        .filter((id) => result.data.some((agent) => agent.id === id && !agent.hidden && (id === input.original || agent.mode !== "subagent")))
        .map((id) => ({
          title:
            id === input.original && id !== "build" && id !== "plan"
              ? `Original (${id})`
              : id === "build"
                ? "Build"
                : "Plan",
          value: id,
          description: "Changes the child's instructions and permissions, not its model or transcript",
        }))

      if (!options.length) {
        input.feedback("Build and Plan agents are unavailable in this session's location.", true)
        return
      }

      const selected = await input.select({ title: "Choose this subagent's agent", current: current.agent, options })
      if (!selected || selected === input.session()?.agent) return
      if (!input.session()?.parentID || input.sending() || input.status() !== "idle") {
        input.feedback("This subagent started running; agent was not changed.")
        return
      }

      await input.client.session.switchAgent({ sessionID: input.sessionID, agent: selected })
      input.onSelected?.(selected)
      input.feedback(`Subagent agent set to ${selected}. Next reply uses its instructions and permissions.`)
    } catch (error) {
      input.feedback(`Could not change subagent agent: ${error instanceof Error ? error.message : String(error)}`, true)
    } finally {
      switching = false
    }
  }
}
