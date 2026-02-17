import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { PipelineStepper } from "../PipelineStepper";

describe("PipelineStepper", () => {
  it("renders all pipeline steps", () => {
    render(<PipelineStepper currentStatus="CREATED" />);
    expect(screen.getByText("CREATED")).toBeInTheDocument();
    expect(screen.getByText("UPLOADING")).toBeInTheDocument();
    expect(screen.getByText("DONE")).toBeInTheDocument();
  });

  it("marks completed steps with check icon", () => {
    const { container } = render(<PipelineStepper currentStatus="EXTRACTING" />);
    // Steps before EXTRACTING (CREATED, UPLOADING, UPLOADED, INDEXING, ROUTING) should be green
    const greenCircles = container.querySelectorAll(".bg-green-500");
    expect(greenCircles.length).toBe(5);
  });

  it("marks current active step with primary color", () => {
    const { container } = render(<PipelineStepper currentStatus="INDEXING" />);
    const pulsingElements = container.querySelectorAll(".animate-pulse");
    expect(pulsingElements.length).toBeGreaterThan(0);
  });

  it("handles FAILED status with red styling", () => {
    const { container } = render(<PipelineStepper currentStatus="FAILED" />);
    // FAILED is not in PIPELINE_STEPS, so currentIdx will be -1
    // No steps should be completed since isFailed is true
    const greenCircles = container.querySelectorAll(".bg-green-500");
    expect(greenCircles.length).toBe(0);
  });

  it("shows DONE state with all steps completed", () => {
    const { container } = render(<PipelineStepper currentStatus="DONE" />);
    // All steps before DONE should be green
    const greenCircles = container.querySelectorAll(".bg-green-500");
    expect(greenCircles.length).toBe(9); // 9 steps before DONE
  });

  it("applies custom className", () => {
    const { container } = render(
      <PipelineStepper currentStatus="CREATED" className="my-class" />,
    );
    expect(container.firstChild).toHaveClass("my-class");
  });
});
