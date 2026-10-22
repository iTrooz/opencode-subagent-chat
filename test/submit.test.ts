import { describe, expect, test } from "bun:test"
import { createSubmit } from "../src/submit"

// Exercise the same submission boundary used by the TUI without starting an agent.
describe("child follow-up submission", () => {
  test("steers only the owning child, waits for admission, and prevents duplicate sends", async () => {
    let release!: () => void
    const pending = new Promise<void>((resolve) => (release = resolve))
    const requests: unknown[] = []
    let draft = "follow up"
    const statuses: string[] = []
    const submit = createSubmit({
      client: {
        session: {
          prompt(input) {
            requests.push(input)
            return pending
          },
        },
      },
      sessionID: "child-123",
      draft: () => draft,
      clear: (sent) => {
        if (draft === sent) draft = ""
      },
      status: (message) => statuses.push(message),
    })

    const first = submit.send()
    await submit.send()
    expect(requests).toEqual([{ sessionID: "child-123", text: "follow up", delivery: "steer" }])
    expect(draft).toBe("follow up")
    expect(submit.busy).toBe(true)
    release()
    await first
    expect(submit.busy).toBe(false)
    expect(draft).toBe("")
    expect(statuses.at(-1)).toContain("safe step boundary")
  })

  test("retains text and reports rejection, then permits a manual retry", async () => {
    let draft = "retry me"
    let attempts = 0
    const statuses: Array<{ message: string; error?: boolean }> = []
    const submit = createSubmit({
      client: {
        session: {
          async prompt() {
            if (++attempts === 1) throw new Error("connection lost")
          },
        },
      },
      sessionID: "child-123",
      draft: () => draft,
      clear: (sent) => {
        if (draft === sent) draft = ""
      },
      status: (message, error) => statuses.push({ message, error }),
    })

    await submit.send()
    expect(draft).toBe("retry me")
    expect(statuses.at(-1)).toMatchObject({ error: true })
    expect(statuses.at(-1)?.message).toContain("Check the transcript before retrying")
    await submit.send()
    expect(attempts).toBe(2)
    expect(draft).toBe("")
  })

  test("does not clear text entered while the previous draft is being admitted", async () => {
    let release!: () => void
    let draft = "first"
    const submit = createSubmit({
      client: { session: { prompt: () => new Promise<void>((resolve) => (release = resolve)) } },
      sessionID: "child-123",
      draft: () => draft,
      clear: (sent) => {
        if (draft === sent) draft = ""
      },
      status: () => {},
    })

    const first = submit.send()
    draft = "first and more"
    release()
    await first
    expect(draft).toBe("first and more")
  })
})
