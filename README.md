# EcoGuard: AI-Powered Biosphere Intelligence

EcoGuard is a next-generation conservation platform designed to monitor, analyze, and protect endangered species and their habitats. By integrating real-time satellite telemetry, global biodiversity data, and advanced AI simulations, EcoGuard provides conservationists with actionable insights into ecosystem health.

## 🌟 Key Features

- **Real-Time Satellite Intel**: Integrates **Sentinel Hub** (NDVI, EVI, NDWI) and **NASA FIRMS** (Thermal Anomalies/Fire) data for granular habitat monitoring.
- **Global Biodiversity Integration**: Anchored to **GBIF** (Global Biodiversity Information Facility) for real-time species occurrence and population tracking.
- **AI-Powered Risk Engine**: Uses **Google Gemini AI** to model ecological constraints and predict extinction risks based on environmental stressors.
- **Intelligence Pulse**: Visualizes 5-year population trends and ongoing ecosystem "pulse" monitoring via automated background telemetry fetching.
- **Interactive Spatial Analytics**: H3-indexed habitat clustering for identifying biodiversity hotspots and critical conservation zones.

## 🛠️ Tech Stack

### Backend
- **Framework**: FastAPI (Python)
- **Database**: SQLite with SQLModel (ORM)
- **Geospatial**: H3, Leaflet-compatible coordination
- **AI**: Google Generative AI (Gemini 1.5 Flash)

### Frontend
- **Framework**: React 18 with Vite
- **Styling**: TailwindCSS 4
- **Maps**: React-Leaflet
- **Charts**: Chart.js

## 🚀 Getting Started

### Prerequisites
- Python 3.10+
- Node.js 18+
- API Keys for:
  - Google Gemini AI (`GOOGLE_API_KEY`)
  - Sentinel Hub (`SENTINEL_CLIENT_ID`, `SENTINEL_CLIENT_SECRET`)
  - NASA FIRMS (`NASA_FIRMS_MAP_KEY`)

### Installation

1. **Clone the repository**:
   ```bash
   git clone https://github.com/aaryasachinvarsolkar/wildsight_1.git
   cd wildsight_1
   ```

2. **Backend Setup**:
   ```bash
   cd backend
   pip install -r requirements.txt
   # Ensure environment variables are set
   python -m uvicorn main:app --port 8000
   ```

3. **Frontend Setup**:
   ```bash
   cd ../frontend
   npm install
   npm run dev
   ```

## 📈 Usage
Navigate to `http://localhost:5173`. Enter the name of an endangered species (e.g., "Bengal Tiger" or "Indian Leopard") and click **SCAN BIOSPHERE**. The system will resolve the species identity, analyze its habitat, and generate a real-time risk assessment.

## 🛡️ Stability Note
The platform includes background threading for telemetry fetching and multi-threaded SQLite access to ensure the UI remains responsive during heavy data processing cycles.


