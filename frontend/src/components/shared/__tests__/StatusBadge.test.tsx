import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { StatusBadge } from "../StatusBadge";

describe("StatusBadge", () => {
  it("renders the status text", () => {
    render(<StatusBadge status="DONE" />);
    expect(screen.getByText("DONE")).toBeInTheDocument();
  });

  it("applies green colors for DONE status", () => {
    render(<StatusBadge status="DONE" />);
    const badge = screen.getByText("DONE");
    expect(badge.className).toContain("bg-green-100");
    expect(badge.className).toContain("text-green-800");
  });

  it("applies red colors for FAILED status", () => {
    render(<StatusBadge status="FAILED" />);
    const badge = screen.getByText("FAILED");
    expect(badge.className).toContain("bg-red-100");
    expect(badge.className).toContain("text-red-800");
  });

  it("applies orange colors for NEEDS_REVIEW status", () => {
    render(<StatusBadge status="NEEDS_REVIEW" />);
    const badge = screen.getByText("NEEDS_REVIEW");
    expect(badge.className).toContain("bg-orange-100");
  });

  it("applies gray fallback for unknown status", () => {
    render(<StatusBadge status="UNKNOWN_STATUS" />);
    const badge = screen.getByText("UNKNOWN_STATUS");
    expect(badge.className).toContain("bg-gray-100");
  });

  it("applies custom className", () => {
    render(<StatusBadge status="CREATED" className="my-custom" />);
    const badge = screen.getByText("CREATED");
    expect(badge.className).toContain("my-custom");
  });

  it("renders each pipeline state with correct colors", () => {
    const states = [
      { status: "CREATED", color: "bg-gray-100" },
      { status: "UPLOADING", color: "bg-blue-100" },
      { status: "INDEXING", color: "bg-sky-100" },
      { status: "ROUTING", color: "bg-cyan-100" },
      { status: "EXTRACTING", color: "bg-indigo-100" },
      { status: "PRICING", color: "bg-violet-100" },
      { status: "GENERATING", color: "bg-purple-100" },
    ];

    for (const { status, color } of states) {
      const { unmount } = render(<StatusBadge status={status} />);
      expect(screen.getByText(status).className).toContain(color);
      unmount();
    }
  });
});
