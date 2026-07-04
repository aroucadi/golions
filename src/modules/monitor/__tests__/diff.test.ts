import { describe, test, expect } from 'vitest';
import { DiffEngine } from '../DiffEngine';
import { FlightSearchResult } from '../types';

function createMockResult(status: FlightSearchResult['status'], flightsFound: number): FlightSearchResult {
  return {
    id: 'test-id',
    timestamp: new Date().toISOString(),
    route: 'CMN-IAH',
    date: '2026-07-04',
    status,
    flightsFound,
    responseTimeMs: 200,
    changeDetected: false
  };
}

describe('DiffEngine', () => {
  test('should return no change if there is no previous result', () => {
    const current = createMockResult('NO_FLIGHTS', 0);
    const diff = DiffEngine.detectChange(current, undefined);
    expect(diff.changed).toBe(false);
    expect(diff.severity).toBe('NONE');
  });

  test('should detect INVENTORY_APPEARED as CRITICAL', () => {
    const previous = createMockResult('NO_FLIGHTS', 0);
    const current = createMockResult('FLIGHTS_AVAILABLE', 2);
    const diff = DiffEngine.detectChange(current, previous);
    expect(diff.changed).toBe(true);
    expect(diff.severity).toBe('CRITICAL');
    expect(diff.type).toBe('INVENTORY_APPEARED');
  });

  test('should detect INVENTORY_SOLD_OUT as HIGH', () => {
    const previous = createMockResult('FLIGHTS_AVAILABLE', 2);
    const current = createMockResult('NO_FLIGHTS', 0);
    const diff = DiffEngine.detectChange(current, previous);
    expect(diff.changed).toBe(true);
    expect(diff.severity).toBe('HIGH');
    expect(diff.type).toBe('INVENTORY_SOLD_OUT');
  });

  test('should detect FLIGHT_COUNT_CHANGED as MEDIUM', () => {
    const previous = createMockResult('FLIGHTS_AVAILABLE', 2);
    const current = createMockResult('FLIGHTS_AVAILABLE', 3);
    const diff = DiffEngine.detectChange(current, previous);
    expect(diff.changed).toBe(true);
    expect(diff.severity).toBe('MEDIUM');
    expect(diff.type).toBe('FLIGHT_COUNT_CHANGED');
  });

  test('should detect ERROR_DETECTED as MEDIUM', () => {
    const previous = createMockResult('NO_FLIGHTS', 0);
    const current = createMockResult('ERROR', 0);
    const diff = DiffEngine.detectChange(current, previous);
    expect(diff.changed).toBe(true);
    expect(diff.severity).toBe('MEDIUM');
    expect(diff.type).toBe('ERROR_DETECTED');
  });

  test('should detect recovery as LOW', () => {
    const previous = createMockResult('ERROR', 0);
    const current = createMockResult('NO_FLIGHTS', 0);
    const diff = DiffEngine.detectChange(current, previous);
    expect(diff.changed).toBe(true);
    expect(diff.severity).toBe('LOW');
  });
});
