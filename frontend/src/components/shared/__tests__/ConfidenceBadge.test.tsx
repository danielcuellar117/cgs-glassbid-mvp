import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ConfidenceBadge } from "../ConfidenceBadge";

describe("ConfidenceBadge", () => {
  it("renders N/A when confidence is null", () => {
    render(<ConfidenceBadge confidence={null} />);
    expect(screen.getByText("N/A")).toBeInTheDocument();
  });

  it("renders N/A when confidence is undefined", () => {
    render(<ConfidenceBadge confidence={undefined} />);
    expect(screen.getByText("N/A")).toBeInTheDocument();
  });

  it("renders percentage for high confidence (>=0.9)", () => {
    render(<ConfidenceBadge confidence={0.95} />);
    const badge = screen.getByText("95%");
    expect(badge).toBeInTheDocument();
    expect(badge.className).toContain("bg-green-100");
  });

  it("renders percentage for medium confidence (>=0.5, <0.9)", () => {
    render(<ConfidenceBadge confidence={0.7} />);
    const badge = screen.getByText("70%");
    expect(badge).toBeInTheDocument();
    expect(badge.className).toContain("bg-yellow-100");
  });

  it("renders percentage for low confidence (<0.5)", () => {
    render(<ConfidenceBadge confidence={0.3} />);
    const badge = screen.getByText("30%");
    expect(badge).toBeInTheDocument();
    expect(badge.className).toContain("bg-red-100");
  });

  it("renders 100% for confidence of 1.0", () => {
    render(<ConfidenceBadge confidence={1.0} />);
    expect(screen.getByText("100%")).toBeInTheDocument();
  });

  it("renders 0% for confidence of 0", () => {
    render(<ConfidenceBadge confidence={0} />);
    expect(screen.getByText("0%")).toBeInTheDocument();
  });

  it("applies green styling at boundary 0.9", () => {
    render(<ConfidenceBadge confidence={0.9} />);
    const badge = screen.getByText("90%");
    expect(badge.className).toContain("bg-green-100");
  });

  it("applies yellow styling at boundary 0.5", () => {
    render(<ConfidenceBadge confidence={0.5} />);
    const badge = screen.getByText("50%");
    expect(badge.className).toContain("bg-yellow-100");
  });

  it("applies custom className", () => {
    render(<ConfidenceBadge confidence={0.8} className="custom-class" />);
    const badge = screen.getByText("80%");
    expect(badge.className).toContain("custom-class");
  });
});
