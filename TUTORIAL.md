# Luxurius Glass - User Guide (For Everyone)

Welcome! This guide will walk you through every step of using Luxurius Glass. No tech skills needed. If you can use a web browser, you can use this app.

---

## Table of Contents

1. [Opening the App](#1-opening-the-app)
2. [Creating Your First Project](#2-creating-your-first-project)
3. [Uploading Your Blueprint PDF](#3-uploading-your-blueprint-pdf)
4. [Waiting While the System Works](#4-waiting-while-the-system-works)
5. [Looking at Your Pages](#5-looking-at-your-pages)
6. [Measuring Things on the Drawing](#6-measuring-things-on-the-drawing)
7. [Checking What the System Found](#7-checking-what-the-system-found)
8. [Reviewing the Prices](#8-reviewing-the-prices)
9. [Getting Your Final Documents](#9-getting-your-final-documents)
10. [Managing Prices (Admin Only)](#10-managing-prices-admin-only)
11. [Checking System Health (Admin Only)](#11-checking-system-health-admin-only)
12. [Cheat Sheet](#12-cheat-sheet)
13. [Common Questions](#13-common-questions)

---

## 1. Opening the App

Open your web browser (Chrome, Edge, Firefox -- any will work) and go to the address your admin gave you.

### What does the screen look like?

You will see a **menu on the left side** of the screen. Think of it like a table of contents for the app.

**The menu has two groups:**

**Your daily tools:**
- **Dashboard** -- This is your home page. It shows all your projects in one place.
- **New Project** -- Click here when you want to start working on a new blueprint.

**Admin tools** (you may not have access to these):
- **Admin Overview** -- Numbers and stats about the system.
- **Pricebook** -- Where you set your prices for glass, hardware, labor, etc.
- **Templates** -- Shop drawing templates.
- **System Health** -- Is everything working? Check here.
- **Audit Log** -- A history of everything that happened in the system.

**Helpful things to know:**
- You can **collapse the menu** by clicking the little arrow at the top-left corner. This gives you more room to work.
- At the very top of the page, you will always see something like **Home > Projects > New**. These are called "breadcrumbs" and they tell you where you are. You can click on any part to go back.

---

## 2. Creating Your First Project

A "project" is like a folder for one job. Each blueprint PDF you work on gets its own project.

### How to create one

**Step 1:** Click the **"+ New Project"** button. You can find it:
- On the Dashboard page (top-right corner), OR
- In the left menu under "New Project"

**Step 2:** Fill in the form. It only has three fields:

| What to fill in | Do I have to? | What should I write? | Example |
|-----------------|:------------:|----------------------|---------|
| **Project Name** | YES | A short name so you can find this project later | Oceanview Tower - Unit 42A |
| **Client Name** | No | Who is this for? | Acme Construction |
| **Address** | No | Where is the project? | 123 Ocean Drive, Miami FL |

**Good to know:** Pick a project name you will recognize later. Something like "Smith Residence - Bathrooms" is much better than "Project 1".

**Step 3:** Attach your PDF file. You will see a box with a dashed border. You can either:
- **Drag your file** from your computer and drop it onto that box, OR
- **Click the box** and a file browser will open so you can find your file

Only PDF files work. The file can be up to 10 GB.

Once you pick a file, its name and size will show up. Picked the wrong one? Click the **X** next to the file name to remove it and try again.

**Step 4:** Click the big **"Create Project & Upload"** button at the bottom.

That is it! The upload starts automatically.

---

## 3. Uploading Your Blueprint PDF

### What is happening now?

After you click "Create Project & Upload", the system does three things:
1. Saves your project information
2. Creates a processing job
3. Starts uploading your file

### What do I see on screen?

A **progress bar** showing how much of the file has been uploaded. It also shows numbers like "45 MB / 120 MB" so you know how far along it is.

### What if something goes wrong?

If the upload fails (maybe your internet dropped), you will see a red message with two buttons:
- **"Try Again"** -- Click this to restart the upload
- **"View Job"** -- Go see more details about what happened

**Don't panic.** If your internet drops during upload, the system will try to pick up where it left off when your connection comes back.

**Big files take time.** A file over 500 MB could take several minutes. This is normal. Just don't close your browser while it is uploading.

---

## 4. Waiting While the System Works

After the upload finishes, you land on the **Job Status** page. This is where you watch the magic happen.

### The progress bar

At the top of the page there is a horizontal bar with numbered steps. Here is what each step means (in plain English):

| Step | Name | What is happening |
|:----:|------|-------------------|
| 1 | Created | Your job was created. Done! |
| 2 | Uploading | Your PDF is being sent to the server. |
| 3 | Uploaded | Upload finished. |
| 4 | Indexing | The system is reading every page and figuring out what each one is (floor plan? schedule? notes?). |
| 5 | Routing | The system is deciding the best way to process each page. |
| 6 | Extracting | The system is finding glass items -- showers, mirrors, dimensions, hardware. |
| 7 | **Needs Review** | **YOUR TURN!** The system needs you to check the results. |
| 8 | Pricing | Prices are being calculated based on your pricing rules. |
| 9 | Generating | Your final PDFs (bid proposal + shop drawings) are being created. |
| 10 | Done | Everything is finished. Download your files! |

### What do the icons mean?

- **Green checkmark** = This step is done.
- **Spinning circle** = This step is happening right now.
- **Gray number** = This step has not started yet.
- **Red X** = Something went wrong. (See the FAQ section for what to do.)

### What do I do?

**Nothing, for now!** Just wait. Steps 1 through 6 happen automatically. It usually takes between 30 seconds and 5 minutes, depending on how big your PDF is.

When the bar reaches step 7 ("Needs Review"), an **orange card** will pop up with buttons telling you what to do next. That is when the system needs your help.

**You do NOT need to refresh the page.** It updates on its own in real time.

---

## 5. Looking at Your Pages

When the system reaches "Needs Review", you can browse all the pages from your PDF.

### How do I get here?

From the Job Status page, click **"View Pages"** in the orange card, or click **"Pages"** in the quick navigation area.

### What does it look like?

A grid of small pictures (thumbnails) of every page in your PDF. Each one shows:

- A tiny preview of the page
- The **page number**
- A **colored label** that tells you what type of page it is:

| Label | What it means |
|-------|--------------|
| **Floor Plan** | A view from above showing the room layout |
| **Elevation** | A side view showing walls and openings |
| **Schedule** | A table listing glass items and their specs |
| **Detail** | A close-up of one specific area |
| **Notes** | Written specifications |
| **Title** | The cover page |
| **Irrelevant** | Not related to glass work |

Pages that are related to glass work will also have a green **"Relevant"** tag.

### What can I do here?

Click on any page thumbnail to open the **Measurement Tool** for that page. This is where you can manually measure things on the drawing.

---

## 6. Measuring Things on the Drawing

Sometimes the system cannot automatically read all the dimensions from the blueprints. When this happens, it creates **measurement tasks** -- things that need you to manually measure a length from the drawing.

### How do I get here?

- Click a page thumbnail from the Pages view
- Click a **"Measure"** link next to an item in the Review table

### What does the screen look like?

The screen is divided into three areas:

| Area | Where | What it does |
|------|-------|-------------|
| **Toolbar** | Left side (thin strip) | Buttons for all the tools you need |
| **Drawing** | Center (big area) | A zoomable view of the blueprint page |
| **Task list** | Right side | Shows measurement tasks waiting to be completed |

### Moving around the drawing

Before measuring, you need to know how to move around:

- **Zoom in/out:** Scroll your mouse wheel up (zoom in) or down (zoom out)
- **Pan (move around):** Click the **hand icon** (Pan tool) in the toolbar, then click-and-drag the drawing to scroll
- **Zoom buttons:** Use the **+** and **-** buttons in the toolbar for precise control
- **Reset view:** Press the **R** key on your keyboard, or click the reset button in the toolbar
- **Minimap:** In the bottom-right corner you will see a small overview of the entire page. Click anywhere on it to jump to that area. You can drag the top-left corner of the minimap to make it bigger or smaller.

---

### The Three Steps: Calibrate, Measure, Assign

Think of it like using a ruler on a printed drawing. First you need to figure out the scale, then you measure, then you write it down.

---

#### STEP 1: Calibrate (Set the Scale)

**Why?** The drawing is scaled down. A wall that is 10 feet in real life might only be 3 inches on the drawing. Calibrating tells the system what the scale is, so it can calculate real measurements.

**You only need to do this ONCE per page.**

1. Find a dimension on the drawing that **already has its measurement written** on it. For example, a line that says "7'-0"" or "84"".
2. In the left toolbar, click the **Calibrate tool** (it looks like a crosshair target).
3. Click on **one end** of that known dimension line. A small orange dot appears.
4. Click on the **other end** of the same line. A second orange dot appears and an orange line connects them.
5. A dialog box pops up asking you to enter the real-world length.
6. You can enter the measurement in two ways:
   - **Feet + Inches + Fraction:** Fill in the three fields (e.g., 7 feet, 0 inches, 0 fraction)
   - **Inches only:** Switch to the "Inches only" tab and type the total (e.g., 84)
7. The dialog shows you a preview of what you entered (e.g., "= 84.0000" (7' - 0")").
8. Click **"Set Scale"**.

**Done!** The status bar at the bottom now says "Scale calibrated" in green. The system automatically switches to the Measure tool.

**Made a mistake with the calibration points?** No problem:
- **Drag the orange dots** to adjust their position -- just hover over a dot until the cursor changes, then click and drag.
- **Drag the orange line** itself to move both points at the same time.
- **Delete it:** Press the **Delete** or **Esc** key, or click the orange trash icon in the toolbar, or click the small orange **X** button that floats near the line.

---

#### STEP 2: Measure

Now you can measure anything on the drawing and the system will tell you the real-world size.

1. Make sure the **Measure tool** is selected (ruler icon in the toolbar). It should already be selected after calibrating.
2. **Zoom in** close to the area you want to measure. The closer you zoom, the more accurate your click will be.
3. Click on **one end** of the thing you want to measure. A blue dot appears.
4. Click on the **other end**. A second blue dot appears and a blue line connects them.
5. The measurement appears right on the drawing in blue text (for example: "4' - 2 1/4"").
6. The measurement also appears in the bottom status bar.

**Need to adjust?** You have several options:
- **Drag a blue dot** to move just that endpoint. Hover over the dot until the cursor changes to a hand, then click and drag. The measurement updates in real time as you drag.
- **Drag the blue line** itself to move the entire measurement (both points move together, keeping the same distance and angle).
- **Delete it:** Press the **Delete** or **Esc** key, or click the blue **X** button in the toolbar, or click the small blue **X** button that floats near the line.
- **Start over:** Just click two new points on the drawing.

---

#### STEP 3: Assign the Measurement to a Task

Now that you have a measurement, you need to tell the system which item it belongs to.

1. Look at the **right panel** for the list of measurement tasks. Each task has a name (like "Width" or "Height") and an item ID.
2. Click on the task that matches your measurement. It will get a blue highlight.
3. Click the **"Assign"** button that appears on that task. It will show the measurement value (e.g., "Assign 4' - 2 1/4"").
4. The task is now marked as complete and disappears from the pending list.
5. The blue measurement line is cleared, and you can start measuring the next item.

**Want to skip a task?** If a task does not apply to this page (for example, the dimension is on a different page), click the **"Skip"** button on that task. You will be asked to write a short reason.

**Want to skip ALL tasks on this page?** Click the **"Skip all tasks on this page"** button at the top of the task list.

---

### If the Image is Blurry

If you zoom in and the image is blurry or hard to read:
1. Click the **"HD"** button in the toolbar (it looks like a monitor with an up arrow)
2. Wait a few seconds for a higher quality image to load
3. Now you can zoom in much further and see more detail

This takes a little longer to load but gives you a much sharper image.

---

### Measurement Tool - Quick Reference

| What you want to do | How to do it |
|---------------------|-------------|
| **Zoom in** | Scroll mouse wheel up |
| **Zoom out** | Scroll mouse wheel down |
| **Move around the drawing** | Select Pan tool (hand icon), then click and drag |
| **Calibrate** | Select Calibrate tool (crosshair), click two points, enter measurement |
| **Measure** | Select Measure tool (ruler), click two points |
| **Move a point** | Hover over it (cursor changes to hand), then click and drag |
| **Move an entire line** | Hover over the line (cursor changes to move arrow), then click and drag |
| **Delete calibration** | Press Delete/Esc, or click the orange trash icon, or click the orange X near the line |
| **Delete measurement** | Press Delete/Esc, or click the blue X icon, or click the blue X near the line |
| **Reset the view** | Press the **R** key |
| **Render in HD** | Click the HD button (monitor icon) |

---

## 7. Checking What the System Found

This is the most important screen. Here you check everything the system extracted from your blueprints and fix any mistakes.

### How do I get here?

From the Job Status page, click **"Review Items"** in the orange card, or click **"Review"** in the navigation area.

### What does it look like?

A big table with one row for each glass item the system found (a shower, a mirror, etc.).

### Understanding the columns

| Column | What it means |
|--------|--------------|
| **#** | Item number (just for counting) |
| **Category** | What type of item: Shower, Mirror, etc. |
| **Location** | Where it is in the building (e.g., "Unit 42A - Master Bath") |
| **Configuration** | The style of glass (e.g., "Inline Panel + Door", "90-Degree Corner") |
| **W** | Width in inches |
| **H** | Height in inches |
| **D** | Depth in inches (not always needed) |
| **Glass Type** | What kind of glass (e.g., "3/8 Clear Tempered") |
| **Hardware** | What finish the hardware is (e.g., "Brushed Nickel") |
| **Qty** | How many of this item |
| **Confidence** | How sure the system is about this item (see below) |
| **Flags** | Warnings you should look at (see below) |
| **Measure** | A link to measure this item's dimensions on the drawing |

### What do the confidence levels mean?

Think of it like a traffic light:

- **HIGH (green):** The system is very confident. Just give it a quick look.
- **MEDIUM (yellow):** The system is somewhat sure, but you should double-check the dimensions.
- **LOW (red):** The system is not confident. **Please check this item carefully.** Something in the blueprint was hard to read.

### What do the warning flags mean?

| Flag | What it means | What should I do? |
|------|--------------|-------------------|
| **Range Warning** | A dimension seems unrealistically large or small | Look at the W, H, or D values. Is a shower really 200 inches wide? Probably not. |
| **Incomplete** | One or more dimensions are missing (it will say "TBV") | Use the Measurement Tool to manually measure the missing dimension. |
| **Math Issue** | The dimensions do not add up | Review and correct the W, H, D values. |
| **Possible Duplicate** | This item looks almost identical to another one | Check if it is really two separate items or if the system accidentally counted it twice. |

### How do I fix a dimension?

It is easy:

1. Click directly on any **W**, **H**, or **D** number in the table
2. The cell turns into an editable field -- just type the correct number
3. Press **Enter** to save, or **Escape** to cancel
4. You can also just click somewhere else on the page to save

### When am I done reviewing?

At the top of the page, you will see how many measurement tasks are still pending. **All measurement tasks must be done** before you can continue.

When everything looks good:

1. Make sure there are **zero pending measurement tasks**
2. Click the **"Submit for Pricing"** button
3. The system will calculate prices for everything

**Take your time here.** The accuracy of your final bid depends on these numbers being correct.

---

## 8. Reviewing the Prices

After you submit the review, the system uses your pricing rules to calculate costs for every item.

### How do I get here?

The system takes you here automatically after pricing is done. You can also click **"Pricing"** on the Job Status page.

### What does it look like?

A pricing table showing every item with its price broken down:

| Column | What it shows |
|--------|--------------|
| **#** | Item number |
| **Description** | What the item is |
| **Category** | Shower, Mirror, etc. |
| **Qty** | How many |
| **Unit Price** | Price for one of this item |
| **Total** | Qty x Unit Price |
| **Glass** | How much the glass costs |
| **Hardware** | How much the hardware costs |
| **Labor** | How much the labor costs |
| **Other** | Any other costs |

At the bottom you will see:
- **Subtotal** -- All items added together
- **Tax** -- Tax amount
- **Grand Total** -- The final number for the proposal

### Need to change a price?

Sometimes the auto-calculated price is not right for a specific situation.

1. Click the **"Override"** button on that item's row
2. A dialog pops up with two fields:
   - **New Price** -- Type the correct price
   - **Reason** -- Write why you are changing it (this is saved for your records)
3. Click **"Apply"**
4. The totals recalculate automatically

Items with changed prices will have a small indicator so you can easily spot them later.

### When prices look good

Click the **"Generate PDFs"** button at the top. The system starts creating your final documents. You will be taken back to the Job Status page to watch the progress.

---

## 9. Getting Your Final Documents

This is the last step! Your documents are ready.

### How do I get here?

When the Job Status page shows **"Done"** (all green), click the **"View Results"** button. You can also click **"Results"** in the navigation area.

### What documents do I get?

The system creates two PDFs for you:

**1. Bid Proposal**
- This is what you send to your client
- It has: project details, client info, a list of all items with prices, and the grand total
- It looks professional and is ready to send as-is

**2. Shop Drawings**
- This is for the glass fabrication shop
- It has one drawing per glass item with exact dimensions
- Each drawing is numbered so the shop can easily reference them

### How to download

For each document you have two options:
- **"Download"** -- Saves the PDF to your computer
- **"Preview"** -- Opens it in a new browser tab so you can look at it first

Want everything at once? Click **"Download All (ZIP)"** at the bottom. This gives you one ZIP file with both PDFs inside.

### Need to make changes after generating?

No problem!

1. Click the **"Regenerate"** button
2. Go back to the Review or Pricing pages to fix things
3. Submit again and new documents will be created

**Good to know:** Every time you regenerate, a new version is created. Old versions are NOT deleted. You always have a complete history.

---

## 10. Managing Prices (Admin Only)

This section is for administrators who manage the pricing rules.

### Getting to the Pricebook

1. Click **"Pricebook"** in the left menu under ADMIN
2. You will see a list of **Pricebook Versions**

### What is a Pricebook Version?

Think of it as a "snapshot" of your prices at a point in time. When you update your prices, you create a new version. Old versions are kept so you can always look back and see what prices were used for previous projects.

### Creating a new version

1. Click **"+ New Version"**
2. Type a note explaining the change (e.g., "2026 Q1 price increase")
3. Click **"Create"**

### Working with pricing rules

Click on any pricebook version to open the **Rules Editor**.

Each rule has these fields:

| Field | What it means | Example |
|-------|--------------|---------|
| **Name** | A descriptive name | Standard Shower Glass |
| **Category** | What type of item it applies to | Shower, Mirror, Hardware, Labor, Other |
| **Formula** | How the price is calculated | Unit Price, Per Square Foot, or Fixed |
| **Price** | The dollar amount | 85.00 |
| **Active** | Is this rule being used? | Yes / No |

### Formula types explained simply

| Formula | How it works | Use this when... |
|---------|-------------|-----------------|
| **Unit Price** | Charges a flat amount per item | The price is the same regardless of size |
| **Per Square Foot** | Calculates based on the item's dimensions | Bigger items should cost more (like glass panels) |
| **Fixed** | Charges a flat amount, period | It is a one-time fee (like delivery or setup) |

### Adding, editing, and removing rules

- **Add a rule:** Click **"+ Add Rule"**, fill in the fields, click **"Save"**
- **Edit a rule:** Click the rule name, change what you need, click **"Save"**
- **Turn off a rule (without deleting):** Toggle it to **Inactive**. It will be ignored during pricing but kept for your records.
- **Delete a rule:** Click **"Delete"** and confirm. **This cannot be undone.**

---

## 11. Checking System Health (Admin Only)

### Quick overview (Admin Overview)

Click **"Admin Overview"** in the left menu. You will see four cards:

| Card | What it tells you |
|------|------------------|
| **Total Projects** | How many projects exist in the system |
| **Active Jobs** | How many jobs are being processed right now |
| **Failed Jobs** | How many jobs had errors |
| **Disk Usage** | How much storage space is being used |

Below those cards, the **System Health** section shows whether the key parts are working:
- **Database** -- Should show a green dot and "Connected"
- **Worker** -- Should show a green dot and "Active"
- **Disk** -- Should show available storage space

### Detailed health check

Click **"System Health"** for a more detailed view (it refreshes every 10 seconds):

- **Status** -- Overall health: OK or Error
- **Database** -- Is the database connected?
- **Disk Usage** -- A bar showing used vs available space
  - **Green** = Healthy (under 60% used)
  - **Yellow** = Getting full (60-80%)
  - **Red** = Critical (over 80%) -- contact your IT team!
- **Worker** -- Is the background processor running?
- **Memory** -- How much memory the app is using

**When should I worry?** If Database or Worker shows red, or if Disk Usage is above 80%. Contact your IT team.

### Audit Log

Click **"Audit Log"** to see a complete history of everything that happened:
- Every project and job created
- Every status change
- Every price override (with the reason)
- Every time documents were generated

You can filter by **Job ID** to see just one job's history. Click the **expand arrow** on any row to see full details.

---

## 12. Cheat Sheet

Here is the entire workflow on one page:

```
STEP 1  CREATE YOUR PROJECT
        Click "New Project" > Fill in the name > Attach your PDF > Click "Create Project & Upload"

STEP 2  WAIT
        The system reads and processes your PDF automatically.
        Usually takes 30 seconds to 5 minutes. Just wait.

STEP 3  BROWSE PAGES (optional)
        Look at the page thumbnails to see what the system found.

STEP 4  TAKE MEASUREMENTS (if needed)
        Calibrate the scale > Measure missing dimensions > Assign to tasks
        Remember: you can drag points to adjust, press Delete to clear.

STEP 5  REVIEW ITEMS
        Check all dimensions. Fix any warnings. Complete all measurement tasks.

STEP 6  SUBMIT FOR PRICING
        Click "Submit for Pricing" (all measurement tasks must be done first).

STEP 7  CHECK PRICES
        Review the pricing table. Override any prices that need adjusting.

STEP 8  GENERATE DOCUMENTS
        Click "Generate PDFs" to create your Bid Proposal and Shop Drawings.

STEP 9  DOWNLOAD
        Download individual PDFs or click "Download All (ZIP)".
        Done! Send the bid proposal to your client.
```

---

## 13. Common Questions

### How long does processing take?

A typical blueprint (20-50 pages) takes 1-3 minutes. A very large file (100+ pages) may take up to 5 minutes.

### Can I work on more than one PDF at a time?

Yes! Each PDF is a separate project. You can upload a new one while a previous one is still processing.

### What types of PDFs work?

Standard PDFs from architectural software like AutoCAD, Revit, or Bluebeam. The system works best with "vector" PDFs (created directly from the design software). Scanned documents (photos of paper drawings) will have lower accuracy.

### What if the system cannot read a dimension?

The item will be flagged as "Incomplete" and a measurement task will be created. You will need to use the Measurement Tool (see Section 6) to manually measure it.

### Can I fix something after submitting for pricing?

Yes. You can go back to the Review page, make your changes, and submit again. If documents were already generated, click "Regenerate" to create updated versions.

### How do I change a price for one specific item?

On the Pricing page, click "Override" on that item. Enter the new price and a reason. The total recalculates automatically.

### What are the two PDF documents?

1. **Bid Proposal** -- A formal price quote you send to your client. It has all items and the total cost.
2. **Shop Drawings** -- Technical drawings for the glass fabrication shop, with exact dimensions for each item.

### Can I see old versions of my documents?

Yes. Every time you regenerate, a new version is created. All versions are kept on the Results page.

### What does "TBV" mean?

**TBV = "To Be Verified."** It means a dimension is missing and needs to be measured or typed in manually.

### What if a job shows "Failed"?

Go to the Job Status page. You will see a red card with error details. Common causes:
- The PDF is corrupted or password-protected
- A page is extremely large and exceeded memory limits
- A temporary glitch (try clicking "Retry")

If retrying does not fix it, contact your administrator.

### How do I start completely over?

Each project is independent. Just create a new project and upload your PDF again. Old projects stay in the system for your records.

### Can other people see my projects?

Yes. Everyone who has access to the system can see all projects. There is no private workspace at this time.

### I accidentally deleted my calibration. Do I need to re-upload?

No! Just calibrate again. Click the Calibrate tool, click two points on a known dimension, and enter the measurement. It takes 10 seconds.

### The measurement line is crooked. How do I fix it?

You do NOT need to start over. Just hover over one of the blue dots at the end of the line -- your cursor will change to a hand. Click and drag the dot to the correct position. The measurement updates in real time as you drag.

### Can I move the entire measurement line?

Yes! Hover over the line itself (not the endpoints). Your cursor will change to a move arrow. Click and drag to move the whole line (both points move together).
