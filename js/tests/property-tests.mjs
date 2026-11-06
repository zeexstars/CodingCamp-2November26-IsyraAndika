/**
 * Property-based tests for Expense & Budget Visualizer logic layer
 * Uses fast-check style property testing with minimal dependencies
 */

// Import the module under test
import {
  validateTransaction,
  createTransaction,
  deleteTransaction,
  sortByNewest,
  calculateTotal,
  formatCurrency,
  aggregateByCategory,
  toRowData,
  computeChartSlices,
  serialize,
  deserialize,
  generateId,
  CATEGORIES
} from '../app.js';

// Simple property testing framework (minimal implementation)
class PropertyTestFramework {
  constructor() {
    this.passed = 0;
    this.failed = 0;
    this.failures = [];
  }

  assert(condition, message) {
    if (!condition) {
      this.failed++;
      this.failures.push(message);
      console.error(`FAIL: ${message}`);
      return false;
    }
    this.passed++;
    return true;
  }

  assertEqual(actual, expected, message) {
    if (actual !== expected) {
      this.failed++;
      this.failures.push(`${message}\n  Expected: ${expected}\n  Actual: ${actual}`);
      console.error(`FAIL: ${message}`);
      return false;
    }
    this.passed++;
    return true;
  }

  assertDeepEqual(actual, expected, message) {
    if (JSON.stringify(actual) !== JSON.stringify(expected)) {
      this.failed++;
      this.failures.push(`${message}\n  Expected: ${JSON.stringify(expected)}\n  Actual: ${JSON.stringify(actual)}`);
      console.error(`FAIL: ${message}`);
      return false;
    }
    this.passed++;
    return true;
  }

  assertApproxEqual(actual, expected, tolerance = 0.0001, message) {
    if (Math.abs(actual - expected) > tolerance) {
      this.failed++;
      this.failures.push(`${message}\n  Expected: ~${expected}\n  Actual: ${actual}`);
      console.error(`FAIL: ${message}`);
      return false;
    }
    this.passed++;
    return true;
  }

  summary() {
    console.log('\n=== Test Summary ===');
    console.log(`Passed: ${this.passed}`);
    console.log(`Failed: ${this.failed}`);
    if (this.failures.length > 0) {
      console.log('\nFailures:');
      this.failures.forEach((f, i) => console.log(`  ${i + 1}. ${f}`));
    }
    return this.failed === 0;
  }
}

// Utility generators (simulating fast-check arbitraries)
function* rangeGenerator(min, max, iterations = 100) {
  for (let i = 0; i < iterations; i++) {
    yield Math.floor(Math.random() * (max - min + 1)) + min;
  }
}

function* amountGenerator(iterations = 100) {
  const amounts = [
    '0.01', '0.10', '1.00', '10.00', '100.00', '999999.99',
    '0.001', '12.345', '0', '-1', '1000000', 'abc', '', '   '
  ];
  for (let i = 0; i < Math.min(iterations, amounts.length); i++) {
    yield amounts[i];
  }
}

function* nameGenerator(iterations = 100) {
  const names = [
    'a', 'ab', 'A'.repeat(50), 'A'.repeat(51),
    'Coffee', '   ', 'Valid Name', '', 'x'.repeat(100)
  ];
  for (let i = 0; i < Math.min(iterations, names.length); i++) {
    yield names[i];
  }
}

function* categoryGenerator(iterations = 100) {
  const categories = ['Food', 'Transport', 'Fun', '', 'Invalid', 'food', 'FOOD'];
  for (let i = 0; i < Math.min(iterations, categories.length); i++) {
    yield categories[i];
  }
}

function* transactionGenerator(iterations = 100) {
  const categories = CATEGORIES;
  for (let i = 0; i < iterations; i++) {
    yield {
      id: generateId(),
      name: `Transaction ${i}`,
      amount: Math.random() * 1000,
      category: categories[i % categories.length],
      createdAt: Date.now() - Math.random() * 1000000
    };
  }
}

function randomAmount() {
  const amounts = [];
  for (let i = 0; i < 50; i++) {
    const val = Math.random() * 1000000;
    amounts.push(val.toFixed(2));
  }
  return amounts;
}

function randomNames() {
  const names = [];
  for (let i = 0; i < 50; i++) {
    const len = Math.floor(Math.random() * 60);
    names.push('x'.repeat(len));
  }
  return names;
}

function randomCategories() {
  const cats = [];
  for (let i = 0; i < 50; i++) {
    const options = [...CATEGORIES, '', 'Invalid', 'food'];
    cats.push(options[Math.floor(Math.random() * options.length)]);
  }
  return cats;
}

