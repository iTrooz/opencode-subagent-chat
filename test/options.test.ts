import { expect, test } from "bun:test"
import { formatKey, resolveOptions } from "../src/options"

test("switchAgentKey defaults to shift+tab", () => {
  expect(resolveOptions({})).toEqual({ switchAgentKey: "shift+tab" })
  expect(resolveOptions(undefined)).toEqual({ switchAgentKey: "shift+tab" })
})

test("switchAgentKey accepts and trims a custom binding", () => {
  expect(resolveOptions({ switchAgentKey: " alt+tab " })).toEqual({ switchAgentKey: "alt+tab" })
})

test("switchAgentKey can be disabled", () => {
  expect(resolveOptions({ switchAgentKey: false })).toEqual({ switchAgentKey: undefined })
  expect(resolveOptions({ switchAgentKey: "none" })).toEqual({ switchAgentKey: undefined })
  expect(resolveOptions({ switchAgentKey: " NONE " })).toEqual({ switchAgentKey: undefined })
})

test("invalid switchAgentKey is rejected", () => {
  expect(() => resolveOptions({ switchAgentKey: 1 })).toThrow("switchAgentKey")
  expect(() => resolveOptions({ switchAgentKey: "  " })).toThrow("switchAgentKey")
})

test("formatKey title-cases key combinations", () => {
  expect(formatKey("shift+tab")).toBe("Shift+Tab")
  expect(formatKey("alt+tab")).toBe("Alt+Tab")
  expect(formatKey("ctrl+shift+tab")).toBe("Ctrl+Shift+Tab")
  expect(formatKey("shift+tab,alt+tab")).toBe("Shift+Tab, Alt+Tab")
})
