import { FlightSearchResult, ChangeDetection } from './types';

export class DiffEngine {
  /**
   * Compares the current search result against the previous search result
   * to determine if any inventory or system state transitions occurred.
   */
  public static detectChange(current: FlightSearchResult, previous?: FlightSearchResult): ChangeDetection {
    // Rule 1: No previous check exists = no baseline to compare, so no change.
    if (!previous) {
      return { changed: false, severity: 'NONE' };
    }

    // Rule 2: Inventory appeared (NO_FLIGHTS -> FLIGHTS_AVAILABLE) = CRITICAL
    if (previous.status === 'NO_FLIGHTS' && current.status === 'FLIGHTS_AVAILABLE') {
      return {
        changed: true,
        severity: 'CRITICAL',
        type: 'INVENTORY_APPEARED'
      };
    }

    // Rule 3: Inventory sold out (FLIGHTS_AVAILABLE -> NO_FLIGHTS) = HIGH
    if (previous.status === 'FLIGHTS_AVAILABLE' && current.status === 'NO_FLIGHTS') {
      return {
        changed: true,
        severity: 'HIGH',
        type: 'INVENTORY_SOLD_OUT'
      };
    }

    // Rule 4: Flight counts changed (still available but different quantity) = MEDIUM
    if (
      previous.status === 'FLIGHTS_AVAILABLE' &&
      current.status === 'FLIGHTS_AVAILABLE' &&
      previous.flightsFound !== current.flightsFound
    ) {
      return {
        changed: true,
        severity: 'MEDIUM',
        type: 'FLIGHT_COUNT_CHANGED'
      };
    }

    // Rule 5: Entering error state = MEDIUM
    if (previous.status !== 'ERROR' && current.status === 'ERROR') {
      return {
        changed: true,
        severity: 'MEDIUM',
        type: 'ERROR_DETECTED'
      };
    }

    // Rule 6: Auto-recovered from error = LOW
    if (previous.status === 'ERROR' && current.status !== 'ERROR') {
      return {
        changed: true,
        severity: 'LOW',
        type: 'OTHER'
      };
    }

    return { changed: false, severity: 'NONE' };
  }
}
export default DiffEngine;
