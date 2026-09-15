import { render, screen } from "@testing-library/react"

import App from "./App"

test("renders the application", () => {
  render(<App />)

  expect(
    screen.getByRole("heading", { level: 1, name: "Get started" }),
  ).toBeInTheDocument()
})