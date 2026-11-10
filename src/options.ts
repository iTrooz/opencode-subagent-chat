export interface Options {
  /** Keybinding for the subagent agent picker; undefined disables it. */
  switchAgentKey: string | undefined
}

const DEFAULT_SWITCH_AGENT_KEY = "shift+tab"

export function resolveOptions(input: Readonly<Record<string, unknown>> | undefined): Options {
  const value = input?.switchAgentKey
  if (value === undefined) return { switchAgentKey: DEFAULT_SWITCH_AGENT_KEY }
  if (value === false || (typeof value === "string" && value.trim().toLowerCase() === "none")) {
    return { switchAgentKey: undefined }
  }
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error('switchAgentKey must be a keybinding string, false, or "none"')
  }
  return { switchAgentKey: value.trim() }
}

export function formatKey(key: string): string {
  return key
    .split(",")
    .map((combo) =>
      combo
        .split("+")
        .map((part) => {
          const trimmed = part.trim()
          if (!trimmed) return trimmed
          return trimmed.length === 1
            ? trimmed.toUpperCase()
            : trimmed.charAt(0).toUpperCase() + trimmed.slice(1)
        })
        .join("+"),
    )
    .join(", ")
}
