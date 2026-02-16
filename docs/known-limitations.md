# Known Limitations (MVP)

## Extraction Pipeline
- Classification heuristics are keyword-based; manual reclassification may be needed
- Dimension extraction works best with standard architectural annotation formats
- Extraction accuracy has not been validated against a golden architectural plan set (Category B acceptance criteria deferred)
- The system does not use OCR or AI/ML for dimension inference

## Upload / Storage
- Maximum single file: 10 GB
- Maximum per-job storage: 15 GB (source + cache + outputs) + up to 10 GB temp during processing
- 800 GB SSD can fill quickly with many concurrent large projects; disk pressure guard mitigates this

## UI / UX
- Measurement tool uses PNG rendering; very large pages may be DPI-clamped (MAX_RENDER_PIXELS=8000)
- PDF.js is used only for output preview (small PDFs), never for source file interaction
- Single user / single session for MVP (no concurrent multi-user editing)

## Pricing
- Formula engine supports `unit_price`, `per_sqft`, and `fixed` types
- More complex formulas (area-based, hardware-count-based) to be added iteratively
- Tax calculation is stubbed at 0% (configurable in code)

## Templates
- 4 templates implemented (TPL-02, TPL-04, TPL-07, TPL-09)
- Remaining 8 templates (TPL-01, TPL-03, TPL-05, TPL-06, TPL-08, TPL-10, TPL-11, TPL-12) need domain expert input
- Adding a template requires only: new Python module + registry.json entry

## Infrastructure
- Single-tenant (tenant_id="default" on all tables, ready for future multi-tenancy)
- Single worker process, 1 concurrent main job
- No SSL/HTTPS at app level (reverse proxy recommended)
- No authentication/authorization (future: JWT, multi-tenant SSO)

## PDF Output
- "Functionally deterministic" outputs, not byte-identical
- Font pinning requires fonts bundled in worker_assets volume
- Shop drawings cover sheet drawing index may truncate for >30 items per page
