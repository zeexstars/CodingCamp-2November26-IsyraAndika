/**
 * Expense & Budget Visualizer - application logic.
 *
 * This module is loaded as an ES module (<script type="module">). The pure
 * logic layer is exported so tests can import it without triggering any UI
 * bootstrap. The UI layer (init, renderers, handlers) is added in later tasks
 * and is only invoked when the DOM is ready, so importing this module has no
 * side effects.
 */

// ---------------------------------------------------------------------------
// Types (documented via JSDoc; this is vanilla JavaScript with no build step)
// ---------------------------------------------------------------------------

/**
 * @typedef {Object} RawInput
 * @property {string} name     - The item name as entered (raw, may have whitespace).
 * @property {string} amount    - The amount as a raw form string, so decimal-place
 *                                validation is exact (e.g. "12.50", "100").
 * @property {string} category - The category as selected (one of CATEGORIES).
 */

/**
 * @typedef {Object} ValidationResult
 * @property {boolean} valid   - True when the input satisfies every rule.
 * @property {string[]} errors - Human-readable validation messages (empty when valid).
 */

/** @typedef {"Food" | "Transport" | "Fun"} Category */

/**
 * @typedef {Object} Transaction
 * @property {string} id        - Unique identifier (from generateId()).
 * @property {string} name      - Trimmed item name, 1 to 50 characters.
 * @property {number} amount    - Positive cost, <= 999999.99, parsed from the raw string.
 * @property {Category} category - One of Food, Transport, or Fun.
 * @property {number} createdAt  - Date.now() at creation, used for newest-first ordering.
 */

/**
 * @typedef {Object} CategoryTotals
 * @property {number} Food      - Total spending in the Food category.
 * @property {number} Transport - Total spending in the Transport category.
 * @property {number} Fun       - Total spending in the Fun category.
 */

/**
 * @typedef {Object} RowData
 * @property {string} name     - The transaction's item name.
 * @property {string} amount    - The amount formatted with exactly two decimal places.
 * @property {string} category  - The transaction's category.
 */

/**
 * @typedef {Object} ChartSlice
 * @property {Category} label   - The category this slice represents.
 * @property {number} value     - The total spending for this category.
 * @property {number} fraction  - This category's share of the grand total (0 to 1).
 */

// ---------------------------------------------------------------------------
// Category constants
// ---------------------------------------------------------------------------

/**
 * The single source of category options, used by both the form <select> and
 * the category aggregation, so the form options and the chart can never drift
 * out of sync. (Requirement 1.2)
 * @type {Category[]}
 */
export const CATEGORIES = ["Food", "Transport", "Fun"];

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

/**
 * Maximum allowed amount value. (Requirement 1.3, 1.5)
 */
const MAX_AMOUNT = 999999.99;

/**
 * Matches a positive decimal with at most two fractional digits, e.g. "12",
 * "12.5", "12.50". Rejects signs, more than two decimals, and bare decimals
 * like ".5". (Requirement 1.3, 1.5)
 */
const AMOUNT_PATTERN = /^\d+(\.\d{1,2})?$/;

/**
 * Validates raw form input against the add-transaction rules.
 *
 * Rules:
 * - name: required; after trimming must be 1 to 50 characters. Whitespace-only
 *   is treated as an empty required field (Requirement 1.4).
 * - amount: required; the raw string must match a positive number with at most
 *   two decimal places, greater than zero and not exceeding 999999.99
 *   (Requirement 1.3, 1.5).
 * - category: required; must be one of Food, Transport, or Fun. Missing or
 *   invalid category is treated as an empty required field (Requirement 1.2).
 *
 * @param {RawInput} input - The raw form input.
 * @returns {ValidationResult} `{ valid, errors }`.
 */
