'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { migrationCommands } from '@/lib/tauri';
import type { MigrationResult, MigrationStatus, ValidationResult } from '@/lib/tauri';
import { AlertCircle, CheckCircle, Info, Loader2 } from 'lucide-react';

export default function MigrationPage() {
  const [status, setStatus] = useState<MigrationStatus | null>(null);
  const [migrationResult, setMigrationResult] = useState<MigrationResult | null>(null);
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);
  const [loading, setLoading] = useState<boolean>(false);

  const checkStatus = async () => {
    setLoading(true);
    try {
      const statusData = await migrationCommands.checkMigrationStatus();
      setStatus(statusData);
    } catch (error) {
      console.error('Error checking migration status:', error);
      alert(`Failed to check migration status: ${error}`);
    } finally {
      setLoading(false);
    }
  };

  const runMigration = async () => {
    if (!confirm('This will create Purchase Orders and inventory batches for all existing products with stock. Continue?')) {
      return;
    }

    setLoading(true);
    try {
      const result = await migrationCommands.migrateExistingProducts();
      setMigrationResult(result);
      await checkStatus(); // Refresh status
      alert(`Migration completed! ${result.products_migrated} products migrated.`);
    } catch (error) {
      console.error('Error running migration:', error);
      alert(`Migration failed: ${error}`);
    } finally {
      setLoading(false);
    }
  };

  const validateData = async () => {
    setLoading(true);
    try {
      const result = await migrationCommands.validateMigration();
      setValidationResult(result);
    } catch (error) {
      console.error('Error validating data:', error);
      alert(`Validation failed: ${error}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-5">
      <h1 className="page-title">Data Migration</h1>

      <Card className="p-5 bg-blue-50 border-blue-200">
        <div className="flex gap-3">
          <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="font-semibold text-blue-900">About Data Migration</h3>
            <p className="text-sm text-blue-800 mt-1">
              This tool migrates existing products with stock to the new Purchase Order and FIFO inventory system.
              It creates migration Purchase Orders and inventory batches for products that don't have them yet.
            </p>
          </div>
        </div>
      </Card>

      {/* Migration Status */}
      <Card className="p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Migration Status</h2>
          <Button onClick={checkStatus} disabled={loading} variant="outline">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Check Status'}
          </Button>
        </div>

        {status && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <div className="p-3 bg-gray-50 rounded-md">
                <p className="text-sm text-gray-600">Total Products</p>
                <p className="text-2xl font-bold">{status.total_products}</p>
              </div>
              <div className="p-3 bg-green-50 rounded-md">
                <p className="text-sm text-gray-600">Already Migrated</p>
                <p className="text-2xl font-bold text-green-600">{status.products_with_batches}</p>
              </div>
              <div className="p-3 bg-orange-50 rounded-md">
                <p className="text-sm text-gray-600">Need Migration</p>
                <p className="text-2xl font-bold text-orange-600">{status.products_needing_migration}</p>
              </div>
            </div>

            {status.migration_required ? (
              <div className="flex items-center gap-2 p-3 bg-orange-50 border border-orange-200 rounded-md">
                <AlertCircle className="w-5 h-5 text-orange-600" />
                <p className="text-sm text-orange-800">
                  {status.products_needing_migration} product(s) need to be migrated to the new system.
                </p>
              </div>
            ) : (
              <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-md">
                <CheckCircle className="w-5 h-5 text-green-600" />
                <p className="text-sm text-green-800">All products are migrated!</p>
              </div>
            )}

            {status.migration_supplier_exists && (
              <p className="text-sm text-gray-600">
                ℹ️ Migration supplier exists in the system
              </p>
            )}
          </div>
        )}
      </Card>

      {/* Run Migration */}
      {status && status.migration_required && (
        <Card className="p-5">
          <h2 className="text-lg font-semibold mb-3">Run Migration</h2>
          <p className="text-sm text-gray-600 mb-4">
            This will create Purchase Orders with the format "PO-MIGRATED-XXXXXX" for each product with stock.
            A "Data Migration" supplier will be created for products without suppliers.
          </p>
          <Button onClick={runMigration} disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Migrating...
              </>
            ) : (
              `Migrate ${status.products_needing_migration} Product(s)`
            )}
          </Button>
        </Card>
      )}

      {/* Migration Results */}
      {migrationResult && (
        <Card className="p-5">
          <h2 className="text-lg font-semibold mb-3">Migration Results</h2>
          <div className="space-y-3">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="p-3 bg-green-50 rounded-md">
                <p className="text-xs text-gray-600">Products Migrated</p>
                <p className="text-xl font-bold text-green-600">{migrationResult.products_migrated}</p>
              </div>
              <div className="p-3 bg-blue-50 rounded-md">
                <p className="text-xs text-gray-600">POs Created</p>
                <p className="text-xl font-bold text-blue-600">{migrationResult.purchase_orders_created}</p>
              </div>
              <div className="p-3 bg-purple-50 rounded-md">
                <p className="text-xs text-gray-600">Batches Created</p>
                <p className="text-xl font-bold text-purple-600">{migrationResult.batches_created}</p>
              </div>
              <div className="p-3 bg-indigo-50 rounded-md">
                <p className="text-xs text-gray-600">Transactions</p>
                <p className="text-xl font-bold text-indigo-600">{migrationResult.transactions_created}</p>
              </div>
            </div>

            {migrationResult.errors.length > 0 && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-md">
                <p className="font-semibold text-red-900 mb-2">Errors:</p>
                <ul className="text-sm text-red-800 space-y-1">
                  {migrationResult.errors.map((error, idx) => (
                    <li key={idx}>• {error}</li>
                  ))}
                </ul>
              </div>
            )}

            {migrationResult.details.length > 0 && (
              <div className="p-3 bg-gray-50 rounded-md max-h-60 overflow-y-auto">
                <p className="font-semibold text-gray-900 mb-2">Details:</p>
                <ul className="text-xs text-gray-700 space-y-1 font-mono">
                  {migrationResult.details.map((detail, idx) => (
                    <li key={idx}>{detail}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </Card>
      )}

      {/* Data Validation */}
      <Card className="p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Data Validation</h2>
          <Button onClick={validateData} disabled={loading} variant="outline">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Validate Data'}
          </Button>
        </div>

        <p className="text-sm text-gray-600 mb-3">
          Checks if product stock quantities match the sum of inventory batch quantities.
        </p>

        {validationResult && (
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-3">
              <div className="p-3 bg-gray-50 rounded-md">
                <p className="text-sm text-gray-600">Total Checked</p>
                <p className="text-2xl font-bold">{validationResult.total_products_checked}</p>
              </div>
              <div className="p-3 bg-green-50 rounded-md">
                <p className="text-sm text-gray-600">Consistent</p>
                <p className="text-2xl font-bold text-green-600">{validationResult.consistent_products}</p>
              </div>
              <div className="p-3 bg-red-50 rounded-md">
                <p className="text-sm text-gray-600">Inconsistent</p>
                <p className="text-2xl font-bold text-red-600">
                  {validationResult.inconsistent_products.length}
                </p>
              </div>
            </div>

            {validationResult.inconsistent_products.length > 0 ? (
              <div className="p-3 bg-red-50 border border-red-200 rounded-md">
                <p className="font-semibold text-red-900 mb-2">Inconsistent Products:</p>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-red-200">
                        <th className="text-left py-2">Product</th>
                        <th className="text-center py-2">SKU</th>
                        <th className="text-center py-2">Stock Qty</th>
                        <th className="text-center py-2">Batch Total</th>
                        <th className="text-center py-2">Difference</th>
                      </tr>
                    </thead>
                    <tbody>
                      {validationResult.inconsistent_products.map((product) => (
                        <tr key={product.id} className="border-b border-red-100">
                          <td className="py-2">{product.name}</td>
                          <td className="text-center">{product.sku}</td>
                          <td className="text-center">{product.stock_quantity}</td>
                          <td className="text-center">{product.batch_total}</td>
                          <td className="text-center font-semibold text-red-600">
                            {product.difference > 0 ? '+' : ''}
                            {product.difference}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-md">
                <CheckCircle className="w-5 h-5 text-green-600" />
                <p className="text-sm text-green-800">All data is consistent! ✓</p>
              </div>
            )}
          </div>
        )}
      </Card>
    </div>
  );
}
