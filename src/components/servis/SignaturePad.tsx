"use client";

import { useRef, useImperativeHandle, forwardRef } from "react";
import dynamic from "next/dynamic";
import { RotateCcw, Check } from "lucide-react";
import type SignatureCanvasType from "react-signature-canvas";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const SignatureCanvas = dynamic(() => import("react-signature-canvas"), { ssr: false }) as any;

export interface SignaturePadRef {
  getDataURL: () => string | null;
  clear: () => void;
  isEmpty: () => boolean;
}

interface Props {
  label: string;
  value?: string;
  onChange?: (dataUrl: string | null) => void;
  disabled?: boolean;
}

export const SignaturePad = forwardRef<SignaturePadRef, Props>(
  ({ label, value, onChange, disabled = false }, ref) => {
    const sigRef = useRef<SignatureCanvasType>(null);

    useImperativeHandle(ref, () => ({
      getDataURL: () => {
        if (!sigRef.current || sigRef.current.isEmpty()) return null;
        return sigRef.current.toDataURL("image/png");
      },
      clear: () => {
        sigRef.current?.clear();
        onChange?.(null);
      },
      isEmpty: () => sigRef.current?.isEmpty() ?? true,
    }));

    const handleEnd = () => {
      if (!sigRef.current || sigRef.current.isEmpty()) return;
      onChange?.(sigRef.current.toDataURL("image/png"));
    };

    const handleClear = () => {
      sigRef.current?.clear();
      onChange?.(null);
    };

    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium text-gray-700">{label}</label>
          {!disabled && (
            <button
              type="button"
              onClick={handleClear}
              className="flex items-center gap-1 text-xs text-gray-500 hover:text-red-500 transition-colors"
            >
              <RotateCcw size={12} />
              Temizle
            </button>
          )}
        </div>

        <div className="relative rounded-xl border-2 border-dashed border-gray-300 bg-gray-50 overflow-hidden">
          {disabled && value ? (
            <img
              src={value}
              alt={label}
              className="w-full h-32 object-contain bg-white"
            />
          ) : disabled && !value ? (
            <div className="h-32 flex items-center justify-center text-gray-400 text-sm">
              İmza yok
            </div>
          ) : (
            <SignatureCanvas
              ref={sigRef}
              canvasProps={{
                className: "w-full",
                style: { height: 128, touchAction: "none" },
              }}
              backgroundColor="rgb(255,255,255)"
              onEnd={handleEnd}
            />
          )}
        </div>

        {value && !disabled && (
          <div className="flex items-center gap-1.5 text-xs text-green-600">
            <Check size={12} />
            İmza alındı
          </div>
        )}

        {!disabled && (
          <p className="text-xs text-gray-400">
            Parmağınızla veya fare ile imzalayın
          </p>
        )}
      </div>
    );
  }
);

SignaturePad.displayName = "SignaturePad";
