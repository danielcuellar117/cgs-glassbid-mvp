/**
 * Database seed script: populates initial configuration data.
 *
 * Run with: npx prisma db seed
 * Or: npx tsx prisma/seed.ts
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding database...");

  // ─── Configuration Template Map ─────────────────────────────────
  const templateMappings = [
    { configuration: "inline-panel", templateId: "TPL-01", description: "Inline Panel (single fixed panel)" },
    { configuration: "inline-panel-door", templateId: "TPL-02", description: "Inline Panel + Door (fixed + swing)" },
    { configuration: "90-degree-corner", templateId: "TPL-03", description: "90-Degree Corner (two panels)" },
    { configuration: "90-degree-corner-door", templateId: "TPL-04", description: "90-Degree Corner + Door" },
    { configuration: "neo-angle", templateId: "TPL-05", description: "Neo-Angle (3-panel)" },
    { configuration: "frameless-sliding", templateId: "TPL-06", description: "Frameless Sliding (bypass)" },
    { configuration: "bathtub-fixed-panel", templateId: "TPL-07", description: "Bathtub Fixed Panel" },
    { configuration: "bathtub-panel-door", templateId: "TPL-08", description: "Bathtub Panel + Door" },
    { configuration: "vanity-mirror", templateId: "TPL-09", description: "Vanity Mirror (rectangular)" },
    { configuration: "vanity-mirror-custom", templateId: "TPL-10", description: "Vanity Mirror (custom shape)" },
    { configuration: "steam-shower", templateId: "TPL-11", description: "Steam Shower (full enclosure)" },
    { configuration: "custom-enclosure", templateId: "TPL-12", description: "Custom Enclosure (generic)" },
  ];

  for (const mapping of templateMappings) {
    await prisma.configurationTemplateMap.upsert({
      where: { configuration: mapping.configuration },
      update: {},
      create: mapping,
    });
  }
  console.log(`  Seeded ${templateMappings.length} template mappings`);

  // ─── Default Pricebook Version ──────────────────────────────────
  const pricebook = await prisma.pricebookVersion.upsert({
    where: { id: "default-v1" },
    update: {},
    create: {
      id: "default-v1",
      effectiveDate: new Date(),
      notes: "Default MVP pricebook - adjust rates as needed",
    },
  });

  // Default pricing rules
  const defaultRules = [
    {
      name: "Shower Enclosure - Standard",
      category: "SHOWER_ENCLOSURE",
      formulaJson: { type: "per_sqft", rate: 45.0 },
      appliesTo: { category: "SHOWER_ENCLOSURE" },
    },
    {
      name: "Shower Enclosure - Premium (Low Iron)",
      category: "SHOWER_ENCLOSURE",
      formulaJson: { type: "per_sqft", rate: 65.0 },
      appliesTo: { category: "SHOWER_ENCLOSURE", glassType: "low iron" },
    },
    {
      name: "Vanity Mirror - Standard",
      category: "VANITY_MIRROR",
      formulaJson: { type: "per_sqft", rate: 35.0 },
      appliesTo: { category: "VANITY_MIRROR" },
    },
    {
      name: "Hardware - Hinge (per unit)",
      category: "HARDWARE",
      formulaJson: { type: "unit_price", unitPrice: 85.0 },
      appliesTo: { hardwareType: "Hinge" },
    },
    {
      name: "Hardware - Handle (per unit)",
      category: "HARDWARE",
      formulaJson: { type: "unit_price", unitPrice: 65.0 },
      appliesTo: { hardwareType: "Handle" },
    },
    {
      name: "Installation - Standard",
      category: "LABOR",
      formulaJson: { type: "fixed", amount: 250.0 },
      appliesTo: {},
    },
  ];

  for (const rule of defaultRules) {
    await prisma.pricingRule.create({
      data: {
        pricebookVersionId: pricebook.id,
        name: rule.name,
        category: rule.category,
        formulaJson: rule.formulaJson as any,
        appliesTo: rule.appliesTo as any,
      },
    });
  }
  console.log(`  Seeded ${defaultRules.length} pricing rules for pricebook v1`);

  console.log("Seeding complete!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
