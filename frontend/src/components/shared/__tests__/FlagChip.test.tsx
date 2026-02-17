import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { FlagChip } from "../FlagChip";

describe("FlagChip", () => {
  it("renders NEEDS_REVIEW flag with formatted text", () => {
    render(<FlagChip flag="NEEDS_REVIEW" />);
    expect(screen.getByText("NEEDS REVIEW")).toBeInTheDocument();
  });

  it("renders TO_BE_VERIFIED_IN_FIELD flag", () => {
    render(<FlagChip flag="TO_BE_VERIFIED_IN_FIELD" />);
    expect(screen.getByText("TO BE VERIFIED IN FIELD")).toBeInTheDocument();
  });

  it("applies orange styling for NEEDS_REVIEW", () => {
    render(<FlagChip flag="NEEDS_REVIEW" />);
    const chip = screen.getByText("NEEDS REVIEW").closest("span")!;
    expect(chip.className).toContain("bg-orange-100");
    expect(chip.className).toContain("text-orange-800");
  });

  it("applies red styling for TO_BE_VERIFIED_IN_FIELD", () => {
    render(<FlagChip flag="TO_BE_VERIFIED_IN_FIELD" />);
    const chip = screen.getByText("TO BE VERIFIED IN FIELD").closest("span")!;
    expect(chip.className).toContain("bg-red-100");
    expect(chip.className).toContain("text-red-800");
  });

  it("applies gray fallback styling for unknown flag", () => {
    render(<FlagChip flag="UNKNOWN_FLAG" />);
    const chip = screen.getByText("UNKNOWN FLAG").closest("span")!;
    expect(chip.className).toContain("bg-gray-100");
  });

  it("replaces underscores with spaces in flag text", () => {
    render(<FlagChip flag="SOME_CUSTOM_FLAG" />);
    expect(screen.getByText("SOME CUSTOM FLAG")).toBeInTheDocument();
  });

  it("applies custom className", () => {
    render(<FlagChip flag="NEEDS_REVIEW" className="extra-class" />);
    const chip = screen.getByText("NEEDS REVIEW").closest("span")!;
    expect(chip.className).toContain("extra-class");
  });
});
