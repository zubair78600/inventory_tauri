'use client';

import { useMemo } from 'react';
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    PieChart,
    Pie,
    Cell,
    LineChart,
    Line,
} from 'recharts';

interface ResultChartProps {
    data: Record<string, unknown>[];
    isCompact?: boolean;
}

const COLORS = ['#6366f1', '#8b5cf6', '#a855f7', '#d946ef', '#ec4899', '#f43f5e', '#f97316', '#eab308'];

// Determine if a value is numeric
const isNumeric = (value: unknown): boolean => {
    if (typeof value === 'number') return true;
    if (typeof value === 'string') {
        const num = parseFloat(value);
        return !isNaN(num) && isFinite(num);
    }
    return false;
};

// Convert to number
const toNumber = (value: unknown): number => {
    if (typeof value === 'number') return value;
    if (typeof value === 'string') return parseFloat(value) || 0;
    return 0;
};

export default function ResultChart({ data, isCompact = false }: ResultChartProps) {
    const chartConfig = useMemo(() => {
        if (!data || data.length === 0) return null;

        const keys = Object.keys(data[0]);

        // Find numeric and non-numeric columns
        const numericKeys: string[] = [];
        const labelKeys: string[] = [];

        keys.forEach(key => {
            const hasNumericValues = data.some(row => isNumeric(row[key]));
            if (hasNumericValues) {
                numericKeys.push(key);
            } else {
                labelKeys.push(key);
            }
        });

        // Priority metrics to show in charts
        const PRIORITY_METRICS = [
            'TOTAL SPENT', 'TOTAL REVENUE', 'TOTAL AMOUNT', 'REVENUE', 'AMOUNT',
            'STOCK VALUE', 'TOTAL STOCK', 'PENDING AMOUNT', 'PENDING CREDIT',
            'TOTAL INVOICES', 'PRODUCTS BOUGHT', 'TOTAL PRODUCTS',
            'total_spent', 'total_revenue', 'total_amount', 'total_invoices', 'total_items',
            'stock_value', 'total_stock', 'pending_amount'
        ];


        // Sort numericKeys to put priority metrics first
        numericKeys.sort((a, b) => {
            const aIndex = PRIORITY_METRICS.findIndex(m => a.toUpperCase() === m.toUpperCase());
            const bIndex = PRIORITY_METRICS.findIndex(m => b.toUpperCase() === m.toUpperCase());

            if (aIndex !== -1 && bIndex !== -1) return aIndex - bIndex;
            if (aIndex !== -1) return -1;
            if (bIndex !== -1) return 1;

            // Put things that look like phone numbers or IDs at the end
            const aUpper = a.toUpperCase();
            const bUpper = b.toUpperCase();
            const badKeywords = ['ID', 'PHONE', 'CONTACT', 'MOBILE', 'ZIP', 'PIN'];
            const aIsBad = badKeywords.some(k => aUpper.includes(k));
            const bIsBad = badKeywords.some(k => bUpper.includes(k));

            if (aIsBad && !bIsBad) return 1;
            if (!aIsBad && bIsBad) return -1;

            return 0;
        });

        // Determine best chart type based on data structure
        const rowCount = data.length;
        const hasLabels = labelKeys.length > 0;
        const numericCount = numericKeys.length;

        // For single row with numeric values, use a simple bar chart
        if (rowCount === 1 && numericCount > 0) {
            const chartData = numericKeys.map(key => ({
                name: key.replace(/_/g, ' '),
                value: toNumber(data[0][key])
            }));
            return { type: 'bar-horizontal', data: chartData, dataKey: 'value', labelKey: 'name', dataKeyName: 'Value' };
        }

        // For few rows with labels, use pie chart if only one numeric column
        if (rowCount <= 6 && hasLabels && numericCount === 1) {
            const labelKey = labelKeys[0];
            const valueKey = numericKeys[0];
            const chartData = data.map(row => ({
                name: String(row[labelKey] || 'Unknown'),
                value: toNumber(row[valueKey])
            }));
            return { type: 'pie', data: chartData, dataKey: 'value', labelKey: 'name', dataKeyName: valueKey.replace(/_/g, ' ') };
        }

        // For time series or many rows, use bar/line chart
        if (hasLabels && numericCount >= 1) {
            const labelKey = labelKeys[0];
            const valueKey = numericKeys[0];
            const chartData = data.slice(0, 10).map(row => ({
                name: String(row[labelKey] || '').substring(0, 15),
                value: toNumber(row[valueKey])
            }));
            return { type: rowCount > 5 ? 'line' : 'bar', data: chartData, dataKey: 'value', labelKey: 'name', dataKeyName: valueKey.replace(/_/g, ' ') };
        }

        // Default: show first numeric column as bar
        if (numericCount > 0) {
            const valueKey = numericKeys[0];
            const chartData = data.slice(0, 10).map((row, i) => ({
                name: `#${i + 1}`,
                value: toNumber(row[valueKey])
            }));
            return { type: 'bar', data: chartData, dataKey: 'value', labelKey: 'name', dataKeyName: valueKey.replace(/_/g, ' ') };
        }

        return null;
    }, [data]);

    if (!chartConfig) {
        return (
            <div className="h-24 flex items-center justify-center text-xs text-muted-foreground">
                No chartable data available
            </div>
        );
    }

    const height = isCompact ? 160 : 220;

    if (chartConfig.type === 'pie') {
        return (
            <ResponsiveContainer width="100%" height={height} minWidth={0} minHeight={0} debounce={50}>
                <PieChart>
                    <Pie
                        data={chartConfig.data}
                        cx="50%"
                        cy="50%"
                        innerRadius={isCompact ? 25 : 35}
                        outerRadius={isCompact ? 45 : 55}
                        paddingAngle={2}
                        dataKey="value"
                        label={({ name, percent }) => `${name} ${((percent || 0) * 100).toFixed(0)}%`}
                        labelLine={false}
                    >
                        {chartConfig.data.map((_, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                    </Pie>
                    <Tooltip
                        formatter={(value: number) => [value.toLocaleString(), (chartConfig as any).dataKeyName || 'Value']}
                        contentStyle={{
                            fontSize: '10px',
                            borderRadius: '8px',
                            border: 'none',
                            boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
                        }}
                    />
                </PieChart>
            </ResponsiveContainer>
        );
    }

    if (chartConfig.type === 'bar-horizontal') {
        return (
            <ResponsiveContainer width="100%" height={height} minWidth={0} minHeight={0} debounce={50}>
                <BarChart layout="vertical" data={chartConfig.data} margin={{ top: 5, right: 30, left: 40, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" horizontal={false} />
                    <XAxis
                        type="number"
                        tick={{ fontSize: 9 }}
                        axisLine={{ stroke: '#e5e7eb' }}
                        tickFormatter={(value) => value >= 1000 ? `${(value / 1000).toFixed(1)}k` : value}
                    />
                    <YAxis
                        dataKey="name"
                        type="category"
                        tick={{ fontSize: 9 }}
                        width={80}
                        axisLine={{ stroke: '#e5e7eb' }}
                    />
                    <Tooltip
                        formatter={(value: number) => [value.toLocaleString(), (chartConfig as any).dataKeyName || 'Value']}
                        contentStyle={{
                            fontSize: '10px',
                            borderRadius: '8px',
                            border: 'none',
                            boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
                        }}
                    />
                    <Bar
                        dataKey="value"
                        fill="#6366f1"
                        radius={[0, 4, 4, 0]}
                        maxBarSize={30}
                    />
                </BarChart>
            </ResponsiveContainer>
        );
    }

    if (chartConfig.type === 'line') {
        return (
            <ResponsiveContainer width="100%" height={height} minWidth={0} minHeight={0} debounce={50}>
                <LineChart data={chartConfig.data} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis
                        dataKey="name"
                        tick={{ fontSize: 9 }}
                        tickLine={false}
                        axisLine={{ stroke: '#e5e7eb' }}
                    />
                    <YAxis
                        tick={{ fontSize: 9 }}
                        tickLine={false}
                        axisLine={{ stroke: '#e5e7eb' }}
                        width={50}
                        tickFormatter={(value) => value >= 1000 ? `${(value / 1000).toFixed(1)}k` : value}
                    />
                    <Tooltip
                        formatter={(value: number) => [value.toLocaleString(), (chartConfig as any).dataKeyName || 'Value']}
                        contentStyle={{
                            fontSize: '10px',
                            borderRadius: '8px',
                            border: 'none',
                            boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
                        }}
                    />
                    <Line
                        type="monotone"
                        dataKey="value"
                        stroke="#6366f1"
                        strokeWidth={2}
                        dot={{ fill: '#6366f1', strokeWidth: 0, r: 3 }}
                        activeDot={{ r: 5 }}
                    />
                </LineChart>
            </ResponsiveContainer>
        );
    }

    // Default: Bar chart
    return (
        <ResponsiveContainer width="100%" height={height} minWidth={0} minHeight={0} debounce={50}>
            <BarChart data={chartConfig.data} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis
                    dataKey="name"
                    tick={{ fontSize: 9 }}
                    tickLine={false}
                    axisLine={{ stroke: '#e5e7eb' }}
                />
                <YAxis
                    tick={{ fontSize: 9 }}
                    tickLine={false}
                    axisLine={{ stroke: '#e5e7eb' }}
                    width={50}
                    tickFormatter={(value) => value >= 1000 ? `${(value / 1000).toFixed(1)}k` : value}
                />
                <Tooltip
                    formatter={(value: number) => [value.toLocaleString(), (chartConfig as any).dataKeyName || 'Value']}
                    contentStyle={{
                        fontSize: '10px',
                        borderRadius: '8px',
                        border: 'none',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
                    }}
                />
                <Bar
                    dataKey="value"
                    fill="#6366f1"
                    radius={[4, 4, 0, 0]}
                    maxBarSize={50}
                />
            </BarChart>
        </ResponsiveContainer>
    );
}