export function validateTransaction(input) {
  const rawName = input && typeof input.name === "string" ? input.name : "";
  const rawAmount = input && typeof input.amount === "string" ? input.amount : "";
  const category = input && typeof input.category === "string" ? input.category : "";

  const name = rawName.trim();
  const amount = rawAmount.trim();

  const errors = [];
  const emptyFields = [];

  // name: required, trimmed length 1 to 50 (Requirement 1.1, 1.4).
  if (name.length === 0) {
    emptyFields.push("Item Name");
  } else if (name.length > 50) {
    errors.push("Item name must be between 1 and 50 characters.");
  }

  // category: required, must be an allowed option (Requirement 1.2).
  if (!CATEGORIES.includes(category)) {
    emptyFields.push("Category");
  }

  // amount: required, positive number <= 999999.99 with at most 2 decimals
  // (Requirement 1.3, 1.5).
  if (amount.length === 0) {
    emptyFields.push("Amount");
  } else if (!AMOUNT_PATTERN.test(amount)) {
    errors.push(
      "Amount must be a positive number not exceeding 999,999.99 with at most 2 decimal places."
    );
  } else {
    const amountValue = Number(amount);
    if (amountValue <= 0 || amountValue > MAX_AMOUNT) {
      errors.push(
        "Amount must be a positive number not exceeding 999,999.99 with at most 2 decimal places."
      );
    }
  }

  // Aggregate empty-required-field messages into a single, field-identifying
  // message (Requirement 1.4).
  if (emptyFields.length > 0) {
    errors.unshift(
      "Please fill in all required fields: " + emptyFields.join(", ") + "."
    );
  }

  return { valid: errors.length === 0, errors };
}

// ---------------------------------------------------------------------------
// Id generation
// ---------------------------------------------------------------------------

/**
 * Generates a unique id using `crypto.randomUUID()` when available, falling
 * back to a timestamp-plus-random string for environments without it. The
 * fallback keeps the app working in older-but-modern engines (Requirement 7.3).
 *
 * @returns {string} A unique id string.
 */
export function generateId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  // Fallback: timestamp + random, both base36-encoded for compactness.
  return Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 10);
}

// ---------------------------------------------------------------------------
// Transaction creation
// ---------------------------------------------------------------------------

/**
 * Creates a Transaction from valid raw input.
 *
 * Precondition: `input` has already passed `validateTransaction`. The name is
 * trimmed, the amount is parsed to a number from the raw string, the category
 * is taken as-is (guaranteed to be an allowed option), and `createdAt` is set
 * to `Date.now()` for newest-first ordering (Requirement 2.1).
 *
 * @param {RawInput} input - A validated raw input.
 * @returns {Transaction} The new transaction.
 */
export function createTransaction(input) {
  return {
    id: generateId(),
    name: input.name.trim(),
    amount: Number(input.amount),
    category: input.category,
    createdAt: Date.now(),
  };
}

// ---------------------------------------------------------------------------
// Deletion
// ---------------------------------------------------------------------------

/**
 * Returns a new transaction array excluding the transaction with the given
 * `id`. Pure: does not mutate the input array. `Array.prototype.filter`
 * always returns a fresh array, so even when the `id` is not present the
 * caller receives a new array containing every element (a copy, not the same
 * reference), keeping downstream consumers from holding stale aliases.
 * (Requirement 3.2)
 *
 * @param {Transaction[]} transactions - The current transaction array.
 * @param {string} id - The id of the transaction to remove.
 * @returns {Transaction[]} A new array without the targeted transaction.
 */
export function deleteTransaction(transactions, id) {
  return transactions.filter((transaction) => transaction.id !== id);
}

// ---------------------------------------------------------------------------
// Ordering
// ---------------------------------------------------------------------------

/**
 * Returns the transactions ordered by `createdAt` descending (newest first)
 * so the most recently added transaction appears at the top of the list.
 * Pure: spreads the input into a shallow copy before sorting, so the input
 * array is never mutated. (Requirement 2.1)
 *
 * @param {Transaction[]} transactions - The current transaction array.
 * @returns {Transaction[]} A new array sorted newest-first.
 */
export function sortByNewest(transactions) {
  return [...transactions].sort((a, b) => b.createdAt - a.createdAt);
}

// ---------------------------------------------------------------------------
// Totals & currency formatting
// ---------------------------------------------------------------------------

/**
 * Returns the arithmetic sum of all transaction amounts. The empty set maps
 * to 0 so the total balance reads "0.00" when there is nothing to sum
 * (Requirement 4.4). Pure: does not mutate the input. (Requirement 4.2)
 *
 * @param {Transaction[]} transactions - The current transaction array.
 * @returns {number} The sum of all `amount` values (0 for an empty array).
 */