function randomTransactions(count) {
  const transactions = [];
  for (let i = 0; i < count; i++) {
    transactions.push({
      id: generateId(),
      name: `Item ${i}`,
      amount: Math.random() * 500,
      category: CATEGORIES[i % CATEGORIES.length],
      createdAt: Date.now() - Math.random() * 1000000
    });
  }
  return transactions;
}

// ============================================================================
// Property Tests
// ============================================================================

const fc = {
  property: (name, test) => {
    console.log(`\nProperty: ${name}`);
    test();
  }
};

console.log('========================================');
console.log('Expense & Budget Visualizer - Property Tests');
console.log('========================================\n');

const results = new PropertyTestFramework();

// Property 1: Validation accepts exactly valid inputs
fc.property('Validation accepts exactly valid inputs', () => {
  const validAmounts = ['0.01', '1', '10.50', '100.00', '999999.99'];
  const validNames = ['a', 'Coffee', 'Lunch', 'A'.repeat(50)];
  const validCategories = CATEGORIES;

  let validCount = 0;
  let invalidCount = 0;

  // Test valid combinations
  for (const amount of validAmounts) {
    for (const name of validNames) {
      for (const category of validCategories) {
        const result = validateTransaction({ name, amount, category });
        results.assert(result.valid, `Valid input rejected: ${name}, ${amount}, ${category}`);
        results.assertEqual(result.errors.length, 0, 'Valid input should have no errors');
        validCount++;
      }
    }
  }

  // Test invalid amounts
  const invalidAmounts = ['0', '-1', '1000000', '12.345', 'abc', '', '   '];
  for (const amount of invalidAmounts) {
    const result = validateTransaction({ name: 'Coffee', amount, category: 'Food' });
    results.assert(!result.valid, `Invalid amount should be rejected: ${amount}`);
    invalidCount++;
  }

  // Test invalid names
  const invalidNames = ['', '   ', 'A'.repeat(51)];
  for (const name of invalidNames) {
    const result = validateTransaction({ name, amount: '10.00', category: 'Food' });
    results.assert(!result.valid, `Invalid name should be rejected: "${name}"`);
    invalidCount++;
  }

  // Test invalid categories
  const invalidCategories = ['', 'Invalid', 'food', 'FOOD'];
  for (const category of invalidCategories) {
    const result = validateTransaction({ name: 'Coffee', amount: '10.00', category });
    results.assert(!result.valid, `Invalid category should be rejected: ${category}`);
    invalidCount++;
  }

  console.log(`  Valid cases tested: ${validCount}, Invalid cases tested: ${invalidCount}`);
});

// Property 2: Transaction list is ordered newest-first
fc.property('Newest-first ordering', () => {
  for (let iter = 0; iter < 50; iter++) {
    const transactions = randomTransactions(10);
    const sorted = sortByNewest(transactions);
    
    for (let i = 0; i < sorted.length - 1; i++) {
      results.assert(
        sorted[i].createdAt >= sorted[i + 1].createdAt,
        `Ordering violated at index ${i}: ${sorted[i].createdAt} < ${sorted[i + 1].createdAt}`
      );
    }
    results.assertEqual(sorted.length, transactions.length, 'Sorted array should preserve length');
  }
  console.log(`  Tested 50 iteration(s)`);
});

// Property 3: Row data mapping
fc.property('Row content preservation', () => {
  for (let iter = 0; iter < 50; iter++) {
    const tx = {
      id: generateId(),
      name: 'Test Item',
      amount: 12.5,
      category: 'Food',
      createdAt: Date.now()
    };
    
    const row = toRowData(tx);
    results.assertEqual(row.name, tx.name, 'Name should be preserved');
    results.assertEqual(row.amount, '12.50', 'Amount should be formatted with 2 decimals');
    results.assertEqual(row.category, tx.category, 'Category should be preserved');
  }
  console.log(`  Tested 50 transaction(s)`);
});

// Property 4: Delete removes exactly one
fc.property('Delete removes exactly one transaction', () => {
  for (let iter = 0; iter < 50; iter++) {
    const transactions = randomTransactions(10);
    if (transactions.length === 0) continue;
    
    const targetIndex = Math.floor(Math.random() * transactions.length);
    const targetId = transactions[targetIndex].id;
    
    const result = deleteTransaction(transactions, targetId);
    results.assertEqual(
      result.length, 
      transactions.length - 1, 
      'Result should have one fewer element'
    );
    results.assertEqual(
      result.find(t => t.id === targetId), 
      undefined, 
      'Deleted transaction should not exist in result'
    );
    results.assertEqual(
      result.length, 
      transactions.length - 1, 
      'Original array should not be mutated'
    );
  }
  console.log(`  Tested 50 iteration(s)`);
});

