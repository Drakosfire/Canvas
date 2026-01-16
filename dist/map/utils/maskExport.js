/**
 * Mask Export Utility
 *
 * Exports mask strokes to base64 PNG for backend inpainting.
 * Implements TDD tests from T162-T164.
 *
 * Alpha channel semantics:
 * - 0 (transparent): AI may generate/replace
 * - 1 (opaque): AI must not alter
 */
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
/**
 * Export mask strokes to a base64-encoded PNG.
 */
export function exportMaskToBase64(options) {
    return __awaiter(this, void 0, void 0, function () {
        var width, height, strokes, safeStrokes, canvas, ctx, _i, safeStrokes_1, stroke, cx, cy, rx, ry, i, base64;
        return __generator(this, function (_a) {
            width = options.width, height = options.height, strokes = options.strokes;
            safeStrokes = strokes || [];
            canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            ctx = canvas.getContext('2d');
            if (!ctx) {
                throw new Error('Failed to get 2D context');
            }
            // Start with transparent background (alpha = 0 = generate)
            ctx.clearRect(0, 0, width, height);
            // Draw each stroke
            for (_i = 0, safeStrokes_1 = safeStrokes; _i < safeStrokes_1.length; _i++) {
                stroke = safeStrokes_1[_i];
                if (stroke.tool === 'eraser') {
                    ctx.globalCompositeOperation = 'destination-out';
                }
                else {
                    ctx.globalCompositeOperation = 'source-over';
                }
                if (stroke.tool === 'rect' && stroke.bounds) {
                    ctx.fillStyle = 'white';
                    ctx.fillRect(stroke.bounds.x, stroke.bounds.y, stroke.bounds.width, stroke.bounds.height);
                }
                else if (stroke.tool === 'circle' && stroke.bounds) {
                    ctx.fillStyle = 'white';
                    ctx.beginPath();
                    cx = stroke.bounds.x + stroke.bounds.width / 2;
                    cy = stroke.bounds.y + stroke.bounds.height / 2;
                    rx = stroke.bounds.width / 2;
                    ry = stroke.bounds.height / 2;
                    ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
                    ctx.fill();
                }
                else if (stroke.points.length >= 2) {
                    ctx.strokeStyle = 'white';
                    ctx.lineWidth = stroke.strokeWidth;
                    ctx.lineCap = 'round';
                    ctx.lineJoin = 'round';
                    ctx.beginPath();
                    ctx.moveTo(stroke.points[0], stroke.points[1]);
                    for (i = 2; i < stroke.points.length; i += 2) {
                        ctx.lineTo(stroke.points[i], stroke.points[i + 1]);
                    }
                    ctx.stroke();
                }
            }
            base64 = canvas.toDataURL('image/png');
            return [2 /*return*/, {
                    base64: base64,
                    width: width,
                    height: height,
                }];
        });
    });
}