export function calculateTotal(transactions) {
  return transactions.reduce((sum, transaction) => sum + transaction.amount, 0);
}

/**
 * Formats a numeric amount with exactly two decimal places, e.g. `12.5` ->
 * `"12.50"`, `0` -> `"0.00"`, `100` -> `"100.00"`. Used for the total balance
 * display and for each list-row amount (Requirements 4.2, 2.2). `toFixed(2)`
 * rounds, so floating-point sums of two-decimal amounts (e.g. 0.1 + 0.2) still
 * format to a clean two-decimal string.
 *
 * @param {number} amount - The amount to format.
 * @returns {string} The amount with exactly two decimal places.
 */
export function formatCurrency(amount) {
  return Number(amount).toFixed(2);
}

// ---------------------------------------------------------------------------
// Category aggregation
// ---------------------------------------------------------------------------

/**
 * Sums amounts per category, returning a totals object keyed by every member
 * of `CATEGORIES`. All keys are always present (even when 0) because they are
 * seeded from `CATEGORIES`, so the form options and the chart aggregation can
 * never drift out of sync (Requirement 5.2). The empty set maps to
 * `{ Food: 0, Transport: 0, Fun: 0 }` (Requirement 4.4). Pure: does not mutate
 * the input.
 *
 * @param {Transaction[]} transactions - The current transaction array.
 * @returns {CategoryTotals} Per-category spending totals.
 */
export function aggregateByCategory(transactions) {
  const totals = Object.fromEntries(
    CATEGORIES.map((category) => [category, 0])
  );
  for (const transaction of transactions) {
    const category = transaction.category;
    // Guard against a category not in CATEGORIES so a stray entry can never
    // produce NaN; validated transactions always match a key.
    if (totals[category] !== undefined) {
      totals[category] += transaction.amount;
    }
  }
  return totals;
}

// ---------------------------------------------------------------------------
// Row mapping
// ---------------------------------------------------------------------------

/**
 * Maps a single transaction to the data its list row renders: the item name,
 * the amount formatted with exactly two decimal places (a string, not the raw
 * number), and the category (Requirement 2.2). Pure: returns a fresh object
 * and does not touch the input.
 *
 * @param {Transaction} transaction - The transaction to map.
 * @returns {RowData} The row data `{ name, amount, category }`.
 */
export function toRowData(transaction) {
  return {
    name: transaction.name,
    amount: formatCurrency(transaction.amount),
    category: transaction.category,
  };
}

// ---------------------------------------------------------------------------
// Chart slice computation
// ---------------------------------------------------------------------------

/**
 * Computes the pie-chart slices for spending by category.
 *
 * Returns one `{ label, value, fraction }` slice per category whose total
 * spending is greater than zero, where `fraction = value / grandTotal` and
 * `grandTotal` is the sum of all category totals (i.e. `calculateTotal`).
 * Categories with zero spending are excluded, so they produce no slice
 * (Requirement 5.2). The empty set - and more generally any set whose grand
 * total is zero - maps to `[]`, the chart's empty state (Requirement 5.4).
 * When a single category holds all the spending its slice has `fraction` of
 * exactly `1`. Pure: no side effects or DOM access.
 *
 * @param {Transaction[]} transactions - The current transaction array.
 * @returns {ChartSlice[]} One slice per category with total > 0, or `[]`.
 */
export function computeChartSlices(transactions) {
  const grandTotal = calculateTotal(transactions);
  // No spending -> no slices (empty state). This also guards against division
  // by zero when the grand total is 0 (e.g. an empty array).
  if (grandTotal <= 0) {
    return [];
  }

  const totals = aggregateByCategory(transactions);
  const slices = [];
  for (const category of CATEGORIES) {
    const value = totals[category];
    if (value > 0) {
      slices.push({
        label: category,
        value: value,
        fraction: value / grandTotal,
      });
    }
  }
  return slices;
}

// ---------------------------------------------------------------------------
// Serialization
// ---------------------------------------------------------------------------

