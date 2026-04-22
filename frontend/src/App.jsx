import React, { useState, useEffect, useRef } from 'react';
import { BrowserRouter, Routes, Route, useNavigate } from 'react-router-dom';
import UserProfile from './UserProfile';
import PipelinePage from './PipelinePage';
import EcoRangerPage from './EcoRangerPage';
import axios from 'axios';
import { MapContainer, TileLayer, Marker, Popup, CircleMarker, Rectangle, Tooltip as LeafletTooltip, useMap } from 'react-leaflet';
import { Line, Bar } from 'react-chartjs-2';
import {
  Search,
  Map as MapIcon,
  Activity,
  Wind,
  Droplets,
  Flame,
  TreeDeciduous,
  Thermometer,
  Lightbulb,
  ArrowRight,
  ShieldCheck,
  AlertTriangle,
  Users,
  Leaf,
  Bird,
  Cat,
  ChevronLeft,
  ChevronRight,
  BrainCircuit,
  MapPin,
  List,
  Navigation,
  User,
  Shield,
  X,
  FileText,
  Download,
  Sun,
  Moon
} from 'lucide-react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';

// Register ChartJS
ChartJS.register(
  CategoryScale, LinearScale, PointElement, LineElement, BarElement, Title, Tooltip, Legend, Filler
);

// --- UTILS ---
const generateTrend = (baseValue, variance, count = 5) => {
  return Array.from({ length: count }, () => {
    const noise = (Math.random() - 0.5) * variance;
    return Number((baseValue + noise).toFixed(2));
  });
};

const QUICK_LINKS = [
  { name: "Bengal Tiger", icon: <Cat size={14} />, type: "Mammal" },
  { name: "Asian Elephant", icon: <Users size={14} />, type: "Mammal" },
  { name: "Syzygium travancoricum", icon: <Leaf size={14} />, type: "Plant" },
  { name: "Great Indian Bustard", icon: <Bird size={14} />, type: "Bird" },
];

function MapUpdater({ center, zoom }) {
  const map = useMap();
  useEffect(() => {
    map.flyTo(center, zoom, { duration: 0.8 });
  }, [center, zoom, map]);
  return null;
}

