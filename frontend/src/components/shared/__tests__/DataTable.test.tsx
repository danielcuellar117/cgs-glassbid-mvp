import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { DataTable, type Column } from "../DataTable";

interface TestRow {
  id: string;
  name: string;
  status: string;
  count: number;
  [key: string]: unknown;
}

const testData: TestRow[] = [
  { id: "1", name: "Alpha", status: "active", count: 10 },
  { id: "2", name: "Beta", status: "inactive", count: 5 },
  { id: "3", name: "Gamma", status: "active", count: 20 },
];

const columns: Column<TestRow>[] = [
  { key: "name", header: "Name", sortable: true },
  { key: "status", header: "Status" },
  { key: "count", header: "Count", sortable: true },
];

describe("DataTable", () => {
  it("renders table headers", () => {
    render(
      <DataTable data={testData} columns={columns} keyExtractor={(r) => r.id} />,
    );
    expect(screen.getByText("Name")).toBeInTheDocument();
    expect(screen.getByText("Status")).toBeInTheDocument();
    expect(screen.getByText("Count")).toBeInTheDocument();
  });

  it("renders all rows", () => {
    render(
      <DataTable data={testData} columns={columns} keyExtractor={(r) => r.id} />,
    );
    expect(screen.getByText("Alpha")).toBeInTheDocument();
    expect(screen.getByText("Beta")).toBeInTheDocument();
    expect(screen.getByText("Gamma")).toBeInTheDocument();
  });

  it("shows empty message when no data", () => {
    render(
      <DataTable data={[]} columns={columns} keyExtractor={(r) => r.id} />,
    );
    expect(screen.getByText("No data found.")).toBeInTheDocument();
  });

  it("shows custom empty message", () => {
    render(
      <DataTable
        data={[]}
        columns={columns}
        keyExtractor={(r) => r.id}
        emptyMessage="Nothing here"
      />,
    );
    expect(screen.getByText("Nothing here")).toBeInTheDocument();
  });

  it("calls onRowClick when a row is clicked", () => {
    const onClick = vi.fn();
    render(
      <DataTable
        data={testData}
        columns={columns}
        keyExtractor={(r) => r.id}
        onRowClick={onClick}
      />,
    );
    fireEvent.click(screen.getByText("Alpha"));
    expect(onClick).toHaveBeenCalledWith(testData[0]);
  });

  it("sorts data ascending on first click of sortable column", () => {
    render(
      <DataTable data={testData} columns={columns} keyExtractor={(r) => r.id} />,
    );

    fireEvent.click(screen.getByText("Count"));

    const rows = screen.getAllByRole("row");
    // Header row + 3 data rows
    expect(rows).toHaveLength(4);
    // After ascending sort by count: Beta(5), Alpha(10), Gamma(20)
    const cells = rows.slice(1).map((row) => row.textContent);
    expect(cells[0]).toContain("Beta");
    expect(cells[2]).toContain("Gamma");
  });

  it("toggles sort direction on second click", () => {
    render(
      <DataTable data={testData} columns={columns} keyExtractor={(r) => r.id} />,
    );

    const countHeader = screen.getByText("Count");
    fireEvent.click(countHeader); // asc
    fireEvent.click(countHeader); // desc

    const rows = screen.getAllByRole("row");
    const cells = rows.slice(1).map((row) => row.textContent);
    // After descending sort by count: Gamma(20), Alpha(10), Beta(5)
    expect(cells[0]).toContain("Gamma");
    expect(cells[2]).toContain("Beta");
  });

  it("uses custom render function for columns", () => {
    const customColumns: Column<TestRow>[] = [
      {
        key: "name",
        header: "Name",
        render: (row) => <strong data-testid="bold-name">{row.name}</strong>,
      },
    ];

    render(
      <DataTable
        data={testData}
        columns={customColumns}
        keyExtractor={(r) => r.id}
      />,
    );

    const boldNames = screen.getAllByTestId("bold-name");
    expect(boldNames).toHaveLength(3);
    expect(boldNames[0]).toHaveTextContent("Alpha");
  });

  it("applies custom className", () => {
    const { container } = render(
      <DataTable
        data={testData}
        columns={columns}
        keyExtractor={(r) => r.id}
        className="custom-table"
      />,
    );
    expect(container.firstChild).toHaveClass("custom-table");
  });
});