/**
 * Serializes a transaction array to the JSON string stored in Local Storage.
 *
 * Each transaction is written as a stored object with exactly the fields
 * `id`, `name`, `amount`, `category`, and `createdAt`, so the persisted
 * representation matches the design's stored format and survives reload with
 * ordering and delete targeting intact (Requirement 6.1). The empty array
 * serializes to `"[]"`. Pure: returns a string and does not mutate the input
 * or touch storage; a non-array input is treated as empty.
 *
 * @param {Transaction[]} transactions - The current transaction array.
 * @returns {string} A JSON array string of the stored representation.
 */
export function serialize(transactions) {
  const list = Array.isArray(transactions) ? transactions : [];
  return JSON.stringify(
    list.map((transaction) => ({
      id: transaction.id,
      name: transaction.name,
      amount: transaction.amount,
      category: transaction.category,
      createdAt: transaction.createdAt,
    }))
  );
}

// ---------------------------------------------------------------------------
// Deserialization
// ---------------------------------------------------------------------------

/**
 * Checks whether a parsed JSON value has the shape of a stored Transaction:
 * `id` and `name` are strings, `amount` and `createdAt` are finite numbers,
 * and `category` is one of `CATEGORIES`. Used by `deserialize` to reject
 * malformed stored entries (Requirement 6.3, 6.4).
 *
 * @param {*} item - A parsed JSON value to check.
 * @returns {boolean} True when `item` is a valid stored transaction.
 */
function isValidStoredTransaction(item) {
  return (
    item !== null &&
    typeof item === "object" &&
    typeof item.id === "string" &&
    typeof item.name === "string" &&
    typeof item.amount === "number" &&
    Number.isFinite(item.amount) &&
    typeof item.createdAt === "number" &&
    Number.isFinite(item.createdAt) &&
    typeof item.category === "string" &&
    CATEGORIES.includes(item.category)
  );
}

/**
 * Deserializes a JSON string into a transaction array, returning `[]` for
 * any missing or corrupt input so the app always initializes with a valid
 * (possibly empty) array (Requirements 6.3, 6.4).
 *
 * Defensive handling:
 * - Missing input (`null`, `undefined`, empty string, or non-string) -> `[]`.
 * - Invalid JSON -> `[]` (wrapped in try-catch).
 * - Non-array JSON -> `[]`.
 * - Any malformed transaction object (missing/wrong-typed fields or an
 *   unknown category) -> `[]`.
 *
 * For valid input, returns the parsed array with all fields intact, so the
 * round-trip property holds: `deserialize(serialize(set))` preserves the count
 * and every `name`, `amount`, and `category` (Requirement 6.4). Pure: no
 * storage access.
 *
 * @param {string} json - The JSON string read from Local Storage.
 * @returns {Transaction[]} The parsed transaction array, or `[]`.
 */
export function deserialize(json) {
  // Missing input: null, undefined, empty string, or non-string -> [].
  if (typeof json !== "string" || json.length === 0) {
    return [];
  }

  let parsed;
  try {
    parsed = JSON.parse(json);
  } catch (error) {
    // Corrupt input: invalid JSON -> [].
    return [];
  }

  // Corrupt input: non-array JSON -> [].
  if (!Array.isArray(parsed)) {
    return [];
  }

  // Validate every element has the required stored-transaction shape; any
  // malformed object rejects the whole payload -> [].
  const transactions = [];
  for (const item of parsed) {
    if (!isValidStoredTransaction(item)) {
      return [];
    }
    transactions.push({
      id: item.id,
      name: item.name,
      amount: item.amount,
      category: item.category,
      createdAt: item.createdAt,
    });
  }
  return transactions;
}

// ---------------------------------------------------------------------------
// State and Storage Layer
// ---------------------------------------------------------------------------

/**
 * Module-level AppState holding the in-memory transaction array.
 * Mutations replace the array reference (don't mutate in-place).
 * This is the single source of truth for transactions during the session.
 * @type {{ transactions: Transaction[] }}
 */
export const AppState = {
  transactions: [],
};

/**
 * Storage service for Local Storage persistence with defensive error handling.
 * All operations catch exceptions and return safe defaults to prevent data loss.
 */
