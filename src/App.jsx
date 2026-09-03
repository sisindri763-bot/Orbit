import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { ThemeProvider } from './context/ThemeContext';
import './styles/index.css';
import Sidebar from './components/Sidebar';

import Overview from './pages/Overview';
import Pipelines from './pages/Pipelines';
import Integrations from './pages/Integrations';
import ObsOverview from './pages/DataObservability/ObsOverview';
import Freshness from './pages/DataObservability/Freshness';
import Volume from './pages/DataObservability/Volume';
import DataQuality from './pages/DataObservability/DataQuality';
import Schema from './pages/DataObservability/Schema';
import Lineage from './pages/Lineage';
import Incidents from './pages/Incidents';
import Metrics from './pages/Metrics';
import Alerts from './pages/Alerts';
import Logs from './pages/Logs';
import Settings from './pages/Settings';

export default function App() {
  return (
    <ThemeProvider>
      <BrowserRouter>
        <div className="app-layout">
          <Sidebar />
          <main className="main-content">
            <Routes>
              <Route path="/" element={<Overview />} />
              <Route path="/pipelines" element={<Pipelines />} />
              <Route path="/integrations" element={<Integrations />} />
              <Route path="/observability" element={<ObsOverview />} />
              <Route path="/observability/freshness" element={<Freshness />} />
              <Route path="/observability/volume" element={<Volume />} />
              <Route path="/observability/data-quality" element={<DataQuality />} />
              <Route path="/observability/schema" element={<Schema />} />
              <Route path="/data-quality" element={<DataQuality />} />
              <Route path="/lineage" element={<Lineage />} />
              <Route path="/incidents" element={<Incidents />} />
              <Route path="/metrics" element={<Metrics />} />
              <Route path="/alerts" element={<Alerts />} />
              <Route path="/logs" element={<Logs />} />
              <Route path="/settings" element={<Settings />} />
            </Routes>
          </main>
        </div>
      </BrowserRouter>
    </ThemeProvider>
  );
}
