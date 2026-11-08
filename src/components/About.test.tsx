import { render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import raw from "../../content/locales.json";

vi.mock("@/lib/i18n", () => ({
  useLocale: () => ({ copy: { ...raw.locales.ru, experience: { items: [] } } }),
}));

import { About } from "./About";

it("keeps about content but hides the empty experience timeline", () => {
  const { container } = render(<About />);
  expect(container.querySelector("#about")).not.toBeNull();
  expect(screen.getByText(raw.locales.ru.about.lead)).toBeInTheDocument();
  expect(container.querySelector("#experience")).toBeNull();
  expect(screen.queryByRole("list")).not.toBeInTheDocument();
});