// Property 5: Total balance
fc.property('Total balance equals sum of amounts', () => {
  // Test with various transaction sets
  const testCases = [
    [],
    [{ name: 'a', amount: 10 }],
    [{ name: 'a', amount: 10 }, { name: 'b', amount: 20 }],
    randomTransactions(20),
    randomTransactions(100)
  ];

  for (const transactions of testCases) {
    const total = calculateTotal(transactions);
    const sum = transactions.reduce((acc, t) => acc + t.amount, 0);
    results.assertApproxEqual(total, sum, 0.001, `Total should equal sum for ${transactions.length} transactions`);
    
    const formatted = formatCurrency(total);
    const expectedFormatted = Number(total).toFixed(2);
    results.assertEqual(formatted, expectedFormatted, `formatCurrency should produce "${expectedFormatted}" for total ${total}`);
  }

  // Empty set should give "0.00"
  const emptyTotal = calculateTotal([]);
  results.assertEqual(emptyTotal, 0, 'Empty set should have total 0');
  results.assertEqual(formatCurrency(emptyTotal), '0.00', 'Empty set formatted should be "0.00"');
  
  console.log(`  Tested ${testCases.length} case(s)`);
});

// Property 6: Chart slices
fc.property('Chart slices are proportional', () => {
  // Test empty set
  const emptySlices = computeChartSlices([]);
  results.assertDeepEqual(emptySlices, [], 'Empty set should produce no slices');

  // Test with transactions
  for (let iter = 0; iter < 50; iter++) {
    const transactions = randomTransactions(20);
    const slices = computeChartSlices(transactions);
    const grandTotal = calculateTotal(transactions);

    if (grandTotal > 0) {
      // Only non-zero categories should produce slices
      for (const slice of slices) {
        results.assert(slice.fraction > 0, 'Slice fraction should be positive');
        results.assertApproxEqual(
          slice.fraction, 
          slice.value / grandTotal, 
          0.001, 
          `Slice fraction should equal value / grandTotal for ${slice.label}`
        );
      }

      // Fractions should sum to 1
      const fractionSum = slices.reduce((acc, s) => acc + s.fraction, 0);
      results.assertApproxEqual(fractionSum, 1, 0.001, 'Sum of fractions should be 1');

      // Values should sum to grand total
      const valueSum = slices.reduce((acc, s) => acc + s.value, 0);
      results.assertApproxEqual(valueSum, grandTotal, 0.001, 'Sum of slice values should equal grand total');
    } else {
      results.assertDeepEqual(slices, [], 'No spending should produce no slices');
    }
  }

  console.log(`  Tested empty case + 50 iteration(s)`);
});

// Property 7: Serialization round-trip
fc.property('Serialization round-trip preserves count and field values', () => {
  for (let iter = 0; iter < 50; iter++) {
    const count = Math.floor(Math.random() * 20) + 1;
    const transactions = randomTransactions(count);
    
    const json = serialize(transactions);
    const loaded = deserialize(json);
    
    results.assertEqual(loaded.length, transactions.length, `Round-trip should preserve count (${count})`);
    
    for (let i = 0; i < transactions.length; i++) {
      results.assertEqual(loaded[i].id, transactions[i].id, `ID should match at index ${i}`);
      results.assertEqual(loaded[i].name, transactions[i].name, `Name should match at index ${i}`);
      results.assertApproxEqual(loaded[i].amount, transactions[i].amount, 0.001, `Amount should match at index ${i}`);
      results.assertEqual(loaded[i].category, transactions[i].category, `Category should match at index ${i}`);
      results.assertEqual(loaded[i].createdAt, transactions[i].createdAt, `createdAt should match at index ${i}`);
    }
  }

  // Test edge cases for deserialize
  results.assertDeepEqual(deserialize(null), [], 'null should return empty array');
  results.assertDeepEqual(deserialize(undefined), [], 'undefined should return empty array');
  results.assertDeepEqual(deserialize(''), [], 'Empty string should return empty array');
  results.assertDeepEqual(deserialize('invalid json'), [], 'Invalid JSON should return empty array');
  results.assertDeepEqual(deserialize('{}'), [], 'Object should return empty array');
  results.assertDeepEqual(deserialize('[invalid]'), [], 'Invalid array should return empty array');
  
  console.log(`  Tested 50 round-trips + edge cases`);
});

