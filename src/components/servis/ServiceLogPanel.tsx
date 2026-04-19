"use client";

import { useState } from "react";
import { ServiceLogType } from "@prisma/client";
import {
  MessageSquare,
  Activity,
  User,
  Package,
  Image,
  Phone,
  MapPin,
  Stethoscope,
  Plus,
  ChevronDown,
  ChevronUp,
  Clock,
} from "lucide-react";

const LOG_TYPE_CONFIG: Record<ServiceLogType, { label: string; icon: React.ReactNode; color: string }> = {
  STATUS_CHANGE:        { label: "Durum Değişikliği", icon: <Activity size={14} />,    color: "text-blue-600 bg-blue-50 border-blue-200" },
  NOTE_ADDED:           { label: "Not Eklendi",       icon: <MessageSquare size={14} />, color: "text-gray-600 bg-gray-50 border-gray-200" },
  TECHNICIAN_ASSIGNED:  { label: "Teknisyen Atandı",  icon: <User size={14} />,         color: "text-purple-600 bg-purple-50 border-purple-200" },
  PARTS_UPDATED:        { label: "Parça Güncellendi", icon: <Package size={14} />,      color: "text-orange-600 bg-orange-50 border-orange-200" },
  PHOTO_ADDED:          { label: "Fotoğraf Eklendi",  icon: <Image size={14} />,        color: "text-green-600 bg-green-50 border-green-200" },
  CUSTOMER_CONTACT:     { label: "Müşteri İletişimi", icon: <Phone size={14} />,        color: "text-teal-600 bg-teal-50 border-teal-200" },
  FIELD_VISIT:          { label: "Saha Ziyareti",     icon: <MapPin size={14} />,       color: "text-red-600 bg-red-50 border-red-200" },
  DIAGNOSIS_UPDATED:    { label: "Teşhis Güncellendi",icon: <Stethoscope size={14} />, color: "text-indigo-600 bg-indigo-50 border-indigo-200" },
};

interface LogEntry {
  id: string;
  type: ServiceLogType;
  description: string;
  oldValue?: string | null;
  newValue?: string | null;
  createdAt: string | Date;
  personnel?: {
    user: { firstName: string | null; lastName: string | null };
  } | null;
}

interface Props {
  reportId: string;
  logs: LogEntry[];
  onLogAdded?: (log: LogEntry) => void;
}

const LOG_TYPE_OPTIONS: { value: ServiceLogType; label: string }[] = [
  { value: "NOTE_ADDED",        label: "Not" },
  { value: "CUSTOMER_CONTACT",  label: "Müşteri İletişimi" },
  { value: "FIELD_VISIT",       label: "Saha Ziyareti" },
  { value: "DIAGNOSIS_UPDATED", label: "Teşhis Güncellendi" },
];

function formatTime(date: string | Date) {
  const d = new Date(date);
  return d.toLocaleString("tr-TR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function personnelName(log: LogEntry) {
  if (!log.personnel) return "Sistem";
  const { firstName, lastName } = log.personnel.user;
  return [firstName, lastName].filter(Boolean).join(" ") || "Kullanıcı";
}

export function ServiceLogPanel({ reportId, logs: initialLogs, onLogAdded }: Props) {
  const [logs, setLogs] = useState<LogEntry[]>(initialLogs);
  const [expanded, setExpanded] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [type, setType] = useState<ServiceLogType>("NOTE_ADDED");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!description.trim()) {
      setError("Açıklama boş bırakılamaz");
      return;
    }
    setLoading(true);
    setError("");

    try {
      const res = await fetch(`/api/servis/${reportId}/logs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, description }),
      });

      if (!res.ok) throw new Error("Kayıt başarısız");

      const { log } = await res.json();
      const newLog: LogEntry = { ...log, createdAt: new Date(log.createdAt) };
      setLogs((prev) => [newLog, ...prev]);
      onLogAdded?.(newLog);
      setDescription("");
      setAddOpen(false);
    } catch {
      setError("Müdahale kaydedilemedi. Tekrar deneyin.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-3 cursor-pointer select-none"
        onClick={() => setExpanded((v) => !v)}
      >
        <div className="flex items-center gap-2">
          <Activity size={16} className="text-gray-500" />
          <span className="font-semibold text-gray-800">Müdahale Geçmişi</span>
          <span className="text-xs bg-gray-100 text-gray-600 rounded-full px-2 py-0.5">
            {logs.length}
          </span>
        </div>
        {expanded ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
      </div>

      {expanded && (
        <div className="border-t border-gray-100">
          {/* Add log button */}
          <div className="px-4 py-3 border-b border-gray-100">
            {!addOpen ? (
              <button
                type="button"
                onClick={() => setAddOpen(true)}
                className="flex items-center gap-2 w-full px-4 py-2.5 rounded-xl border-2 border-dashed border-gray-300 text-gray-500 hover:border-primary hover:text-primary transition-colors text-sm"
              >
                <Plus size={16} />
                Müdahale Notu Ekle
              </button>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  {LOG_TYPE_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setType(opt.value)}
                      className={`px-3 py-2 rounded-lg border text-xs font-medium transition-colors ${
                        type === opt.value
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-gray-200 text-gray-600 hover:border-gray-300"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>

                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Yapılan işlemi veya notu girin..."
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                  rows={3}
                  autoFocus
                />

                {error && <p className="text-xs text-red-500">{error}</p>}

                <div className="flex gap-2">
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex-1 px-4 py-2.5 bg-primary text-white rounded-xl text-sm font-medium disabled:opacity-50"
                  >
                    {loading ? "Kaydediliyor..." : "Kaydet"}
                  </button>
                  <button
                    type="button"
                    onClick={() => { setAddOpen(false); setDescription(""); setError(""); }}
                    className="px-4 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50"
                  >
                    İptal
                  </button>
                </div>
              </form>
            )}
          </div>

          {/* Log list */}
          <div className="divide-y divide-gray-50 max-h-96 overflow-y-auto">
            {logs.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-gray-400">
                Henüz müdahale kaydı yok
              </div>
            ) : (
              logs.map((log) => {
                const config = LOG_TYPE_CONFIG[log.type];
                return (
                  <div key={log.id} className="px-4 py-3 flex gap-3">
                    <div className={`flex-shrink-0 mt-0.5 w-7 h-7 rounded-full border flex items-center justify-center ${config.color}`}>
                      {config.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm text-gray-800 leading-relaxed">{log.description}</p>
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs text-gray-400 flex items-center gap-1">
                          <Clock size={10} />
                          {formatTime(log.createdAt)}
                        </span>
                        <span className="text-xs text-gray-400">·</span>
                        <span className="text-xs text-gray-500">{personnelName(log)}</span>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
