import { render, screen } from "@testing-library/react"
import { afterEach, describe, expect, test, vi } from "vitest"

import App from "./App"

afterEach(() => {
  vi.restoreAllMocks()
})

describe("App", () => {
  test("shows loading state while system status is being fetched", () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(
      () => new Promise(() => {}),
    )

    render(<App />)

    expect(
      screen.getByText("Loading system status..."),
    ).toBeInTheDocument()
  })

  test("shows API health and version information", async () => {
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ status: "ok" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            version: "0.1.0",
            environment: "development",
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          },
        ),
      )

    render(<App />)

    expect(
      await screen.findByText("API Status: ok"),
    ).toBeInTheDocument()

    expect(screen.getByText("Version: 0.1.0")).toBeInTheDocument()
    expect(
      screen.getByText("Environment: development"),
    ).toBeInTheDocument()
  })

  test("shows an error when the API cannot be reached", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(
      new Error("API unavailable"),
    )

    render(<App />)

    expect(
      await screen.findByText("Unable to connect to the API"),
    ).toBeInTheDocument()
  })
})