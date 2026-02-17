# Luxurius Glass - User Guide

A step-by-step guide to creating glass proposals from architectural blueprints. No technical knowledge required.

---

## Table of Contents

1. [Getting Started](#1-getting-started)
2. [Your First Project](#2-your-first-project)
3. [Uploading a PDF](#3-uploading-a-pdf)
4. [Watching the Progress](#4-watching-the-progress)
5. [Browsing the Pages](#5-browsing-the-pages)
6. [Taking Measurements](#6-taking-measurements)
7. [Reviewing Extracted Items](#7-reviewing-extracted-items)
8. [Reviewing Prices](#8-reviewing-prices)
9. [Downloading Your Documents](#9-downloading-your-documents)
10. [Managing Pricing Rules (Admin)](#10-managing-pricing-rules-admin)
11. [Monitoring the System (Admin)](#11-monitoring-the-system-admin)
12. [Quick Reference Card](#12-quick-reference-card)
13. [Frequently Asked Questions](#13-frequently-asked-questions)

---

## 1. Getting Started

Open your web browser and go to **http://localhost**. You will see the main screen of the application.

### What You Will See

On the left side there is a **navigation menu** with two sections:

**For daily work:**
- **Dashboard** -- Your home screen showing all projects
- **New Project** -- Start a new glass proposal

**For administrators:**
- **Admin Overview** -- System statistics at a glance
- **Pricebook** -- Manage your pricing rules
- **Templates** -- View available shop drawing templates
- **System Health** -- Check that everything is running properly
- **Audit Log** -- Review the history of all changes

You can collapse the side menu by clicking the **arrow icon** at the top left corner. This gives you more screen space when working.

At the top of the page, you will always see **breadcrumbs** (for example: Home > Projects > New) so you know exactly where you are.

---

## 2. Your First Project

### Step 1: Open the New Project Form

From the Dashboard, click the **"+ New Project"** button in the top right corner. You can also click **"New Project"** in the side menu.

### Step 2: Fill in the Project Details

You will see a form with three fields:

| Field | Required? | What to Enter | Example |
|-------|:---------:|---------------|---------|
| **Project Name** | Yes | A name that helps you identify this project | Oceanview Tower - Unit 42A |
| **Client Name** | No | The name of the general contractor or client | Acme Construction |
| **Address** | No | The project site address | 123 Ocean Drive, Miami FL |

> **Tip:** Use a descriptive project name. You will be searching for it later on the Dashboard.

### Step 3: Attach Your PDF File

Below the form, you will see an upload area with a dashed border. You have two ways to select your file:

- **Drag and drop** your PDF file from your file explorer onto the upload area
- **Click** anywhere inside the upload area to open a file browser

Only PDF files are accepted. The maximum file size is 10 GB.

Once your file is selected, you will see the file name and size displayed. If you picked the wrong file, click the **X** button next to the file name to remove it and try again.

### Step 4: Create and Upload

Click the **"Create Project & Upload"** button at the bottom.

The system will begin uploading your file. You will see a progress bar showing how much has been uploaded. If your internet connection drops during the upload, do not worry -- the upload will resume from where it left off when your connection comes back.

When the upload finishes, you will see a green success message and the system will automatically take you to the next screen.

---

## 3. Uploading a PDF

### What Happens During Upload

After you click "Create Project & Upload", three things happen automatically:

1. Your project is saved
2. A processing job is created for your PDF
3. The file begins uploading

### What You Will See

- A **progress bar** showing the percentage complete
- The amount uploaded vs the total size (for example: 45 MB / 120 MB)

### If Something Goes Wrong

If the upload fails, you will see a red error message with two options:
- **"Try Again"** -- Retry the upload
- **"View Job"** -- Go to the job status page to see more details

> **Tip:** Large files (over 500 MB) may take several minutes to upload. This is normal. Do not close your browser during the upload.

---

## 4. Watching the Progress

After your PDF uploads successfully, you are taken to the **Job Status** page. This is where you watch the system process your blueprints.

### The Progress Bar

At the top of the page, you will see a horizontal progress bar with numbered steps. Each step represents one phase of the processing:

| Step | What It Means |
|------|--------------|
| 1. Created | Your job was created |
| 2. Uploading | The PDF is being uploaded |
| 3. Uploaded | Upload complete |
| 4. Indexing | The system is reading and classifying each page of your PDF |
| 5. Routing | The system is figuring out how to process each page |
| 6. Extracting | The system is finding glass items (showers, mirrors, dimensions, hardware) |
| 7. **Needs Review** | The system is done extracting -- it needs you to check the results |
| 8. Pricing | Prices are being calculated |
| 9. Generating | Your final documents are being created |
| 10. Done | Everything is finished and ready to download |

### How the Steps Look

- **Green checkmark** -- This step is complete
- **Spinning circle** -- This step is currently in progress
- **Gray number** -- This step has not started yet
- **Red X** -- Something went wrong at this step

### What to Do

Most of the time, you just wait. The system processes your PDF automatically through steps 1-6. This usually takes between 30 seconds and 5 minutes depending on the size of your PDF.

When the progress bar reaches **"Needs Review"** (step 7), an orange card will appear with buttons to continue. This is when the system needs your help.

> **Tip:** The page updates in real time. You do not need to refresh your browser.

---

## 5. Browsing the Pages

When the system reaches "Needs Review", you can browse all the pages of your PDF to see how they were classified.

### How to Get Here

From the Job Status page, click **"View Pages"** in the orange card, or click **"Pages"** in the quick navigation area.

### What You Will See

A grid of small preview images (thumbnails) for every page in your PDF. Each thumbnail shows:

- A miniature view of the page
- The **page number**
- A **colored label** showing what type of page it is:
  - **Floor Plan** -- Overhead view of the space
  - **Elevation** -- Side view showing walls and openings
  - **Schedule** -- Table listing glass items and specifications
  - **Detail** -- Close-up drawing of a specific area
  - **Notes** -- Written specifications or notes
  - **Title** -- Title/cover page
  - **Irrelevant** -- Not related to glass work
- A **"Relevant" tag** if the page contains glass-related information (showers, mirrors, etc.)

### What to Do

Click on any page thumbnail to open the **Measurement Tool** for that page. This is useful when you need to manually measure a dimension that the system could not read automatically.

---

## 6. Taking Measurements

Sometimes the system cannot automatically extract all dimensions from the blueprints. When this happens, it creates **measurement tasks** -- items that need you to manually measure a dimension from the drawings.

### How to Get Here

- Click a page thumbnail from the Pages view
- Click a **"Measure"** link next to an item in the Review table

### What You Will See

This is a full-screen drawing viewer with three areas:

- **Left toolbar** -- Tools for navigating and measuring
- **Center** -- A large, zoomable view of the blueprint page
- **Right panel** -- A list of measurement tasks waiting to be completed

### Step-by-Step: How to Measure

#### 1. Set the Scale (Calibration)

Before you can measure anything, you need to tell the system the scale of the drawing. You do this by marking a known dimension.

1. Click the **"Calibrate"** tool in the left toolbar (it looks like a ruler)
2. Find a dimension on the drawing that you already know (for example, a door opening marked as 36")
3. Click on one end of that dimension line
4. Click on the other end of that dimension line
5. A dialog box will appear asking: "What is the actual measurement in inches?"
6. Type the real measurement (for example: `36`) and click **OK**

The system now knows the scale of this page. You only need to calibrate once per page.

#### 2. Take a Measurement

1. Click the **"Measure"** tool in the left toolbar
2. Click on one end of the dimension you want to measure
3. Click on the other end
4. A blue line will appear with the measurement shown in inches (for example: `48.5"`)

#### 3. Assign the Measurement to a Task

1. Look at the **right panel** for the list of pending measurement tasks
2. Click on the task that matches the measurement you just took
3. Click the **"Assign"** button
4. The task will be marked as complete

#### 4. Need More Detail? (Optional)

If the image is too blurry or small to read:
- Click the **"Render HD"** button in the left toolbar
- Wait a few seconds for a higher resolution version to load
- Now you can zoom in further and see more detail

### Navigation Tips

- **Scroll your mouse wheel** to zoom in and out
- Select the **"Pan"** tool (hand icon) and drag to move around the drawing
- Use the **"Zoom In"** and **"Zoom Out"** buttons for precise control

---

## 7. Reviewing Extracted Items

This is the most important screen in the workflow. Here you check everything the system found in your blueprints and make corrections if needed.

### How to Get Here

From the Job Status page, click **"Review Items"** in the orange card, or click **"Review"** in the quick navigation area.

### What You Will See

A table listing every glass item found in the PDF. Each row is one item (a shower enclosure, a mirror, etc.).

### Understanding the Table

| Column | What It Shows |
|--------|--------------|
| **#** | Item number |
| **Category** | Type of item: Shower, Mirror, etc. |
| **Location** | Where it is in the building (e.g., "Unit 42A - Master Bath") |
| **Configuration** | The style of installation (e.g., "Inline Panel + Door", "90-Degree Corner") |
| **W** | Width in inches |
| **H** | Height in inches |
| **D** | Depth in inches (if applicable) |
| **Glass Type** | Type of glass (e.g., "3/8 Clear Tempered") |
| **Hardware** | Hardware finish (e.g., "Brushed Nickel") |
| **Qty** | Quantity |
| **Confidence** | How confident the system is about this extraction |
| **Flags** | Warnings or issues to review |
| **Measure** | Link to the measurement tool for this item's page |

### Confidence Levels

Each item has a confidence indicator that helps you prioritize what to check:

- **HIGH** (green) -- The system is very confident. A quick glance is usually enough.
- **MEDIUM** (yellow) -- You should verify this item. Some dimensions may be approximate.
- **LOW** (red) -- You should definitely check this item carefully. Something was unclear in the blueprints.

### Warning Flags

You may see colored warning chips next to some items:

| Flag | What It Means | What to Do |
|------|--------------|------------|
| **Range Warning** | A dimension seems too large or too small | Double-check the W, H, or D values |
| **Incomplete** | One or more dimensions are missing (shown as "TBV") | Use the Measure tool to fill in the missing value |
| **Math Issue** | The dimensions do not add up correctly | Review and correct the W, H, D values |
| **Possible Duplicate** | This item looks very similar to another one | Check if it is really a separate item or a duplicate |

### How to Edit a Dimension

1. Click directly on any **W**, **H**, or **D** cell
2. The cell becomes editable -- type the correct value
3. Press **Enter** to save, or **Escape** to cancel
4. You can also click anywhere else on the page to save

### When You Are Done Reviewing

At the top of the page, you will see a count of pending measurement tasks. All measurement tasks must be completed before you can move forward.

Once everything looks correct:

1. Make sure there are **zero pending measurement tasks**
2. Click the **"Submit for Pricing"** button
3. The system will automatically calculate prices for all items

> **Important:** Take your time on this step. The accuracy of your final proposal depends on the dimensions being correct.

---

## 8. Reviewing Prices

After you submit the review, the system applies your pricing rules and calculates costs for every item.

### How to Get Here

The system will take you here automatically after pricing is complete, or you can click **"Pricing"** in the quick navigation area on the Job Status page.

### What You Will See

A detailed pricing table showing every item with its calculated price:

| Column | What It Shows |
|--------|--------------|
| **#** | Item number |
| **Description** | Item description |
| **Category** | Shower, Mirror, etc. |
| **Qty** | Quantity |
| **Unit Price** | Price per unit |
| **Total** | Quantity x Unit Price |
| **Glass** | Glass material cost breakdown |
| **Hardware** | Hardware cost breakdown |
| **Labor** | Labor cost breakdown |
| **Other** | Other costs |

At the bottom of the table you will see:
- **Subtotal** -- Sum of all line items
- **Tax** -- Calculated tax amount
- **Grand Total** -- Final total for the proposal

### Adjusting a Price (Override)

If you need to change the price for a specific item:

1. Click the **"Override"** button on that item's row
2. A dialog will appear with two fields:
   - **New Price** -- Enter the adjusted unit price
   - **Reason** -- Explain why you are changing it (this is saved for record-keeping)
3. Click **"Apply"**
4. The total will recalculate automatically

Items with adjusted prices will show a small indicator so you can easily see which prices were changed manually.

### When Prices Look Good

Click the **"Generate PDFs"** button at the top of the page. The system will begin creating your final documents. You will be taken back to the Job Status page where you can watch the progress.

---

## 9. Downloading Your Documents

This is the final step. Your documents are ready to download and send to your client.

### How to Get Here

When the Job Status page shows **"Done"** (green), click the **"View Results"** button. You can also click **"Results"** in the quick navigation area.

### What You Will See

Cards for each generated document. The system creates two PDFs:

**1. Bid Proposal**
- A professional proposal document
- Includes project details, client information, and item list with prices
- Shows the grand total
- Ready to send to your client

**2. Shop Drawings**
- Technical fabrication drawings
- One drawing per glass item with exact dimensions
- Numbered sequentially for easy reference
- Used by the glass fabrication shop

### How to Download

For each document you have two options:

- **"Download"** -- Saves the PDF to your computer
- **"Preview"** -- Opens the PDF in a new browser tab so you can review it before downloading

To download everything at once, click **"Download All (ZIP)"** at the bottom. This creates a single ZIP file containing both PDFs.

### Need to Make Changes?

If you notice an issue after the documents are generated:

1. Click the **"Regenerate"** button
2. Go back to the Review or Pricing pages to make corrections
3. Submit again and new documents will be created

> **Tip:** Each regeneration creates a new version. Previous versions are not deleted, so you always have a record.

---

## 10. Managing Pricing Rules (Admin)

This section is for administrators who manage the pricing rules used to calculate costs.

### Accessing Pricing Rules

1. Click **"Pricebook"** in the side menu under ADMIN
2. You will see a list of **Pricebook Versions**

### What is a Pricebook Version?

A pricebook version is a set of pricing rules that apply from a specific date. When you update prices, you create a new version. Old versions are kept for reference and auditing.

### Creating a New Pricebook Version

1. Click **"+ New Version"**
2. Enter a note describing the change (for example: "2026 Q1 price increase")
3. Click **"Create"**

### Adding and Editing Pricing Rules

Click on any pricebook version to open the **Rules Editor**.

Each rule has:

| Field | Description | Example |
|-------|-------------|---------|
| **Name** | A descriptive name for the rule | Standard Shower Glass |
| **Category** | What type of item it applies to | Shower, Mirror, Hardware, Labor, Other |
| **Formula** | How the price is calculated (see below) | Unit Price |
| **Price** | The dollar amount | 85.00 |
| **Active** | Whether this rule is currently in use | Yes / No |

### Formula Types Explained

| Formula | How It Works | When to Use |
|---------|-------------|-------------|
| **Unit Price** | Charges a flat amount per item | For standard items with fixed pricing |
| **Per Square Foot** | Calculates based on the item's dimensions | For glass panels where price depends on size |
| **Fixed** | Charges a flat amount regardless of size or quantity | For one-time fees like delivery or setup |

### To Add a Rule

1. Click **"+ Add Rule"**
2. Fill in the name, category, formula type, and price
3. Click **"Save"**

### To Edit a Rule

1. Click on the **rule name** in the table
2. Make your changes
3. Click **"Save"**

### To Deactivate a Rule

Instead of deleting a rule, you can toggle it to **Inactive**. Inactive rules are ignored during pricing but kept for your records.

### To Delete a Rule

Click **"Delete"** next to the rule and confirm. This cannot be undone.

---

## 11. Monitoring the System (Admin)

### Admin Overview

Click **"Admin Overview"** in the side menu. You will see four summary cards:

- **Total Projects** -- How many projects exist
- **Active Jobs** -- How many jobs are currently being processed
- **Failed Jobs** -- How many jobs have encountered errors
- **Disk Usage** -- How much storage space is being used

Below the cards, the **System Health** section shows whether the key components are running:
- **Database** -- Should show a green dot with "Connected"
- **Worker** -- Should show a green dot with "Active" and a recent timestamp
- **Disk** -- Should show available storage space

### System Health (Detailed)

Click **"System Health"** for a more detailed view that updates automatically every 10 seconds:

- **Status** -- Overall system health (OK or Error)
- **Database** -- Connection status
- **Disk Usage** -- A visual bar showing used vs available space
  - Green = Healthy (under 60% used)
  - Yellow = Getting full (60-80% used)
  - Red = Critical (over 80% used)
- **Worker** -- Whether the background processor is running
- **Memory** -- How much memory the application is using

> **When to worry:** If you see a red indicator for Database or Worker, or if Disk Usage is above 80%, contact your IT team.

### Audit Log

Click **"Audit Log"** to see a history of everything that has happened in the system:

- Every project and job created
- Every time a job changes status
- Every price override (with the reason provided)
- Every time documents are generated or regenerated

You can filter by **Job ID** to see the history for a specific job.

Click the **expand arrow** on any row to see the full details of what changed.

---

## 12. Quick Reference Card

Here is the complete workflow at a glance:

```
Step 1  Create a new project and upload your PDF
           Click "New Project" > Fill in details > Attach PDF > Click "Create Project & Upload"

Step 2  Wait for automatic processing
           The system reads, classifies, and extracts information from your PDF
           (Usually 30 seconds to 5 minutes)

Step 3  Review the extracted pages (optional)
           Browse page thumbnails to see what was found

Step 4  Take any manual measurements (if needed)
           Calibrate the scale > Measure missing dimensions > Assign to tasks

Step 5  Review and correct extracted items
           Check dimensions, fix any warnings, complete all measurement tasks

Step 6  Submit for pricing
           Click "Submit for Pricing" (all measurement tasks must be complete)

Step 7  Review and adjust prices
           Check the pricing table, override any prices if needed

Step 8  Generate documents
           Click "Generate PDFs" to create your Bid Proposal and Shop Drawings

Step 9  Download your documents
           Download individual PDFs or use "Download All (ZIP)"
```

---

## 13. Frequently Asked Questions

### How long does processing take?

It depends on the size of your PDF. A typical set of blueprints (20-50 pages) takes 1-3 minutes. Very large files (100+ pages) may take up to 5 minutes.

### Can I process multiple PDFs at the same time?

Yes. Each PDF is a separate job. You can upload another PDF while a previous one is still processing.

### What PDF file types are supported?

Standard PDF files from architectural software (AutoCAD, Revit, Bluebeam, etc.). The system works best with vector-based PDFs. Scanned documents may have lower accuracy.

### What happens if the system cannot read a dimension?

The item will be flagged as "Incomplete" and a measurement task will be created. You will need to manually measure the dimension using the Measurement Tool (see Section 6).

### Can I edit an item after submitting for pricing?

Yes. You can go back to the Review page, make changes, and submit again. If documents have already been generated, you can click "Regenerate" to create updated versions.

### How do I change the price for a specific item?

On the Pricing Review page, click the "Override" button for that item. Enter the new price and a reason for the change. The total will recalculate automatically.

### What are the two PDF documents that get generated?

1. **Bid Proposal** -- A formal price quote to send to your client, with a summary of all items and the total cost
2. **Shop Drawings** -- Technical drawings for the glass fabrication shop, showing exact dimensions for each item

### Can I download previous versions of my documents?

Yes. Each time you regenerate documents, a new version is created. All versions remain available on the Results page.

### What does "TBV" mean in the review table?

**TBV** stands for **"To Be Verified"**. It means a dimension is missing and needs to be measured or entered manually.

### What if a job shows "Failed"?

Go to the Job Status page. You will see a red card with error details. Common causes include:
- A corrupted or password-protected PDF
- An extremely large page that exceeds memory limits
- A temporary system issue (try clicking "Retry")

If retrying does not work, contact your administrator.

### How do I reset everything and start fresh?

Each project and job is independent. Simply create a new project and upload your PDF again. Old projects can remain in the system for your records.

### Who can see my projects?

Currently, all users share the same workspace. All projects are visible to everyone who has access to the system.
