import { useParams } from "react-router-dom";
import {
  usePricingRules,
  useCreatePricingRule,
  useUpdatePricingRule,
  useDeletePricingRule,
} from "@/api/hooks/usePricing";
import { Loader2, Plus, Trash2, Save } from "lucide-react";
import { useState, useCallback } from "react";

export function RulesEditor() {
  const { id: pricebookId } = useParams<{ id: string }>();
  const { data: rules, isLoading } = usePricingRules(pricebookId!);
  const createRule = useCreatePricingRule();
  const updateRule = useUpdatePricingRule();
  const deleteRule = useDeletePricingRule();

  const [showNew, setShowNew] = useState(false);
  const [newForm, setNewForm] = useState({
    name: "",
    category: "shower",
    formulaType: "unit_price",
    price: "",
  });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({
    name: "",
    category: "",
    formulaType: "",
    price: "",
    active: true,
  });

  const handleCreate = useCallback(async () => {
    await createRule.mutateAsync({
      pricebookVersionId: pricebookId!,
      name: newForm.name,
      category: newForm.category,
      formulaType: newForm.formulaType,
      formulaJson: { price: parseFloat(newForm.price) || 0 },
    });
    setShowNew(false);
    setNewForm({ name: "", category: "shower", formulaType: "unit_price", price: "" });
  }, [newForm, pricebookId, createRule]);

  const startEdit = useCallback((rule: (typeof rules extends (infer T)[] | undefined ? T : never)) => {
    if (!rule) return;
    setEditingId(rule.id);
    const formula = rule.formulaJson as Record<string, unknown> | null;
    setEditForm({
      name: rule.name,
      category: rule.category,
      formulaType: rule.formulaType,
      price: String(formula?.price ?? ""),
      active: rule.active,
    });
  }, []);

  const handleSaveEdit = useCallback(async () => {
    if (!editingId) return;
    await updateRule.mutateAsync({
      id: editingId,
      name: editForm.name,
      category: editForm.category,
      formulaType: editForm.formulaType,
      formulaJson: { price: parseFloat(editForm.price) || 0 },
      active: editForm.active,
    });
    setEditingId(null);
  }, [editingId, editForm, updateRule]);

  const handleDelete = useCallback(
    async (id: string) => {
      if (!confirm("Delete this rule?")) return;
      await deleteRule.mutateAsync(id);
    },
    [deleteRule],
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Rules Editor</h1>
          <p className="text-sm text-muted-foreground">
            Pricebook: {pricebookId?.slice(0, 8)}... | {rules?.length ?? 0} rules
          </p>
        </div>
        <button
          onClick={() => setShowNew(true)}
          className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow hover:bg-primary/90"
        >
          <Plus size={16} /> Add Rule
        </button>
      </div>

      {/* New rule form */}
      {showNew && (
        <div className="rounded-lg border border-border bg-card p-4 space-y-3">
          <h3 className="font-semibold">New Pricing Rule</h3>
          <div className="grid grid-cols-2 gap-3">
            <input
              placeholder="Rule name"
              value={newForm.name}
              onChange={(e) => setNewForm({ ...newForm, name: e.target.value })}
              className="rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
            <select
              value={newForm.category}
              onChange={(e) => setNewForm({ ...newForm, category: e.target.value })}
              className="rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="shower">Shower</option>
              <option value="mirror">Mirror</option>
              <option value="hardware">Hardware</option>
              <option value="labor">Labor</option>
              <option value="other">Other</option>
            </select>
            <select
              value={newForm.formulaType}
              onChange={(e) => setNewForm({ ...newForm, formulaType: e.target.value })}
              className="rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="unit_price">Unit Price</option>
              <option value="per_sqft">Per Sq Ft</option>
              <option value="fixed">Fixed</option>
            </select>
            <input
              type="number"
              step="0.01"
              placeholder="Price"
              value={newForm.price}
              onChange={(e) => setNewForm({ ...newForm, price: e.target.value })}
              className="rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleCreate}
              disabled={!newForm.name || createRule.isPending}
              className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              Create
            </button>
            <button
              onClick={() => setShowNew(false)}
              className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-muted"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Rules table */}
      <div className="overflow-x-auto rounded-lg border border-border bg-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/50">
              {["Name", "Category", "Formula", "Price", "Active", "Actions"].map((h) => (
                <th
                  key={h}
                  className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(rules ?? []).length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                  No rules defined yet.
                </td>
              </tr>
            ) : (
              (rules ?? []).map((rule) => {
                const isEditing = editingId === rule.id;
                const formula = rule.formulaJson as Record<string, unknown> | null;

                return (
                  <tr key={rule.id} className="border-b border-border hover:bg-muted/20">
                    <td className="px-4 py-3">
                      {isEditing ? (
                        <input
                          value={editForm.name}
                          onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                          className="rounded border border-input bg-background px-2 py-1 text-sm"
                        />
                      ) : (
                        <span
                          className="cursor-pointer hover:underline"
                          onClick={() => startEdit(rule)}
                        >
                          {rule.name}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">{isEditing ? editForm.category : rule.category}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {isEditing ? editForm.formulaType : rule.formulaType}
                    </td>
                    <td className="px-4 py-3">
                      {isEditing ? (
                        <input
                          type="number"
                          value={editForm.price}
                          onChange={(e) => setEditForm({ ...editForm, price: e.target.value })}
                          className="w-24 rounded border border-input bg-background px-2 py-1 text-sm"
                        />
                      ) : (
                        `$${String(formula?.price ?? 0)}`
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {isEditing ? (
                        <input
                          type="checkbox"
                          checked={editForm.active}
                          onChange={(e) => setEditForm({ ...editForm, active: e.target.checked })}
                          className="rounded"
                        />
                      ) : (
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                            rule.active
                              ? "bg-green-100 text-green-800"
                              : "bg-gray-100 text-gray-600"
                          }`}
                        >
                          {rule.active ? "Active" : "Inactive"}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {isEditing ? (
                        <div className="flex gap-1">
                          <button
                            onClick={handleSaveEdit}
                            disabled={updateRule.isPending}
                            className="rounded p-1 text-green-600 hover:bg-green-50"
                          >
                            <Save size={16} />
                          </button>
                          <button
                            onClick={() => setEditingId(null)}
                            className="rounded p-1 text-muted-foreground hover:bg-muted"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => handleDelete(rule.id)}
                          className="rounded p-1 text-red-500 hover:bg-red-50"
                          title="Delete"
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
