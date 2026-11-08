import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import { LoadingScreen } from "./LoadingScreen";

it("announces indeterminate loading and keeps its decorative indicator motion-safe", () => {
  const { container } = render(<LoadingScreen fullPage label="Проверка доступа…" />);
  const status = screen.getByRole("status");
  expect(status).toHaveTextContent("Проверка доступа…");
  expect(status).toHaveAttribute("aria-live", "polite");
  expect(status).toHaveClass("min-h-screen", "items-center", "justify-center");
  expect(container.querySelector('[aria-hidden="true"]')).toHaveClass("motion-safe:animate-spin", "motion-reduce:animate-none");
});

it("uses section height without a full-page takeover by default", () => {
  render(<LoadingScreen />);
  expect(screen.getByRole("status")).toHaveClass("min-h-[16rem]");
  expect(screen.getByRole("status")).not.toHaveClass("min-h-screen");
});