export const StorageService = {
  /**
   * Local Storage key for the expense visualizer.
   * @type {string}
   */
  KEY: "expense-visualizer:transactions",

  /**
   * Probes Local Storage availability by attempting a test write/read and cleaning up.
   * Returns true if Local Storage is available and functional, false otherwise.
   * @returns {boolean}
   */
  isAvailable() {
    try {
      // Test write
      const testKey = "__storage_test__";
      const testValue = "ok";
      localStorage.setItem(testKey, testValue);
      
      // Test read
      const readValue = localStorage.getItem(testKey);
      
      // Cleanup
      localStorage.removeItem(testKey);
      
      return readValue === testValue;
    } catch (error) {
      // Any exception means Local Storage is unavailable
      return false;
    }
  },

  /**
   * Serializes transactions to JSON and writes to Local Storage.
   * Returns { ok: true } on success, or { ok: false, error: "description" } on failure.
   * On failure, the in-memory data is retained (not lost).
   *
   * @param {Transaction[]} transactions - The transaction array to save.
   * @returns {{ ok: boolean, error?: string }}
   */
  save(transactions) {
    try {
      if (!this.isAvailable()) {
        return { ok: false, error: "Local Storage is unavailable" };
      }
      
      const json = serialize(transactions);
      localStorage.setItem(this.KEY, json);
      
      return { ok: true };
    } catch (error) {
      // Catch quota exceeded, security, or other Local Storage errors
      return { 
        ok: false, 
        error: error instanceof DOMException && error.name === "QuotaExceededError" 
          ? "Local Storage quota exceeded" 
          : "Failed to save data to Local Storage" 
      };
    }
  },

  /**
   * Reads and deserializes from Local Storage.
   * Returns the parsed transaction array, or [] if unavailable/corrupt/empty.
   * @returns {Transaction[]}
   */
  load() {
    try {
      if (!this.isAvailable()) {
        return [];
      }
      
      const json = localStorage.getItem(this.KEY);
      
      if (json === null || json.length === 0) {
        return [];
      }
      
      return deserialize(json);
    } catch (error) {
      // Return empty array on any Local Storage error
      return [];
    }
  },
};

// ---------------------------------------------------------------------------
// UI Layer
// ---------------------------------------------------------------------------

/**
 * Escapes HTML special characters to prevent XSS.
 * @param {string} text - Text to escape.
 * @returns {string} Escaped text.
 */
