var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
import { isDebugEnabled } from './debugFlags';
export var isRegionHeightDebugEnabled = function () { return isDebugEnabled('region-height'); };
export var logRegionHeightEvent = function (step, context) {
    if (!isRegionHeightDebugEnabled()) {
        return;
    }
    // eslint-disable-next-line no-console
    console.log('📊 [RegionHeight]', step, __assign(__assign({}, context), { timestamp: new Date().toISOString() }));
};
