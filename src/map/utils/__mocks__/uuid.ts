/**
 * UUID Mock for Testing
 * 
 * Provides deterministic UUIDs for testing.
 */

let counter = 0;

export const v4 = (): string => {
  counter += 1;
  return `mock-uuid-${counter}`;
};

export const resetMockUuid = (): void => {
  counter = 0;
};