function escapeHtml(text) {
  if (typeof text !== 'string') {
    return '';
  }
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Initializes the application when the DOM is ready.
 * Only runs when the container exists (no side effects on import).
 * Loads transactions from StorageService, renders list/total/chart,
 * and attaches event handlers.
 */
export function init() {
  // Check if DOM is ready and container exists
  const container = document.querySelector('.app');
  if (!container) {
    return;
  }

  // Load transactions from StorageService
  const loadedTransactions = StorageService.load();
  AppState.transactions = loadedTransactions;

  // Render initial state
  renderTransactionList(AppState.transactions);
  renderTotal(AppState.transactions);
  renderChart(AppState.transactions);

  // Attach form event handler
  const form = document.getElementById('expense-form');
  if (form) {
    form.addEventListener('submit', handleFormSubmit);
  }

  // Attach delete handlers after initial render
  attachDeleteHandlers();
}

/**
 * Rebuilds the scrollable transaction list.
 * Shows name, formatted amount, and category for each transaction.
 * Orders by newest-first using sortByNewest.
 * Shows empty-state indication when array is empty.
 * Attaches delete control per row.
 * @param {Transaction[]} transactions - The transaction array to render.
 */
export function renderTransactionList(transactions) {
  const listContainer = document.getElementById('transaction-list');
  if (!listContainer) {
    return;
  }

  // Clear existing content (but keep the empty-state element if it exists)
  const existingRows = listContainer.querySelectorAll('.transaction-row');
  existingRows.forEach((row) => row.remove());

  const emptyState = document.getElementById('list-empty-state');

  if (transactions.length === 0) {
    // Show empty state
    if (emptyState) {
      emptyState.style.display = 'block';
    }
    return;
  }

  // Show empty state if hidden
  if (emptyState) {
    emptyState.style.display = 'none';
  }

  // Render transaction rows (newest-first)
  const sortedTransactions = sortByNewest(transactions);
  for (const transaction of sortedTransactions) {
    const rowData = toRowData(transaction);
    const row = document.createElement('div');
    row.className = 'transaction-row';
    row.setAttribute('role', 'listitem');
    row.setAttribute('data-id', transaction.id);

    row.innerHTML = `
      <div class="transaction-row__info">
        <span class="transaction-row__name">${escapeHtml(rowData.name)}</span>
        <span class="transaction-row__meta">${rowData.category}</span>
      </div>
      <span class="transaction-row__amount">${rowData.amount}</span>
      <button class="btn btn--delete" data-delete-id="${transaction.id}" aria-label="Delete ${escapeHtml(rowData.name)}">
        Delete
      </button>
    `;

    listContainer.appendChild(row);
  }

  // Attach delete handlers for the newly rendered rows
  attachDeleteHandlers();
}

/**
 * Sets the total balance display.
 * Shows formatCurrency(calculateTotal(...)) or "0.00" when empty.
 * @param {Transaction[]} transactions - The transaction array.
 */
export function renderTotal(transactions) {
  const totalElement = document.getElementById('total-balance');
  if (!totalElement) {
    return;
  }

  const total = calculateTotal(transactions);
  totalElement.textContent = formatCurrency(total);
}

/**
 * Renders SVG pie chart from chart slices.
 * Uses computeChartSlices(...) to get category slices.
 * Computes arc paths from fractions (hand-rolled, no libraries).
 * Shows category labels.
 * Shows "no spending data" when empty.
 * @param {Transaction[]} transactions - The transaction array.
 */
export function renderChart(transactions) {
  const chartContainer = document.getElementById('chart-container');
  if (!chartContainer) {
    return;
  }

  const emptyState = document.getElementById('chart-empty-state');
  const slices = computeChartSlices(transactions);

  // Clear existing SVG content
  const existingSvg = chartContainer.querySelector('svg');
  if (existingSvg) {
    existingSvg.remove();
  }

  if (slices.length === 0) {
    // Show empty state
    if (emptyState) {
      emptyState.style.display = 'block';
    }
    return;
  }

  // Hide empty state
  if (emptyState) {
    emptyState.style.display = 'none';
  }

  // Render SVG pie chart
  const size = 240;
  const center = size / 2;
  const radius = size / 2 - 20; // Leave padding for labels

  let currentAngle = 0;
  const svgContent = [];

  for (const slice of slices) {
    const startAngle = currentAngle;
    const endAngle = currentAngle + slice.fraction * 2 * Math.PI;
    currentAngle = endAngle;

    // Calculate arc path
    const x1 = center + radius * Math.cos(startAngle);
    const y1 = center + radius * Math.sin(startAngle);
    const x2 = center + radius * Math.cos(endAngle);
    const y2 = center + radius * Math.sin(endAngle);

    const largeArcFlag = slice.fraction > 0.5 ? 1 : 0;

    const pathData = `M ${center} ${center} L ${x1} ${y1} A ${radius} ${radius} 0 ${largeArcFlag} 1 ${x2} ${y2} Z`;

    // Get color for category
    let color;
    switch (slice.label) {
      case 'Food':
        color = 'var(--color-food)';
        break;
      case 'Transport':
        color = 'var(--color-transport)';
        break;
      case 'Fun':
        color = 'var(--color-fun)';
        break;
      default:
        color = '#6b7280';
    }

    svgContent.push(
      `<path d="${pathData}" fill="${color}"/>`,
      `<text x="${center}" y="${center}" text-anchor="middle" dominant-baseline="middle" fill="white" font-weight="bold" font-size="12">${formatCurrency(slice.value)}</text>`
    );
  }

  // Render legend
  const legendContent = [];
  for (const slice of slices) {
    let color;
    switch (slice.label) {
      case 'Food':
        color = 'var(--color-food)';
        break;
      case 'Transport':
        color = 'var(--color-transport)';
        break;
      case 'Fun':
        color = 'var(--color-fun)';
        break;
      default:
        color = '#6b7280';
    }

    legendContent.push(
      `<div class="chart-legend__item">
        <span class="chart-legend__swatch" style="background-color: ${color}"></span>
        <span>${slice.label} (${formatCurrency(slice.value)})</span>
      </div>`
    );
  }

  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', `0 0 ${size} ${size}`);
  svg.innerHTML = svgContent.join('');

  const legend = document.createElement('div');
  legend.className = 'chart-legend';
  legend.innerHTML = legendContent.join('');

  chartContainer.appendChild(svg);
  chartContainer.appendChild(legend);
}

/**
 * Form submission handler.
 * Validates via validateTransaction.
 * On success: create transaction, add to AppState, clear form, persist, re-render.
 * On failure: call showValidationError.
 * @param {Event} event - The submit event.
 */
export function handleFormSubmit(event) {
  event.preventDefault();

  const form = event.target;
  if (!form) {
    return;
  }

  // Get form values
  const nameInput = document.getElementById('item-name');
  const amountInput = document.getElementById('amount');
  const categoryInput = document.getElementById('category');

  const input = {
    name: nameInput ? nameInput.value : '',
    amount: amountInput ? amountInput.value : '',
    category: categoryInput ? categoryInput.value : '',
  };

  // Validate
  const result = validateTransaction(input);

  if (!result.valid) {
    showValidationError(result.errors);
    return;
  }

  // Clear validation messages on success
  const validationContainer = document.getElementById('validation-messages');
  if (validationContainer) {
    validationContainer.innerHTML = '';
    validationContainer.setAttribute('hidden', '');
  }

  // Create and add transaction
  const transaction = createTransaction(input);
  AppState.transactions.push(transaction);

  // Clear form
  if (form.reset) {
    form.reset();
  }

  // Persist
  const saveResult = StorageService.save(AppState.transactions);

  if (!saveResult.ok) {
    showPersistenceError(saveResult.error);
  }

  // Re-render
  renderTransactionList(AppState.transactions);
  renderTotal(AppState.transactions);
  renderChart(AppState.transactions);
}

/**
 * Delete handler.
 * Removes transaction via deleteTransaction.
 * Persists and re-renders list/total/chart.
 * On failure: call showPersistenceError while keeping in-memory data.
 * @param {string} id - The transaction ID to delete.
 */
export function handleDelete(id) {
  // Remove from in-memory array
  const beforeCount = AppState.transactions.length;
  AppState.transactions = deleteTransaction(AppState.transactions, id);
  const afterCount = AppState.transactions.length;

  // Only persist if transaction was actually removed
  if (afterCount < beforeCount) {
    const saveResult = StorageService.save(AppState.transactions);

    if (!saveResult.ok) {
      // Revert in-memory change on failure
      // This would require knowing what was deleted, which is complex
      // For simplicity, we keep the in-memory state and show error
      showPersistenceError(saveResult.error);
    }

    // Re-render
    renderTransactionList(AppState.transactions);
    renderTotal(AppState.transactions);
    renderChart(AppState.transactions);
  }
}

/**
 * Renders validation messages near the form.
 * @param {string[]} errors - Array of error messages to display.
 */
export function showValidationError(errors) {
  const container = document.getElementById('validation-messages');
  if (!container) {
    return;
  }

  if (!errors || errors.length === 0) {
    container.setAttribute('hidden', '');
    return;
  }

  // Build list of errors
  const ul = document.createElement('ul');
  for (const error of errors) {
    const li = document.createElement('li');
    li.textContent = error;
    ul.appendChild(li);
  }

  container.innerHTML = '';
  container.appendChild(ul);
  container.removeAttribute('hidden');

  // Make visible
  container.classList.add('is-visible');
}

/**
 * Renders non-blocking persistence failure message.
 * @param {string} message - Error message to display.
 */
export function showPersistenceError(message) {
  const container = document.getElementById('persistence-error');
  if (!container) {
    return;
  }

  container.textContent = message;
  container.removeAttribute('hidden');

  // Make visible
  container.classList.add('is-visible');
}

/**
 * Attaches delete event handlers to all delete buttons in the list.
 */
function attachDeleteHandlers() {
  const deleteButtons = document.querySelectorAll('[data-delete-id]');
  for (const button of deleteButtons) {
    button.addEventListener('click', (event) => {
      const id = button.getAttribute('data-delete-id');
      if (id) {
        handleDelete(id);
      }
    });
  }
}

// Run init when DOM is ready (only once)
if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', () => {
    init();
  });
}
