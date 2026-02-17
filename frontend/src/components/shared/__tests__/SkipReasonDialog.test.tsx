import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { SkipReasonDialog } from "../SkipReasonDialog";

const defaultProps = {
  title: "Skip These Tasks",
  description: "Select a reason to skip",
  onConfirm: vi.fn(),
  onCancel: vi.fn(),
};

describe("SkipReasonDialog", () => {
  it("renders title and description", () => {
    render(<SkipReasonDialog {...defaultProps} />);
    expect(screen.getByText("Skip These Tasks")).toBeInTheDocument();
    expect(screen.getByText("Select a reason to skip")).toBeInTheDocument();
  });

  it("renders all preset reasons", () => {
    render(<SkipReasonDialog {...defaultProps} />);
    expect(screen.getByText("Not a glass/window page")).toBeInTheDocument();
    expect(screen.getByText("Specifications or text only")).toBeInTheDocument();
    expect(screen.getByText("Duplicate or repeated content")).toBeInTheDocument();
    expect(screen.getByText("Not applicable to this bid")).toBeInTheDocument();
    expect(screen.getByText("Page cannot be measured accurately")).toBeInTheDocument();
  });

  it("renders custom reason option", () => {
    render(<SkipReasonDialog {...defaultProps} />);
    expect(screen.getByText("Other (custom reason)...")).toBeInTheDocument();
  });

  it("calls onCancel when cancel button is clicked", () => {
    const onCancel = vi.fn();
    render(<SkipReasonDialog {...defaultProps} onCancel={onCancel} />);
    fireEvent.click(screen.getByText("Cancel"));
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it("calls onCancel when close button is clicked", () => {
    const onCancel = vi.fn();
    render(<SkipReasonDialog {...defaultProps} onCancel={onCancel} />);
    fireEvent.click(screen.getByLabelText("Close"));
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it("submit button is disabled when no reason selected", () => {
    render(<SkipReasonDialog {...defaultProps} />);
    const footer = screen.getByText("Cancel").parentElement!;
    const submitBtn = within(footer).getByRole("button", { name: "Skip Tasks" });
    expect(submitBtn).toBeDisabled();
  });

  it("calls onConfirm with preset reason when selected and submitted", () => {
    const onConfirm = vi.fn();
    render(<SkipReasonDialog {...defaultProps} onConfirm={onConfirm} />);

    fireEvent.click(screen.getByText("Not a glass/window page"));
    const footer = screen.getByText("Cancel").parentElement!;
    fireEvent.click(within(footer).getByRole("button", { name: "Skip Tasks" }));

    expect(onConfirm).toHaveBeenCalledWith("Not a glass/window page");
  });

  it("shows textarea when custom reason is selected", () => {
    render(<SkipReasonDialog {...defaultProps} />);
    fireEvent.click(screen.getByText("Other (custom reason)..."));
    expect(screen.getByPlaceholderText(/Describe why/)).toBeInTheDocument();
  });

  it("calls onConfirm with custom reason text", () => {
    const onConfirm = vi.fn();
    render(<SkipReasonDialog {...defaultProps} onConfirm={onConfirm} />);

    fireEvent.click(screen.getByText("Other (custom reason)..."));
    const textarea = screen.getByPlaceholderText(/Describe why/);
    fireEvent.change(textarea, { target: { value: "Custom reason here" } });
    const footer = screen.getByText("Cancel").parentElement!;
    fireEvent.click(within(footer).getByRole("button", { name: "Skip Tasks" }));

    expect(onConfirm).toHaveBeenCalledWith("Custom reason here");
  });

  it("shows 'Skipping...' when isPending is true", () => {
    render(<SkipReasonDialog {...defaultProps} isPending />);
    expect(screen.getByText("Skipping...")).toBeInTheDocument();
  });

  it("disables buttons when isPending", () => {
    render(<SkipReasonDialog {...defaultProps} isPending />);
    expect(screen.getByText("Cancel")).toBeDisabled();
    expect(screen.getByText("Skipping...")).toBeDisabled();
  });
});
