import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { PipelineStepper } from "../PipelineStepper";
import { PIPELINE_STEPS } from "@/lib/constants";

describe("PipelineStepper", () => {
  it("renders all pipeline steps with human-friendly labels", () => {
    render(<PipelineStepper currentStatus="CREATED" />);
    expect(screen.getByText("Created")).toBeInTheDocument();
    expect(screen.getByText("Uploading")).toBeInTheDocument();
    expect(screen.getByText("Complete")).toBeInTheDocument();
  });

  it("marks completed steps with check icon", () => {
    const { container } = render(<PipelineStepper currentStatus="EXTRACTING" />);
    // Steps before EXTRACTING: CREATED, UPLOADING, UPLOADED, INDEXING, ROUTING = 5
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
    const greenCircles = container.querySelectorAll(".bg-green-500");
    expect(greenCircles.length).toBe(0);
  });

  it("shows DONE state with all steps completed", () => {
    const { container } = render(<PipelineStepper currentStatus="DONE" />);
    const greenCircles = container.querySelectorAll(".bg-green-500");
    expect(greenCircles.length).toBe(PIPELINE_STEPS.length);
  });

  it("applies custom className", () => {
    const { container } = render(
      <PipelineStepper currentStatus="CREATED" className="my-class" />,
    );
    expect(container.firstChild).toHaveClass("my-class");
  });
});
