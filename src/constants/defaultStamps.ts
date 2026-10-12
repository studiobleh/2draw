import { StampAsset } from '../types';

// Helper to create clean base64 data URLs for vector SVG stamps
function svgToDataUrl(svg: string): string {
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

export const DEFAULT_STAMPS: StampAsset[] = [
  {
    id: 'stamp_default_star',
    name: 'Neo Star',
    dataUrl: svgToDataUrl(`
      <svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128">
        <path d="M64 4 L76 48 L120 48 L84 76 L98 120 L64 92 L30 120 L44 76 L8 48 L52 48 Z" 
              fill="#FFE600" stroke="#000000" stroke-width="7" stroke-linejoin="round"/>
        <circle cx="64" cy="64" r="8" fill="#000000"/>
      </svg>
    `),
    width: 128,
    height: 128,
  },
  {
    id: 'stamp_default_bolt',
    name: 'High Voltage',
    dataUrl: svgToDataUrl(`
      <svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128">
        <polygon points="76,8 24,72 60,72 44,120 104,52 68,52" 
                 fill="#00E5F0" stroke="#000000" stroke-width="7" stroke-linejoin="round"/>
      </svg>
    `),
    width: 128,
    height: 128,
  },
  {
    id: 'stamp_default_heart',
    name: 'Brutalist Heart',
    dataUrl: svgToDataUrl(`
      <svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128">
        <path d="M64 116 C64 116 16 84 16 46 C16 24 34 12 52 12 C60 12 64 18 64 18 C64 18 68 12 76 12 C94 12 112 24 112 46 C112 84 64 116 64 116 Z" 
              fill="#FF5F38" stroke="#000000" stroke-width="7" stroke-linejoin="round"/>
        <path d="M36 32 C32 40 32 48 36 54" stroke="#FFFFFF" stroke-width="5" stroke-linecap="round" fill="none"/>
      </svg>
    `),
    width: 128,
    height: 128,
  },
  {
    id: 'stamp_default_skull',
    name: 'Chunky Skull',
    dataUrl: svgToDataUrl(`
      <svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128">
        <path d="M24 54 C24 28 42 14 64 14 C86 14 104 28 104 54 C104 74 92 84 84 88 L84 104 L44 104 L44 88 C36 84 24 74 24 54 Z" 
              fill="#FFFFFF" stroke="#000000" stroke-width="7" stroke-linejoin="round"/>
        <ellipse cx="46" cy="54" rx="9" ry="12" fill="#000000"/>
        <ellipse cx="82" cy="54" rx="9" ry="12" fill="#000000"/>
        <polygon points="64,66 59,78 69,78" fill="#000000"/>
        <line x1="56" y1="94" x2="56" y2="104" stroke="#000000" stroke-width="5"/>
        <line x1="72" y1="94" x2="72" y2="104" stroke="#000000" stroke-width="5"/>
      </svg>
    `),
    width: 128,
    height: 128,
  },
  {
    id: 'stamp_default_flower',
    name: 'Retro Daisy',
    dataUrl: svgToDataUrl(`
      <svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128">
        <circle cx="64" cy="28" r="18" fill="#FFFFFF" stroke="#000000" stroke-width="6"/>
        <circle cx="98" cy="52" r="18" fill="#FFFFFF" stroke="#000000" stroke-width="6"/>
        <circle cx="86" cy="94" r="18" fill="#FFFFFF" stroke="#000000" stroke-width="6"/>
        <circle cx="42" cy="94" r="18" fill="#FFFFFF" stroke="#000000" stroke-width="6"/>
        <circle cx="30" cy="52" r="18" fill="#FFFFFF" stroke="#000000" stroke-width="6"/>
        <circle cx="64" cy="64" r="20" fill="#FFE600" stroke="#000000" stroke-width="6"/>
      </svg>
    `),
    width: 128,
    height: 128,
  },
  {
    id: 'stamp_default_eye',
    name: 'Mystic Eye',
    dataUrl: svgToDataUrl(`
      <svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128">
        <path d="M12 64 C32 28 96 28 116 64 C96 100 32 100 12 64 Z" 
              fill="#FFFFFF" stroke="#000000" stroke-width="7" stroke-linejoin="round"/>
        <circle cx="64" cy="64" r="22" fill="#A855F7" stroke="#000000" stroke-width="6"/>
        <circle cx="64" cy="64" r="10" fill="#000000"/>
        <circle cx="68" cy="60" r="4" fill="#FFFFFF"/>
      </svg>
    `),
    width: 128,
    height: 128,
  },
  {
    id: 'stamp_default_burst',
    name: 'Action Splat',
    dataUrl: svgToDataUrl(`
      <svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128">
        <path d="M64 10 L78 36 L108 24 L102 54 L124 74 L98 88 L104 118 L76 106 L58 122 L48 96 L20 102 L30 76 L8 58 L34 46 L30 18 L56 30 Z" 
              fill="#FFE600" stroke="#000000" stroke-width="6" stroke-linejoin="round"/>
        <circle cx="64" cy="64" r="16" fill="#000000"/>
      </svg>
    `),
    width: 128,
    height: 128,
  },
  {
    id: 'stamp_default_sparkle',
    name: '4-Pt Sparkle',
    dataUrl: svgToDataUrl(`
      <svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128">
        <path d="M64 8 Q64 64 8 64 Q64 64 64 120 Q64 64 120 64 Q64 64 64 8 Z" 
              fill="#00E5F0" stroke="#000000" stroke-width="7" stroke-linejoin="round"/>
      </svg>
    `),
    width: 128,
    height: 128,
  },
];
