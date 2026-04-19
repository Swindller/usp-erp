"use client";

import { ServiceStatus } from "@prisma/client";

const STATUS_CONFIG: Record<
  ServiceStatus,
  { label: string; classes: string }
> = {
  RECEIVED:       { label: "Teslim Alındı",     classes: "bg-blue-100 text-blue-800 border-blue-200" },
  DIAGNOSING:     { label: "Teşhis Yapılıyor",  classes: "bg-yellow-100 text-yellow-800 border-yellow-200" },
  WAITING_PARTS:  { label: "Parça Bekleniyor",  classes: "bg-orange-100 text-orange-800 border-orange-200" },
  IN_REPAIR:      { label: "Tamirde",           classes: "bg-purple-100 text-purple-800 border-purple-200" },
  QUALITY_CHECK:  { label: "Kalite Kontrolde",  classes: "bg-indigo-100 text-indigo-800 border-indigo-200" },
  READY:          { label: "Teslime Hazır",     classes: "bg-green-100 text-green-800 border-green-200" },
  DELIVERED:      { label: "Teslim Edildi",     classes: "bg-gray-100 text-gray-700 border-gray-200" },
  CANCELLED:      { label: "İptal Edildi",      classes: "bg-red-100 text-red-700 border-red-200" },
  WARRANTY_RETURN:{ label: "Garanti İadesi",    classes: "bg-pink-100 text-pink-800 border-pink-200" },
};

interface Props {
  status: ServiceStatus;
  size?: "sm" | "md" | "lg";
}

export function ServiceStatusBadge({ status, size = "md" }: Props) {
  const config = STATUS_CONFIG[status];
  const sizeClasses = {
    sm: "text-xs px-2 py-0.5",
    md: "text-xs px-2.5 py-1",
    lg: "text-sm px-3 py-1.5",
  }[size];

  return (
    <span
      className={`inline-flex items-center font-medium rounded-full border ${config.classes} ${sizeClasses}`}
    >
      {config.label}
    </span>
  );
}

export { STATUS_CONFIG };
