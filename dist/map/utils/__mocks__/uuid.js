/**
 * UUID Mock for Testing
 *
 * Provides deterministic UUIDs for testing.
 */
var counter = 0;
export var v4 = function () {
    counter += 1;
    return "mock-uuid-".concat(counter);
};
export var resetMockUuid = function () {
    counter = 0;
};