function Dashboard() {
  const navigate = useNavigate();
  const [speciesName, setSpeciesName] = useState('Indian Tiger');
  const [activeSpecies, setActiveSpecies] = useState(null);
  const [loading, setLoading] = useState(false); // Initial loading should be false for landing
  const [hasSearched, setHasSearched] = useState(false);
  const [error, setError] = useState(null);
  const [selectedZone, setSelectedZone] = useState(null); 
  const [isDark, setIsDark] = useState(() => {
    const saved = localStorage.getItem('wsTheme');
    return saved ? saved === 'dark' : true;
  });

  const [isPipelineVisible, setIsPipelineVisible] = useState(false);
  const [pipelineData, setPipelineData] = useState({ ndvi: [], gbif: [] });


  useEffect(() => {
    localStorage.setItem('wsTheme', isDark ? 'dark' : 'light');
    if (isDark) document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
  }, [isDark]);

  const theme = isDark ? {
    bg: 'bg-slate-950',
    text: 'text-slate-200',
    title: 'text-white',
    muted: 'text-slate-400',
    card: 'bg-slate-900 border-slate-800',
    cardLight: 'bg-slate-800/50 border-slate-700/50',
    header: 'bg-slate-900 border-slate-800',
    nav: 'bg-slate-800 border-slate-700',
    accent: 'emerald',
    map: 'dark_all'
  } : {
    bg: 'bg-slate-50',
    text: 'text-slate-800',
    title: 'text-slate-900',
    muted: 'text-slate-500',
    card: 'bg-white border-slate-200',
    cardLight: 'bg-slate-50 border-slate-200',
    header: 'bg-white border-slate-100',
    nav: 'bg-slate-100 border-slate-200',
    accent: 'emerald',
    map: 'light_all'
  };

  const handleSearch = (e) => {
    e.preventDefault();
    if (speciesName) {
      loadSpecies(speciesName.trim());
    }
  };

  // --- API FETCH ---
  // --- MAIN DATA FETCHING ---
  const loadSpecies = async (paramName, zoneId = null, silent = false) => {
    if (!silent) {
      setLoading(true);
      setActiveSpecies(null);
      setHasSearched(true);
    }
    setError(null);
    if (!zoneId) setSelectedZone(null); 
    try {
      console.log(`Fetching data for: ${paramName}, Zone: ${zoneId || 'National'} (Silent: ${silent})`);

      let url = `http://localhost:8000/api/v1/species/${paramName}`;
      if (zoneId) {
        url += `?zone_id=${zoneId}`;
      }

      const response = await axios.get(url);
      const data = response.data;

      if (!data || !data.species) {
        throw new Error("No species data found in API response.");
      }

      const speciesData = data.species; // flatten structure
      const envData = data.environment_context || {};
      const rootData = data; // Keep full response for occupancy etc.

      // Map Checkpoints
      let checkpoints = speciesData.checkpoints || [];
      if (checkpoints.length === 0) {
        checkpoints = [{ lat: 20, lon: 78, id: 'mock' }];
      }

      // Auto-Center Map
      let center = [20, 78];
      let zoom = 4;

      // If Zone Selected, center on Zone.
      if (zoneId) {
        // Keep current map center or dont override
      } else if (speciesData.checkpoints_region) {
        center = [
          (speciesData.checkpoints_region.lat_min + speciesData.checkpoints_region.lat_max) / 2,
          (speciesData.checkpoints_region.lon_min + speciesData.checkpoints_region.lon_max) / 2
        ];
        zoom = 5;
      }

      // --- DYNAMIC GRAPH DATA GENERATION ---
      const baseTemp = envData.avg_temp || 25;
      const baseRain = envData.avg_rain || 1000;
      const baseNDVI = envData.avg_ndvi || 0.5;
      const baseHDI = envData.hdi || 0.3;

      const uiData = {
        id: paramName,
        name: speciesData.species_name,
        status: speciesData.status || "Unknown",
        population: Array.isArray(speciesData.population_history) ? speciesData.population_history : [],
        years: speciesData.years || ['2020', '2021', '2022', '2023', '2024'],
        years_hist: speciesData.years_history || ['2020', '2021', '2022', '2023', '2024'],
        years_forecast: speciesData.years_forecast || ['2025', '2026', '2027', '2028', '2029'],
        location: { lat: center[0], lon: center[1], zoom: zoom },
        occupancy_probability: rootData.occupancy_probability ?? 0,

        analysis: {
          vegetation: {
            ndvi: speciesData.analysis?.vegetation?.ndvi || [],
            evi: speciesData.analysis?.vegetation?.evi || [],
            ndwi: speciesData.analysis?.vegetation?.ndwi || []
          },
          climate: {
            temp: speciesData.analysis?.climate?.temp || [],
            rain: speciesData.analysis?.climate?.rain || []
          },
          disturbance: {
            frp: speciesData.analysis?.disturbance?.frp || [],
            nightlight: speciesData.analysis?.disturbance?.nightlight || []
          }
        },

        advice: [],
        checkpoints: checkpoints,
        distribution: speciesData.distribution_analysis || { zones: [], total_estimated_individuals: 0 },
        sensitivities: speciesData.sensitivities || {},
        pulse_history: speciesData.pulse_history || []
      };

      // Calculate Latest Count for UI Display
      let latestCount = 0;
      if (uiData.pulse_history && uiData.pulse_history.length > 0) {
        latestCount = uiData.pulse_history[0].count;
      } else if (uiData.population && uiData.population.length > 0) {
        latestCount = uiData.population[uiData.population.length - 1].count;
      }
      uiData.latestCount = latestCount;

      setActiveSpecies(uiData);
      setSpeciesName(speciesData.species_name);
      
      // Auto-hide pipeline on species change
      setIsPipelineVisible(false);

    } catch (err) {
      console.error("API Fetch Error Detail:", err);
      if (err.response) {
        console.error("Payload:", err.response.data);
      }
      setError(err.message);
      setActiveSpecies(null);
    } finally {
      setLoading(false);
    }
  };

  // --- CHART OPTIONS ---
  const commonOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { 
      legend: { display: false },
      tooltip: {
        backgroundColor: isDark ? '#0f172a' : '#ffffff',
        titleColor: '#10b981',
        bodyColor: isDark ? '#94a3b8' : '#64748b',
        borderColor: isDark ? '#1e293b' : '#e2e8f0',
        borderWidth: 1,
        padding: 10,
        cornerRadius: 8,
        displayColors: false
      }
    },
    scales: {
      x: { 
        grid: { display: false }, 
        ticks: { color: isDark ? '#64748b' : '#94a3b8', font: { size: 10 } } 
      },
      y: { 
        grid: { color: isDark ? '#1e293b' : '#f1f5f9' }, 
        ticks: { color: isDark ? '#64748b' : '#94a3b8', font: { size: 10 } } 
      }
    }
  };

  const [analysisResult, setAnalysisResult] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [aiReport, setAiReport] = useState('');
  const [downloading, setDownloading] = useState(false);
  const [emailing, setEmailing] = useState(false);

  const runZoneAnalysis = async (zoneArg = null) => {
    // If called from onClick directly, zoneArg might be an event object.
    const isEvent = zoneArg && zoneArg.nativeEvent;
    const zone = (!isEvent && zoneArg?.id) ? zoneArg : (selectedZone || (activeSpecies?.distribution?.zones?.length > 0 ? activeSpecies.distribution.zones[0] : null));

    if (!zone) {
      console.warn("No zone selected for analysis. Performing global summary.");
    }

    const speciesToLoad = activeSpecies?.name || speciesName || 'Tiger';

    if (zone) {
      console.log(`Analyzing Zone: ${zone.name} (${zone.id})`);
      setSelectedZone(zone);
      // 1. SILENT RELOAD to FORCE chart update for this zone
      // Setting silent=true updates data without full loading spinner
      await loadSpecies(speciesToLoad, zone.id, true);
    }

    // 2. ML ANALYSIS & LLM REPORT (Parallel)
    setAnalyzing(true);
    setAnalysisResult(null); // Clear previous ML results immediately
    setAiReport(''); // Clear previous LLM report
    try {
      const h3Index = zone ? zone.id : "global_summary";
      const name = speciesToLoad;
      const countForAnalysis = zone ? (zone.sighting_count * 5) : (activeSpecies?.latestCount || 1000);

      console.log(`Running ML Analysis for ${name} at Zone ${h3Index}`);

      // 1. Fetch Prescriptions (Fast)
      const prescRes = await axios.get(`http://localhost:8000/api/v1/analytics/prescriptions/${h3Index}?species=${name}&count=${countForAnalysis}`);
      setAnalysisResult(prescRes.data);
      setShowModal(true); // Open modal immediately with ML results
      setAnalyzing(false); // Stop loading state for the main button

      // 2. Fetch LLM Report in Background (Pass Zone ID)
      try {
        let reportUrl = `http://localhost:8000/api/v1/analytics/report/${name}`;
        if (zone) {
          reportUrl += `?zone_id=${zone.id}`;
        }
        const reportRes = await axios.get(reportUrl);
        setAiReport(reportRes.data.report);
        // Merge structured data and status into analysis result for the modal
        setAnalysisResult(prev => ({
          ...prev,
          status: reportRes.data.status,
          color: reportRes.data.color,
          factors: reportRes.data.factors,
          structured_data: reportRes.data.structured_data
        }));

        // Auto-send email if all profile fields are filled
        try {
          const saved = localStorage.getItem('wildsight_user_profile');
          const profile = saved ? JSON.parse(saved) : {};
          const allFilled = profile.name && profile.email && profile.contact && profile.organizationName && profile.region;
          if (allFilled) {
            await axios.post(
              `http://localhost:8000/api/v1/analytics/report/email/${encodeURIComponent(name)}`,
              {
                report_text: reportRes.data.report,
                status_info: { status: reportRes.data.status, color: reportRes.data.color },
                recipient_email: profile.email,
                recipient_name: profile.name
              }
            );
            console.log(`Report auto-sent to ${profile.email}`);
          }
        } catch (emailErr) {
          console.error("Auto-email failed:", emailErr);
        }
      } catch (e) {
        console.error("LLM Report Background Error:", e);
        setAiReport("## Analysis Service Delayed\nThe AI engine is currently under high load. Please try refreshing.");
      }
    } catch (e) {
      console.error("Analysis Engine Error:", e);
      setError("Failed to generate comprehensive analysis. Please check API connectivity.");
    } finally {
      setAnalyzing(false);
    }
  };

  const handleDownloadPDF = async () => {
    if (!aiReport || !activeSpecies) return;
    setDownloading(true);
    try {
      console.log(`Initiating PDF Download for: ${activeSpecies.name}`);
      // Use encodeURIComponent to handle spaces/special chars in species names
      const encodedName = encodeURIComponent(activeSpecies.name);
      const response = await axios.post(
        `http://localhost:8000/api/v1/analytics/report/download/${encodeURIComponent(activeSpecies.name)}`,
        { 
          report_text: aiReport,
          status_info: { 
            status: analysisResult.status, 
            color: analysisResult.color 
          }
        },
        { 
          responseType: 'blob',
          headers: { 'Accept': 'application/pdf' }
        }
      );

      // Create blob with explicit type
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      
      // Clean filename
      const safeFileName = activeSpecies.name.replace(/\s+/g, '_');
      link.setAttribute('download', `WildSight_Report_${safeFileName}.pdf`);
      
      document.body.appendChild(link);
      link.click();
      
      // Cleanup
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      console.log("PDF Download Successful");
    } catch (e) {
      console.error("Critical Download Error:", e);
      const errorMsg = e.response?.data?.detail || e.message || "Unknown Error";
      alert(`Failed to download PDF report: ${errorMsg}`);
    } finally {
      setDownloading(false);
    }
  };

  const handleEmailReport = async () => {
    if (!aiReport || !activeSpecies) return;
    const saved = localStorage.getItem('wildsight_user_profile');
    const profile = saved ? JSON.parse(saved) : {};
    const { name, email, contact, organizationName, region } = profile;
    if (!name || !email || !contact || !organizationName || !region) {
      alert('Please fill in all profile fields (Name, Email, Contact, Organization, Region) before sending the report.');
      return;
    }
    setEmailing(true);
    try {
      await axios.post(
        `http://localhost:8000/api/v1/analytics/report/email/${encodeURIComponent(activeSpecies.name)}`,
        {
          report_text: aiReport,
          status_info: { status: analysisResult?.status, color: analysisResult?.color },
          recipient_email: email,
          recipient_name: name
        }
      );
      alert(`Report sent to ${email}`);
    } catch (e) {
      const msg = e.response?.data?.detail || e.message || 'Unknown error';
      alert(`Failed to send email: ${msg}`);
    } finally {
      setEmailing(false);
    }
  };

  const simulatePipeline = () => {
    if (!activeSpecies) return;
    
    setIsPipelineVisible(true);
    const { lat, lon } = activeSpecies.location;
    
    // Simulate NDVI Grid (10x10 squares around center)
    const gridSize = 10;
    const step = 0.005; // ~500m per step
    const ndviGrid = [];
    
    // Base NDVI from environment data or default
    const baseNdvi = activeSpecies.analysis?.vegetation?.ndvi[0] || 0.6;
    
    for (let i = -gridSize/2; i < gridSize/2; i++) {
      for (let j = -gridSize/2; j < gridSize/2; j++) {
        const cellLat = lat + i * step;
        const cellLon = lon + j * step;
        // Add random variance based on species status (endangered = sparser/lower)
        const variance = (Math.random() - 0.5) * 0.4;
        const statusModifier = activeSpecies.status.includes('Endangered') ? -0.2 : 0.1;
        const value = Math.max(0.1, Math.min(0.9, baseNdvi + variance + statusModifier));
        
        ndviGrid.push({
          bounds: [
            [cellLat, cellLon],
            [cellLat + step, cellLon + step]
          ],
          value: value.toFixed(2)
        });
      }
    }
    
    // Simulate GBIF Spotting (Scatter points)
    const gbifPoints = [];
    const pointCount = activeSpecies.status.includes('Endangered') ? 5 : 15;
    for (let k = 0; k < pointCount; k++) {
      gbifPoints.push({
        lat: lat + (Math.random() - 0.5) * step * gridSize,
        lon: lon + (Math.random() - 0.5) * step * gridSize,
        name: activeSpecies.name,
        timestamp: new Date(Date.now() - Math.random() * 86400000 * 30).toLocaleDateString()
      });
    }
    
    setPipelineData({ ndvi: ndviGrid, gbif: gbifPoints });
  };


  useEffect(() => {
    // We don't load anything automatically anymore to allow the landing page to show
  }, []);

  // --- CAROUSEL LOGIC ---
  const [slideIndex, setSlideIndex] = useState(0);
  const nextSlide = () => setSlideIndex((prev) => (prev + 1) % 4);
  const prevSlide = () => setSlideIndex((prev) => (prev - 1 + 4) % 4);

  // --- LOADING STAGE LOGIC ---
  const [loadingStage, setLoadingStage] = useState(0);
  useEffect(() => {
    if (loading) {
      const interval = setInterval(() => {
        setLoadingStage(prev => (prev < 4 ? prev + 1 : prev));
      }, 800);
      return () => clearInterval(interval);
    } else {
      setLoadingStage(0);
    }
  }, [loading]);

  const loadingMessages = [
    "INITIALIZING NEURAL GRID...",
    "CONNECTING TO SENTINEL-2 SATELLITE NETWORK...",
    "EXTRACTING MULTISPECTRAL VEGETATION INDICES...",
    "ANALYZING CLUSTER DYNAMICS...",
    "WildSight Synchronized"
  ];

  if (loading) {
    return (
      <div className={`min-h-screen ${isDark ? 'bg-slate-950 text-white' : 'bg-slate-50 text-slate-900'} flex flex-col items-center justify-center p-6 relative overflow-hidden transition-colors duration-300`}>
        {/* Background Effects */}
        <div className={`absolute inset-0 ${isDark ? 'bg-[radial-gradient(circle_at_50%_40%,rgba(16,185,129,0.1),transparent_50%)]' : 'bg-[radial-gradient(circle_at_50%_40%,rgba(16,185,129,0.05),transparent_50%)]'}`}></div>
        <div className="absolute top-0 left-0 w-full h-full bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-5"></div>
        
        <div className="z-10 flex flex-col items-center text-center max-w-md w-full">
          {/* Scanning Animation */}
          <div className="relative mb-12">
            <div className={`w-28 h-28 rounded-full border-4 ${loadingStage === 4 ? 'border-emerald-500 bg-emerald-500/20 shadow-[0_0_50px_-10px_rgba(16,185,129,0.5)]' : 'border-emerald-500/20'} flex items-center justify-center transition-all duration-1000`}>
              {loadingStage === 4 ? (
                <ShieldCheck size={56} className="text-emerald-400 animate-in zoom-in duration-500" />
              ) : (
                <div className="relative w-full h-full flex items-center justify-center">
                  <div className="absolute inset-0 border-4 border-emerald-400 border-t-transparent rounded-full animate-spin"></div>
                  <BrainCircuit size={48} className="text-emerald-400 animate-pulse" />
                </div>
              )}
            </div>
            {/* Outer Pulsing Rings */}
            <div className="absolute -inset-4 border border-emerald-500/10 rounded-full animate-[ping_3s_linear_infinite]"></div>
            <div className="absolute -inset-8 border border-emerald-500/5 rounded-full animate-[ping_4s_linear_infinite]"></div>
          </div>

          <h2 className={`text-4xl font-black ${isDark ? 'text-white' : 'text-slate-900'} mb-8 tracking-tighter`}>
            {loadingStage === 4 ? "WildSight Synchronized" : "Scanning Biosphere..."}
          </h2>

          <div className={`px-8 py-4 ${isDark ? 'bg-black/60 border-slate-800' : 'bg-white border-slate-200 shadow-xl'} border rounded-2xl mb-12 min-w-[340px] backdrop-blur-sm`}>
            <p className={`text-[10px] font-black tracking-[0.3em] transition-all duration-700 ${loadingStage === 4 ? 'text-emerald-400' : theme.muted}`}>
              {loadingStage === 4 ? "EVERYTHING UP TO DATE (SYNCHRONIZED WITH 5-DAY SATELLITE CYCLE)" : loadingMessages[loadingStage]}
            </p>
          </div>

          {/* Stepper Progress Bar */}
          <div className="flex gap-3 w-full max-w-[200px]">
            {[0, 1, 2, 3, 4].map((step) => (
              <div 
                key={step}
                className={`h-1.5 flex-1 rounded-full transition-all duration-700 ${step <= loadingStage ? 'bg-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.8)]' : 'bg-slate-800'}`}
              ></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`min-h-screen ${isDark ? 'bg-slate-950 text-white' : 'bg-slate-50 text-slate-900'} flex flex-col items-center justify-center p-6 relative overflow-hidden transition-colors duration-300`}>
        <div className={`absolute inset-0 ${isDark ? 'bg-red-500/5' : 'bg-red-500/10'} blur-[120px]`}></div>
        <div className={`${isDark ? 'bg-slate-900/80 border-slate-800' : 'bg-white border-slate-200'} p-10 rounded-[2.5rem] shadow-2xl max-w-lg text-center border backdrop-blur-md relative z-10`}>
          <div className="w-24 h-24 bg-red-500/10 rounded-3xl flex items-center justify-center mx-auto mb-8 border border-red-500/20 rotate-3">
            <Search size={48} className="text-red-400 -rotate-3" />
          </div>
          <h2 className={`text-3xl font-black ${isDark ? 'text-white' : 'text-slate-900'} mb-3`}>Target Not Found</h2>
          <p className={`${isDark ? 'text-slate-400' : 'text-slate-600'} mb-10 text-lg leading-relaxed`}>{error}</p>
          <div className="flex gap-4">
            <button onClick={() => window.location.reload()} className={`flex-1 px-8 py-4 ${isDark ? 'bg-slate-800 border-slate-700 text-white hover:bg-slate-700' : 'bg-slate-100 border-slate-200 text-slate-600 hover:bg-white'} rounded-2xl font-bold transition-all border`}>
              Reset System
            </button>
            <button onClick={() => { setError(null); setSpeciesName('Tiger'); loadSpecies('Tiger'); }} className="flex-1 px-8 py-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl font-black transition-all shadow-lg shadow-emerald-500/20">
              Retry National Scan
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!hasSearched) {
    return (
      <div className={`min-h-screen ${isDark ? 'bg-slate-950 text-white' : 'bg-slate-50 text-slate-900'} flex flex-col items-center justify-center p-6 relative overflow-hidden transition-colors duration-300`}>
        {/* Theme Toggle for Landing */}
        <div className="absolute top-8 right-8 z-50">
          <button
            onClick={() => setIsDark(!isDark)}
            className={`p-4 rounded-3xl border shadow-2xl transition-all ${isDark ? 'bg-slate-900 border-slate-800 text-yellow-400 hover:bg-slate-800' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}
          >
            {isDark ? <Sun size={24} /> : <Moon size={24} />}
          </button>
        </div>

        {/* Animated Background */}
        <div className={`absolute inset-0 ${isDark ? 'bg-[radial-gradient(circle_at_50%_50%,rgba(16,185,129,0.1),transparent_50%)]' : 'bg-[radial-gradient(circle_at_50%_50%,rgba(16,185,129,0.05),transparent_50%)]'}`}></div>
        <div className="absolute top-y-0 left-0 w-full h-full bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-10"></div>
        
        <div className="z-10 text-center max-w-4xl w-full">
           <div className="flex items-center justify-center gap-4 mb-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
             <div className="p-4 bg-gradient-to-tr from-emerald-500 to-teal-400 rounded-3xl shadow-2xl shadow-emerald-500/20">
               <MapIcon size={48} className="text-white" />
             </div>
             <div className="text-left">
               <h1 className={`text-6xl font-black ${isDark ? 'text-white' : 'text-slate-950'} tracking-tighter leading-none`}>WILD<span className="text-emerald-400">SIGHT</span></h1>
               <p className="text-sm text-emerald-400 font-black uppercase tracking-[0.4em] mt-1 ml-1">Indian Intelligence Core</p>
             </div>
           </div>

           <h2 className={`text-2xl ${isDark ? 'text-slate-400' : 'text-slate-600'} mb-12 font-medium max-w-2xl mx-auto leading-relaxed animate-in fade-in slide-in-from-bottom-6 duration-1000 delay-200`}>
             Uncover local biodiversity trends, habitat risks, and AI-driven conservation strategies across the Indian subcontinent.
           </h2>

           <form onSubmit={handleSearch} className="relative max-w-2xl mx-auto group animate-in fade-in slide-in-from-bottom-8 duration-1000 delay-500 shadow-2xl rounded-3xl">
              <div className="absolute -inset-1 bg-gradient-to-r from-emerald-500 to-teal-500 rounded-3xl blur opacity-25 group-focus-within:opacity-50 transition duration-1000"></div>
              <div className={`relative ${isDark ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'} border rounded-3xl overflow-hidden flex items-center p-2`}>
                <Search className="ml-4 text-slate-500 group-focus-within:text-emerald-400 transition-colors" size={28} />
                <input
                  type="text"
                  value={speciesName}
                  onChange={(e) => setSpeciesName(e.target.value)}
                  placeholder="Enter Species Name (e.g. Bengal Tiger)..."
                  className={`flex-1 bg-transparent border-none py-4 px-4 text-xl ${isDark ? 'text-white' : 'text-slate-950'} focus:outline-none placeholder:text-slate-400`}
                />
                <button type="submit" className="bg-emerald-600 hover:bg-emerald-500 text-white font-black px-8 py-4 rounded-2xl transition-all flex items-center gap-2 group/btn shadow-xl shadow-emerald-500/20">
                  SCAN BIOSPHERE
                  <ArrowRight size={20} className="group-hover/btn:translate-x-1 transition-transform" />
                </button>
              </div>
           </form>

           <div className={`mt-16 flex flex-wrap justify-center gap-4 animate-in fade-in slide-in-from-bottom-10 duration-1000 delay-700 ${theme.muted}`}>
             <div className="w-full text-[10px] font-black uppercase tracking-[0.3em] mb-4 opacity-40">Intelligence Hotspots</div>
             {QUICK_LINKS.map(link => (
                <button 
                  key={link.name}
                  onClick={() => loadSpecies(link.name)}
                  className={`px-6 py-3 ${isDark ? 'bg-slate-900/50 border-slate-800' : 'bg-white border-slate-200 shadow-sm'} hover:bg-slate-800 border hover:border-emerald-500/50 rounded-2xl text-sm font-bold transition-all flex items-center gap-3 ${isDark ? 'text-slate-400' : 'text-slate-600'} hover:text-white`}
                >
                  <span className="text-emerald-500">{link.icon}</span>
                  {link.name}
                </button>
             ))}
           </div>
        </div>
      </div>
    );
  }

  if (!activeSpecies) return null;

  const slides = [
    {
      title: "Monitoring Log (5-Day Pulse)",
      icon: <Activity size={24} className="text-purple-400" />,
      bg: "bg-purple-500/10",
      subtitle: selectedZone ? `LOCATION SENSOR FEED: ${selectedZone.name}` : "NATIONAL TELEMETRY CLUSTER",
      chart: (
        <Line data={{
          labels: activeSpecies.pulse_history ? activeSpecies.pulse_history.map(p => p.date).reverse() : [],
          datasets: [
            {
              label: 'Estimated Count',
              data: activeSpecies.pulse_history ? activeSpecies.pulse_history.map(p => p.count).reverse() : [],
              borderColor: '#c084fc',
              backgroundColor: '#c084fc',
              borderWidth: 3,
              tension: 0.4,
              pointRadius: 4,
              yAxisID: 'y'
            },
            {
              label: 'Risk Score (ML)',
              data: activeSpecies.pulse_history ? activeSpecies.pulse_history.map(p => p.risk).reverse() : [],
              borderColor: '#f43f5e',
              backgroundColor: '#f43f5e',
              borderWidth: 2,
              borderDash: [5, 5],
              tension: 0.1,
              pointRadius: 3,
              yAxisID: 'y1'
            }
          ]
        }} options={{
          ...commonOptions,
          scales: {
            ...commonOptions.scales,
            y: { ...commonOptions.scales.y, position: 'left', title: { display: true, text: 'Pop. Count', color: '#94a3b8', font: { weight: 'bold' } } },
            y1: { display: true, position: 'right', grid: { display: false }, title: { display: true, text: 'Risk Index', color: '#94a3b8', font: { weight: 'bold' } }, min: 0, max: 1 }
          }
        }} />
      )
    },
    {
      title: "Vegetation & Moisture",
      icon: <TreeDeciduous size={24} className="text-emerald-400" />,
      bg: "bg-emerald-500/10",
      subtitle: selectedZone ? `LOCAL SPECTRAL FEED: ${selectedZone.name}` : "NATIONAL SPECTRAL BANDS",
      chart: (
        <Line data={{
          labels: activeSpecies.years_hist,
          datasets: [
            {
              label: 'NDVI (Greenness)',
              data: activeSpecies.analysis.vegetation.ndvi,
              borderColor: '#10b981',
              backgroundColor: '#10b981',
              tension: 0.4,
              fill: false
            },
            {
              label: 'NDWI (Water)',
              data: activeSpecies.analysis.vegetation.ndwi,
              borderColor: '#0284c7',
              backgroundColor: '#0284c7',
              borderDash: [5, 5],
              tension: 0.4,
              fill: false
            }
          ]
        }} options={commonOptions} />
      )
    },
    {
      title: "Climate Resilience",
      icon: <Thermometer size={24} className="text-blue-400" />,
      bg: "bg-blue-500/10",
      subtitle: selectedZone ? `LOCAL METEOROLOGY: ${selectedZone.name}` : "NATIONAL CLIMATE TREND",
      chart: (
        <Line data={{
          labels: activeSpecies.years_hist,
          datasets: [
            {
              label: 'Temp (°C)',
              data: activeSpecies.analysis.climate.temp,
              borderColor: '#f43f5e',
              backgroundColor: '#f43f5e',
              yAxisID: 'y',
              tension: 0.4
            },
            {
              label: 'Rain (mm)',
              data: activeSpecies.analysis.climate.rain,
              borderColor: '#38bdf8',
              backgroundColor: '#38bdf8',
              yAxisID: 'y1',
              tension: 0.4
            }
          ]
        }} options={{
          ...commonOptions,
          scales: {
            ...commonOptions.scales,
            y: { ...commonOptions.scales.y, position: 'left', title: { display: true, text: 'Temp', color: '#94a3b8' } },
            y1: { display: true, position: 'right', grid: { display: false }, title: { display: true, text: 'Rain', color: '#94a3b8' } }
          }
        }} />
      )
    },
    {
      title: "Disturbance Factors",
      icon: <Flame size={24} className="text-orange-400" />,
      bg: "bg-orange-500/10",
      subtitle: selectedZone ? `LOCAL DISTURBANCE: ${selectedZone.name}` : "NATIONAL ANTHROPOGENIC IMPACT",
      chart: (
        <Bar data={{
          labels: activeSpecies.years_hist,
          datasets: [
            {
              label: 'Fire Power (FRP)',
              data: activeSpecies.analysis.disturbance.frp,
              backgroundColor: '#f97316',
              borderRadius: 4,
              barPercentage: 0.5
            },
            {
              label: 'Night Lights',
              data: activeSpecies.analysis.disturbance.nightlight,
              backgroundColor: '#6366f1',
              borderRadius: 4,
              barPercentage: 0.5
            }
          ]
        }} options={commonOptions} />
      )
    }
  ];

  return (
    <div className={`min-h-screen ${isDark ? 'bg-slate-950 text-slate-200' : 'bg-white text-slate-800'} font-sans pb-10 relative transition-colors duration-300`}>

      {/* COMPREHENSIVE AI REPORT MODAL */}
      {showModal && analysisResult && (
        <div className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-xl flex items-center justify-center p-0 md:p-6 transition-all duration-500">
          <div className="bg-white text-slate-900 w-full max-w-5xl h-full md:h-[95vh] md:rounded-[2.5rem] shadow-[0_40px_100px_rgba(0,0,0,0.2)] flex flex-col overflow-hidden border border-slate-200 relative">
            
            {/* Modal Header */}
            <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-slate-50 sticky top-0 z-20">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-emerald-100 rounded-2xl border border-emerald-200">
                  <BrainCircuit className="text-emerald-600" size={32} />
                </div>
                <div>
                  <h3 className="text-2xl font-black tracking-tight text-slate-900">ECOLOGICAL AUDIT</h3>
                  <p className="text-[10px] text-slate-500 font-black uppercase tracking-[0.4em]">WildSight AI Prediction Engine v3.0</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <button
                  onClick={handleDownloadPDF}
                  disabled={downloading || !aiReport}
                  className="flex items-center gap-3 px-6 py-3 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-200 text-white rounded-2xl text-sm font-black transition-all shadow-xl shadow-emerald-500/10"
                >
                  {downloading ? (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <Download size={18} />
                  )}
                  DOWNLOAD AUDIT
                </button>
                <button
                  onClick={handleEmailReport}
                  disabled={emailing || !aiReport}
                  className="flex items-center gap-3 px-6 py-3 bg-slate-700 hover:bg-slate-600 disabled:bg-slate-200 text-white rounded-2xl text-sm font-black transition-all shadow-xl"
                >
                  {emailing ? (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <FileText size={18} />
                  )}
                  EMAIL REPORT
                </button>
                <button onClick={() => setShowModal(false)} className="p-3 hover:bg-slate-100 rounded-2xl transition-colors border border-slate-200"><X size={24} className="text-slate-600" /></button>
              </div>
            </div>

            {/* Scrollable Report Content */}
            <div className="flex-1 overflow-y-auto p-10 space-y-12 no-scrollbar scroll-smooth bg-white">
              
            {/* SECTION 1: COVER SECTION */}
              <div className={`relative p-10 ${isDark ? 'bg-slate-900/50 border-slate-800' : 'bg-slate-50 border-slate-200'} rounded-[2rem] border overflow-hidden group transition-colors`}>
                <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/5 rounded-full blur-[80px] -mr-20 -mt-20"></div>
                <div className="relative z-10 grid md:grid-cols-2 gap-10 items-center">
                  <div>
                    <h1 className={`text-6xl font-black tracking-tighter mb-4 leading-none ${theme.title}`}>{activeSpecies.name}</h1>
                    <div className={`flex items-center gap-4 ${theme.muted} font-bold uppercase tracking-widest text-xs mb-8`}>
                      <MapPin size={16} className="text-emerald-600" />
                      {analysisResult.structured_data?.location || "India"}
                    </div>
                    
                    <div className="flex gap-10">
                      <div>
                        <p className={`text-[10px] font-black uppercase tracking-widest ${theme.muted} mb-2`}>Confidence</p>
                        <div className={`text-2xl font-black ${theme.title}`}>95<span className="text-emerald-600">%</span></div>
                      </div>
                      <div>
                        <p className={`text-[10px] font-black uppercase tracking-widest ${theme.muted} mb-2`}>Audit Timestamp</p>
                        <div className={`text-sm font-black ${theme.muted} mt-2`}>{new Date().toLocaleDateString()}</div>
                      </div>
                    </div>
                  </div>
                  
                  <div className={`${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'} p-8 rounded-3xl border shadow-sm transition-colors`}>
                    <p className={`text-[10px] font-black uppercase tracking-widest ${theme.muted} mb-4`}>Input Telemetry</p>
                    <div className="grid grid-cols-2 gap-6">
                      <div className="flex items-center gap-3">
                        <Thermometer size={16} className="text-red-500" />
                        <span className={`text-sm font-bold ${theme.text}`}>{analysisResult.structured_data?.temperature_avg}°C</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <Droplets size={16} className="text-blue-500" />
                        <span className={`text-sm font-bold ${theme.text}`}>Monsoon: {analysisResult.structured_data?.monsoon_intensity}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <Leaf size={16} className="text-emerald-500" />
                        <span className={`text-sm font-bold ${theme.text}`}>NDVI: {analysisResult.structured_data?.ndvi_index}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <Activity size={16} className="text-purple-500" />
                        <span className={`text-sm font-bold ${theme.text}`}>HDI: {analysisResult.structured_data?.hdi}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* REPORT BODY RENDERER (Markdown sections 2, 3, 5, 6, 7, 8) */}
              <div className="max-w-4xl mx-auto space-y-12">
                {aiReport ? (
                  aiReport.split(/\d+\.\s+\*\*[A-Z ]+\*\*/g).map((sectionContent, idx) => {
                    const sectionTitleMatch = aiReport.match(new RegExp(`${idx}\\.\\s+\\*\\*([A-Z ]+)\\*\\*`));
                    const sectionTitle = sectionTitleMatch ? sectionTitleMatch[1] : `Section ${idx}`;
                    
                    if (idx === 0) return null; 
                    if (idx === 1 || idx === 4) return null; 

                    return (
                      <section key={idx} className="animate-in fade-in slide-in-from-bottom-5 duration-700">
                        <div className="flex items-center gap-4 mb-6">
                           <div className="h-0.5 flex-1 bg-slate-100"></div>
                           <h4 className="text-xs font-black uppercase tracking-[0.4em] text-emerald-600">{sectionTitle}</h4>
                           <div className="h-0.5 flex-1 bg-slate-100"></div>
                        </div>
                        
                        <div className="prose prose-slate max-w-none text-slate-700">
                          {sectionContent.split('\n').map((line, lidx) => {
                            const cleanLine = line.trim();
                            if (!cleanLine) return null;
                            if (cleanLine.startsWith('|')) return null;

                            return (
                              <p key={lidx} className="mb-4 text-lg leading-relaxed font-medium">
                                {cleanLine.split(/(\*\*.*?\*\*)/g).map((part, pi) =>
                                  part.startsWith('**') ? <strong key={pi} className="text-slate-900 font-black">{part.slice(2, -2)}</strong> : part
                                )}
                              </p>
                            );
                          })}

                          {/* Render Priority Table in Section 7 */}
                          {sectionTitle.includes("ACTION PRIORITY") && (
                            <div className="mt-8 overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 shadow-sm">
                              <table className="w-full text-left border-collapse">
                                <thead className="bg-slate-100 text-[10px] font-black uppercase tracking-widest text-slate-600">
                                  <tr>
                                    <th className="p-4 border-b border-slate-200">Factor</th>
                                    <th className="p-4 border-b border-slate-200">Severity</th>
                                    <th className="p-4 border-b border-slate-200">Priority</th>
                                  </tr>
                                </thead>
                                <tbody className="text-sm font-bold text-slate-800">
                                  {sectionContent.split('\n').filter(l => l.includes('|') && !l.includes('---')).slice(1).map((row, ridx) => {
                                    const cells = row.split('|').filter(c => c.trim());
                                    if (cells.length < 3) return null;
                                    return (
                                      <tr key={ridx} className="border-b border-slate-100 hover:bg-white transition-colors">
                                        <td className="p-4 text-slate-900">{cells[0].trim()}</td>
                                        <td className="p-4"><span className={`px-3 py-1 rounded-full text-[10px] ${cells[1].includes('High') || cells[1].includes('Critical') ? 'bg-red-50 text-red-600' : 'bg-orange-50 text-orange-600'}`}>{cells[1].trim()}</span></td>
                                        <td className="p-4 text-emerald-600">{cells[2].trim()}</td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                          )}
                        </div>
                      </section>
                    );
                  })
                ) : (
                  <div className="flex flex-col items-center py-20">
                    <div className="w-12 h-12 border-4 border-emerald-100 border-t-emerald-600 rounded-full animate-spin mb-6" />
                    <p className="text-lg font-black text-emerald-600 animate-pulse tracking-widest uppercase">Initializing Analytical Core...</p>
                  </div>
                )}

                {/* VISUAL ANALYTICS COMPONENT (Custom Section 4) */}
                {aiReport && (
                  <section className="bg-slate-50 p-10 rounded-[2rem] border border-slate-200">
                    <div className="flex items-center gap-4 mb-10">
                       <div className="h-0.5 flex-1 bg-slate-200"></div>
                       <h4 className="text-xs font-black uppercase tracking-[0.4em] text-emerald-600">VISUAL ANALYTICS</h4>
                       <div className="h-0.5 flex-1 bg-slate-200"></div>
                    </div>
                    
                    <div className="grid md:grid-cols-2 gap-8">
                      <div className="p-6 bg-white rounded-3xl border border-slate-200 h-64 flex flex-col items-center justify-center text-center shadow-sm">
                        <Activity className="text-emerald-300 mb-4" size={48} />
                        <h5 className="font-black text-slate-800 mb-2">Habitat Stress Heatmap</h5>
                        <p className="text-[10px] text-slate-400 uppercase tracking-widest">NDVI Density Gradients</p>
                      </div>
                      <div className="p-6 bg-white rounded-3xl border border-slate-200 h-64 flex flex-col items-center justify-center text-center shadow-sm">
                        <Navigation className="text-blue-300 mb-4" size={48} />
                        <h5 className="font-black text-slate-800 mb-2">Fragmentation Vectors</h5>
                        <p className="text-[10px] text-slate-400 uppercase tracking-widest">Anthropogenic Border Detection</p>
                      </div>
                    </div>
                  </section>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-10 bg-slate-50 border-t border-slate-100 text-center relative overflow-hidden">
               <div className="absolute inset-0 opacity-20 pointer-events-none">
                 <div className="h-full w-full bg-[radial-gradient(circle,#e2e8f0_1px,transparent_1px)] bg-[size:20px_20px]"></div>
               </div>
               <p className="text-[10px] font-black uppercase tracking-[0.6em] text-slate-400 mb-2">WILD SIGHT INTELLIGENCE CORE</p>
               <p className="text-[9px] text-slate-400 max-w-xl mx-auto font-medium">This report is 100% generated by AI using satellite telemetry and is for advisory purposes only. (c) 2026 Republic of India.</p>
            </div>
          </div>
        </div>
      )}

      {/* HEADER */}
      <header className={`${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'} text-white shadow-2xl sticky top-0 z-50 overflow-hidden border-b transition-colors duration-300`}>
        <div className="max-w-[1600px] mx-auto px-6 py-4">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-4 group cursor-pointer" onClick={() => loadSpecies('Tiger')}>
              <div className="p-3 bg-gradient-to-tr from-emerald-500 to-teal-400 rounded-2xl shadow-lg shadow-emerald-500/20 group-hover:rotate-3 transition-transform">
                <MapIcon size={32} className="text-white" />
              </div>
              <div>
                <h1 className={`text-3xl font-black ${isDark ? 'text-white' : 'text-slate-900'} tracking-tight leading-none`}>WILD<span className="text-emerald-400">SIGHT</span> <span className="text-xs align-top bg-emerald-100/10 text-emerald-400 px-2 py-1 rounded-md ml-1 tracking-widest font-black uppercase">India</span></h1>
                <p className={`text-[10px] ${isDark ? 'text-emerald-200/60' : 'text-emerald-600/60'} uppercase tracking-[0.3em] font-black`}>National Intelligence Core</p>
              </div>
            </div>

            <div className="flex-1 max-w-2xl w-full">
              <form onSubmit={handleSearch} className="relative group">
                <input
                  type="text"
                  value={speciesName}
                  onChange={(e) => setSpeciesName(e.target.value)}
                  placeholder="Search Indian Species..."
                  className={`w-full ${isDark ? 'bg-slate-800/80 border-slate-700/50 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'} border-2 rounded-2xl py-4 pl-14 pr-32 text-lg focus:outline-none focus:border-emerald-500/50 transition-all placeholder:text-slate-500`}
                />
                <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-emerald-400 transition-colors" size={24} />
                <button type="submit" className="absolute right-3 top-1/2 -translate-y-1/2 px-6 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-black rounded-xl text-sm transition-all shadow-md">
                  SCAN
                </button>
              </form>
            </div>

            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate('/eco-ranger')}
                className={`px-4 py-3 rounded-2xl border transition-all inline-flex items-center gap-2 font-bold ${isDark ? 'bg-slate-800 border-slate-700 text-emerald-300 hover:bg-slate-700' : 'bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100'}`}
              >
                <Shield size={18} />
                <span className="text-xs uppercase tracking-wider">Eco Ranger</span>
              </button>
              <button
                onClick={() => setIsDark(!isDark)}
                className={`p-3 rounded-2xl border transition-all ${isDark ? 'bg-slate-800 border-slate-700 text-yellow-400 hover:bg-slate-700' : 'bg-slate-100 border-slate-200 text-slate-600 hover:bg-white'}`}
                title="Toggle Theme"
              >
                {isDark ? <Sun size={24} /> : <Moon size={24} />}
              </button>
              <button
                onClick={() => navigate('/profile')}
                className={`p-3 rounded-2xl border transition-all ${isDark ? 'bg-slate-800 border-slate-700 text-slate-400 hover:text-emerald-400' : 'bg-slate-100 border-slate-200 text-slate-400 hover:text-emerald-600'}`}
              >
                <User size={24} />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* SPECIES NAVIGATION BAR - SCALED UP */}
      <nav className={`${theme.nav} text-slate-400 border-b overflow-hidden shadow-inner flex flex-col transition-colors duration-300`}>
        <div className="max-w-[1600px] mx-auto flex items-center gap-2 overflow-x-auto no-scrollbar py-4 px-6 w-full">
          <div className={`flex-none pr-4 border-r ${isDark ? 'border-slate-700' : 'border-slate-200'} mr-2`}>
            <span className={`text-[10px] font-black uppercase tracking-widest ${theme.muted}`}>Fast Reach</span>
          </div>
          {QUICK_LINKS.map(link => (
            <button
              key={link.name}
              onClick={() => loadSpecies(link.name)}
              className={`flex-none flex items-center gap-3 px-6 py-3 rounded-2xl border-2 transition-all font-bold group ${activeSpecies?.name === link.name
                ? 'bg-emerald-500 border-emerald-400 text-white shadow-lg shadow-emerald-500/20 scale-105'
                : `${isDark ? 'bg-slate-900/50 border-slate-700' : 'bg-white border-slate-200'} ${theme.muted} hover:border-emerald-500/50 hover:${theme.title}`
                }`}
            >
              <div className={`p-1.5 rounded-lg ${activeSpecies?.name === link.name ? 'bg-white/20' : `${isDark ? 'bg-slate-800' : 'bg-slate-100'} text-emerald-500`}`}>
                {link.icon}
              </div>
              <span className="text-base">{link.name}</span>
            </button>
          ))}

          <div className={`flex-none px-4 opacity-20 ${isDark ? 'text-slate-500' : 'text-slate-300'}`}>|</div>

          {['Lion', 'Leopard', 'Snow Leopard', 'Rhino', 'Gharial'].map(s => (
            <button
              key={s}
              onClick={() => loadSpecies(s)}
              className={`flex-none px-6 py-3 border rounded-2xl text-sm font-bold transition-all whitespace-nowrap hover:border-emerald-500/50 ${isDark ? 'bg-slate-900/30 border-slate-700/50 text-slate-500 hover:text-white' : 'bg-white border-slate-200 text-slate-400 hover:text-slate-900'}`}
            >
              {s}
            </button>
          ))}
        </div>
      </nav>

      <main className="max-w-7xl mx-auto p-4 md:p-6 space-y-8">

        {/* TOP ROW: MAP & STATUS */}
        <section className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[600px]">
          {/* LEFT: MAP */}
          <div className={`${theme.card} rounded-[2.5rem] shadow-2xl overflow-hidden relative group transition-colors duration-300 lg:col-span-2`}>
            {/* Map Overlay Info */}
            <div className="absolute top-6 left-6 z-[400]">
              <div className={`${isDark ? 'bg-slate-900/90 border-slate-700/50' : 'bg-white/90 border-slate-200'} backdrop-blur-md p-6 rounded-3xl shadow-2xl border`}>
                <div className="flex items-center gap-3 mb-1">
                  <span className="relative flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                  </span>
                  <span className={`text-[10px] font-black ${theme.muted} uppercase tracking-[0.2em]`}>Real-time Node Status</span>
                </div>
                <div className={`text-2xl font-black ${theme.title}`}>
                  {activeSpecies.checkpoints.length} <span className="text-xs text-emerald-500 uppercase tracking-widest ml-1">Nodes Active</span>
                </div>
                
                <button 
                  onClick={() => isPipelineVisible ? setIsPipelineVisible(false) : simulatePipeline()}
                  className={`mt-4 w-full py-3 px-4 rounded-2xl flex items-center justify-center gap-2 font-black text-xs uppercase tracking-[0.2em] transition-all shadow-lg ${
                    isPipelineVisible 
                    ? 'bg-rose-500 text-white shadow-rose-500/20' 
                    : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-500/20'
                  }`}
                >
                  <BrainCircuit size={16} />
                  {isPipelineVisible ? 'HIDE PIPELINE' : 'VISUALIZE PIPELINE'}
                </button>
              </div>
            </div>


            <MapContainer center={[activeSpecies.location.lat, activeSpecies.location.lon]} zoom={activeSpecies.location.zoom} style={{ height: '100%', width: '100%', background: isDark ? '#020617' : '#f8fafc' }} zoomControl={false}>
              <TileLayer
                url={`https://{s}.basemaps.cartocdn.com/rastertiles/${theme.map}/{z}/{x}/{y}{r}.png`}
                attribution='&copy; CARTO'
              />
              <MapUpdater center={[activeSpecies.location.lat, activeSpecies.location.lon]} zoom={activeSpecies.location.zoom} />

              {/* RENDER CLUSTERS */}
              {activeSpecies.distribution?.zones.map((zone, i) => (
                <CircleMarker
                  key={i}
                  center={[zone.lat, zone.lon]}
                  radius={Math.min(zone.estimated_count * 2, 35)}
                  pathOptions={{
                    color: activeSpecies.checkpoints_region ? "#10b981" : "#f59e0b",
                    fillColor: activeSpecies.checkpoints_region ? "#10b981" : "#f59e0b",
                    fillOpacity: 0.6
                  }}
                  eventHandlers={{
                    click: () => {
                      console.log(`Zone Clicked: ${zone.name} (${zone.id})`);
                      setSelectedZone(zone);
                      // Trigger SILENT reload for the specific zone to get local analytics/graphs
                      loadSpecies(activeSpecies.name, zone.id, true);
                    }
                  }}
                >
                  <Popup>
                    <div className="text-center p-2 font-sans bg-slate-900 text-white rounded-lg">
                      <strong className="text-emerald-400 text-lg">{zone.name}</strong><br />
                      <span className="text-xs text-slate-400 font-bold uppercase tracking-widest block mt-1">Pop. Seg: {zone.estimated_count}</span>
                      <button onClick={() => runZoneAnalysis(zone)} className="mt-3 w-full py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all">ANALYZE HABITAT</button>
                    </div>
                  </Popup>
                </CircleMarker>
              ))}

              {/* RENDER INDIVIDUAL POINTS (Ghosted if Clusters exist) */}
              {activeSpecies.checkpoints.map((pt, i) => (
                <Marker key={i} position={[pt.lat, pt.lon]} opacity={activeSpecies.distribution?.zones.length > 0 ? 0.4 : 1.0}>
                  <Popup>
                    <div className="text-center p-1">
                      <strong className="text-emerald-700">{activeSpecies.name}</strong><br />
                      <span className="text-xs text-slate-500">{pt.lat.toFixed(2)}, {pt.lon.toFixed(2)}</span>
                    </div>
                  </Popup>
                </Marker>
              ))}

              {/* PIPELINE VISUALIZATION LAYER */}
              {isPipelineVisible && (
                <>
                  {/* NDVI Grid */}
                  {pipelineData.ndvi.map((cell, idx) => (
                    <Rectangle
                      key={`ndvi-${idx}`}
                      bounds={cell.bounds}
                      pathOptions={{
                        fillColor: cell.value > 0.7 ? '#14532d' : cell.value > 0.5 ? '#16a34a' : cell.value > 0.3 ? '#84cc16' : '#92400e',
                        fillOpacity: 0.6,
                        weight: 1,
                        color: 'white',
                        opacity: 0.1
                      }}
                    >
                      <LeafletTooltip permanent={false} direction="center" className="ndvi-tooltip">
                        <div className="p-2 bg-slate-900 text-white rounded-lg shadow-xl border border-slate-700">
                          <div className="text-[10px] font-black uppercase tracking-widest text-emerald-400 mb-1">Spectral Reading</div>
                          <div className="text-xl font-black">NDVI: {cell.value}</div>
                        </div>
                      </LeafletTooltip>
                    </Rectangle>
                  ))}

                  {/* GBIF Spotting */}
                  {pipelineData.gbif.map((pt, idx) => (
                    <CircleMarker
                      key={`gbif-${idx}`}
                      center={[pt.lat, pt.lon]}
                      radius={12}
                      pathOptions={{
                        fillColor: '#f43f5e',
                        fillOpacity: 0.8,
                        color: 'white',
                        weight: 2,
                        dashArray: '5, 5'
                      }}
                    >
                      <LeafletTooltip direction="top" className="gbif-tooltip">
                        <div className="p-3 bg-slate-900 text-white rounded-2xl shadow-2xl border border-rose-500/30">
                          <div className="flex items-center gap-2 mb-2">
                            <div className="w-2 h-2 rounded-full bg-rose-500 animate-pulse"></div>
                            <span className="text-[10px] font-black uppercase tracking-widest text-rose-400">GBIF OCCURRENCE</span>
                          </div>
                          <div className="text-sm font-black text-white">{pt.name}</div>
                          <div className="text-[9px] text-slate-400 font-bold mt-1 uppercase tracking-tight">Verified: {pt.timestamp}</div>
                          <div className="text-[9px] text-slate-500 font-mono mt-0.5">{pt.lat.toFixed(4)}, {pt.lon.toFixed(4)}</div>
                        </div>
                      </LeafletTooltip>
                    </CircleMarker>
                  ))}
                </>
              )}
            </MapContainer>

          </div>

          {/* RIGHT: SPECIES CARD */}
          <div className={`${theme.card} p-0 rounded-[2.5rem] shadow-2xl flex flex-col overflow-hidden relative transition-colors duration-300`}>
            {/* Decorative accent */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-full blur-3xl -mr-10 -mt-10"></div>
            
            <div className="p-8 pb-0 relative z-10">
              <div className="flex justify-between items-start mb-6">
                <span className={`inline-flex px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-[0.2em] ${activeSpecies.status.includes('Endangered') || activeSpecies.status.includes('Threatened')
                  ? 'bg-red-500/10 text-red-500 border border-red-500/20'
                  : 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'
                  }`}>
                  {activeSpecies.status}
                </span>
                <button 
                  onClick={() => navigate(`/pipeline/${activeSpecies.name}`)}
                  title="Deep Pipeline Analysis"
                  className={`p-2 ${isDark ? 'bg-slate-800 text-slate-500' : 'bg-slate-100 text-slate-400'} rounded-xl hover:text-emerald-500 hover:bg-emerald-500/10 transition-all`}
                >
                  <BrainCircuit size={18} />
                </button>
                <button className={`p-2 ${isDark ? 'bg-slate-800 text-slate-500' : 'bg-slate-100 text-slate-400'} rounded-xl hover:text-emerald-500 transition-all`}><Activity size={18} /></button>
              </div>
              <h2 className={`text-5xl font-black ${theme.title} leading-none mb-2 tracking-tighter`}>{activeSpecies.name}</h2>


              <div className="flex items-baseline gap-2 mt-4 mb-2">
                <span className="text-5xl font-black text-emerald-400 tracking-tighter drop-shadow-[0_0_10px_rgba(16,185,129,0.3)]">
                  {activeSpecies.estimated_population > 0
                    ? activeSpecies.estimated_population.toLocaleString()
                    : (activeSpecies.distribution?.total_estimated_individuals?.toLocaleString() || "Unknown")}
                </span>
                <span className="text-[10px] text-slate-500 font-black uppercase tracking-[0.2em]">National Census</span>
              </div>
              <div className="flex items-center gap-3 mt-3">
                <span className={`text-[10px] font-black flex items-center gap-1 ${activeSpecies.pulse_direction === 'up' ? 'text-emerald-400' : (activeSpecies.pulse_direction === 'down' ? 'text-red-400' : 'text-slate-500')}`}>
                  {activeSpecies.pulse_direction === 'up' && <ChevronRight className="-rotate-90" size={10} />}
                  {activeSpecies.pulse_direction === 'down' && <ChevronRight className="rotate-90" size={10} />}
                  <span className="font-mono tracking-tighter">
                    {activeSpecies.pulse_delta !== 0
                      ? `${activeSpecies.pulse_delta > 0 ? '+' : ''}${activeSpecies.pulse_delta} 5D CHANGE`
                      : 'CORE STABLE'}
                  </span>
                </span>
                <div className="h-1 w-1 rounded-full bg-slate-800"></div>
                <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest leading-none">Intelligence Pulse</p>
              </div>
            </div>

            <div className="flex-1 w-full h-full min-h-[180px] px-2">
              <Line data={{
                labels: activeSpecies.years,
                datasets: [{
                  label: 'Population',
                  data: activeSpecies.population.length > 0 ? activeSpecies.population.map(p => p.count) : [0, 0, 0, 0, 0],
                  borderColor: '#10b981',
                  backgroundColor: (context) => {
                    const ctx = context.chart.ctx;
                    const gradient = ctx.createLinearGradient(0, 0, 0, 200);
                    gradient.addColorStop(0, 'rgba(16, 185, 129, 0.2)');
                    gradient.addColorStop(1, 'rgba(16, 185, 129, 0)');
                    return gradient;
                  },
                  fill: true,
                  tension: 0.4,
                  pointRadius: 4,
                  pointBackgroundColor: '#fff',
                  pointBorderColor: '#10b981',
                  pointBorderWidth: 2
                }]
              }} options={commonOptions} />
            </div>
            <div className={`${isDark ? 'bg-slate-800/30 border-slate-800/50' : 'bg-slate-50 border-slate-100'} p-6 border-t flex-1 overflow-y-auto max-h-[300px]`}>
              <h4 className={`text-[10px] font-black ${theme.muted} uppercase tracking-widest mb-4 flex items-center gap-2`}><MapPin size={12} className="text-emerald-500" /> Critical Habitats</h4>
              <ul className="space-y-3">
                {activeSpecies.distribution?.zones.slice(0, 5).map(zone => (
                  <li key={zone.id}
                    onClick={() => {
                      setSelectedZone(zone);
                      loadSpecies(activeSpecies.name, zone.id, true);
                    }}
                    className={`flex justify-between items-center p-3 rounded-2xl cursor-pointer transition-all ${selectedZone?.id === zone.id ? 'bg-emerald-500/10 border border-emerald-500/30 shadow-[0_0_15px_-5px_rgba(16,185,129,0.3)]' : `bg-opacity-50 border ${isDark ? 'bg-slate-950 border-slate-800 hover:border-slate-700' : 'bg-white border-slate-200 hover:border-emerald-200'}`}`}>
                    <div>
                      <div className={`text-sm font-black ${theme.title}`}>{zone.name}</div>
                      <div className={`text-[9px] ${theme.muted} font-mono mt-0.5`}>{zone.lat}, {zone.lon}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-black text-emerald-400 leading-none">{zone.estimated_count}</div>
                      <div className="text-[8px] text-slate-500 font-black uppercase tracking-tighter">EST. POP</div>
                    </div>
                  </li>
                ))}
                {activeSpecies.distribution?.zones.length === 0 && <li className="text-xs text-slate-500 italic px-2">No active clusters detected in current sweep.</li>}
              </ul>
            </div>
          </div>
        </section>

        <section className="animate-in fade-in slide-in-from-bottom-10 duration-1000">
          <div className="flex justify-between items-end mb-6 px-2">
            <div>
              <h3 className={`text-3xl font-black ${theme.title} flex items-center gap-3`}>
                <Activity size={28} className="text-emerald-500" />
                Regional Analytics
              </h3>
              <p className={`text-[10px] ${theme.muted} font-black uppercase tracking-[0.3em] ml-11`}>Satellite & Sensor Integration</p>
            </div>
            <div className="flex gap-3">
              <button onClick={prevSlide} className={`p-4 ${theme.card} rounded-3xl hover:bg-emerald-500/10 ${theme.muted} hover:text-emerald-500 transition-all shadow-xl`}><ChevronLeft size={24} /></button>
              <button onClick={nextSlide} className={`p-4 ${theme.card} rounded-3xl hover:bg-emerald-500/10 ${theme.muted} hover:text-emerald-500 transition-all shadow-xl`}><ChevronRight size={24} /></button>
            </div>
          </div>

          <div className={`relative overflow-hidden h-[400px] ${theme.card} rounded-[3rem] shadow-2xl transition-colors duration-300`}>
            <div className="absolute inset-0 flex transition-transform duration-700 cubic-bezier(0.4, 0, 0.2, 1)" style={{ transform: `translateX(-${slideIndex * 100}%)` }}>
              {slides.map((slide, i) => (
                <div key={i} className="min-w-full h-full p-12 flex flex-col">
                  <div className="flex justify-between items-start mb-8">
                    <div className="flex items-center gap-6">
                      <div className={`p-5 rounded-3xl ${isDark ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-200'} border text-emerald-500 shadow-xl transition-colors`}>{slide.icon}</div>
                      <div>
                        <h4 className={`text-3xl font-black ${theme.title} flex items-center gap-4 tracking-tighter`}>
                          {slide.title}
                          {selectedZone && (
                            <span className={`text-[10px] ${isDark ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-emerald-50 text-emerald-600 border-emerald-200'} px-3 py-1 rounded-full border uppercase tracking-widest`}>
                              {selectedZone.name}
                            </span>
                          )}
                        </h4>
                        <p className={`text-[10px] font-black ${theme.muted} uppercase tracking-[0.3em] mt-1`}>{slide.subtitle}</p>
                      </div>
                    </div>
                  </div>
                  <div className="flex-1 w-full mt-8 opacity-80 hover:opacity-100 transition-opacity">
                    {slide.chart}
                  </div>
                </div>
              ))}
            </div>

            {/* DOTS */}
            <div className="absolute bottom-6 left-0 right-0 flex justify-center gap-3">
              {slides.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setSlideIndex(i)}
                  className={`h-1.5 rounded-full transition-all duration-500 ${i === slideIndex ? 'bg-emerald-500 w-10' : 'bg-slate-800 w-4'}`}
                />
              ))}
            </div>
          </div>
        </section>

        {/* BOTTOM ROW: EXPLAINABLE AI */}
        <section className="bg-slate-900 rounded-3xl p-8 md:p-10 text-white relative overflow-hidden shadow-2xl">
          <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-emerald-600/20 rounded-full blur-[120px] pointer-events-none"></div>

          <div className="relative z-10 grid lg:grid-cols-12 gap-10 items-center">
            <div className="lg:col-span-8">
              <div className="inline-flex items-center gap-3 px-4 py-1.5 bg-emerald-500/10 border border-emerald-500/20 rounded-full mb-6">
                <BrainCircuit size={16} className="text-emerald-400" />
                <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-100">Explainable AI Core</span>
              </div>
              <h2 className="text-4xl font-serif leading-tight mb-4 text-white">Generate ML-Driven Strategy</h2>
              <p className="text-slate-400 leading-relaxed text-lg max-w-2xl">
                Activate the EcoGuard Neural Engine to process satellite telemetry and historical intervention data. Our Random Forest model will predict the optimal conservation strategy for <span className="text-emerald-400 font-bold">{activeSpecies.name}</span>.
              </p>
            </div>

            <div className="lg:col-span-4 flex justify-end">
              <button
                onClick={runZoneAnalysis}
                disabled={analyzing}
                className="group relative bg-white text-slate-900 px-8 py-4 rounded-2xl font-bold text-lg w-full md:w-auto hover:bg-emerald-50 transition-all shadow-[0_0_40px_-10px_rgba(16,185,129,0.5)] flex items-center justify-center gap-3 overflow-hidden"
              >
                {analyzing ? (
                  <>
                    <div className="w-5 h-5 border-2 border-slate-900/30 border-t-slate-900 rounded-full animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    Run Analysis <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
                  </>
                )}
              </button>
            </div>
          </div>
        </section>

      </main>
    </div >
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/profile" element={<UserProfile />} />
        <Route path="/pipeline/:speciesName" element={<PipelinePage />} />
        <Route path="/eco-ranger" element={<EcoRangerPage />} />
      </Routes>
    </BrowserRouter>
  );
}
