import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ photoUrl: undefined as string | undefined }));
vi.mock("@/lib/i18n", () => ({ useLocale: () => ({ copy: { hero: { title: "Title", sub: "Subtitle", lead: "Lead", ctaPrimary: "Contact", ctaSecondary: "Services", photoAlt: "Portrait", photoUrl: state.photoUrl } } }) }));
vi.mock("./SectionNext", () => ({ SectionNext: () => null }));
import { Hero } from "./Hero";

const externalPhotoUrl = "https://lh3.google.com/u/0/d/1CqupFBSMr-e2jjZAso4hNFcgJLsssiDB=w1920-h868-iv1?auditContext=forDisplay";

it("uses a saved URL without replacing it on error, and defaults only for blank", () => {
  state.photoUrl = "https://example.com/saved.jpg";
  const { rerender } = render(<Hero />);
  fireEvent.error(screen.getByAltText("Portrait"));
  expect(screen.getByAltText("Portrait")).toHaveAttribute("src", state.photoUrl);
  state.photoUrl = "  ";
  rerender(<Hero />);
  expect(screen.getByAltText("Portrait")).toHaveAttribute("src", externalPhotoUrl);
  state.photoUrl = undefined;
});

it("renders the exact external portrait and completes its loading state", () => {
  render(<Hero />);
  const image = screen.getByAltText("Portrait");
  expect(screen.getByText("Title")).toBeInTheDocument();
  expect(image).toHaveAttribute("src", externalPhotoUrl);
  expect(image).toHaveAttribute("width", "800");
  expect(image).toHaveAttribute("height", "1000");
  expect(image).toHaveAttribute("aria-busy", "true");
  fireEvent.load(image);
  expect(image).toHaveAttribute("aria-busy", "false");
});

it("keeps the external URL without any fallback after an image error", () => {
  render(<Hero />);
  const image = screen.getByAltText("Portrait");
  fireEvent.error(image);
  expect(image).toHaveAttribute("src", externalPhotoUrl);
  expect(image).not.toHaveAttribute("srcset");
  expect(screen.getAllByRole("img")).toHaveLength(1);
  expect(image).toHaveAttribute("aria-busy", "false");
});
