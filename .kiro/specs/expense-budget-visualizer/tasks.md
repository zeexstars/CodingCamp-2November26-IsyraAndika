# Implementation Plan: Expense & Budget Visualizer

## Overview

The implementation builds a dependency-free, client-side expense tracker as a single `index.html`, a single `css/styles.css`, and a single `js/app.js` ES module. The work proceeds bottom-up: first the static HTML/CSS shell, then the pure logic layer (validation, totals, aggregation, chart-slice math, serialization) which is the target of property-based tests, then the state/storage layer wrapping Local Storage, and finally the UI layer (list, total, SVG pie chart, form/delete handlers) wired together in `init()`. All logic functions are exported from `js/app.js` so tests import them without running UI code; test tooling (`fast-check`, a DOM environment, a runner) is dev-only and never shipped, keeping the built app within the one-file-per-folder and no-third-party-runtime constraints.

## Tasks

- [ ] 1. Set up project structure and static files
  - [x] 1.1 Create index.html structure
    - Create `index.html` with the app shell: a header containing the total balance display container, the input form (Item Name input with `maxlength="50"`, Amount input, Category `<select>` populated with Food/Transport/Fun), a scrollable transaction list container, and a chart container for the SVG pie chart
    - Link `css/styles.css` and load `js/app.js` as `<script type="module">`; reference only local `css/` and `js/` files with no third-party runtime scripts or stylesheets
    - _Requirements: 1.1, 1.2, 4.1, 9.1, 10.1_

  - [x] 1.2 Create css/styles.css styling
    - Create `css/styles.css` with a clean, minimal layout: total balance at the top, the form, a scrollable list (overflow scrolling when content exceeds the visible height), and the chart laid out responsively
    - Set body text to a minimum of 16px and secondary/helper text (validation messages, empty-state hints) to a minimum of 14px; make the primary Add action visually larger than secondary controls (delete buttons, helper text)
    - _Requirements: 2.4, 4.1, 9.1, 9.2_

- [x] 2. Implement pure logic layer (js/app.js)
  - [x] 2.1 Implement validation, transaction creation, id generation, and category constants
    - Define `CATEGORIES = ["Food", "Transport", "Fun"]` as the single source of category options used by both the form select and the aggregation
    - Implement `validateTransaction(input)` returning `{ valid, errors }`: name trimmed length 1-50, amount raw string matching a positive number with at most 2 decimals not exceeding 999999.99, category in CATEGORIES; whitespace-only name and missing/invalid category are treated as empty required fields
    - Implement `generateId()` using `crypto.randomUUID()` with a timestamp-plus-random fallback, and `createTransaction(input)` (precondition: valid input) producing a `{ id, name, amount, category, createdAt }` with `createdAt = Date.now()`
    - Export all of these from `js/app.js`
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_

  - [x]* 2.2 Write property test for validation partition
    - **Property 1: Validation accepts exactly the valid inputs**
    - **Validates: Requirements 1.3, 1.4, 1.5**
    - Use `fast-check` with an arbitrary `RawInput` spanning valid and invalid names/amounts/categories; assert `validateTransaction` accepts exactly the valid partition and rejects all others with at least one error; minimum 100 runs

  - [x] 2.3 Implement transaction deletion and newest-first ordering
    - Implement `deleteTransaction(transactions, id)` returning a new array excluding the transaction with that `id` without mutating the input
    - Implement `sortByNewest(transactions)` returning transactions ordered by `createdAt` descending
    - Export both from `js/app.js`
    - _Requirements: 2.1, 3.1, 3.2_

  - [x]* 2.4 Write property test for newest-first ordering
    - **Property 2: Transaction list is ordered newest-first**
    - **Validates: Requirements 2.1**
    - For arbitrary transaction sets with distinct `createdAt`, assert `sortByNewest` yields strictly descending `createdAt` order; minimum 100 runs

  - [x]* 2.5 Write property test for delete removing exactly the targeted transaction
    - **Property 4: Delete removes exactly the targeted transaction**
    - **Validates: Requirements 3.2**
    - For arbitrary sets containing a chosen transaction `T`, assert `deleteTransaction(set, T.id)` excludes `T` (by id) and shrinks the set by exactly one; minimum 100 runs

  - [x] 2.6 Implement totals, currency formatting, category aggregation, and row mapping
    - Implement `calculateTotal(transactions)` returning the arithmetic sum of amounts; `formatCurrency(amount)` returning the amount with exactly two decimal places (e.g., `12.5` -> `"12.50"`); `aggregateByCategory(transactions)` returning `{ Food, Transport, Fun }` summing amounts per category; and a pure `toRowData(transaction)` helper returning `{ name, amount: formatCurrency(amount), category }` for list row rendering
    - Export all of these from `js/app.js`
    - _Requirements: 2.2, 4.2, 4.4, 5.2_

  - [x]* 2.7 Write property test for list row content
    - **Property 3: Each row contains the transaction's name, amount, and category**
    - **Validates: Requirements 2.2**
    - For arbitrary transactions, assert `toRowData(transaction)` contains the name, the amount formatted with exactly two decimals, and the category; minimum 100 runs

  - [x]* 2.8 Write property test for total balance
    - **Property 5: Total balance equals the sum of amounts, with empty mapping to zero**
    - **Validates: Requirements 4.2, 4.4**
    - For arbitrary sets including the empty set, assert `formatCurrency(calculateTotal(set))` equals the sum of amounts formatted to two decimals, and equals `"0.00"` for the empty set; minimum 100 runs

  - [x] 2.9 Implement chart slice computation
    - Implement `computeChartSlices(transactions)` returning one `{ label, value, fraction }` per category with total greater than zero, where `fraction = value / grandTotal` (grand total = sum of all category totals); return `[]` when there are no transactions
    - Export from `js/app.js`
    - _Requirements: 5.2, 5.4_

  - [x]* 2.10 Write property test for chart slices
    - **Property 6: Chart slices are proportional and cover the whole, empty maps to no slices**
    - **Validates: Requirements 5.2, 5.4**
    - For arbitrary sets including the empty set, assert only `>0` categories produce a slice, `fraction = value / grandTotal`, fractions sum to 1 (within floating-point tolerance) when at least one category is non-zero, slice `value`s sum to `calculateTotal(set)`, and the empty set yields no slices; minimum 100 runs

  - [x] 2.11 Implement serialization and deserialization
    - Implement `serialize(transactions)` returning a JSON string of the stored representation (id, name, amount, category, createdAt) and `deserialize(json)` returning the parsed transaction array, returning `[]` for missing/corrupt input
    - Export both from `js/app.js`
    - _Requirements: 6.1, 6.3, 6.4_

  - [x]* 2.12 Write property test for serialization round-trip
    - **Property 7: Serialization round-trip preserves count and field values**
    - **Validates: Requirements 6.4**
    - For arbitrary sets of 1 to 1,000 valid transactions, assert `deserialize(serialize(set))` preserves the count and that every original transaction has a loaded counterpart with identical name, amount, and category; minimum 100 runs

  - [x]* 2.13 Write unit tests for logic-layer boundaries and edge cases
    - Amount boundaries: `0.01` and `999999.99` accepted; `0`, `-1`, `1000000`, `12.345`, non-numeric, and empty rejected; name length `1` and `50` accepted, `51` rejected; whitespace-only name rejected
    - Total edge case: empty set -> `"0.00"`; chart edge case: empty set -> no slices, single category -> fraction `1`
    - _Requirements: 1.3, 1.4, 1.5, 4.4, 5.4_

