import { act, fireEvent, render, screen } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { beforeEach, expect, it, vi } from "vitest";
import type { User } from "firebase/auth";
import { AdminLayout } from "./AdminLayout";
import { useUnsavedChanges } from "./lib/navigation-protection";

const { signOutUser } = vi.hoisted(() => ({ signOutUser: vi.fn() }));
vi.mock("@/admin/lib/auth", () => ({ signOutUser }));
function Editor({ pending }: { pending: boolean }) {
  useUnsavedChanges({ dirty: true, pending });
  return <h1>Editor</h1>;
}
function setup(pending = false) {
  render(<RouterProvider router={createMemoryRouter([{
    path: "/", element: <AdminLayout user={{ email: "owner@example.com" } as User} />,
    children: [{ index: true, element: <Editor pending={pending} /> }],
  }])} />);
}
beforeEach(() => { vi.restoreAllMocks(); signOutUser.mockReset().mockResolvedValue(undefined); });
it("logout confirms before calling auth and cancellation preserves the editor", async () => {
  const confirm = vi.spyOn(window, "confirm").mockReturnValueOnce(false).mockReturnValueOnce(true);
  setup();
  const logout = screen.getAllByRole("button").find((button) => button.querySelector(".lucide-log-out"))!;
  fireEvent.click(logout);
  expect(signOutUser).not.toHaveBeenCalled();
  expect(screen.getByRole("heading", { name: "Editor" })).toBeInTheDocument();
  await act(async () => fireEvent.click(logout));
  expect(signOutUser).toHaveBeenCalledTimes(1);
  expect(confirm).toHaveBeenCalledTimes(2);
});
it("pending write blocks logout without a confirmation", () => {
  const confirm = vi.spyOn(window, "confirm").mockReturnValue(true);
  setup(true);
  const logout = screen.getAllByRole("button").find((button) => button.querySelector(".lucide-log-out"))!;
  fireEvent.click(logout);
  expect(signOutUser).not.toHaveBeenCalled();
  expect(confirm).not.toHaveBeenCalled();
});
