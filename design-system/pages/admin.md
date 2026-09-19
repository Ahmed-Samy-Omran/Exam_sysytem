# Page Overrides — Admin (Dashboard + CRUD)

Admin surfaces are **Flat Design with maximal clarity**: dense tables, obvious status, no decorative chrome.

## Deviations from Master
- **Sidebar:** fixed right side (RTL) grouped: General / Management. Active item = `bg-primary text-on-primary`.
- **Dashboard:** stat cards (4): active questions, categories, attempts, pass rate. Empty periods handled with EmptyState.
- **Question table:**
  - Filters row: search input (debounced), category select, status select, active count badge.
  - Row state: `is_active` switch; archived rows `opacity-60`.
  - Pagination footer; page size 10.
- **Forms (QuestionForm):** single-column on mobile, 2-col grid ≥ md.
  - Options: dynamic add (2..5), radio marks correct answer (unique correct enforced client + server).
  - Explanation textarea required for MVP.
  - Validation errors under fields; submit disabled while saving.
- **Confirm dialogs** for delete/archive and destructive actions; never destructive without explicit text.

## Status badge colors
| State | Style |
|---|---|
| active | `bg-success/10 text-success` |
| archived | `bg-muted text-muted-foreground` |
| error | `bg-destructive/10 text-destructive` |