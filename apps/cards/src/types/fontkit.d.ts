// The part of fontkit (the font engine @react-pdf uses) the cards measure text with: it ships no types.
declare module 'fontkit' {
  export interface Font {
    unitsPerEm: number;
    capHeight: number;
    layout(text: string): { advanceWidth: number };
  }
  export function openSync(path: string): Font;
}
