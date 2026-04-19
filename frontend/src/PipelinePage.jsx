import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, 
  BrainCircuit, 
  Activity, 
  Maximize2, 
  Layers, 
  Navigation,
  Info,
  Thermometer,
  Wind
} from 'lucide-react';

export default function PipelinePage() {
  const { speciesName } = useParams();
  const navigate = useNavigate();
  const [isSimulating, setIsSimulating] = useState(false);
  const [pipelineData, setPipelineData] = useState({ ndvi: [], gbif: [] });
  const [hoverInfo, setHoverInfo] = useState(null);
  const canvasRef = useRef(null);

  // Theme Constants (Consistent with main dashboard)
  const theme = {
    bg: 'bg-slate-950',
    card: 'bg-slate-900/50 backdrop-blur-xl border border-white/10',
    title: 'text-white font-black',
    accent: 'text-emerald-500',
    btn: 'bg-emerald-600 hover:bg-emerald-500 text-white'
  };

  const startSimulation = () => {
    setIsSimulating(true);
    
    // Generate simulated GBIF points relative to canvas size
    const points = [];
    for (let i = 0; i < 15; i++) {
      points.push({
        x: 10 + Math.random() * 80, // percentage
        y: 10 + Math.random() * 80, // percentage
        id: i,
        timestamp: '2024-04-18',
        reliability: (0.8 + Math.random() * 0.2).toFixed(2)
      });
    }
    setPipelineData(prev => ({ ...prev, gbif: points }));
  };

  const handleMouseMove = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    
    // Simulate NDVI reading based on coordinate (re-using logic or random with clusters)
    const mockNdvi = (0.4 + Math.sin(x/10 + y/10) * 0.3 + Math.random() * 0.05).toFixed(2);
    
    setHoverInfo({ x, y, ndvi: mockNdvi });
  };

  return (
    <div className={`min-h-screen ${theme.bg} text-slate-300 font-sans selection:bg-emerald-500/30`}>
      {/* Background Ambience */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-emerald-600/10 rounded-full blur-[120px]"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-600/10 rounded-full blur-[120px]"></div>
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-6 py-8">
        {/* Navigation */}
        <button 
          onClick={() => navigate('/')}
          className="group mb-8 flex items-center gap-2 text-slate-400 hover:text-white transition-colors"
        >
          <div className="p-2 rounded-xl bg-white/5 border border-white/10 group-hover:bg-emerald-500 group-hover:text-white transition-all">
            <ArrowLeft size={18} />
          </div>
          <span className="font-black text-xs uppercase tracking-[0.2em]">Exit to Dashboard</span>
        </button>

        {/* Header Section */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 mb-12">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-emerald-500/20 text-emerald-500 rounded-lg">
                <BrainCircuit size={20} />
              </div>
              <span className="text-xs font-black uppercase tracking-[0.3em] text-emerald-500">Spectral Pipeline Analysis</span>
            </div>
            <h1 className="text-5xl md:text-7xl font-black text-white tracking-tighter uppercase">
              {speciesName || 'Generic Species'}
            </h1>
            <p className="mt-4 text-lg text-slate-400 max-w-2xl font-medium">
              Superimposition of real-time NDVI vegetation imagery and GBIF biological occurrence data for hyper-local habitat risk assessment.
            </p>
          </div>

          <button 
            onClick={startSimulation}
            disabled={isSimulating}
            className={`px-8 py-4 rounded-2xl flex items-center gap-3 font-black text-sm uppercase tracking-[0.2em] transition-all shadow-xl shadow-emerald-900/20 ${
              isSimulating ? 'bg-slate-800 text-slate-500 cursor-not-allowed' : theme.btn
            }`}
          >
            {isSimulating ? <Activity className="animate-pulse" /> : <Layers size={18} />}
            {isSimulating ? 'SIMULATION ACTIVE' : 'VISUALIZE PIPELINE'}
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Visualizer Area */}
          <div className="lg:col-span-2 relative group overflow-hidden rounded-[2.5rem] border border-white/10 bg-slate-900 shadow-2xl">
            <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent pointer-events-none z-10"></div>
            
            {/* Visualizer Header Controls */}
            <div className="absolute top-6 left-6 right-6 flex justify-between items-center z-20">
              <div className="px-4 py-2 rounded-full bg-slate-900/80 backdrop-blur-md border border-white/10 flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                <span className="text-[10px] font-black uppercase tracking-widest text-white">Live Spectral Feed</span>
              </div>
              <div className="flex gap-2">
                <button className="p-2 rounded-full bg-slate-900/80 backdrop-blur-md border border-white/10 text-white hover:bg-white/10 transition-colors">
                  <Maximize2 size={16} />
                </button>
              </div>
            </div>

            {/* THE NDVI IMAGE (Procedural Canvas) */}
            <div 
              className="relative aspect-video w-full cursor-crosshair overflow-hidden"
              onMouseMove={handleMouseMove}
              onMouseLeave={() => setHoverInfo(null)}
            >
              <img 
                src="/habitat_image.webp" 
                alt="Habitat Spectral Analysis"
                className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                style={{ filter: isSimulating ? 'contrast(1.2) saturate(1.2)' : 'none' }}
              />
              
              {/* Image Overlay Texture (Grain/Grid) */}
              <div className="absolute inset-0 bg-white/[0.02] mix-blend-overlay pointer-events-none"></div>
              
              {/* GBIF Overlay */}
              {isSimulating && (
                <div className="absolute inset-0 z-10">
                  {pipelineData.gbif.map(pt => (
                    <div 
                      key={pt.id}
                      className="absolute group/pt"
                      style={{ left: `${pt.x}%`, top: `${pt.y}%` }}
                    >
                      <div className="relative">
                        <div className="w-4 h-4 -ml-2 -mt-2 bg-rose-500 border-2 border-white rounded-full shadow-[0_0_20px_rgba(244,63,94,0.8)] transition-transform hover:scale-150"></div>
                        <div className="absolute inset-0 w-8 h-8 -ml-4 -mt-4 border-2 border-rose-500 rounded-full animate-ping opacity-20"></div>
                        
                        {/* Tooltip on hover */}
                        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 w-48 opacity-0 group-hover/pt:opacity-100 transition-all pointer-events-none z-30 translate-y-2 group-hover/pt:translate-y-0">
                          <div className="p-3 rounded-2xl bg-slate-900 border border-white/20 shadow-2xl">
                            <div className="text-[10px] font-black text-rose-400 uppercase tracking-widest mb-1">Biological Spotting</div>
                            <div className="text-white text-xs font-bold truncate">{speciesName}</div>
                            <div className="flex justify-between mt-2 text-[10px] text-slate-400">
                              <span>Reliability: {pt.reliability}</span>
                              <span>{pt.timestamp}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Spectral Hover Probe */}
              {hoverInfo && (
                <div 
                  className="absolute pointer-events-none z-20 transform -translate-x-1/2 -translate-y-[120%] flex flex-col items-center"
                  style={{ left: `${hoverInfo.x}%`, top: `${hoverInfo.y}%` }}
                >
                  <div className="px-4 py-2 rounded-xl bg-emerald-600 text-white font-black text-sm shadow-2xl border border-emerald-400/50">
                    NDVI: {hoverInfo.ndvi}
                  </div>
                  <div className="w-px h-12 bg-gradient-to-b from-emerald-500 to-transparent"></div>
                </div>
              )}
            </div>
          </div>

          {/* Right Sidebar - Analytics Card */}
          <div className="space-y-6">
            <div className={`p-8 rounded-[2.5rem] ${theme.card} space-y-8`}>
              <div>
                <h3 className="text-xs font-black uppercase tracking-[0.2em] text-slate-500 mb-6">Spectral Status</h3>
                <div className="flex items-center gap-4">
                  <div className="text-5xl font-black text-white">0.74</div>
                  <div className="px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-500 text-[10px] font-black tracking-widest uppercase border border-emerald-500/20">Optimal Habitat</div>
                </div>
                <div className="mt-4 w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                  <div className="h-full bg-emerald-500 w-[74%]"></div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 rounded-3xl bg-white/5 border border-white/5">
                  <div className="text-emerald-500 mb-2"><Thermometer size={18} /></div>
                  <div className="text-xl font-black text-white">24°C</div>
                  <div className="text-[10px] font-bold text-slate-500 uppercase">Avg Temperature</div>
                </div>
                <div className="p-4 rounded-3xl bg-white/5 border border-white/5">
                  <div className="text-blue-500 mb-2"><Wind size={18} /></div>
                  <div className="text-xl font-black text-white">12.4</div>
                  <div className="text-[10px] font-bold text-slate-500 uppercase">Humidity (Index)</div>
                </div>
              </div>

              <div className="pt-6 border-t border-white/10">
                <div className="flex items-center gap-2 mb-4">
                  <Info size={14} className="text-emerald-500" />
                  <span className="text-[10px] font-black uppercase text-slate-400">Deep Analytics Insight</span>
                </div>
                <p className="text-sm text-slate-300 leading-relaxed italic">
                  "Current NDVI clustering suggests high carbon sequestration potential in the northwestern quadrant, ideal for population corridor expansion."
                </p>
              </div>
            </div>

            <div className="p-8 rounded-[2.5rem] bg-gradient-to-br from-emerald-900/40 to-emerald-950/40 border border-emerald-500/20">
              <h3 className="text-white font-black text-lg mb-2 flex items-center gap-2">
                <Navigation size={18} />
                Next Step
              </h3>
              <p className="text-xs text-emerald-200/60 leading-relaxed mb-6">
                Download the high-resolution spectral report for {speciesName} with coordinate mapping for ground teams.
              </p>
              <button className="w-full py-3 rounded-2xl bg-white text-emerald-950 font-black text-xs uppercase tracking-widest hover:bg-emerald-50 transition-colors shadow-lg shadow-emerald-500/10">
                Export GeoJSON
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
