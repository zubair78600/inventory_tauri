'use client';

import { Settings2, RotateCcw, Move, X, Check, GripVertical, Maximize2 } from 'lucide-react';
import { useEffect, useRef, useState, ReactNode, useCallback, createContext, useContext } from 'react';
import { settingsCommands } from '@/lib/tauri';

// Panel size context for adaptive content
interface PanelDimensions {
  width: number;
  height: number;
  sizeClass: 'xs' | 'sm' | 'md' | 'lg';
}

const PanelDimensionsContext = createContext<PanelDimensions>({ width: 400, height: 400, sizeClass: 'md' });
export const usePanelDimensions = () => useContext(PanelDimensionsContext);

// Layout Settings Context
interface LayoutSettingsContextType {
  isReorganizing: boolean;
  handleStartReorganize: () => void;
  handleResetLayout: () => void;
}

const LayoutSettingsContext = createContext<LayoutSettingsContextType>({
  isReorganizing: false,
  handleStartReorganize: () => { },
  handleResetLayout: () => { },
});

export const useLayoutSettings = () => useContext(LayoutSettingsContext);

function getSizeClass(width: number, height: number): 'xs' | 'sm' | 'md' | 'lg' {
  const minDim = Math.min(width, height);
  if (minDim < 250) return 'xs';
  if (minDim < 350) return 'sm';
  if (minDim < 500) return 'md';
  return 'lg';
}

// Each panel has its own position and size (in pixels, converted to % for responsiveness)
interface PanelLayout {
  x: number; // percentage from left
  y: number; // percentage from top
  width: number; // percentage width
  height: number; // percentage height
  zIndex: number; // stacking order
}

interface LayoutState {
  currentBill: PanelLayout;
  recentInvoices: PanelLayout;
  products: PanelLayout;
}

// Default layout - 3 panels filling the space with minimal gaps
const DEFAULT_LAYOUT: LayoutState = {
  currentBill: { x: 0, y: 0, width: 48, height: 58, zIndex: 1 },
  recentInvoices: { x: 0, y: 59, width: 48, height: 41, zIndex: 1 },
  products: { x: 49, y: 0, width: 51, height: 100, zIndex: 1 },
};

const MIN_SIZE = 15; // Minimum panel size in %
const MIN_PX = 150; // Minimum panel size in pixels

interface ResizableBillingLayoutProps {
  currentBillPanel: ReactNode;
  recentInvoicesPanel: ReactNode;
  productsPanel: ReactNode;
}

type DragMode = 'move' | 'resize-n' | 'resize-s' | 'resize-e' | 'resize-w' | 'resize-ne' | 'resize-nw' | 'resize-se' | 'resize-sw' | null;

// Adaptive Panel Wrapper - defined outside to prevent re-creation on parent render
// No scaling transform - just provides dimensions context for child components
function AdaptivePanelWrapper({ children }: { children: ReactNode }) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState<PanelDimensions>({ width: 400, height: 400, sizeClass: 'md' });

  useEffect(() => {
    if (!wrapperRef.current) return;

    const updateDimensions = () => {
      if (wrapperRef.current) {
        const { width, height } = wrapperRef.current.getBoundingClientRect();
        const sizeClass = getSizeClass(width, height);
        setDimensions(prev => {
          if (prev.width === width && prev.height === height) return prev;
          return { width, height, sizeClass };
        });
      }
    };

    updateDimensions();
    const observer = new ResizeObserver(() => requestAnimationFrame(updateDimensions));
    observer.observe(wrapperRef.current);
    return () => observer.disconnect();
  }, []);

  return (
    <PanelDimensionsContext.Provider value={dimensions}>
      <div ref={wrapperRef} className="h-full w-full overflow-hidden">
        {children}
      </div>
    </PanelDimensionsContext.Provider>
  );
}

