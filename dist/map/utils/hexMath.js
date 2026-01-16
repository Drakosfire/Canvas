/**
 * Hexagonal Grid Math Utilities
 *
 * Pure functions for calculating hex grid lines and coordinate conversions.
 * Uses cube coordinates with pointy-top orientation.
 *
 * Reference: https://www.redblobgames.com/grids/hexagons/
 */
/**
 * Round fractional cube coordinates to the nearest valid hex.
 * Uses the cube coordinate rounding algorithm from Red Blob Games.
 *
 * @param cube - Fractional cube coordinate
 * @returns Rounded cube coordinate satisfying x + y + z = 0
 */
export function cubeRound(cube) {
    var rx = Math.round(cube.x);
    var ry = Math.round(cube.y);
    var rz = Math.round(cube.z);
    var dx = Math.abs(rx - cube.x);
    var dy = Math.abs(ry - cube.y);
    var dz = Math.abs(rz - cube.z);
    // Reset the component with largest rounding error
    if (dx > dy && dx > dz) {
        rx = -ry - rz;
    }
    else if (dy > dz) {
        ry = -rx - rz;
    }
    else {
        rz = -rx - ry;
    }
    return { x: rx, y: ry, z: rz };
}
/**
 * Convert pixel coordinates to cube coordinates.
 * Uses pointy-top orientation.
 *
 * @param px - Pixel X position
 * @param py - Pixel Y position
 * @param size - Hex size (center to corner distance)
 * @returns Cube coordinate
 */
export function pixelToCube(px, py, size) {
    // Pointy-top orientation conversion
    var q = ((Math.sqrt(3) / 3) * px - (1 / 3) * py) / size;
    var r = ((2 / 3) * py) / size;
    // In cube coordinates: x = q, z = r, y = -x - z
    return cubeRound({
        x: q,
        y: -q - r,
        z: r,
    });
}
/**
 * Convert cube coordinates to pixel coordinates.
 * Uses pointy-top orientation.
 *
 * @param cube - Cube coordinate
 * @param size - Hex size (center to corner distance)
 * @returns Pixel position { px, py }
 */
export function cubeToPixel(cube, size) {
    // Pointy-top orientation: use x (q) and z (r)
    var px = size * Math.sqrt(3) * (cube.x + cube.z / 2);
    var py = size * (3 / 2) * cube.z;
    return { px: px, py: py };
}
/**
 * Get the 6 corners of a hex in pixel coordinates.
 *
 * @param centerX - Center X position
 * @param centerY - Center Y position
 * @param size - Hex size
 * @returns Array of 6 corner points
 */
export function getHexCorners(centerX, centerY, size) {
    var corners = [];
    // Pointy-top hex: starts at 30 degrees
    for (var i = 0; i < 6; i++) {
        var angleDeg = 60 * i - 30;
        var angleRad = (Math.PI / 180) * angleDeg;
        corners.push({
            x: centerX + size * Math.cos(angleRad),
            y: centerY + size * Math.sin(angleRad),
        });
    }
    return corners;
}
/**
 * Calculate all line segments for a hex grid overlay.
 * Uses pointy-top hexagons.
 *
 * @param params - Hex grid parameters
 * @returns Array of line segments
 */
export function calculateHexGridLines(params) {
    var width = params.width, height = params.height, size = params.cellSize, offsetX = params.offsetX, offsetY = params.offsetY;
    var lines = [];
    // Guard against invalid size
    if (size <= 0) {
        return lines;
    }
    // Set to track drawn edges (avoid duplicates)
    var drawnEdges = new Set();
    // Pointy-top hex dimensions
    var hexWidth = Math.sqrt(3) * size;
    var hexHeight = 2 * size;
    var vertDist = hexHeight * 0.75;
    // Calculate how many hexes we need to cover the viewport (with buffer)
    var cols = Math.ceil(width / hexWidth) + 2;
    var rows = Math.ceil(height / vertDist) + 2;
    // Starting offsets
    var startCol = Math.floor(-offsetX / hexWidth) - 1;
    var startRow = Math.floor(-offsetY / vertDist) - 1;
    for (var row = startRow; row < startRow + rows; row++) {
        for (var col = startCol; col < startCol + cols; col++) {
            // Calculate center position
            var centerX = col * hexWidth + offsetX;
            var centerY = row * vertDist + offsetY;
            // Offset odd rows for pointy-top
            if (row % 2 !== 0) {
                centerX += hexWidth / 2;
            }
            // Get hex corners
            var corners = getHexCorners(centerX, centerY, size);
            // Add edges (6 edges per hex)
            for (var i = 0; i < 6; i++) {
                var start = corners[i];
                var end = corners[(i + 1) % 6];
                // Create a unique key for this edge (order-independent)
                var x1 = Math.round(start.x * 100) / 100;
                var y1 = Math.round(start.y * 100) / 100;
                var x2 = Math.round(end.x * 100) / 100;
                var y2 = Math.round(end.y * 100) / 100;
                var edgeKey = [
                    "".concat(Math.min(x1, x2), ",").concat(Math.min(y1, y2)),
                    "".concat(Math.max(x1, x2), ",").concat(Math.max(y1, y2)),
                ].join('-');
                // Skip if edge already drawn
                if (drawnEdges.has(edgeKey)) {
                    continue;
                }
                drawnEdges.add(edgeKey);
                // Only add lines that are at least partially visible
                var minX = Math.min(start.x, end.x);
                var maxX = Math.max(start.x, end.x);
                var minY = Math.min(start.y, end.y);
                var maxY = Math.max(start.y, end.y);
                if (maxX >= 0 && minX <= width && maxY >= 0 && minY <= height) {
                    lines.push({
                        points: [start.x, start.y, end.x, end.y],
                    });
                }
            }
        }
    }
    return lines;
}
/**
 * Get neighbors of a hex in cube coordinates
 */
export function getCubeNeighbors(cube) {
    var directions = [
        { x: 1, y: -1, z: 0 },
        { x: 1, y: 0, z: -1 },
        { x: 0, y: 1, z: -1 },
        { x: -1, y: 1, z: 0 },
        { x: -1, y: 0, z: 1 },
        { x: 0, y: -1, z: 1 },
    ];
    return directions.map(function (dir) { return ({
        x: cube.x + dir.x,
        y: cube.y + dir.y,
        z: cube.z + dir.z,
    }); });
}
/**
 * Calculate distance between two hexes in cube coordinates
 */
export function cubeDistance(a, b) {
    return (Math.abs(a.x - b.x) + Math.abs(a.y - b.y) + Math.abs(a.z - b.z)) / 2;
}
