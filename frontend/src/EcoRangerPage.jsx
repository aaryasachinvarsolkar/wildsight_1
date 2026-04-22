import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { MapContainer, TileLayer, CircleMarker, Popup } from 'react-leaflet';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import {
  ArrowLeft,
  ShieldCheck,
  TriangleAlert,
  Activity,
  Users,
  MapPin,
  BadgeCheck,
} from 'lucide-react';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend);

const STATUS_COLOR = {
  Healthy: '#10b981',
  'At Risk': '#eab308',
  Critical: '#ef4444',
};

function statusClass(status) {
  if (status === 'Critical') return 'text-rose-300 bg-rose-500/20 border-rose-500/40';
  if (status === 'At Risk') return 'text-yellow-300 bg-yellow-500/20 border-yellow-500/40';
  return 'text-emerald-300 bg-emerald-500/20 border-emerald-500/40';
}

export default function EcoRangerPage() {
  const navigate = useNavigate();
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedMarker, setSelectedMarker] = useState(null);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        setLoading(true);
        const res = await axios.get('http://localhost:8000/api/v1/eco-ranger/web/dashboard');
        if (mounted) {
          setDashboard(res.data);
          setError(null);
        }
      } catch (err) {
        if (mounted) {
          setError(err.message || 'Failed to load Eco Ranger dashboard');
        }
      } finally {
        if (mounted) setLoading(false);
      }
    };

    load();
    const intervalId = setInterval(load, 15000);

    return () => {
      mounted = false;
      clearInterval(intervalId);
    };
  }, []);

  const mapMarkers = dashboard?.map_markers || [];
  const speciesLogs = dashboard?.species_logs || [];
  const validations = dashboard?.validations || [];
  const alerts = dashboard?.alerts || [];
  const profiles = dashboard?.ranger_profiles || [];
  const analytics = dashboard?.analytics || {
    total_scans: 0,
    species_monitored: 0,
    model_accuracy_improvement_pct: 0,
    current_accuracy_pct: 0,
    ranger_activity_heatmap: [],
  };

  const center = useMemo(() => {
    if (!mapMarkers.length) return [20.5937, 78.9629];
    return [mapMarkers[0].latitude, mapMarkers[0].longitude];
  }, [mapMarkers]);

  const timelineChart = useMemo(() => {
    const timeline = [...(dashboard?.timeline || [])].slice(-12);
    return {
      labels: timeline.map((item) => new Date(item.timestamp).toLocaleDateString()),
      datasets: [
        {
          label: 'Satellite Risk %',
          data: timeline.map((item) => item.satellite_risk_pct),
          borderColor: '#22d3ee',
          backgroundColor: 'rgba(34, 211, 238, 0.15)',
          tension: 0.4,
        },
        {
          label: 'Ranger Validation Confidence %',
          data: timeline.map((item) => Math.round((item.confidence_score || 0) * 100)),
          borderColor: '#34d399',
          backgroundColor: 'rgba(52, 211, 153, 0.15)',
          tension: 0.35,
        },
      ],
    };
  }, [dashboard]);

  const timelineChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { labels: { color: '#cbd5e1' } },
    },
    scales: {
      x: { ticks: { color: '#94a3b8' }, grid: { color: 'rgba(148, 163, 184, 0.2)' } },
      y: { ticks: { color: '#94a3b8' }, grid: { color: 'rgba(148, 163, 184, 0.2)' } },
    },
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto max-w-[1600px] px-4 md:px-8 py-6 md:py-8 space-y-6">
        <div className="flex items-center justify-between gap-4">
          <button
            onClick={() => navigate('/')}
            className="inline-flex items-center gap-2 rounded-xl bg-slate-900 border border-slate-800 px-4 py-2 text-slate-200 hover:border-emerald-500/60 transition"
          >
            <ArrowLeft size={16} /> Back to WildSight
          </button>
          <div className="inline-flex items-center gap-2 rounded-xl bg-emerald-500/10 border border-emerald-500/30 px-4 py-2 text-emerald-300 font-semibold">
            <ShieldCheck size={16} /> Eco Ranger Live
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
            <div className="text-xs text-slate-400 uppercase tracking-widest">Total Scans</div>
            <div className="mt-2 text-3xl font-black text-white">{analytics.total_scans}</div>
          </div>
          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
            <div className="text-xs text-slate-400 uppercase tracking-widest">Species Monitored</div>
            <div className="mt-2 text-3xl font-black text-white">{analytics.species_monitored}</div>
          </div>
          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
            <div className="text-xs text-slate-400 uppercase tracking-widest">Accuracy Improvement</div>
            <div className="mt-2 text-3xl font-black text-emerald-300">{analytics.model_accuracy_improvement_pct}%</div>
          </div>
          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
            <div className="text-xs text-slate-400 uppercase tracking-widest">Current Accuracy</div>
            <div className="mt-2 text-3xl font-black text-cyan-300">{analytics.current_accuracy_pct}%</div>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          <section className="xl:col-span-2 rounded-3xl border border-slate-800 bg-slate-900 p-4 md:p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-black tracking-tight">Interactive Map View</h2>
              <div className="text-xs text-slate-400">Green: Healthy | Yellow: At Risk | Red: Critical</div>
            </div>
            <div className="h-[420px] overflow-hidden rounded-2xl border border-slate-800">
              <MapContainer center={center} zoom={5} className="h-full w-full">
                <TileLayer
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  attribution="&copy; OpenStreetMap contributors"
                />
                {mapMarkers.map((marker) => (
                  <CircleMarker
                    key={marker.scan_id}
                    center={[marker.latitude, marker.longitude]}
                    radius={10}
                    pathOptions={{
                      color: STATUS_COLOR[marker.health_status] || '#94a3b8',
                      fillColor: STATUS_COLOR[marker.health_status] || '#94a3b8',
                      fillOpacity: 0.85,
                    }}
                    eventHandlers={{ click: () => setSelectedMarker(marker) }}
                  >
                    <Popup>
                      <div className="text-sm font-semibold">{marker.species_common_name}</div>
                      <div className="text-xs text-slate-500">{marker.species_scientific_name}</div>
                      <div className="text-xs mt-1">Status: {marker.health_status}</div>
                    </Popup>
                  </CircleMarker>
                ))}
              </MapContainer>
            </div>
          </section>

          <section className="rounded-3xl border border-slate-800 bg-slate-900 p-4 md:p-6 space-y-4">
            <h2 className="text-xl font-black tracking-tight">Species Detail Panel</h2>
            {selectedMarker ? (
              <div className="space-y-3">
                <div>
                  <div className="text-xs text-slate-400 uppercase tracking-widest">Common Name</div>
                  <div className="text-lg font-bold">{selectedMarker.species_common_name}</div>
                </div>
                <div>
                  <div className="text-xs text-slate-400 uppercase tracking-widest">Scientific Name</div>
                  <div className="text-sm text-cyan-300 italic">{selectedMarker.species_scientific_name}</div>
                </div>
                <div className={`inline-flex rounded-lg border px-3 py-1 text-xs font-semibold ${statusClass(selectedMarker.health_status)}`}>
                  {selectedMarker.health_status}
                </div>
                <div>
                  <div className="text-xs text-slate-400 uppercase tracking-widest">Growth Stage</div>
                  <div className="text-sm">{selectedMarker.growth_stage}</div>
                </div>
                <div>
                  <div className="text-xs text-slate-400 uppercase tracking-widest">Last Scan</div>
                  <div className="text-sm">{new Date(selectedMarker.timestamp).toLocaleString()}</div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {(selectedMarker.image_urls || []).slice(0, 4).map((url, i) => (
                    <img key={`${url}-${i}`} src={url} alt="Ranger upload" className="h-20 w-full rounded-lg object-cover border border-slate-700" />
                  ))}
                </div>
                <div className="text-xs text-slate-300 bg-slate-800/70 border border-slate-700 rounded-lg p-3">
                  {selectedMarker.notes || 'No field notes recorded.'}
                </div>
              </div>
            ) : (
              <div className="text-sm text-slate-400">Select a marker to open species details.</div>
            )}
          </section>
        </div>

        <section className="rounded-3xl border border-slate-800 bg-slate-900 p-4 md:p-6">
          <h2 className="text-xl font-black tracking-tight mb-4">Monitoring Timeline</h2>
          <div className="h-80">
            <Line data={timelineChart} options={timelineChartOptions} />
          </div>
        </section>

        <section className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <div className="rounded-3xl border border-slate-800 bg-slate-900 p-4 md:p-6">
            <h2 className="text-xl font-black tracking-tight mb-4">AI vs Ranger Validation</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-slate-400 border-b border-slate-800">
                    <th className="py-2 pr-3">Satellite Prediction</th>
                    <th className="py-2 pr-3">Ranger Input</th>
                    <th className="py-2 pr-3">Confidence</th>
                  </tr>
                </thead>
                <tbody>
                  {speciesLogs.slice(0, 12).map((row) => (
                    <tr key={row.id} className={`border-b border-slate-800/60 ${row.mismatch ? 'bg-rose-500/10' : ''}`}>
                      <td className="py-2 pr-3">
                        {row.satellite_health} | {row.satellite_ndvi_trend} | {Math.round(row.satellite_risk_pct)}%
                      </td>
                      <td className="py-2 pr-3">{row.ranger_health} {row.ranger_notes ? `- ${row.ranger_notes}` : ''}</td>
                      <td className="py-2 pr-3">{Math.round((row.confidence_score || 0) * 100)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="rounded-3xl border border-slate-800 bg-slate-900 p-4 md:p-6 space-y-4">
            <h2 className="text-xl font-black tracking-tight">Alert System</h2>
            {!alerts.length && <div className="text-sm text-slate-400">No active alerts.</div>}
            {alerts.slice(0, 8).map((alert, index) => (
              <div key={`${alert.species}-${index}`} className="rounded-xl border border-rose-500/40 bg-rose-500/10 p-3">
                <div className="flex items-center gap-2 text-rose-200 font-semibold">
                  <TriangleAlert size={14} /> {alert.species}
                </div>
                <div className="text-xs text-rose-100 mt-1">{alert.message}</div>
              </div>
            ))}
          </div>
        </section>

        <section className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <div className="rounded-3xl border border-slate-800 bg-slate-900 p-4 md:p-6 space-y-3">
            <h2 className="text-xl font-black tracking-tight">Ranger Profiles</h2>
            {profiles.length === 0 && <div className="text-sm text-slate-400">No ranger activity yet.</div>}
            {profiles.slice(0, 12).map((profile) => (
              <div key={profile.ranger_id} className="rounded-xl border border-slate-800 bg-slate-800/70 p-3 flex items-center justify-between">
                <div>
                  <div className="font-semibold text-slate-100">{profile.ranger_name}</div>
                  <div className="text-xs text-slate-400">{profile.ranger_id}</div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-slate-300">Scans: {profile.scans} | Validations: {profile.validations}</div>
                  <div className="mt-1 inline-flex items-center gap-1 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2 py-1 text-[11px] text-emerald-200">
                    <BadgeCheck size={12} /> {profile.badge}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="rounded-3xl border border-slate-800 bg-slate-900 p-4 md:p-6">
            <h2 className="text-xl font-black tracking-tight mb-3">Ranger Activity Heatmap (Points)</h2>
            <div className="space-y-2 max-h-72 overflow-auto pr-1">
              {(analytics.ranger_activity_heatmap || []).slice(0, 30).map((point, idx) => (
                <div key={`${point.lat}-${point.lon}-${idx}`} className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-800/60 p-2 text-sm">
                  <span className="inline-flex items-center gap-2 text-slate-200"><MapPin size={13} /> {point.lat.toFixed(4)}, {point.lon.toFixed(4)}</span>
                  <span className="text-cyan-300">Intensity {point.intensity}</span>
                </div>
              ))}
              {!(analytics.ranger_activity_heatmap || []).length && (
                <div className="text-sm text-slate-400">No location points recorded yet.</div>
              )}
            </div>
          </div>
        </section>

        {loading && <div className="text-sm text-slate-400">Loading Eco Ranger data...</div>}
        {error && <div className="text-sm text-rose-300">{error}</div>}
        {!!validations.length && (
          <div className="text-xs text-slate-500 flex items-center gap-2">
            <Activity size={14} /> Last validation event at {new Date(validations[0].created_at).toLocaleString()}
          </div>
        )}
      </div>
    </div>
  );
}
