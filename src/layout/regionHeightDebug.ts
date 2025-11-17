import { isDebugEnabled } from './debugFlags';

export const isRegionHeightDebugEnabled = (): boolean => isDebugEnabled('region-height');

export const logRegionHeightEvent = (
    step: string,
    context: Record<string, unknown>
): void => {
    if (!isRegionHeightDebugEnabled()) {
        return;
    }

    // eslint-disable-next-line no-console
    console.log('📊 [RegionHeight]', step, {
        ...context,
        timestamp: new Date().toISOString(),
    });
};

