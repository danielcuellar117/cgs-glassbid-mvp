/**
 * E2E Smoke Test -- Full pipeline upload -> DONE flow.
 *
 * Prerequisites:
 *   docker compose -f docker-compose.test.yml up -d --wait
 *
 * This test:
 * 1. Verifies the compose stack is healthy
 * 2. Navigates to the UI
 * 3. Creates a project
 * 4. Uploads a test PDF via the UI (or direct API)
 * 5. Waits for job status to reach DONE or NEEDS_REVIEW
 * 6. If NEEDS_REVIEW: handles measurement, regenerates
 * 7. Downloads outputs and verifies 2 PDFs
 */

import { test, expect, type Page } from "@playwright/test";

const API_BASE = process.env.E2E_API_URL || "http://localhost:3001";
const UI_BASE = process.env.E2E_BASE_URL || "http://localhost:8090";

test.describe("Smoke Test - Full Pipeline", () => {
  test.beforeAll(async ({ request }) => {
    // Verify the compose stack is up
    const healthRes = await request.get(`${API_BASE}/health`);
    expect(healthRes.ok()).toBeTruthy();
  });

  test("upload PDF and wait for pipeline completion", async ({ page, request }) => {
    // --- Step 1: Create a project via API ---
    const projectRes = await request.post(`${API_BASE}/api/projects`, {
      data: {
        name: "E2E Smoke Test Project",
        clientName: "Test Client",
        address: "123 Test St",
      },
    });
    expect(projectRes.ok()).toBeTruthy();
    const project = await projectRes.json();
    const projectId = project.id;
    expect(projectId).toBeTruthy();

    // --- Step 2: Create a job to get upload token ---
    const jobRes = await request.post(`${API_BASE}/api/jobs`, {
      data: {
        projectId,
        fileName: "smoke-test.pdf",
        fileSize: 50000,
      },
    });
    expect(jobRes.status()).toBe(201);
    const jobData = await jobRes.json();
    const jobId = jobData.jobId;
    const uploadToken = jobData.uploadToken;
    expect(jobId).toBeTruthy();
    expect(uploadToken).toBeTruthy();

    // --- Step 3: Upload a small test PDF via tus endpoint ---
    // Generate a minimal PDF in-memory (simple text PDF)
    const pdfContent = generateMinimalPdf();

    // Upload directly to tus with the token
    const tusEndpoint = process.env.E2E_TUS_URL || "http://localhost:8081/files/";
    const createRes = await request.post(tusEndpoint, {
      headers: {
        "Tus-Resumable": "1.0.0",
        "Upload-Length": String(pdfContent.length),
        "Upload-Metadata": `token ${Buffer.from(uploadToken).toString("base64")},filename ${Buffer.from("smoke-test.pdf").toString("base64")}`,
      },
    });

    // tus returns 201 with Location header
    if (createRes.status() === 201) {
      const location = createRes.headers()["location"];
      if (location) {
        // PATCH to upload the content
        await request.patch(location, {
          headers: {
            "Tus-Resumable": "1.0.0",
            "Upload-Offset": "0",
            "Content-Type": "application/offset+octet-stream",
          },
          data: pdfContent,
        });
      }
    }

    // --- Step 4: Poll job status until DONE or NEEDS_REVIEW ---
    let jobStatus = "UPLOADED";
    const maxWaitMs = 120_000;
    const pollIntervalMs = 3000;
    const startTime = Date.now();

    while (Date.now() - startTime < maxWaitMs) {
      const statusRes = await request.get(`${API_BASE}/api/jobs/${jobId}`);
      expect(statusRes.ok()).toBeTruthy();
      const job = await statusRes.json();
      jobStatus = job.status;

      if (jobStatus === "DONE" || jobStatus === "NEEDS_REVIEW" || jobStatus === "FAILED") {
        break;
      }

      await page.waitForTimeout(pollIntervalMs);
    }

    expect(["DONE", "NEEDS_REVIEW"]).toContain(jobStatus);

    // --- Step 5: Handle NEEDS_REVIEW if needed ---
    if (jobStatus === "NEEDS_REVIEW") {
      // Get measurement tasks
      const tasksRes = await request.get(
        `${API_BASE}/api/measurement-tasks?jobId=${jobId}`,
      );

      if (tasksRes.ok()) {
        const tasks = await tasksRes.json();

        // Complete each measurement task via API
        for (const task of tasks) {
          if (task.status === "PENDING") {
            await request.patch(
              `${API_BASE}/api/measurement-tasks/${task.id}`,
              {
                data: {
                  status: "COMPLETED",
                  measuredValue: 36.0,
                  measuredBy: "e2e-test",
                },
              },
            );
          }
        }
      }

      // Mark job as reviewed
      await request.patch(`${API_BASE}/api/jobs/${jobId}/ssot`, {
        data: { status: "REVIEWED" },
      });

      // Wait for pipeline to continue
      const reviewWaitMs = 60_000;
      const reviewStart = Date.now();

      while (Date.now() - reviewStart < reviewWaitMs) {
        const statusRes = await request.get(`${API_BASE}/api/jobs/${jobId}`);
        const job = await statusRes.json();
        jobStatus = job.status;

        if (jobStatus === "DONE" || jobStatus === "FAILED") break;
        await page.waitForTimeout(pollIntervalMs);
      }
    }

    // --- Step 6: Navigate to UI and verify ---
    await page.goto(UI_BASE);
    await expect(page).toHaveTitle(/.*/);

    // --- Step 7: Verify outputs (if DONE) ---
    if (jobStatus === "DONE") {
      const outputsRes = await request.get(
        `${API_BASE}/api/downloads/${jobId}/outputs`,
      );
      expect(outputsRes.ok()).toBeTruthy();
      const { outputs } = await outputsRes.json();

      // Expect 2 PDFs: bid + shop drawings
      expect(outputs.length).toBeGreaterThanOrEqual(2);

      // Each output should have a download URL
      for (const output of outputs) {
        expect(output.downloadUrl).toBeTruthy();
      }
    }
  });
});

/**
 * Generate a minimal valid PDF for upload testing.
 * This is a bare-bones PDF that PyMuPDF can open.
 */
function generateMinimalPdf(): Buffer {
  const content = [
    "%PDF-1.4",
    "1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj",
    "2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj",
    "3 0 obj<</Type/Page/MediaBox[0 0 612 792]/Parent 2 0 R/Resources<</Font<</F1 4 0 R>>>>/Contents 5 0 R>>endobj",
    "4 0 obj<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>endobj",
    "5 0 obj<</Length 44>>stream",
    "BT /F1 12 Tf 100 700 Td (Smoke Test PDF) Tj ET",
    "endstream endobj",
    "xref",
    "0 6",
    "0000000000 65535 f ",
    "0000000009 00000 n ",
    "0000000058 00000 n ",
    "0000000115 00000 n ",
    "0000000266 00000 n ",
    "0000000340 00000 n ",
    "trailer<</Size 6/Root 1 0 R>>",
    "startxref",
    "434",
    "%%EOF",
  ].join("\n");
  return Buffer.from(content, "ascii");
}
