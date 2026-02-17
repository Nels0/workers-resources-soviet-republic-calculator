import { Routes, Route, Link, useLocation } from 'react-router-dom'
import BuildingList from './components/BuildingList'
import BuildingDetail from './components/BuildingDetail'
import ProjectView from './components/ProjectView'
import './win95.css'

function App() {
  const location = useLocation()

  return (
    <div className="win95">
      <div className="win95-taskbar">
        <Link to="/" className="win95-start-btn">WRSR Calculator</Link>
        <div className="win95-taskbar-sep" />
        <span className="win95-nav-label">Info:</span>
        <Link
          to="/"
          className={`win95-nav-btn${location.pathname === '/' ? ' active' : ''}`}
        >
          Buildings
        </Link>
        <div className="win95-taskbar-sep" />
        <span className="win95-nav-label">Planning:</span>
        <Link
          to="/projects"
          className={`win95-nav-btn${location.pathname === '/projects' ? ' active' : ''}`}
        >
          Projects
        </Link>
      </div>
      <Routes>
        <Route path="/" element={
          <div style={{ padding: '8px' }}>
            <BuildingList />
          </div>
        } />
        <Route path="/buildings/:id" element={
          <div style={{ padding: '8px', maxWidth: 700 }}>
            <BuildingDetail />
          </div>
        } />
        <Route path="/projects" element={
          <div style={{ padding: '8px' }}>
            <ProjectView />
          </div>
        } />
      </Routes>
    </div>
  )
}

export default App
