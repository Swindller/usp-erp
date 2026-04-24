"use client";

import { useState, useEffect, useRef } from "react";
import { Search, Plus, Trash2, Package, X, Loader2 } from "lucide-react";

export interface PartItem {
  productId?: string;
  name: string;
  partNo?: string;
  quantity: number;
  unitPrice: number;
}

interface CatalogProduct {
  id: string;
  sku: string;
  name: string;
  price: number;
  stock: number;
  brand: string | null;
  imageUrl: string | null;
}

interface Props {
  parts: PartItem[];
  onChange: (parts: PartItem[]) => void;
  disabled?: boolean;
  hidePrices?: boolean;
}

export function PartsEditor({ parts, onChange, disabled = false, hidePrices = false }: Props) {
  const [searchQuery, setSearchQuery] = useState("");
  const [results, setResults] = useState<CatalogProduct[]>([]);
  const [searching, setSearching] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  // Debounced catalog search
  useEffect(() => {
    if (searchQuery.length < 2) { setResults([]); return; }
    const t = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(
          `/api/urunler/arama?q=${encodeURIComponent(searchQuery)}`
        );
        const data = await res.json();
        setResults(data.products || []);
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [searchQuery]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowSearch(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const addFromCatalog = (product: CatalogProduct) => {
    const alreadyExists = parts.findIndex((p) => p.productId === product.id);
    if (alreadyExists >= 0) {
      // Increase quantity
      onChange(
        parts.map((p, i) =>
          i === alreadyExists ? { ...p, quantity: p.quantity + 1 } : p
        )
      );
    } else {
      onChange([
        ...parts,
        {
          productId: product.id,
          name: product.name,
          partNo: product.sku,
          quantity: 1,
          unitPrice: product.price,
        },
      ]);
    }
    setSearchQuery("");
    setResults([]);
    setShowSearch(false);
  };

  const addManual = () => {
    onChange([...parts, { name: "", partNo: "", quantity: 1, unitPrice: 0 }]);
  };

  const updatePart = (i: number, key: keyof PartItem, value: string | number) => {
    onChange(parts.map((p, j) => (j === i ? { ...p, [key]: value } : p)));
  };

  const removePart = (i: number) => {
    onChange(parts.filter((_, j) => j !== i));
  };

  const totalCost = parts.reduce((s, p) => s + p.quantity * p.unitPrice, 0);

  return (
    <div className="space-y-3">
      {/* Parts list */}
      {parts.length > 0 && (
        <div className="space-y-2">
          {/* Header */}
          {hidePrices ? (
            <div className="hidden sm:grid grid-cols-12 gap-2 px-1 text-xs font-medium text-gray-400">
              <span className="col-span-8">Parça Adı</span>
              <span className="col-span-3 text-center">Adet</span>
              <span className="col-span-1" />
            </div>
          ) : (
            <div className="hidden sm:grid grid-cols-12 gap-2 px-1 text-xs font-medium text-gray-400">
              <span className="col-span-4">Parça Adı</span>
              <span className="col-span-3">Parça No / SKU</span>
              <span className="col-span-2 text-center">Adet</span>
              <span className="col-span-2 text-right">Birim ₺</span>
              <span className="col-span-1" />
            </div>
          )}

          {parts.map((part, i) => (
            <div
              key={i}
              className={`grid grid-cols-12 gap-2 items-center p-2 rounded-xl border ${
                part.productId
                  ? "bg-blue-50/50 border-blue-100"
                  : "bg-gray-50 border-gray-100"
              }`}
            >
              {hidePrices ? (
                <>
                  <div className="col-span-11 flex items-center gap-1.5">
                    {part.productId && <Package size={12} className="text-blue-400 flex-shrink-0" />}
                    <span className="text-xs font-medium text-gray-800">{part.name || "—"}</span>
                  </div>
                  <div className="col-span-1 flex justify-end">
                    {!disabled && (
                      <button type="button" onClick={() => removePart(i)} className="p-1 rounded hover:bg-red-50 text-gray-300 hover:text-red-500 transition-colors">
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>
                  <div className="col-span-12 flex items-center gap-2 -mt-1 pl-5">
                    <span className="text-xs text-gray-500">Adet:</span>
                    {disabled ? (
                      <span className="text-xs font-semibold text-gray-700">{part.quantity}</span>
                    ) : (
                      <input
                        type="number" min={1} value={part.quantity}
                        onChange={(e) => updatePart(i, "quantity", parseInt(e.target.value) || 1)}
                        className="w-16 px-2 py-1 text-xs border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-primary text-center"
                      />
                    )}
                  </div>
                </>
              ) : (
                <>
                  <div className="col-span-12 sm:col-span-4 flex items-center gap-1.5">
                    {part.productId && <Package size={12} className="text-blue-400 flex-shrink-0" />}
                    <input
                      value={part.name}
                      onChange={(e) => updatePart(i, "name", e.target.value)}
                      disabled={disabled}
                      placeholder="Parça adı"
                      className="flex-1 min-w-0 px-2 py-1.5 text-xs border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-60"
                    />
                  </div>
                  <div className="col-span-5 sm:col-span-3">
                    <input
                      value={part.partNo || ""}
                      onChange={(e) => updatePart(i, "partNo", e.target.value)}
                      disabled={disabled}
                      placeholder="SKU / No"
                      className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-primary font-mono disabled:opacity-60"
                    />
                  </div>
                  <div className="col-span-3 sm:col-span-2">
                    <input
                      type="number" min={1} value={part.quantity}
                      onChange={(e) => updatePart(i, "quantity", parseInt(e.target.value) || 1)}
                      disabled={disabled}
                      className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-primary text-center disabled:opacity-60"
                    />
                  </div>
                  <div className="col-span-3 sm:col-span-2">
                    <input
                      type="number" min={0} step={0.01} value={part.unitPrice}
                      onChange={(e) => updatePart(i, "unitPrice", parseFloat(e.target.value) || 0)}
                      disabled={disabled}
                      className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-primary text-right disabled:opacity-60"
                    />
                  </div>
                  <div className="col-span-1 flex justify-end">
                    {!disabled && (
                      <button type="button" onClick={() => removePart(i)} className="p-1 rounded hover:bg-red-50 text-gray-300 hover:text-red-500 transition-colors">
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>
                  <div className="col-span-12 text-right text-xs text-gray-500 pr-8 -mt-1">
                    ₺{(part.quantity * part.unitPrice).toLocaleString("tr-TR", { minimumFractionDigits: 2 })}
                  </div>
                </>
              )}
            </div>
          ))}

          {/* Totals — sadece admin/manager için */}
          {!hidePrices && (
            <div className="flex justify-end pt-1 border-t border-gray-200">
              <div className="text-sm font-semibold text-gray-800">
                Parça Toplamı: ₺{totalCost.toLocaleString("tr-TR", { minimumFractionDigits: 2 })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Add buttons */}
      {!disabled && (
        <div className="flex flex-col sm:flex-row gap-2">
          {/* Catalog search */}
          <div ref={searchRef} className="relative flex-1">
            <button
              type="button"
              onClick={() => setShowSearch(true)}
              className="flex items-center gap-2 w-full px-3 py-2.5 rounded-xl border-2 border-dashed border-blue-300 text-blue-600 hover:border-blue-400 hover:bg-blue-50 transition-colors text-sm"
            >
              <Search size={14} />
              Ürün Kataloğundan Ara
            </button>

            {showSearch && (
              <div className="absolute top-full mt-1 left-0 right-0 z-30 bg-white border border-gray-200 rounded-2xl shadow-lg overflow-hidden">
                <div className="relative p-2">
                  <Search size={13} className="absolute left-4.5 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    autoFocus
                    type="search"
                    placeholder="SKU veya ürün adı..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-8 pr-8 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                  {searching && (
                    <Loader2 size={12} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 animate-spin" />
                  )}
                  {!searching && searchQuery && (
                    <button
                      onClick={() => setSearchQuery("")}
                      className="absolute right-4 top-1/2 -translate-y-1/2"
                    >
                      <X size={12} className="text-gray-400" />
                    </button>
                  )}
                </div>

                {results.length > 0 && (
                  <div className="max-h-52 overflow-y-auto divide-y divide-gray-50">
                    {results.map((product) => (
                      <button
                        key={product.id}
                        type="button"
                        onClick={() => addFromCatalog(product)}
                        className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-gray-50 text-left transition-colors"
                      >
                        {product.imageUrl ? (
                          <img
                            src={product.imageUrl}
                            alt=""
                            className="w-8 h-8 rounded-lg object-cover flex-shrink-0 border border-gray-100"
                          />
                        ) : (
                          <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
                            <Package size={14} className="text-gray-400" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-800 truncate">
                            {product.name}
                          </p>
                          <p className="text-xs text-gray-400">
                            {product.sku}
                            {product.brand && ` · ${product.brand}`}
                            {` · Stok: ${product.stock}`}
                          </p>
                        </div>
                        {!hidePrices && (
                          <span className="text-sm font-semibold text-gray-700 flex-shrink-0">
                            ₺{product.price.toLocaleString("tr-TR", { minimumFractionDigits: 2 })}
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                )}

                {!searching && searchQuery.length >= 2 && results.length === 0 && (
                  <div className="px-3 py-4 text-sm text-gray-400 text-center">
                    Ürün bulunamadı
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Manual add */}
          <button
            type="button"
            onClick={addManual}
            className="flex items-center gap-2 px-3 py-2.5 rounded-xl border-2 border-dashed border-gray-300 text-gray-500 hover:border-gray-400 hover:bg-gray-50 transition-colors text-sm sm:flex-shrink-0"
          >
            <Plus size={14} />
            Manuel Ekle
          </button>
        </div>
      )}

      {parts.length === 0 && disabled && (
        <p className="text-sm text-gray-400 italic">Parça girilmemiş</p>
      )}
    </div>
  );
}
