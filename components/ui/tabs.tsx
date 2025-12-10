"use client";

import * as React from "react";

interface TabsProps {
    defaultValue?: string;
    value?: string;
    onValueChange?: (value: string) => void;
    children: React.ReactNode;
    className?: string;
}

interface TabsListProps {
    children: React.ReactNode;
    className?: string;
}

interface TabsTriggerProps {
    value: string;
    children: React.ReactNode;
    className?: string;
}

interface TabsContentProps {
    value: string;
    children: React.ReactNode;
    className?: string;
}

const TabsContext = React.createContext<{
    value: string;
    onValueChange: (value: string) => void;
}>({ value: "", onValueChange: () => { } });

export function Tabs({ defaultValue = "", value, onValueChange, children, className }: TabsProps) {
    const [internalValue, setInternalValue] = React.useState(defaultValue);
    const activeValue = value ?? internalValue;
    const handleChange = onValueChange ?? setInternalValue;

    return (
        <TabsContext.Provider value={{ value: activeValue, onValueChange: handleChange }}>
            <div className={className}>{children}</div>
        </TabsContext.Provider>
    );
}

export function TabsList({ children, className }: TabsListProps) {
    return (
        <div className={`inline-flex h-9 items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-800 p-1 text-slate-500 dark:text-slate-400 ${className || ""}`}>
            {children}
        </div>
    );
}

export function TabsTrigger({ value, children, className }: TabsTriggerProps) {
    const { value: activeValue, onValueChange } = React.useContext(TabsContext);
    const isActive = value === activeValue;

    return (
        <button
            className={`inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 ${isActive
                    ? "bg-white dark:bg-slate-950 text-slate-950 dark:text-slate-50 shadow"
                    : "hover:bg-slate-200 dark:hover:bg-slate-700"
                } ${className || ""}`}
            onClick={() => onValueChange(value)}
        >
            {children}
        </button>
    );
}

export function TabsContent({ value, children, className }: TabsContentProps) {
    const { value: activeValue } = React.useContext(TabsContext);

    if (value !== activeValue) return null;

    return (
        <div className={`mt-2 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${className || ""}`}>
            {children}
        </div>
    );
}
