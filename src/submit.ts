export type SubmitClient = {
  session: {
    prompt(input: { sessionID: string; text: string; delivery: "steer" }): Promise<unknown>
  }
}

// Admit one draft at a time to the session that owns this editor.
export function createSubmit(input: {
  client: SubmitClient
  sessionID: string
  draft: () => string
  clear: (submitted: string) => void
  status: (message: string, error?: boolean) => void
}) {
  let busy = false

  return {
    get busy() {
      return busy
    },
    async send() {
      const text = input.draft()
      if (busy || !text.trim()) return
      busy = true
      input.status("Sending to this subagent…")

      try {
        await input.client.session.prompt({ sessionID: input.sessionID, text, delivery: "steer" })
        input.clear(text)
        input.status("Accepted by subagent; running sessions receive steering at a safe step boundary.")
      } catch (error) {
        const detail = error instanceof Error ? error.message : String(error)
        input.status(`Send failed: ${detail}. Check the transcript before retrying; the draft is preserved.`, true)
      } finally {
        busy = false
      }
    },
  }
}
