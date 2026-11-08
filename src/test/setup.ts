import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// Без `globals` авто-очистка DOM у @testing-library/react не регистрируется,
// из-за чего DOM накапливается между тестами и возникают дублирующиеся элементы.
afterEach(() => {
  cleanup();
});
