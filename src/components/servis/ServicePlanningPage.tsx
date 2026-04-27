"use client";

import { useState, useEffect, useCallback } from "react";
import {
  ChevronLeft, ChevronRight, Plus, MapPin, Wrench, MoreHorizontal,
  User, Check, Truck, X, Save, Trash2, Edit3,
  Navigation, Clock, CheckCircle2, Users, FileText,
} from "lucide-react";
import Link from "next/link";

// ── Types ────────────────────────────────────────────────────────────────────

type PlanTaskStatus = "PENDING" | "EN_ROUTE" | "ARRIVED" | "IN_PROGRESS" | "DONE" | "CANCELLED";
type PlanTaskType   = "FIELD_VISIT" | "WORKSHOP" | "OTHER";

interface Assignee {
  personnelId: string;
  personnel: { user: { firstName: string | null; lastName: string | null } };
}

interface PlanTask {
  id: string;
  type: PlanTaskType;
  title: string;
  description: string | null;
  address: string | null;
  sortOrder: number;
  status: PlanTaskStatus;
  assignees: Assignee[];
  serviceReport: {
    id: string;
    reportNumber: string;
    status: string;
    customer: { firstName: string | null; lastName: string | null; companyName: string | null; type: string };
  } | null;
  startedAt: string | null;
  arrivedAt: string | null;
  completedAt: string | null;
  notes: string | null;
}

interface ServicePlan {
  id: string;
  date: string;
  title: string | null;
  notes: string | null;
  tasks: PlanTask[];
  createdBy: { user: { firstName: string | null; lastName: string | null } } | null;
}

interface Personnel {
  id: string;
  role: string;
  user: { firstName: string | null; lastName: string | null };
}

interface Props {
  personnel: Personnel[];
  userRole: string;
  currentPersonnelId: string | null;
}

// ── Sabitler ─────────────────────────────────────────────────────────────────

const TYPE_CONFIG: Record<PlanTaskType, { label: string; icon: React.ReactNode; classes: string }> = {
  FIELD_VISIT: { label: "Saha",    icon: <Navigation size={12} />, classes: "bg-blue-100 text-blue-700 border-blue-200" },
  WORKSHOP:    { label: "Atölye",  icon: <Wrench size={12} />,     classes: "bg-purple-100 text-purple-700 border-purple-200" },
  OTHER:       { label: "Diğer",   icon: <MoreHorizontal size={12} />, classes: "bg-gray-100 text-gray-600 border-gray-200" },
};

const STATUS_CONFIG: Record<PlanTaskStatus, { label: string; color: string; icon: React.ReactNode }> = {
  PENDING:     { label: "Bekliyor",      color: "text-gray-500",   icon: <Clock size={13} /> },
  EN_ROUTE:    { label: "Yola Çıktı",   color: "text-blue-600",   icon: <Truck size={13} /> },
  ARRIVED:     { label: "Vardı",         color: "text-indigo-600", icon: <MapPin size={13} /> },
  IN_PROGRESS: { label: "Çalışıyor",    color: "text-orange-600", icon: <Wrench size={13} /> },
  DONE:        { label: "Tamamlandı",   color: "text-green-600",  icon: <CheckCircle2 size={13} /> },
  CANCELLED:   { label: "İptal",         color: "text-red-500",    icon: <X size={13} /> },
};

// Teknisyen için sıradaki durum
const NEXT_STATUS: Partial<Record<PlanTaskStatus, { status: PlanTaskStatus; label: string; classes: string }>> = {
  PENDING:     { status: "EN_ROUTE",    label: "🚗 Yola Çıkıyorum", classes: "bg-blue-600 text-white hover:bg-blue-700" },
  EN_ROUTE:    { status: "ARRIVED",     label: "📍 Vardım",          classes: "bg-indigo-600 text-white hover:bg-indigo-700" },
  ARRIVED:     { status: "IN_PROGRESS", label: "🔧 Başladım",        classes: "bg-orange-500 text-white hover:bg-orange-600" },
  IN_PROGRESS: { status: "DONE",        label: "✅ Tamamladım",      classes: "bg-green-600 text-white hover:bg-green-700" },
};

