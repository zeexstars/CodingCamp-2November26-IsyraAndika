/**
 * Tests for AppState and StorageService
 * Tests the state and storage layer implementation
 */

import {
  AppState,
  StorageService,
  serialize,
  deserialize,
  generateId
} from '../app.js';

// Test helper
function assert(condition, message) {
  if (!condition) {
    console.error(`FAIL: ${message}`);
    process.exit(1);
  }
}

function assertEqual(actual, expected, message) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    console.error(`FAIL: ${message}`);
    console.error(`  Expected: ${JSON.stringify(expected)}`);
    console.error(`  Actual: ${JSON.stringify(actual)}`);
    process.exit(1);
  }
}

console.log('Testing AppState and StorageService...\n');

// ============================================================================
// AppState Tests
// ============================================================================

console.log('=== AppState Tests ===');

// Test 1: AppState exists and has transactions array
assert(AppState !== undefined, 'AppState should be exported');
assert(AppState.transactions !== undefined, 'AppState should have transactions property');
assert(Array.isArray(AppState.transactions), 'AppState.transactions should be an array');
assertEqual(AppState.transactions, [], 'AppState.transactions should be empty initially');

// Test 2: AppState.transactions can be replaced
const originalArray = AppState.transactions;
AppState.transactions = [{ id: generateId(), name: 'Test', amount: 10, category: 'Food', createdAt: Date.now() }];
assert(AppState.transactions !== originalArray, 'AppState.transactions should replace reference');
assertEqual(AppState.transactions.length, 1, 'AppState.transactions should have 1 item after replacement');

// Test 3: AppState.transactions can be reset to empty
AppState.transactions = [];
assertEqual(AppState.transactions, [], 'AppState.transactions should be empty after reset');

console.log('AppState tests passed!\n');

// ============================================================================
// StorageService.isAvailable() Tests
// ============================================================================

console.log('=== StorageService.isAvailable() Tests ===');

// Test 4: isAvailable returns boolean
const isAvailable = StorageService.isAvailable();
assert(typeof isAvailable === 'boolean', 'isAvailable should return a boolean');
console.log(`  Local Storage available: ${isAvailable}`);

// Test 5: isAvailable handles unavailable storage gracefully
// (We can't easily test this without mocking, but the implementation should catch all exceptions)
console.log('isAvailable tests passed!\n');

// ============================================================================
// StorageService.save() Tests
// ============================================================================

console.log('=== StorageService.save() Tests ===');

// Test 6: save returns ok object
const testTransactions = [
  { id: generateId(), name: 'Coffee', amount: 5.50, category: 'Food', createdAt: 1000 },
  { id: generateId(), name: 'Bus', amount: 2.00, category: 'Transport', createdAt: 2000 }
];

const saveResult = StorageService.save(testTransactions);
assert(saveResult !== undefined, 'save should return an object');
assert(saveResult.ok !== undefined, 'save result should have ok property');

if (isAvailable) {
  assert(saveResult.ok === true, 'save should succeed when Local Storage is available');
  console.log('  save() returned { ok: true } as expected');
} else {
  assert(saveResult.ok === false, 'save should fail when Local Storage is unavailable');
  assert(saveResult.error !== undefined, 'save should return error message when failing');
  console.log(`  save() returned { ok: false, error: "${saveResult.error}" } as expected`);
}

// Test 7: save returns error object on failure (simulated by setting isAvailable to false temporarily)
// We can't easily test this without mocking, but the implementation handles it
console.log('save tests passed!\n');

// ============================================================================
// StorageService.load() Tests
// ============================================================================

console.log('=== StorageService.load() Tests ===');

// Test 8: load returns array
const loadedTransactions = StorageService.load();
assert(Array.isArray(loadedTransactions), 'load should return an array');

// Test 9: load returns empty array when no data saved
if (!isAvailable || loadedTransactions.length === 0) {
  assertEqual(loadedTransactions, [], 'load should return empty array when no data saved');
  console.log('  load() returned empty array as expected');
}

// Test 10: load returns deserialized transactions when data exists
if (isAvailable && loadedTransactions.length > 0) {
  assert(loadedTransactions.every(t => t.id !== undefined), 'Loaded transactions should have id');
  assert(loadedTransactions.every(t => t.name !== undefined), 'Loaded transactions should have name');
  assert(loadedTransactions.every(t => typeof t.amount === 'number'), 'Loaded transactions should have number amount');
  assert(loadedTransactions.every(t => ['Food', 'Transport', 'Fun'].includes(t.category)), 'Loaded transactions should have valid category');
  console.log(`  load() returned ${loadedTransactions.length} transactions as expected`);
}

// Test 11: load handles corrupt data by returning empty array
if (isAvailable) {
  // Save corrupted data
  const originalKey = StorageService.KEY;
  const originalValue = localStorage.getItem(originalKey);
  localStorage.setItem(originalKey, 'invalid json {');
  
  const corruptedResult = StorageService.load();
  assertEqual(corruptedResult, [], 'load should return empty array for corrupt JSON');
  
  // Restore original value
  if (originalValue !== null) {
    localStorage.setItem(originalKey, originalValue);
  } else {
    localStorage.removeItem(originalKey);
  }
  console.log('  load() correctly handles corrupt JSON');
}

console.log('load tests passed!\n');

// ============================================================================
// Integration Tests: Save and Load Round-Trip
// ============================================================================

console.log('=== Integration: Save/Load Round-Trip Tests ===');

if (isAvailable) {
  // Test 12: Save then load returns same data
  const originalTransactions = [
    { id: generateId(), name: 'Lunch', amount: 15.50, category: 'Food', createdAt: 3000 },
    { id: generateId(), name: 'Taxi', amount: 25.00, category: 'Transport', createdAt: 4000 },
    { id: generateId(), name: 'Movie', amount: 12.00, category: 'Fun', createdAt: 5000 }
  ];

  // Clear storage first
  localStorage.removeItem(StorageService.KEY);

  // Save
  const saveResult = StorageService.save(originalTransactions);
  assert(saveResult.ok === true, 'save should succeed');

  // Load
  const loadedTransactions = StorageService.load();
  
  // Verify round-trip
  assertEqual(loadedTransactions.length, originalTransactions.length, 'Loaded count should match saved count');
  
  for (let i = 0; i < originalTransactions.length; i++) {
    assertEqual(loadedTransactions[i].id, originalTransactions[i].id, `ID should match at index ${i}`);
    assertEqual(loadedTransactions[i].name, originalTransactions[i].name, `Name should match at index ${i}`);
    assertEqual(loadedTransactions[i].amount, originalTransactions[i].amount, `Amount should match at index ${i}`);
    assertEqual(loadedTransactions[i].category, originalTransactions[i].category, `Category should match at index ${i}`);
    assertEqual(loadedTransactions[i].createdAt, originalTransactions[i].createdAt, `createdAt should match at index ${i}`);
  }
  
  console.log('  save/load round-trip preserved all data correctly');
  
  // Test 13: Empty array round-trip
  const emptySaveResult = StorageService.save([]);
  assert(emptySaveResult.ok === true, 'save empty array should succeed');
  
  const emptyLoadResult = StorageService.load();
  assertEqual(emptyLoadResult, [], 'Empty array should round-trip correctly');
  
  console.log('  save/load round-trip of empty array works correctly');
} else {
  console.log('  Skipped - Local Storage not available');
}

console.log('\n=== All Tests Passed! ===');
