// Price Calculator - Core calculation logic for product pricing

export interface AdditionalCostItem {
  id: string;
  label: string;
  amount: number;
}

export type ProfitMode = 'percentage' | 'flat' | 'total';

export interface PriceCalculationInputs {
  productCost: number;
  quantity: number;
  additionalCosts: AdditionalCostItem[];
  profitMode: ProfitMode;
  profitValue: number;
}

export interface PriceCalculationResult {
  baseCost: number;              // productCost × quantity
  totalAdditionalCosts: number;  // sum of all additional costs
  totalCost: number;             // baseCost + totalAdditionalCosts
  costPerPiece: number;          // totalCost ÷ quantity
  profitPerPiece: number;        // calculated based on mode
  totalProfit: number;           // profitPerPiece × quantity
  sellingPrice: number;          // costPerPiece + profitPerPiece
  profitMarginPercentage: number; // (profitPerPiece / costPerPiece) × 100
}

/**
 * Calculate pricing based on costs and profit mode
 */
export function calculatePricing(inputs: PriceCalculationInputs): PriceCalculationResult {
  const { productCost, quantity, additionalCosts, profitMode, profitValue } = inputs;

  // 1. Base Cost = productCost × quantity
  const baseCost = productCost * quantity;

  // 2. Total Additional Costs = sum of all additional costs
  const totalAdditionalCosts = additionalCosts.reduce((sum, item) => sum + item.amount, 0);

  // 3. Total Cost = baseCost + totalAdditionalCosts
  const totalCost = baseCost + totalAdditionalCosts;

  // 4. Cost Per Piece = totalCost ÷ quantity
  const costPerPiece = totalCost / quantity;

  // 5. Calculate Profit Per Piece based on mode
  let profitPerPiece = 0;

  switch (profitMode) {
    case 'percentage':
      // Percentage mode: costPerPiece × (profitValue / 100)
      profitPerPiece = costPerPiece * (profitValue / 100);
      break;

    case 'flat':
      // Flat amount mode: profitValue per piece
      profitPerPiece = profitValue;
      break;

    case 'total':
      // Total profit mode: profitValue ÷ quantity
      profitPerPiece = profitValue / quantity;
      break;
  }

  // 6. Selling Price = costPerPiece + profitPerPiece
  const sellingPrice = costPerPiece + profitPerPiece;

  // 7. Total Profit = profitPerPiece × quantity
  const totalProfit = profitPerPiece * quantity;

  // 8. Profit Margin Percentage = (profitPerPiece / costPerPiece) × 100
  const profitMarginPercentage = costPerPiece > 0 ? (profitPerPiece / costPerPiece) * 100 : 0;

  return {
    baseCost,
    totalAdditionalCosts,
    totalCost,
    costPerPiece,
    profitPerPiece,
    totalProfit,
    sellingPrice,
    profitMarginPercentage,
  };
}

/**
 * Validate calculation inputs and return array of error messages
 */
export function validateCalculationInputs(inputs: Partial<PriceCalculationInputs>): string[] {
  const errors: string[] = [];

  // Product cost validation
  if (!inputs.productCost || inputs.productCost <= 0) {
    errors.push('Product cost must be greater than 0');
  }

  // Quantity validation
  if (!inputs.quantity || inputs.quantity <= 0) {
    errors.push('Quantity must be at least 1');
  }

  // Additional costs validation
  if (inputs.additionalCosts) {
    inputs.additionalCosts.forEach((item, index) => {
      if (!item.label || item.label.trim() === '') {
        errors.push(`Additional cost item ${index + 1} must have a label`);
      }
      if (item.amount < 0) {
        errors.push(`Additional cost item "${item.label}" cannot be negative`);
      }
    });
  }

  // Profit value validation
  if (inputs.profitValue !== undefined && inputs.profitValue < 0) {
    errors.push('Profit value cannot be negative');
  }

  return errors;
}

/**
 * Check if inputs are valid for calculation
 */
export function isValidForCalculation(inputs: Partial<PriceCalculationInputs>): boolean {
  return validateCalculationInputs(inputs).length === 0;
}

/**
 * Format currency for display
 */
export function formatCurrency(value: number): string {
  return `₹${value.toFixed(2)}`;
}

/**
 * Format percentage for display
 */
export function formatPercentage(value: number): string {
  return `${value.toFixed(1)}%`;
}

/**
 * Format number with thousands separator
 */
export function formatNumber(value: number, decimals: number = 2): string {
  return value.toLocaleString('en-IN', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}
