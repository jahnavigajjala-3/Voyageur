import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { MapPin, Trash2, ArrowLeft, Clock } from "lucide-react";
import AppSidebar from "../components/AppSidebar";
import { useRouteContext } from "../context/RouteContext";
import { getLocationDisplayName } from "../services/geocodingService";

export default function RouteHistory() {
  const navigate = useNavigate();
  const { routeHistory, deleteRoute } = useRouteContext();
  const [routeLocationNames, setRouteLocationNames] = useState({});
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);

  useEffect(() => {
    const fetchNames = async () => {
      const newNames = {};
      for (const historyItem of routeHistory) {
        const originKey = `${historyItem.origin.lat},${historyItem.origin.lng}`;
        const destKey = `${historyItem.destination.lat},${historyItem.destination.lng}`;

        if (!routeLocationNames[originKey]) {
          const name = await getLocationDisplayName(historyItem.origin.lat, historyItem.origin.lng);
          if (name) newNames[originKey] = name;
        }

        if (!routeLocationNames[destKey]) {
          const name = await getLocationDisplayName(historyItem.destination.lat, historyItem.destination.lng);
          if (name) newNames[destKey] = name;
        }
      }

      if (Object.keys(newNames).length > 0) {
        setRouteLocationNames(prev => ({ ...prev, ...newNames }));
      }
    };

    if (routeHistory.length > 0) {
      fetchNames();
    }
  }, [routeHistory, routeLocationNames]);

  const formatLocation = (location) => {
    const key = `${location.lat},${location.lng}`;
    return routeLocationNames[key] || `${location.lat.toFixed(4)}, ${location.lng.toFixed(4)}`;
  };

  return (
    <>
      {confirmDeleteId && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 p-4"
          style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0 }}
          onClick={() => setConfirmDeleteId(null)}
        >
          <div
            className="w-full max-w-sm rounded-3xl border p-6 shadow-2xl"
            style={{ 
              borderColor: "rgb(var(--border-primary))",
              background: "rgb(var(--bg-elevated))",
              color: "rgb(var(--text-primary))"
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-lg font-semibold" style={{ color: "rgb(var(--text-primary))" }}>
              Delete route?
            </p>
            <p className="mt-2 text-sm" style={{ color: "rgb(var(--text-secondary))" }}>
              Are you sure you want to remove this saved route? This cannot be undone.
            </p>
            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={() => setConfirmDeleteId(null)}
                className="flex-1 rounded-2xl border py-3 text-sm font-semibold transition-colors"
                style={{ borderColor: "rgb(var(--border-primary))", color: "rgb(var(--text-secondary))" }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  deleteRoute(confirmDeleteId);
                  setConfirmDeleteId(null);
                }}
                className="flex-1 rounded-2xl bg-rose-500 py-3 text-sm font-semibold text-white hover:bg-rose-600 transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
      
      <div className="voyageur-page-bg flex min-h-screen w-full" style={{ color: "rgb(var(--text-primary))" }}>
        <AppSidebar />
        <main className="flex-1 p-6 md:p-8 lg:p-10">
          <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div className="space-y-3">
              <div className="inline-flex items-center gap-2 rounded-full bg-slate-900/70 px-4 py-2 text-sm font-semibold text-cyan-200 shadow-sm" style={{ border: "1px solid rgb(var(--border-primary))" }}>
                <MapPin size={16} />
                Route History
              </div>
              <div>
                <p className="text-3xl font-bold" style={{ color: "rgb(var(--text-primary))" }}>Saved route history</p>
                <p className="max-w-xl text-sm leading-6" style={{ color: "rgb(var(--text-secondary))" }}>
                  Your last planned routes are stored permanently in the browser. Use this page to review every saved route and remove entries you no longer need.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => navigate("/dashboard")}
              className="inline-flex items-center gap-2 rounded-2xl border px-4 py-2 text-sm font-semibold transition-colors"
              style={{
                color: "rgb(var(--text-primary))",
                borderColor: "rgb(var(--border-primary))",
                background: "rgb(var(--bg-secondary) / 0.85)",
              }}
            >
              <ArrowLeft size={16} />
              Back to dashboard
            </button>
          </div>

          <div className="grid gap-5 lg:grid-cols-[1fr]">
            <div className="voyageour-panel rounded-3xl border p-5" style={{ background: "rgb(var(--bg-elevated) / 0.95)", borderColor: "rgb(var(--border-primary))", boxShadow: "0 24px 60px -26px rgb(0 0 0 / 0.45)" }}>
              <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold uppercase tracking-[0.24em]" style={{ color: "rgb(var(--text-secondary))" }}>History stored</p>
                  <p className="mt-1 text-xs" style={{ color: "rgb(var(--text-tertiary))" }}>
                    {routeHistory.length} total planned {routeHistory.length === 1 ? "route" : "routes"}
                  </p>
                </div>
                <div className="inline-flex items-center gap-2 rounded-full bg-cyan-600/10 px-3 py-1.5 text-xs font-semibold text-cyan-200">
                  <Clock size={14} />
                  Preserved across sessions
                </div>
              </div>

              {routeHistory.length === 0 ? (
                <div className="rounded-3xl border border-dashed p-8 text-center" style={{ borderColor: "rgb(var(--border-primary))" }}>
                  <p className="text-base font-semibold" style={{ color: "rgb(var(--text-primary))" }}>No saved routes yet</p>
                  <p className="mt-2 text-sm" style={{ color: "rgb(var(--text-secondary))" }}>
                    Plan a route on the dashboard and it will appear here automatically.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {routeHistory.map((historyItem, index) => (
                    <div
                      key={historyItem.id}
                      onClick={() => navigate("/dashboard", { state: { replayRoute: historyItem } })}
                      className="rounded-3xl border p-4 transition-colors cursor-pointer hover:border-cyan-400"
                      style={{
                        background: "rgb(var(--bg-secondary) / 0.8)",
                        borderColor: "rgb(var(--border-primary))"
                      }}
                    >
                      <div className="flex flex-row items-center justify-between gap-3 mb-4">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold" style={{ color: "rgb(var(--text-primary))" }}>
                            Route {routeHistory.length - index}
                          </p>
                          <p className="mt-1 text-xs" style={{ color: "rgb(var(--text-secondary))" }}>
                            {new Date(historyItem.timestamp).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setConfirmDeleteId(historyItem.id);
                          }}
                          className="flex items-center gap-2 rounded-2xl border px-3 py-2 text-xs font-semibold transition-colors hover:bg-rose-500/10 shrink-0 self-start"
                          style={{
                            borderColor: "rgb(var(--border-primary))",
                            color: "rgb(var(--text-secondary))"
                          }}
                        >
                          <Trash2 size={14} />
                          Delete
                        </button>
                      </div>

                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="rounded-3xl border p-4" style={{ borderColor: "rgb(var(--border-primary))" }}>
                          <p className="text-[11px] uppercase tracking-[0.24em] text-slate-400">Origin</p>
                          <p className="mt-3 text-sm font-semibold" style={{ color: "rgb(var(--text-primary))" }}>{formatLocation(historyItem.origin)}</p>
                        </div>
                        <div className="rounded-3xl border p-4" style={{ borderColor: "rgb(var(--border-primary))" }}>
                          <p className="text-[11px] uppercase tracking-[0.24em] text-slate-400">Destination</p>
                          <p className="mt-3 text-sm font-semibold" style={{ color: "rgb(var(--text-primary))" }}>{formatLocation(historyItem.destination)}</p>
                        </div>
                      </div>

                      {historyItem.routes?.length > 0 && (
                        <div className="mt-4 rounded-3xl bg-slate-950/10 p-4 text-sm" style={{ border: "1px solid rgb(var(--border-primary))" }}>
                          <p className="text-xs uppercase tracking-[0.22em] text-slate-400">Top route</p>
                          <div className="mt-3 flex flex-wrap items-center gap-3 text-sm" style={{ color: "rgb(var(--text-secondary))" }}>
                            <span className="rounded-full bg-emerald-500/10 px-2.5 py-1 font-semibold text-emerald-200">
                              {historyItem.routes[0].type.toUpperCase()}
                            </span>
                            <span>{historyItem.routes[0].safety_score?.toFixed(1) ?? "—"}/10 safety</span>
                            <span>{Math.round(historyItem.routes[0].distance ?? 0)} km</span>
                            <span>{Math.round((historyItem.routes[0].duration ?? 0) / 60)} min</span>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </main>
      </div>
    </>
  );
}
