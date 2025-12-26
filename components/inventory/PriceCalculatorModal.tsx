'use client';

import React, { useState, useMemo, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Plus, Trash2, FileDown } from 'lucide-react';
import {
  calculatePricing,
  validateCalculationInputs,
  formatCurrency,
  formatPercentage,
  formatNumber,
  type AdditionalCostItem,
  type ProfitMode,
  type PriceCalculationInputs,
} from '@/lib/price-calculator';
import { generatePriceCalculationPDF } from '@/lib/pdf-generator';

interface PriceCalculatorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPriceCalculated: (data: {
    sellingPrice: number;
    actualPrice: number;
    quantity: number;
  }) => void;
  initialProductCost?: number;
  initialQuantity?: number;
}

export function PriceCalculatorModal({
  isOpen,
  onClose,
  onPriceCalculated,
  initialProductCost,
  initialQuantity,
}: PriceCalculatorModalProps) {
  // Core input states
  const [productCost, setProductCost] = useState<string>('');
  const [quantity, setQuantity] = useState<string>('');
  const [additionalCosts, setAdditionalCosts] = useState<AdditionalCostItem[]>([]);

  // Profit mode states
  const [profitMode, setProfitMode] = useState<ProfitMode>('percentage');
  const [profitPercentage, setProfitPercentage] = useState<string>('');
  const [profitFlat, setProfitFlat] = useState<string>('');
  const [profitTotal, setProfitTotal] = useState<string>('');

  // Error state
  const [errors, setErrors] = useState<string[]>([]);

  // Initialize with values from parent form
  useEffect(() => {
    if (isOpen) {
      setProductCost(initialProductCost?.toString() || '');
      setQuantity(initialQuantity?.toString() || '');
    }
  }, [isOpen, initialProductCost, initialQuantity]);

  // Get current profit value based on mode
  const currentProfitValue = useMemo(() => {
    switch (profitMode) {
      case 'percentage':
        return parseFloat(profitPercentage) || 0;
      case 'flat':
        return parseFloat(profitFlat) || 0;
      case 'total':
        return parseFloat(profitTotal) || 0;
      default:
        return 0;
    }
  }, [profitMode, profitPercentage, profitFlat, profitTotal]);

  // Calculate pricing in real-time
  const calculationResult = useMemo(() => {
    const cost = parseFloat(productCost) || 0;
    const qty = parseInt(quantity) || 0;

    if (cost <= 0 || qty <= 0) {
      return null;
    }

    const inputs: PriceCalculationInputs = {
      productCost: cost,
      quantity: qty,
      additionalCosts,
      profitMode,
      profitValue: currentProfitValue,
    };

    return calculatePricing(inputs);
  }, [productCost, quantity, additionalCosts, profitMode, currentProfitValue]);

  // Validation
  const isValid = useMemo(() => {
    const cost = parseFloat(productCost) || 0;
    const qty = parseInt(quantity) || 0;

    const inputs: Partial<PriceCalculationInputs> = {
      productCost: cost,
      quantity: qty,
      additionalCosts,
      profitValue: currentProfitValue,
    };

    const validationErrors = validateCalculationInputs(inputs);
    setErrors(validationErrors);
    return validationErrors.length === 0;
  }, [productCost, quantity, additionalCosts, currentProfitValue]);

  // Add new cost item
  const handleAddCost = () => {
    const newCost: AdditionalCostItem = {
      id: crypto.randomUUID(),
      label: '',
      amount: 0,
    };
    setAdditionalCosts([...additionalCosts, newCost]);
  };

  // Remove cost item
  const handleRemoveCost = (id: string) => {
    setAdditionalCosts(additionalCosts.filter((cost) => cost.id !== id));
  };

  // Update cost item
  const handleUpdateCost = (id: string, field: 'label' | 'amount', value: string) => {
    setAdditionalCosts(
      additionalCosts.map((cost) =>
        cost.id === id
          ? { ...cost, [field]: field === 'amount' ? parseFloat(value) || 0 : value }
          : cost
      )
    );
  };

  // Handle save and auto-fill
  const handleSavePrice = () => {
    if (!isValid || !calculationResult) {
      return;
    }

    const qty = parseInt(quantity) || 0;

    onPriceCalculated({
      sellingPrice: calculationResult.sellingPrice,
      actualPrice: calculationResult.costPerPiece,
      quantity: qty,
    });
  };

  // Handle PDF generation
  const handleGeneratePDF = async () => {
    if (!calculationResult) {
      alert('Please enter valid calculation inputs first');
      return;
    }

    try {
      const cost = parseFloat(productCost) || 0;
      const qty = parseInt(quantity) || 0;

      const inputs: PriceCalculationInputs = {
        productCost: cost,
        quantity: qty,
        additionalCosts,
        profitMode,
        profitValue: currentProfitValue,
      };

      await generatePriceCalculationPDF(calculationResult, inputs);
    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('Failed to generate PDF. Please try again.');
    }
  };

  // Reset calculator
  const handleClose = () => {
    setProductCost('');
    setQuantity('');
    setAdditionalCosts([]);
    setProfitPercentage('');
    setProfitFlat('');
    setProfitTotal('');
    setProfitMode('percentage');
    setErrors([]);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto bg-white dark:bg-slate-900">
        <DialogHeader>
          <DialogTitle className="text-2xl">Price Calculator</DialogTitle>
          <DialogDescription>
            Calculate optimal selling price based on costs and desired profit margin
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 py-4">
          {/* Left Column - Cost Breakdown */}
          <div className="space-y-4">
            {/* Base Cost Inputs */}
            <Card className="rounded-2xl border-slate-200/80">
              <CardHeader className="p-4 pb-3">
                <CardTitle className="text-lg">Base Cost</CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-0 space-y-3">
                <div>
                  <Label htmlFor="productCost" className="text-sm font-medium mb-1 block">
                    Product Cost (₹)
                  </Label>
                  <Input
                    id="productCost"
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    value={productCost}
                    onChange={(e) => setProductCost(e.target.value)}
                    className="h-10"
                  />
                </div>
                <div>
                  <Label htmlFor="quantity" className="text-sm font-medium mb-1 block">
                    Quantity
                  </Label>
                  <Input
                    id="quantity"
                    type="number"
                    min="1"
                    placeholder="0"
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    className="h-10"
                  />
                </div>
              </CardContent>
            </Card>

            {/* Additional Costs */}
            <Card className="rounded-2xl border-slate-200/80">
              <CardHeader className="p-4 pb-3">
                <CardTitle className="text-lg">Additional Costs</CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-0 space-y-3">
                {additionalCosts.map((cost) => (
                  <div key={cost.id} className="flex gap-2">
                    <Input
                      type="text"
                      placeholder="Label (e.g., Travel)"
                      value={cost.label}
                      onChange={(e) => handleUpdateCost(cost.id, 'label', e.target.value)}
                      className="flex-1 h-9 text-sm"
                    />
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="0.00"
                      value={cost.amount || ''}
                      onChange={(e) => handleUpdateCost(cost.id, 'amount', e.target.value)}
                      className="w-28 h-9 text-sm"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemoveCost(cost.id)}
                      className="h-9 w-9 p-0"
                    >
                      <Trash2 className="h-4 w-4 text-red-600" />
                    </Button>
                  </div>
                ))}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleAddCost}
                  className="w-full h-9"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Cost Item
                </Button>
              </CardContent>
            </Card>

            {/* Cost Summary */}
            <Card className="rounded-2xl border-emerald-200 bg-emerald-50/50 dark:bg-emerald-900/10">
              <CardHeader className="p-4 pb-3">
                <CardTitle className="text-lg text-emerald-900 dark:text-emerald-100">
                  Cost Summary
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-0 space-y-2">
                {calculationResult ? (
                  <>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-600 dark:text-slate-400">Base Cost</span>
                      <span className="font-semibold text-slate-900 dark:text-slate-100">
                        {formatCurrency(calculationResult.baseCost)}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-600 dark:text-slate-400">Additional Costs</span>
                      <span className="font-semibold text-slate-900 dark:text-slate-100">
                        {formatCurrency(calculationResult.totalAdditionalCosts)}
                      </span>
                    </div>
                    <div className="border-t border-emerald-200 dark:border-emerald-700 my-2" />
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-600 dark:text-slate-400">Total Cost</span>
                      <span className="font-bold text-slate-900 dark:text-slate-100">
                        {formatCurrency(calculationResult.totalCost)}
                      </span>
                    </div>
                    <div className="flex justify-between text-base mt-3 p-2 bg-emerald-100 dark:bg-emerald-900/30 rounded-lg">
                      <span className="font-semibold text-emerald-900 dark:text-emerald-100">
                        Cost Per Piece
                      </span>
                      <span className="font-bold text-emerald-900 dark:text-emerald-100">
                        {formatCurrency(calculationResult.costPerPiece)}
                      </span>
                    </div>
                  </>
                ) : (
                  <p className="text-sm text-slate-500 dark:text-slate-400 text-center py-4">
                    Enter product cost and quantity to see summary
                  </p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Right Column - Profit Calculator */}
          <div className="space-y-4">
            <Card className="rounded-2xl border-slate-200/80">
              <CardHeader className="p-4 pb-3">
                <CardTitle className="text-lg">Profit Calculation</CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-0 space-y-4">
                <RadioGroup value={profitMode} onValueChange={(v) => setProfitMode(v as ProfitMode)}>
                  <div className="space-y-3">
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="percentage" id="percentage" />
                      <Label htmlFor="percentage" className="font-normal cursor-pointer">
                        Percentage Profit
                      </Label>
                    </div>
                    {profitMode === 'percentage' && (
                      <div className="ml-6">
                        <div className="flex items-center gap-2">
                          <Input
                            type="number"
                            step="0.1"
                            min="0"
                            placeholder="15"
                            value={profitPercentage}
                            onChange={(e) => setProfitPercentage(e.target.value)}
                            className="h-9 w-24"
                          />
                          <span className="text-sm text-slate-600">%</span>
                        </div>
                      </div>
                    )}

                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="flat" id="flat" />
                      <Label htmlFor="flat" className="font-normal cursor-pointer">
                        Flat Amount Per Piece
                      </Label>
                    </div>
                    {profitMode === 'flat' && (
                      <div className="ml-6">
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-slate-600">₹</span>
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            placeholder="20.00"
                            value={profitFlat}
                            onChange={(e) => setProfitFlat(e.target.value)}
                            className="h-9 w-28"
                          />
                        </div>
                      </div>
                    )}

                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="total" id="total" />
                      <Label htmlFor="total" className="font-normal cursor-pointer">
                        Total Profit Needed
                      </Label>
                    </div>
                    {profitMode === 'total' && (
                      <div className="ml-6">
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-slate-600">₹</span>
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            placeholder="2000.00"
                            value={profitTotal}
                            onChange={(e) => setProfitTotal(e.target.value)}
                            className="h-9 w-32"
                          />
                          <span className="text-xs text-slate-500">(total)</span>
                        </div>
                      </div>
                    )}
                  </div>
                </RadioGroup>

                {/* Selling Price Display */}
                {calculationResult && (
                  <div className="mt-6 p-4 bg-gradient-to-br from-emerald-50 to-emerald-100 dark:from-emerald-900/20 dark:to-emerald-800/20 rounded-xl border-2 border-emerald-300 dark:border-emerald-700">
                    <div className="text-center">
                      <p className="text-sm font-medium text-emerald-900 dark:text-emerald-100 mb-1">
                        Selling Price Per Piece
                      </p>
                      <p className="text-4xl font-bold text-emerald-700 dark:text-emerald-400">
                        {formatCurrency(calculationResult.sellingPrice)}
                      </p>
                    </div>

                    <div className="mt-4 pt-4 border-t border-emerald-300 dark:border-emerald-700 space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-emerald-800 dark:text-emerald-200">
                          Profit Per Piece
                        </span>
                        <span className="font-semibold text-emerald-900 dark:text-emerald-100">
                          {formatCurrency(calculationResult.profitPerPiece)}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-emerald-800 dark:text-emerald-200">Total Profit</span>
                        <span className="font-semibold text-emerald-900 dark:text-emerald-100">
                          {formatCurrency(calculationResult.totalProfit)}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-emerald-800 dark:text-emerald-200">
                          Profit Margin
                        </span>
                        <span className="font-semibold text-emerald-900 dark:text-emerald-100">
                          {formatPercentage(calculationResult.profitMarginPercentage)}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-emerald-800 dark:text-emerald-200">
                          Total Revenue ({quantity} units)
                        </span>
                        <span className="font-semibold text-emerald-900 dark:text-emerald-100">
                          {formatCurrency(
                            calculationResult.sellingPrice * (parseInt(quantity) || 0)
                          )}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Error Display */}
        {errors.length > 0 && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-3">
            <p className="text-sm font-medium text-red-900 dark:text-red-100 mb-1">
              Please fix the following:
            </p>
            <ul className="list-disc list-inside text-sm text-red-700 dark:text-red-300 space-y-1">
              {errors.map((error, index) => (
                <li key={index}>{error}</li>
              ))}
            </ul>
          </div>
        )}

        <DialogFooter className="flex-row gap-2 sm:gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={handleGeneratePDF}
            disabled={!isValid || !calculationResult}
            className="flex-1 sm:flex-none"
          >
            <FileDown className="h-4 w-4 mr-2" />
            Generate PDF
          </Button>
          <div className="flex-1" />
          <Button type="button" variant="ghost" onClick={handleClose} className="flex-1 sm:flex-none">
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleSavePrice}
            disabled={!isValid || !calculationResult}
            className="flex-1 sm:flex-none bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            Use This Price
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
