"use client";

import { useEffect } from "react";

export default function ErpError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[ERP ERROR]", error.message, error.stack);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center p-8">
      <div className="bg-white rounded-2xl border border-red-200 p-8 max-w-lg w-full space-y-4 shadow-sm">
        <h2 className="text-lg font-bold text-red-600">Sayfa yüklenemedi</h2>
        <p className="text-sm text-gray-600 font-mono bg-gray-50 rounded-xl p-3 break-all">
          {error.message}
        </p>
        {error.digest && (
          <p className="text-xs text-gray-400">Digest: {error.digest}</p>
        )}
        <button
          onClick={reset}
          className="w-full py-2.5 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700"
        >
          Tekrar Dene
        </button>
      </div>
    </div>
  );
}
