import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { ThemeProvider, useTheme } from "./theme";
let changed: (event: { matches: boolean }) => void;
function Probe() {
  const { theme, preference, setPreference, toggle } = useTheme();
  return <><p>{preference}:{theme}</p><button onClick={toggle}>Toggle</button><button onClick={() => setPreference("system")}>System</button></>;
}
beforeEach(() => {
  localStorage.clear();
  vi.stubGlobal("matchMedia", vi.fn(() => ({ matches: false, addEventListener: (_event: string, cb: typeof changed) => { changed = cb; }, removeEventListener: vi.fn() })));
});
afterEach(() => vi.unstubAllGlobals());
it("preserves toggle and saved theme while returning to live system updates", () => {
  render(<ThemeProvider><Probe /></ThemeProvider>);
  expect(screen.getByText("system:light")).toBeInTheDocument();
  act(() => changed({ matches: true })); expect(screen.getByText("system:dark")).toBeInTheDocument();
  fireEvent.click(screen.getByText("Toggle")); expect(screen.getByText("light:light")).toBeInTheDocument();
  expect(localStorage.getItem("rasul-theme")).toBe("light");
  fireEvent.click(screen.getByText("System")); expect(screen.getByText("system:dark")).toBeInTheDocument();
  expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
  expect(localStorage.getItem("rasul-theme")).toBeNull();
});
it("reads existing explicit preference", () => {
  localStorage.setItem("rasul-theme", "dark"); render(<ThemeProvider><Probe /></ThemeProvider>);
  expect(screen.getByText("dark:dark")).toBeInTheDocument();
});
