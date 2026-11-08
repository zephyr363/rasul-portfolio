import { act, fireEvent, render, screen } from "@testing-library/react";
import { createMemoryRouter, Link, Navigate, RouterProvider } from "react-router-dom";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useUnsavedChanges } from "./navigation-protection";

function Editor({ dirty, pending }: { dirty: boolean; pending: boolean }) {
  const { confirmDiscard } = useUnsavedChanges({ dirty, pending });
  return <><Link to="/next">Leave</Link><button onClick={confirmDiscard}>Discard</button></>;
}

function setup(dirty = true, pending = false) {
  const router = createMemoryRouter([
    { path: "/", element: <Editor dirty={dirty} pending={pending} /> },
    { path: "/next", element: <h1>Next</h1> },
  ]);
  const view = render(<RouterProvider router={router} />);
  return { router, ...view };
}

afterEach(() => vi.restoreAllMocks());
describe("unsaved navigation protection", () => {
  it("clean routes navigate without a confirmation", async () => {
    const confirm = vi.spyOn(window, "confirm");
    setup(false);
    fireEvent.click(screen.getByText("Leave"));
    expect(await screen.findByRole("heading", { name: "Next" })).toBeInTheDocument();
    expect(confirm).not.toHaveBeenCalled();
  });
  it("cancel keeps the editor, acceptance proceeds with exactly one prompt per attempt", async () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValueOnce(false).mockReturnValueOnce(true);
    const { router } = setup();
    fireEvent.click(screen.getByText("Leave"));
    expect(router.state.location.pathname).toBe("/");
    expect(confirm).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByText("Leave"));
    expect(await screen.findByRole("heading", { name: "Next" })).toBeInTheDocument();
    expect(confirm).toHaveBeenCalledTimes(2);
  });
  it("pending writes never proceed or offer discard even if confirmation would accept", async () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(true);
    const { router } = setup(true, true);
    fireEvent.click(screen.getByText("Leave"));
    fireEvent.click(screen.getByText("Discard"));
    await act(async () => { await router.navigate("/next"); });
    expect(router.state.location.pathname).toBe("/");
    expect(confirm).not.toHaveBeenCalled();
  });
  it.each([[true, false], [false, true], [false, false]])("beforeunload dirty=%s pending=%s", (dirty, pending) => {
    const { unmount } = setup(dirty, pending);
    const event = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(dirty || pending);
    unmount();
    const after = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(after);
    expect(after.defaultPrevented).toBe(false);
  });
  it("blocks browser-history back and permits a confirmed second attempt", async () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValueOnce(false).mockReturnValueOnce(true);
    const router = createMemoryRouter([
      { path: "/", element: <Editor dirty pending={false} /> },
      { path: "/next", element: <h1>Next</h1> },
    ], { initialEntries: ["/next", "/"], initialIndex: 1 });
    render(<RouterProvider router={router} />);
    await act(async () => { await router.navigate(-1); });
    expect(router.state.location.pathname).toBe("/");
    await act(async () => { await router.navigate(-1); });
    expect(await screen.findByRole("heading", { name: "Next" })).toBeInTheDocument();
    expect(confirm).toHaveBeenCalledTimes(2);
  });
  it("auth revocation may remove protected content and redirect without prompting", async () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    function Gate() {
      const [allowed, setAllowed] = useState(true);
      return allowed ? <><button onClick={() => setAllowed(false)}>Revoke</button><Editor dirty pending /></> : <Navigate to="/login" replace />;
    }
    render(<RouterProvider router={createMemoryRouter([
      { path: "/", element: <Gate /> },
      { path: "/login", element: <h1>Login</h1> },
    ])} />);
    fireEvent.click(screen.getByText("Revoke"));
    expect(await screen.findByRole("heading", { name: "Login" })).toBeInTheDocument();
    expect(confirm).not.toHaveBeenCalled();
  });
});