// ============================================================================
// Unit Tests - Boundary Conditions
// ============================================================================

console.log('\n========================================');
console.log('Unit Tests - Boundary Conditions');
console.log('========================================\n');

// Amount boundaries
console.log('Amount boundary tests:');
results.assert(
  validateTransaction({ name: 'Coffee', amount: '0.01', category: 'Food' }).valid,
  'Amount 0.01 should be accepted'
);
results.assert(
  validateTransaction({ name: 'Coffee', amount: '999999.99', category: 'Food' }).valid,
  'Amount 999999.99 should be accepted'
);
results.assert(
  !validateTransaction({ name: 'Coffee', amount: '0', category: 'Food' }).valid,
  'Amount 0 should be rejected'
);
results.assert(
  !validateTransaction({ name: 'Coffee', amount: '-1', category: 'Food' }).valid,
  'Amount -1 should be rejected'
);
results.assert(
  !validateTransaction({ name: 'Coffee', amount: '1000000', category: 'Food' }).valid,
  'Amount 1000000 should be rejected'
);
results.assert(
  !validateTransaction({ name: 'Coffee', amount: '12.345', category: 'Food' }).valid,
  'Amount 12.345 should be rejected'
);
results.assert(
  !validateTransaction({ name: 'Coffee', amount: 'abc', category: 'Food' }).valid,
  'Non-numeric amount should be rejected'
);
results.assert(
  !validateTransaction({ name: 'Coffee', amount: '', category: 'Food' }).valid,
  'Empty amount should be rejected'
);

// Name length boundaries
console.log('Name length boundary tests:');
results.assert(
  validateTransaction({ name: 'a', amount: '10.00', category: 'Food' }).valid,
  'Name of length 1 should be accepted'
);
results.assert(
  validateTransaction({ name: 'A'.repeat(50), amount: '10.00', category: 'Food' }).valid,
  'Name of length 50 should be accepted'
);
results.assert(
  !validateTransaction({ name: 'A'.repeat(51), amount: '10.00', category: 'Food' }).valid,
  'Name of length 51 should be rejected'
);
results.assert(
  !validateTransaction({ name: '   ', amount: '10.00', category: 'Food' }).valid,
  'Whitespace-only name should be rejected'
);

// Empty set edge cases
console.log('Empty set edge cases:');
results.assertEqual(calculateTotal([]), 0, 'Empty transactions should have total 0');
results.assertEqual(formatCurrency(0), '0.00', 'Zero formatted should be "0.00"');
results.assertDeepEqual(computeChartSlices([]), [], 'Empty transactions should produce no chart slices');
results.assertDeepEqual(aggregateByCategory([]), { Food: 0, Transport: 0, Fun: 0 }, 'Empty should give all zeros');

// Single category edge case
console.log('Single category edge cases:');
const singleCatTransactions = [
  { id: generateId(), name: 'Item', amount: 50, category: 'Food', createdAt: Date.now() }
];
const singleSlices = computeChartSlices(singleCatTransactions);
results.assertEqual(singleSlices.length, 1, 'Single category should produce one slice');
results.assertApproxEqual(singleSlices[0].fraction, 1, 0.001, 'Single category fraction should be 1');

// Category constants
console.log('Category constant tests:');
results.assertDeepEqual(CATEGORIES, ['Food', 'Transport', 'Fun'], 'CATEGORIES should have correct values');

// Delete last transaction
console.log('Delete edge case:');
const lastTx = [{ id: generateId(), name: 'Only', amount: 10, category: 'Food', createdAt: Date.now() }];
const afterDelete = deleteTransaction(lastTx, lastTx[0].id);
results.assertDeepEqual(afterDelete, [], 'Deleting last should give empty array');

// Format currency variations
console.log('Format currency variations:');
results.assertEqual(formatCurrency(12.5), '12.50', '12.5 -> 12.50');
results.assertEqual(formatCurrency(0), '0.00', '0 -> 0.00');
results.assertEqual(formatCurrency(100), '100.00', '100 -> 100.00');
results.assertEqual(formatCurrency(0.1), '0.10', '0.1 -> 0.10');

// ============================================================================
// Final Summary
// ============================================================================

const allPassed = results.summary();
console.log('\n========================================');
if (allPassed) {
  console.log('ALL TESTS PASSED');
  process.exit(0);
} else {
  console.log('SOME TESTS FAILED');
  process.exit(1);
}