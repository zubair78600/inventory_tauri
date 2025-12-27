import { PanelSizeClass } from './ResponsivePanel';

// Font and spacing configurations for each size class
export const adaptiveStyles = {
  xs: {
    // Typography
    titleSize: 'text-sm',
    labelSize: 'text-[8px]',
    textSize: 'text-[9px]',
    subtextSize: 'text-[8px]',

    // Inputs & Buttons
    inputPadding: 'py-0.5 px-1.5',
    inputText: 'text-[9px]',
    buttonPadding: 'py-1 px-2',
    buttonText: 'text-[9px]',

    // Spacing
    gap: 'gap-1',
    cardPadding: 'p-2',

    // Product Grid
    showProductImage: false,
    showProductSku: false,
    productCardHeight: 'h-[45px]',
    productNameSize: 'text-[8px]',
    productPriceSize: 'text-[7px]',
    minGridColumns: 1,
    maxGridColumns: 2,

    // Cart
    cartItemPadding: 'py-0.5 px-1',
    cartMaxHeight: 'max-h-20',
  },
  sm: {
    // Typography
    titleSize: 'text-base',
    labelSize: 'text-[9px]',
    textSize: 'text-[10px]',
    subtextSize: 'text-[9px]',

    // Inputs & Buttons
    inputPadding: 'py-1 px-2',
    inputText: 'text-[10px]',
    buttonPadding: 'py-1.5 px-3',
    buttonText: 'text-[10px]',

    // Spacing
    gap: 'gap-1.5',
    cardPadding: 'p-2.5',

    // Product Grid
    showProductImage: false,
    showProductSku: false,
    productCardHeight: 'h-[55px]',
    productNameSize: 'text-[9px]',
    productPriceSize: 'text-[8px]',
    minGridColumns: 1,
    maxGridColumns: 3,

    // Cart
    cartItemPadding: 'py-1 px-2',
    cartMaxHeight: 'max-h-28',
  },
  md: {
    // Typography
    titleSize: 'text-lg',
    labelSize: 'text-[10px]',
    textSize: 'text-xs',
    subtextSize: 'text-[10px]',

    // Inputs & Buttons
    inputPadding: 'py-1.5 px-2.5',
    inputText: 'text-xs',
    buttonPadding: 'py-2 px-4',
    buttonText: 'text-sm',

    // Spacing
    gap: 'gap-2',
    cardPadding: 'p-3',

    // Product Grid
    showProductImage: true,
    showProductSku: false,
    productCardHeight: 'h-[70px]',
    productNameSize: 'text-[10px]',
    productPriceSize: 'text-[9px]',
    minGridColumns: 2,
    maxGridColumns: 4,

    // Cart
    cartItemPadding: 'py-1.5 px-2.5',
    cartMaxHeight: 'max-h-36',
  },
  lg: {
    // Typography
    titleSize: 'text-xl',
    labelSize: 'text-xs',
    textSize: 'text-sm',
    subtextSize: 'text-xs',

    // Inputs & Buttons
    inputPadding: 'py-2 px-3',
    inputText: 'text-sm',
    buttonPadding: 'py-2.5 px-5',
    buttonText: 'text-base',

    // Spacing
    gap: 'gap-3',
    cardPadding: 'p-4',

    // Product Grid
    showProductImage: true,
    showProductSku: true,
    productCardHeight: 'h-[80px]',
    productNameSize: 'text-[11px]',
    productPriceSize: 'text-[10px]',
    minGridColumns: 2,
    maxGridColumns: 6,

    // Cart
    cartItemPadding: 'py-2 px-3',
    cartMaxHeight: 'max-h-44',
  },
} as const;

export type AdaptiveStyleConfig = typeof adaptiveStyles[PanelSizeClass];

export function getAdaptiveStyles(sizeClass: PanelSizeClass): AdaptiveStyleConfig {
  return adaptiveStyles[sizeClass];
}

// Calculate optimal grid columns based on panel width
export function calculateGridColumns(width: number, sizeClass: PanelSizeClass): number {
  const config = adaptiveStyles[sizeClass];

  // Card minimum widths per size class
  const minCardWidth = {
    xs: 70,
    sm: 90,
    md: 110,
    lg: 130,
  }[sizeClass];

  const cols = Math.floor(width / minCardWidth);
  return Math.max(config.minGridColumns, Math.min(cols, config.maxGridColumns));
}