export function ResizableBillingLayout({
  currentBillPanel,
  recentInvoicesPanel,
  productsPanel,
}: ResizableBillingLayoutProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const panelsContainerRef = useRef<HTMLDivElement>(null);

  const [layout, setLayout] = useState<LayoutState>(DEFAULT_LAYOUT);
  const [isLoaded, setIsLoaded] = useState(false);
  const [showSettingsPopup, setShowSettingsPopup] = useState(false);
  const [isReorganizing, setIsReorganizing] = useState(false);
  const [tempLayout, setTempLayout] = useState<LayoutState>(DEFAULT_LAYOUT);

  // Drag state
  const [activePanel, setActivePanel] = useState<keyof LayoutState | null>(null);
  const [dragMode, setDragMode] = useState<DragMode>(null);
  const dragStartRef = useRef({ x: 0, y: 0, panel: null as PanelLayout | null });
  const tempLayoutRef = useRef<LayoutState>(DEFAULT_LAYOUT);

  // Load saved layout
  useEffect(() => {
    const loadLayout = async () => {
      try {
        const settings = await settingsCommands.getAll();
        if (settings.billing_layout_v5) {
          const saved = JSON.parse(settings.billing_layout_v5);
          setLayout(saved);
        }
      } catch (error) {
        console.error('Failed to load layout:', error);
      } finally {
        setIsLoaded(true);
      }
    };
    loadLayout();
  }, []);

  // Save layout
  const saveLayout = useCallback(async (newLayout: LayoutState) => {
    try {
      await settingsCommands.set('billing_layout_v5', JSON.stringify(newLayout));
    } catch (error) {
      console.error('Failed to save layout:', error);
    }
  }, []);

  // Start drag
  const handleDragStart = useCallback((
    panelKey: keyof LayoutState,
    mode: DragMode,
    e: React.MouseEvent
  ) => {
    e.preventDefault();
    e.stopPropagation();

    // Capture the current panel position BEFORE any state updates
    const currentPanelState = { ...tempLayout[panelKey] };

    setActivePanel(panelKey);
    setDragMode(mode);

    // Bring panel to front (only affects zIndex, not position)
    const maxZ = Math.max(tempLayout.currentBill.zIndex, tempLayout.recentInvoices.zIndex, tempLayout.products.zIndex);
    const newLayout = { ...tempLayout };
    newLayout[panelKey] = { ...currentPanelState, zIndex: maxZ + 1 };
    setTempLayout(newLayout);

    // Store the starting mouse position and the panel's position at drag start
    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      panel: currentPanelState // Use position before zIndex update
    };
  }, [tempLayout]);

  // Keep tempLayoutRef in sync
  useEffect(() => {
    tempLayoutRef.current = tempLayout;
  }, [tempLayout]);

  // Handle drag - use refs to avoid stale closures
  useEffect(() => {
    if (!activePanel || !dragMode || !isReorganizing) return;

    const currentPanel = activePanel; // Capture for closure
    const currentMode = dragMode; // Capture for closure

    const handleMouseMove = (e: MouseEvent) => {
      if (!containerRef.current || !dragStartRef.current.panel) return;

      const rect = containerRef.current.getBoundingClientRect();
      const { x: startX, y: startY, panel: startPanel } = dragStartRef.current;

      const deltaXPercent = ((e.clientX - startX) / rect.width) * 100;
      const deltaYPercent = ((e.clientY - startY) / rect.height) * 100;

      const newLayout = { ...tempLayoutRef.current };
      let newPanel = { ...startPanel };

      if (currentMode === 'move') {
        newPanel.x = Math.max(0, Math.min(100 - newPanel.width, startPanel.x + deltaXPercent));
        newPanel.y = Math.max(0, Math.min(100 - newPanel.height, startPanel.y + deltaYPercent));
      } else {
        // Resize operations
        if (currentMode.includes('n')) {
          const newY = startPanel.y + deltaYPercent;
          const newHeight = startPanel.height - deltaYPercent;
          if (newHeight >= MIN_SIZE && newY >= 0) {
            newPanel.y = newY;
            newPanel.height = newHeight;
          }
        }
        if (currentMode.includes('s')) {
          const newHeight = startPanel.height + deltaYPercent;
          if (newHeight >= MIN_SIZE && startPanel.y + newHeight <= 100) {
            newPanel.height = newHeight;
          }
        }
        if (currentMode.includes('w')) {
          const newX = startPanel.x + deltaXPercent;
          const newWidth = startPanel.width - deltaXPercent;
          if (newWidth >= MIN_SIZE && newX >= 0) {
            newPanel.x = newX;
            newPanel.width = newWidth;
          }
        }
        if (currentMode.includes('e')) {
          const newWidth = startPanel.width + deltaXPercent;
          if (newWidth >= MIN_SIZE && startPanel.x + newWidth <= 100) {
            newPanel.width = newWidth;
          }
        }
      }

      newLayout[currentPanel] = newPanel;
      setTempLayout(newLayout);
    };

    const handleMouseUp = () => {
      setActivePanel(null);
      setDragMode(null);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [activePanel, dragMode, isReorganizing]);

  // Actions
  const handleResetLayout = async () => {
    setShowSettingsPopup(false);
    setLayout(DEFAULT_LAYOUT);
    setTempLayout(DEFAULT_LAYOUT);
    await saveLayout(DEFAULT_LAYOUT);
  };

  const handleStartReorganize = () => {
    setShowSettingsPopup(false);
    setTempLayout(layout);
    tempLayoutRef.current = layout;
    setIsReorganizing(true);
  };

  const handleSaveReorganize = async () => {
    setLayout(tempLayout);
    setIsReorganizing(false);
    await saveLayout(tempLayout);
  };

  const handleCancelReorganize = () => {
    setTempLayout(layout);
    setIsReorganizing(false);
  };

  const currentLayout = isReorganizing ? tempLayout : layout;

  // Cursor helper
  const getCursor = () => {
    if (!dragMode) return 'default';
    if (dragMode === 'move') return 'grabbing';
    if (dragMode === 'resize-n' || dragMode === 'resize-s') return 'ns-resize';
    if (dragMode === 'resize-e' || dragMode === 'resize-w') return 'ew-resize';
    if (dragMode === 'resize-nw' || dragMode === 'resize-se') return 'nwse-resize';
    if (dragMode === 'resize-ne' || dragMode === 'resize-sw') return 'nesw-resize';
    return 'default';
  };

  if (!isLoaded) {
    return (
      <div className="h-[calc(100vh-6rem)] flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-2 border-sky-600 border-t-transparent rounded-full" />
      </div>
    );
  }


  // Panel renderer
  const renderPanel = (
    key: keyof LayoutState,
    title: string,
    content: ReactNode,
    panelLayout: PanelLayout
  ) => {
    const isActive = activePanel === key;

    if (!isReorganizing) {
      return (
        <div
          key={key}
          className="absolute overflow-hidden"
          style={{
            left: `${panelLayout.x}%`,
            top: `${panelLayout.y}%`,
            width: `${panelLayout.width}%`,
            height: `${panelLayout.height}%`,
            zIndex: panelLayout.zIndex,
          }}
        >
          <div className="h-full w-full p-2">
            <AdaptivePanelWrapper>
              {content}
            </AdaptivePanelWrapper>
          </div>
        </div>
      );
    }

    // Modern reorganize mode UI
    return (
      <div
        key={key}
        className="absolute overflow-visible"
        style={{
          left: `${panelLayout.x}%`,
          top: `${panelLayout.y}%`,
          width: `${panelLayout.width}%`,
          height: `${panelLayout.height}%`,
          zIndex: isActive ? 100 : panelLayout.zIndex,
        }}
      >
        {/* Panel wrapper with modern glass effect */}
        <div
          className={`h-full w-full rounded-2xl overflow-hidden transition-all duration-200 ${isActive
            ? 'ring-2 ring-sky-500 ring-offset-2 shadow-2xl shadow-sky-500/20'
            : 'ring-1 ring-slate-200/50 shadow-lg hover:shadow-xl'
            }`}
          style={{
            background: isActive
              ? 'linear-gradient(135deg, rgba(240,249,255,0.95) 0%, rgba(224,242,254,0.9) 100%)'
              : 'rgba(255,255,255,0.92)',
            backdropFilter: 'blur(8px)',
          }}
        >
          {/* Modern floating grab handle */}
          <div
            onMouseDown={(e) => handleDragStart(key, 'move', e)}
            className={`absolute top-3 left-3 z-30 flex items-center gap-2 px-3 py-2 rounded-xl cursor-grab active:cursor-grabbing transition-all duration-200 ${isActive
              ? 'bg-sky-500 text-white shadow-lg shadow-sky-500/30'
              : 'bg-slate-800/90 text-white shadow-md hover:bg-slate-700'
              }`}
          >
            <GripVertical className="h-4 w-4" />
            <span className="text-xs font-semibold tracking-wide">{title}</span>
          </div>

          {/* Size indicator badge */}
          <div className="absolute top-3 right-3 z-30 flex items-center gap-1.5 px-2 py-1 bg-slate-900/70 text-white/90 rounded-lg text-[10px] font-medium backdrop-blur-sm">
            <Maximize2 className="h-3 w-3" />
            {Math.round(panelLayout.width)}% × {Math.round(panelLayout.height)}%
          </div>

          {/* Content area - consistent padding with saved state */}
          <div className="h-full w-full p-2 overflow-hidden opacity-60">
            <AdaptivePanelWrapper>
              {content}
            </AdaptivePanelWrapper>
          </div>
        </div>

        {/* Modern edge resize handles - invisible until hover */}
        {/* Top edge */}
        <div
          onMouseDown={(e) => handleDragStart(key, 'resize-n', e)}
          className="absolute -top-1 left-6 right-6 h-2 cursor-ns-resize group"
        >
          <div className={`absolute inset-x-0 top-0.5 h-1 rounded-full transition-all duration-200 ${isActive ? 'bg-sky-400' : 'bg-transparent group-hover:bg-slate-300'
            }`} />
        </div>
        {/* Bottom edge */}
        <div
          onMouseDown={(e) => handleDragStart(key, 'resize-s', e)}
          className="absolute -bottom-1 left-6 right-6 h-2 cursor-ns-resize group"
        >
          <div className={`absolute inset-x-0 bottom-0.5 h-1 rounded-full transition-all duration-200 ${isActive ? 'bg-sky-400' : 'bg-transparent group-hover:bg-slate-300'
            }`} />
        </div>
        {/* Left edge */}
        <div
          onMouseDown={(e) => handleDragStart(key, 'resize-w', e)}
          className="absolute -left-1 top-6 bottom-6 w-2 cursor-ew-resize group"
        >
          <div className={`absolute inset-y-0 left-0.5 w-1 rounded-full transition-all duration-200 ${isActive ? 'bg-sky-400' : 'bg-transparent group-hover:bg-slate-300'
            }`} />
        </div>
        {/* Right edge */}
        <div
          onMouseDown={(e) => handleDragStart(key, 'resize-e', e)}
          className="absolute -right-1 top-6 bottom-6 w-2 cursor-ew-resize group"
        >
          <div className={`absolute inset-y-0 right-0.5 w-1 rounded-full transition-all duration-200 ${isActive ? 'bg-sky-400' : 'bg-transparent group-hover:bg-slate-300'
            }`} />
        </div>

        {/* Modern corner resize handles */}
        <div
          onMouseDown={(e) => handleDragStart(key, 'resize-nw', e)}
          className={`absolute -top-1 -left-1 w-4 h-4 cursor-nwse-resize rounded-tl-xl rounded-br-lg transition-all duration-200 ${isActive ? 'bg-sky-500 shadow-md' : 'bg-slate-400/50 hover:bg-slate-500'
            }`}
        />
        <div
          onMouseDown={(e) => handleDragStart(key, 'resize-ne', e)}
          className={`absolute -top-1 -right-1 w-4 h-4 cursor-nesw-resize rounded-tr-xl rounded-bl-lg transition-all duration-200 ${isActive ? 'bg-sky-500 shadow-md' : 'bg-slate-400/50 hover:bg-slate-500'
            }`}
        />
        <div
          onMouseDown={(e) => handleDragStart(key, 'resize-sw', e)}
          className={`absolute -bottom-1 -left-1 w-4 h-4 cursor-nesw-resize rounded-bl-xl rounded-tr-lg transition-all duration-200 ${isActive ? 'bg-sky-500 shadow-md' : 'bg-slate-400/50 hover:bg-slate-500'
            }`}
        />
        <div
          onMouseDown={(e) => handleDragStart(key, 'resize-se', e)}
          className={`absolute -bottom-1 -right-1 w-4 h-4 cursor-nwse-resize rounded-br-xl rounded-tl-lg transition-all duration-200 ${isActive ? 'bg-sky-500 shadow-md' : 'bg-slate-400/50 hover:bg-slate-500'
            }`}
        />
      </div>
    );
  };

  return (
    <LayoutSettingsContext.Provider value={{ isReorganizing, handleStartReorganize, handleResetLayout }}>
      <div
        ref={containerRef}
        className={`billing-layout-full h-[calc(100vh-5rem)] relative ${dragMode ? 'select-none' : ''}`}
        style={{ cursor: getCursor() }}
      >
        {/* Modern Floating Editor Pill */}
        {isReorganizing && (
          <div className="absolute top-6 left-1/2 -translate-x-1/2 z-[100] flex items-center gap-6 px-6 py-3 bg-slate-900/95 backdrop-blur-xl rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.3)] border border-white/10 ring-1 ring-black/20">
            <div className="flex items-center gap-3 pr-6 border-r border-slate-700/50">
              <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-sky-500/10 border border-sky-500/20">
                <Move className="h-4 w-4 text-sky-400" />
              </div>
              <div className="flex flex-col">
                <p className="text-xs font-bold text-white uppercase tracking-wider">Layout Editor</p>
                <p className="text-[10px] text-slate-400 font-medium whitespace-nowrap">Drag panels & edges to customize</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={handleCancelReorganize}
                className="flex items-center gap-2 px-4 py-2 text-slate-400 hover:text-white hover:bg-white/5 rounded-xl text-xs font-semibold transition-all duration-200"
              >
                <X className="h-3.5 w-3.5" />
                Discard
              </button>
              <button
                onClick={handleSaveReorganize}
                className="flex items-center gap-2 px-5 py-2.5 bg-sky-500 hover:bg-sky-400 text-white rounded-xl text-xs font-bold transition-all duration-200 shadow-lg shadow-sky-500/20 active:scale-95"
              >
                <Check className="h-4 w-4" />
                Save Layout
              </button>
            </div>
          </div>
        )}

        {/* Panels Container - always full size to keep coordinate system stable */}
        <div
          ref={panelsContainerRef}
          className="relative h-full w-full"
        >
          {renderPanel('currentBill', 'Current Bill', currentBillPanel, currentLayout.currentBill)}
          {renderPanel('recentInvoices', 'Recent Invoices', recentInvoicesPanel, currentLayout.recentInvoices)}
          {renderPanel('products', 'Products', productsPanel, currentLayout.products)}
        </div>
      </div>
    </LayoutSettingsContext.Provider>
  );
}