- [x] 3. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Implement state and storage layer (js/app.js)
  - [x] 4.1 Implement AppState store and StorageService
    - Implement a module-level `AppState` holding the `transactions` array (mutations replace the array reference) and a `StorageService` with `isAvailable()` (probe Local Storage via a test write/read), `save(transactions)` returning `{ ok, error? }` that serializes and writes while catching quota/availability errors, and `load()` returning deserialized transactions or `[]`
    - Use a single Local Storage key (e.g., `"expense-visualizer:transactions"`); on unavailable storage or a failed write, retain the in-memory array so data is not lost
    - _Requirements: 6.1, 6.2, 6.3, 6.5, 10.2, 10.3_

- [-] 5. Implement UI layer (js/app.js)
  - [x] 5.1 Implement init bootstrap and transaction list rendering
    - Implement `init()` (runs on `DOMContentLoaded` only when the DOM container exists, so importing the module in tests is side-effect free): load saved transactions from `StorageService`, render the list, total, and chart (or their empty states), and attach event handlers
    - Implement `renderTransactionList(transactions)`: rebuild the scrollable list rows showing name, formatted amount, and category, ordered newest-first via `sortByNewest`; show an empty-state indication when the array is empty; attach a delete control per row
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 6.2_

  - [ ] 5.2 Implement total balance display and SVG pie chart rendering
    - Implement `renderTotal(transactions)` setting the top total balance to `formatCurrency(calculateTotal(...))`, or `"0.00"` when empty
    - Implement `renderChart(transactions)` rendering a hand-rolled vanilla SVG pie chart from `computeChartSlices(...)` (compute slice arc paths from each fraction, no third-party libraries), with category labels and an empty-state "no spending data" indication when there are no slices
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 5.1, 5.2, 5.3, 5.4, 10.1_

  - [ ] 5.3 Implement form submission and delete handlers with error display
    - Implement `handleFormSubmit(event)`: validate via `validateTransaction`; on success create and add the transaction to `AppState`, clear the form fields, persist via `StorageService`, and re-render list/total/chart; on failure call `showValidationError` and do not add
    - Implement `handleDelete(id)`: remove the transaction via `deleteTransaction`, persist, and re-render list/total/chart; on persistence failure call `showPersistenceError` while keeping in-memory data
    - Implement `showValidationError(errors)` (render validation messages near the form, cleared on the next successful submit) and `showPersistenceError(message)` (non-blocking persistence-failure message)
    - _Requirements: 1.3, 1.4, 1.5, 1.6, 3.1, 3.2, 3.3, 6.1, 6.5, 8.1_

- [ ] 6. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for a faster MVP; the shipped app remains one `index.html`, one `css/styles.css`, and one `js/app.js` with no third-party runtime libraries
- Test tooling (`fast-check`, a DOM environment such as jsdom, and a test runner) is dev-only and never shipped; it does not violate Requirement 10.1, which governs the built application's runtime, not the development toolchain
- Each implementation task references specific acceptance criteria for traceability; property tests are tagged with their design property number and the requirement clauses they validate
- Checkpoints ensure incremental validation before and after the state/storage and UI layers
- The pure logic layer is exported so tests import functions without triggering UI bootstrap, keeping the single-JS-file rule while remaining testable

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2"] },
    { "id": 1, "tasks": ["2.1"] },
    { "id": 2, "tasks": ["2.3", "2.2"] },
    { "id": 3, "tasks": ["2.6", "2.4", "2.5"] },
    { "id": 4, "tasks": ["2.9", "2.7", "2.8"] },
    { "id": 5, "tasks": ["2.11", "2.10"] },
    { "id": 6, "tasks": ["4.1", "2.12", "2.13"] },
    { "id": 7, "tasks": ["5.1", "4.2"] },
    { "id": 8, "tasks": ["5.2"] },
    { "id": 9, "tasks": ["5.3"] },
    { "id": 10, "tasks": ["5.4", "5.5"] }
  ]
}
```
