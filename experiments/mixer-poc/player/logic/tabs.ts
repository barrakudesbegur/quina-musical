// The bottom tab bar: everything is at most 2 taps away.
export const TAB_IDS = ['ara', 'cartrons', 'historial', 'premis', 'programa'] as const;
export type TabId = (typeof TAB_IDS)[number];