// Atölye için (EN_ROUTE/ARRIVED atlanır)
const NEXT_STATUS_WORKSHOP: Partial<Record<PlanTaskStatus, { status: PlanTaskStatus; label: string; classes: string }>> = {
  PENDING:     { status: "IN_PROGRESS", label: "🔧 Başladım",   classes: "bg-orange-500 text-white hover:bg-orange-600" },
  IN_PROGRESS: { status: "DONE",        label: "✅ Tamamladım", classes: "bg-green-600 text-white hover:bg-green-700" },
};

function pName(p: Personnel) {
  return [p.user.firstName, p.user.lastName].filter(Boolean).join(" ") || "—";
}

function toYMD(date: Date) {
  return date.toISOString().slice(0, 10);
}

function addDays(dateStr: string, n: number) {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + n);
  return toYMD(d);
}

function fmtDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("tr-TR", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });
}

function fmtTime(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });
}

// ── Component ────────────────────────────────────────────────────────────────

export function ServicePlanningPage({ personnel, userRole, currentPersonnelId }: Props) {
  const isManager = ["ADMIN", "SUPER_ADMIN", "MANAGER"].includes(userRole);
  const isTech    = userRole === "TECHNICIAN";

  const [selectedDate, setSelectedDate] = useState(toYMD(new Date()));
  const [plan, setPlan] = useState<ServicePlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Yeni görev formu
  const [showAddTask, setShowAddTask] = useState(false);
  const [taskForm, setTaskForm] = useState({
    type: "FIELD_VISIT" as PlanTaskType,
    title: "",
    description: "",
    address: "",
    assigneeIds: [] as string[],
    serviceReportId: "",
    notes: "",
  });
  const [taskError, setTaskError] = useState("");

  // Düzenleme
  const [editingTask, setEditingTask] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<typeof taskForm & { assigneeIds: string[] }>>({});

  const loadPlan = useCallback(async (date: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/servis/planlama?date=${date}`);
      const data = await res.json();
      setPlan(data.plan);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadPlan(selectedDate); }, [selectedDate, loadPlan]);

  const createPlanAndAddTask = async () => {
    if (!taskForm.title.trim()) { setTaskError("Görev başlığı zorunludur"); return; }
    setSaving(true);
    setTaskError("");
    try {
      // Plan varsa görev ekle, yoksa plan+görev oluştur
      if (plan) {
        const res = await fetch(`/api/servis/planlama/${plan.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            addTask: {
              ...taskForm,
              sortOrder: plan.tasks.length,
              serviceReportId: taskForm.serviceReportId || undefined,
            },
          }),
        });
        const data = await res.json();
        if (!res.ok) { setTaskError("Hata oluştu"); return; }
        setPlan(data.plan);
      } else {
        const res = await fetch("/api/servis/planlama", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            date: selectedDate,
            tasks: [{
              ...taskForm,
              sortOrder: 0,
              serviceReportId: taskForm.serviceReportId || undefined,
            }],
          }),
        });
        const data = await res.json();
        if (!res.ok) { setTaskError("Hata oluştu"); return; }
        setPlan(data.plan);
      }
      setShowAddTask(false);
      setTaskForm({ type: "FIELD_VISIT", title: "", description: "", address: "", assigneeIds: [], serviceReportId: "", notes: "" });
    } finally {
      setSaving(false);
    }
  };

  const updateTaskStatus = async (taskId: string, status: PlanTaskStatus) => {
    const res = await fetch(`/api/servis/planlama/gorev/${taskId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (res.ok) {
      const data = await res.json();
      setPlan((p) => p ? { ...p, tasks: p.tasks.map((t) => t.id === taskId ? { ...t, ...data.task } : t) } : p);
    }
  };

  const saveEditTask = async (taskId: string) => {
    setSaving(true);
    try {
      const res = await fetch(`/api/servis/planlama/gorev/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...editForm,
          serviceReportId: editForm.serviceReportId || null,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setPlan((p) => p ? { ...p, tasks: p.tasks.map((t) => t.id === taskId ? { ...t, ...data.task } : t) } : p);
        setEditingTask(null);
      }
    } finally {
      setSaving(false);
    }
  };

  const deleteTask = async (taskId: string) => {
    const res = await fetch(`/api/servis/planlama/gorev/${taskId}`, { method: "DELETE" });
    if (res.ok) {
      setPlan((p) => p ? { ...p, tasks: p.tasks.filter((t) => t.id !== taskId) } : p);
    }
  };

  const toggleAssignee = (pid: string) => {
    setTaskForm((f) => ({
      ...f,
      assigneeIds: f.assigneeIds.includes(pid) ? f.assigneeIds.filter((id) => id !== pid) : [...f.assigneeIds, pid],
    }));
  };

  const toggleEditAssignee = (pid: string) => {
    setEditForm((f) => {
      const ids = f.assigneeIds || [];
      return { ...f, assigneeIds: ids.includes(pid) ? ids.filter((id) => id !== pid) : [...ids, pid] };
    });
  };

  // Teknisyen için bugünkü görevlerini filtrele
  const myTasks = isTech && currentPersonnelId
    ? (plan?.tasks || []).filter((t) => t.assignees.some((a) => a.personnelId === currentPersonnelId))
    : (plan?.tasks || []);

  const displayTasks = isTech ? myTasks : (plan?.tasks || []);

  // Özet istatistikler
  const stats = {
    total: displayTasks.length,
    done: displayTasks.filter((t) => t.status === "DONE").length,
    inProgress: displayTasks.filter((t) => ["EN_ROUTE", "ARRIVED", "IN_PROGRESS"].includes(t.status)).length,
    pending: displayTasks.filter((t) => t.status === "PENDING").length,
  };

  return (
    <div className="space-y-5 max-w-4xl mx-auto">
      {/* ── Başlık ── */}
      <div className="flex items-center gap-3">
        <div className="flex-1">
          <h1 className="text-xl font-bold text-gray-900">
            {isTech ? "Görevlerim" : "Servis Planlaması"}
          </h1>
          <p className="text-sm text-gray-500">
            {isTech ? "Bugün sana atanan görevler" : "Günlük teknisyen görev planı"}
          </p>
        </div>
        {isManager && (
          <button
            onClick={() => setShowAddTask(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 transition-colors"
          >
            <Plus size={16} />Görev Ekle
          </button>
        )}
      </div>

      {/* ── Tarih Navigasyonu ── */}
      <div className="bg-white border border-gray-200 rounded-2xl p-3 flex items-center gap-3">
        <button
          onClick={() => setSelectedDate((d) => addDays(d, -1))}
          className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
        >
          <ChevronLeft size={18} className="text-gray-600" />
        </button>
        <div className="flex-1 text-center">
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="text-center font-semibold text-gray-800 border-0 outline-none bg-transparent cursor-pointer text-sm"
          />
          <p className="text-xs text-gray-400 capitalize">{fmtDate(selectedDate)}</p>
        </div>
        <button
          onClick={() => setSelectedDate((d) => addDays(d, 1))}
          className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
        >
          <ChevronRight size={18} className="text-gray-600" />
        </button>
        <button
          onClick={() => setSelectedDate(toYMD(new Date()))}
          className="px-3 py-1.5 text-xs font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors"
        >
          Bugün
        </button>
      </div>

      {/* ── Özet Bar ── */}
      {!loading && displayTasks.length > 0 && (
        <div className="grid grid-cols-4 gap-3">
          {[
            { label: "Toplam",      value: stats.total,      color: "text-gray-700 bg-gray-50 border-gray-200" },
            { label: "Bekliyor",    value: stats.pending,    color: "text-amber-700 bg-amber-50 border-amber-200" },
            { label: "Devam Eden",  value: stats.inProgress, color: "text-blue-700 bg-blue-50 border-blue-200" },
            { label: "Tamamlandı", value: stats.done,       color: "text-green-700 bg-green-50 border-green-200" },
          ].map((s) => (
            <div key={s.label} className={`rounded-xl border p-3 text-center ${s.color}`}>
              <div className="text-2xl font-bold">{s.value}</div>
              <div className="text-xs font-medium">{s.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* ── İçerik ── */}
      {loading ? (
        <div className="flex items-center justify-center h-40">
          <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full" />
        </div>
      ) : displayTasks.length === 0 ? (
        <div className="bg-white border border-dashed border-gray-200 rounded-2xl p-12 text-center">
          <div className="w-14 h-14 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-4">
            <Users size={24} className="text-gray-400" />
          </div>
          <p className="text-gray-500 font-medium">
            {isTech ? "Bu gün için görevin yok" : "Bu gün için plan oluşturulmamış"}
          </p>
          {isManager && (
            <button
              onClick={() => setShowAddTask(true)}
              className="mt-4 text-sm text-blue-600 hover:underline flex items-center gap-1 mx-auto"
            >
              <Plus size={13} />Görev ekle
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {displayTasks.map((task, idx) => {
            const typeCfg   = TYPE_CONFIG[task.type];
            const statusCfg = STATUS_CONFIG[task.status];
            const nextMap   = task.type === "WORKSHOP" ? NEXT_STATUS_WORKSHOP : NEXT_STATUS;
            const next      = nextMap[task.status];
            const isEditing = editingTask === task.id;
            const isDone    = task.status === "DONE" || task.status === "CANCELLED";

            return (
              <div
                key={task.id}
                className={`bg-white border rounded-2xl overflow-hidden transition-all ${
                  isDone ? "border-gray-100 opacity-75" : task.status !== "PENDING" ? "border-blue-200 shadow-sm" : "border-gray-200"
                }`}
              >
                {/* ── Kart Başlığı ── */}
                <div className="p-4">
                  <div className="flex items-start gap-3">
                    {/* Sıra numarası */}
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold ${
                      isDone ? "bg-green-100 text-green-600" : task.status !== "PENDING" ? "bg-blue-100 text-blue-600" : "bg-gray-100 text-gray-500"
                    }`}>
                      {isDone ? <Check size={13} /> : idx + 1}
                    </div>

                    <div className="flex-1 min-w-0">
                      {/* Tip badge + başlık */}
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${typeCfg.classes}`}>
                          {typeCfg.icon}{typeCfg.label}
                        </span>
                        {isEditing ? (
                          <input
                            value={editForm.title || ""}
                            onChange={(e) => setEditForm((f) => ({ ...f, title: e.target.value }))}
                            className="flex-1 text-sm font-semibold border border-gray-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                          />
                        ) : (
                          <span className={`text-sm font-semibold ${isDone ? "line-through text-gray-400" : "text-gray-800"}`}>
                            {task.title}
                          </span>
                        )}
                      </div>

                      {/* Adres */}
                      {(isEditing ? true : task.address) && (
                        <div className="flex items-center gap-1.5 mt-1">
                          <MapPin size={11} className="text-gray-400 flex-shrink-0" />
                          {isEditing ? (
                            <input
                              value={editForm.address || ""}
                              onChange={(e) => setEditForm((f) => ({ ...f, address: e.target.value }))}
                              placeholder="Adres / Konum"
                              className="flex-1 text-xs border border-gray-200 rounded-lg px-2 py-1 focus:outline-none"
                            />
                          ) : (
                            <span className="text-xs text-gray-500">{task.address}</span>
                          )}
                        </div>
                      )}

                      {/* Açıklama */}
                      {(isEditing ? true : task.description) && (
                        <div className="mt-1">
                          {isEditing ? (
                            <textarea
                              value={editForm.description || ""}
                              onChange={(e) => setEditForm((f) => ({ ...f, description: e.target.value }))}
                              placeholder="Açıklama / yapılacak işler"
                              rows={2}
                              className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1 focus:outline-none resize-none"
                            />
                          ) : (
                            <p className="text-xs text-gray-500 whitespace-pre-wrap">{task.description}</p>
                          )}
                        </div>
                      )}

                      {/* Bağlı servis raporu */}
                      {task.serviceReport && (
                        <div className="mt-1.5">
                          <Link
                            href={`/servis/${task.serviceReport.id}`}
                            className="inline-flex items-center gap-1 text-[10px] text-blue-600 hover:underline"
                          >
                            <FileText size={10} />
                            {task.serviceReport.reportNumber}
                            {" · "}
                            {task.serviceReport.customer.type === "CORPORATE"
                              ? task.serviceReport.customer.companyName
                              : [task.serviceReport.customer.firstName, task.serviceReport.customer.lastName].filter(Boolean).join(" ")}
                          </Link>
                        </div>
                      )}

                      {/* Atananlar */}
                      {isEditing ? (
                        <div className="mt-2">
                          <p className="text-[10px] text-gray-400 mb-1.5">Atanan Personel</p>
                          <div className="flex flex-wrap gap-1.5">
                            {personnel.map((p) => {
                              const sel = (editForm.assigneeIds || []).includes(p.id);
                              return (
                                <button
                                  key={p.id}
                                  type="button"
                                  onClick={() => toggleEditAssignee(p.id)}
                                  className={`px-2 py-1 rounded-lg text-[10px] font-medium border transition-colors ${
                                    sel ? "bg-blue-600 text-white border-blue-600" : "bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100"
                                  }`}
                                >
                                  {pName(p)}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      ) : task.assignees.length > 0 && (
                        <div className="flex items-center gap-1 mt-2 flex-wrap">
                          <Users size={11} className="text-gray-400" />
                          {task.assignees.map((a) => (
                            <span key={a.personnelId} className="text-[10px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded-full">
                              {[a.personnel.user.firstName, a.personnel.user.lastName].filter(Boolean).join(" ")}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Sağ: durum + aksiyon */}
                    <div className="flex items-start gap-1.5 flex-shrink-0">
                      <div className={`flex items-center gap-1 text-xs font-medium ${statusCfg.color}`}>
                        {statusCfg.icon}
                        <span className="hidden sm:inline">{statusCfg.label}</span>
                      </div>
                      {isManager && !isEditing && (
                        <button
                          onClick={() => {
                            setEditingTask(task.id);
                            setEditForm({
                              type: task.type,
                              title: task.title,
                              description: task.description || "",
                              address: task.address || "",
                              assigneeIds: task.assignees.map((a) => a.personnelId),
                            });
                          }}
                          className="p-1 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-700"
                        >
                          <Edit3 size={13} />
                        </button>
                      )}
                      {isManager && !isEditing && (
                        <button
                          onClick={() => deleteTask(task.id)}
                          className="p-1 rounded-lg hover:bg-red-50 text-gray-300 hover:text-red-500"
                        >
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Zaman damgaları */}
                  {(task.startedAt || task.arrivedAt || task.completedAt) && (
                    <div className="flex gap-3 mt-2 pl-10 text-[10px] text-gray-400">
                      {task.startedAt    && <span>🚗 {fmtTime(task.startedAt)}</span>}
                      {task.arrivedAt    && <span>📍 {fmtTime(task.arrivedAt)}</span>}
                      {task.completedAt  && <span>✅ {fmtTime(task.completedAt)}</span>}
                    </div>
                  )}

                  {/* Admin düzenleme kaydet/iptal */}
                  {isEditing && (
                    <div className="flex gap-2 mt-3 pl-10">
                      <button
                        onClick={() => saveEditTask(task.id)}
                        disabled={saving}
                        className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-medium disabled:opacity-50"
                      >
                        <Save size={12} />{saving ? "Kaydediliyor..." : "Kaydet"}
                      </button>
                      <button
                        onClick={() => setEditingTask(null)}
                        className="px-3 py-1.5 border border-gray-200 text-gray-600 rounded-lg text-xs"
                      >
                        <X size={12} />
                      </button>
                    </div>
                  )}
                </div>

                {/* ── Teknisyen Aksiyon Butonları ── */}
                {!isEditing && next && !isDone && (
                  <div className="border-t border-gray-100 px-4 py-2.5 bg-gray-50/50">
                    <div className="flex gap-2 items-center">
                      <button
                        onClick={() => updateTaskStatus(task.id, next.status)}
                        className={`flex-1 py-2 rounded-xl text-sm font-semibold transition-colors ${next.classes}`}
                      >
                        {next.label}
                      </button>
                      {isManager && (
                        <button
                          onClick={() => updateTaskStatus(task.id, "CANCELLED")}
                          className="px-3 py-2 border border-gray-200 text-gray-500 rounded-xl text-xs hover:bg-gray-100 transition-colors"
                        >
                          İptal
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── Yeni Görev Modal ── */}
      {showAddTask && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg my-4">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h3 className="font-bold text-gray-900 flex items-center gap-2">
                <Plus size={16} className="text-blue-500" />Yeni Görev Ekle
              </h3>
              <button onClick={() => setShowAddTask(false)} className="p-1.5 rounded-lg hover:bg-gray-100">
                <X size={18} className="text-gray-500" />
              </button>
            </div>
            <div className="px-6 py-5 space-y-4">
              {taskError && (
                <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-2.5 text-sm">
                  {taskError}
                </div>
              )}

              {/* Görev Tipi */}
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1.5">Görev Tipi</label>
                <div className="flex gap-2">
                  {(["FIELD_VISIT", "WORKSHOP", "OTHER"] as PlanTaskType[]).map((t) => {
                    const cfg = TYPE_CONFIG[t];
                    return (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setTaskForm((f) => ({ ...f, type: t }))}
                        className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl border text-xs font-semibold transition-colors ${
                          taskForm.type === t
                            ? `${cfg.classes} border-current`
                            : "border-gray-200 text-gray-500 hover:bg-gray-50"
                        }`}
                      >
                        {cfg.icon}{cfg.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Başlık */}
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">Görev Başlığı *</label>
                <input
                  value={taskForm.title}
                  onChange={(e) => setTaskForm((f) => ({ ...f, title: e.target.value }))}
                  placeholder="Örn: Kazan bakımı, Pompa montajı..."
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
              </div>

              {/* Açıklama */}
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">Yapılacak İşler</label>
                <textarea
                  value={taskForm.description}
                  onChange={(e) => setTaskForm((f) => ({ ...f, description: e.target.value }))}
                  placeholder="Detaylı açıklama, yapılacak işlemler..."
                  rows={3}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 resize-none"
                />
              </div>

              {/* Adres (saha için) */}
              {taskForm.type === "FIELD_VISIT" && (
                <div>
                  <label className="text-xs font-medium text-gray-600 block mb-1">
                    <MapPin size={11} className="inline mr-1" />Adres / Konum
                  </label>
                  <input
                    value={taskForm.address}
                    onChange={(e) => setTaskForm((f) => ({ ...f, address: e.target.value }))}
                    placeholder="Tam adres veya konum bilgisi"
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  />
                </div>
              )}

              {/* Personel Atama */}
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1.5">
                  <User size={11} className="inline mr-1" />Atanan Personel
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {personnel.map((p) => {
                    const sel = taskForm.assigneeIds.includes(p.id);
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => toggleAssignee(p.id)}
                        className={`px-2.5 py-1.5 rounded-xl text-xs font-medium border transition-colors ${
                          sel ? "bg-blue-600 text-white border-blue-600" : "bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100"
                        }`}
                      >
                        {pName(p)}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Not */}
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">Not</label>
                <input
                  value={taskForm.notes}
                  onChange={(e) => setTaskForm((f) => ({ ...f, notes: e.target.value }))}
                  placeholder="Ekstra bilgi..."
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
              </div>
            </div>
            <div className="px-6 pb-5 flex gap-3">
              <button
                onClick={() => setShowAddTask(false)}
                className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50"
              >
                İptal
              </button>
              <button
                onClick={createPlanAndAddTask}
                disabled={saving}
                className="flex-1 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {saving ? "Ekleniyor..." : "Görevi Ekle"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
