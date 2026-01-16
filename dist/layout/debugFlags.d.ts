type DebugChannel = 'paginate-spellcasting' | 'measurement-spellcasting' | 'measurement' | 'planner-spellcasting' | 'layout-dirty' | 'measure-first' | 'layout-plan-diff' | 'column-cache-disabled' | 'cursor' | 'plan-commit' | 'region-height';
export declare const isDebugEnabled: (channel: DebugChannel) => boolean;
export declare const setDebugPreference: (channel: DebugChannel, enabled: boolean) => void;
export type { DebugChannel };
//# sourceMappingURL=debugFlags.d.ts.map