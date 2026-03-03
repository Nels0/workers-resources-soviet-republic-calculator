import { useState, useEffect, useRef, useCallback } from 'react'
import { Routes, Route, Link, useLocation } from 'react-router-dom'
import BuildingList from './components/BuildingList'
import BuildingDetail from './components/BuildingDetail'
import BuildingInfoWindow from './components/BuildingInfoWindow'
import ProjectView from './components/ProjectView'
import CountrySelector from './components/CountrySelector'
import ResourcePrices from './components/ResourcePrices'
import { fetchCountries, createCountryAPI, deleteCountryAPI, updateCountryAPI, fetchCountryPrices, updateCountryPricesAPI } from './api'
import './win95.css'

function App() {
  const location = useLocation()
  const [countries, setCountries] = useState([])
  const [selectedCountryId, setSelectedCountryId] = useState(null)
  const [countryPrices, setCountryPrices] = useState({})
  const [showPricesPanel, setShowPricesPanel] = useState(false)
  const [showCountryCreateDialog, setShowCountryCreateDialog] = useState(false)
  const [showCountryDeleteDialog, setShowCountryDeleteDialog] = useState(false)
  const [newCountryName, setNewCountryName] = useState('')
  const [countryError, setCountryError] = useState(null)
  const [openBuildingId, setOpenBuildingId] = useState(null)
  const [panelHeight, setPanelHeight] = useState(500)
  const [panelPos, setPanelPos] = useState(() => ({
    x: window.innerWidth - 560,
    y: 36,
  }))
  const [panelDragging, setPanelDragging] = useState(false)
  const panelDraggingRef = useRef(false)
  const panelDragOffset = useRef({ x: 0, y: 0 })
  const panelResizing = useRef(false)
  const panelResizeStart = useRef({ y: 0, h: 0 })
  const newCountryInputRef = useRef(null)

  // Load countries on mount — inline to avoid react-hooks/set-state-in-effect
  useEffect(() => {
    fetchCountries()
      .then(data => {
        setCountries(data)
        if (data.length > 0) setSelectedCountryId(data[0].id)
      })
      .catch(() => {})
  }, [])

  // Load country prices when selected country changes
  useEffect(() => {
    if (!selectedCountryId) return
    fetchCountryPrices(selectedCountryId)
      .then(setCountryPrices)
      .catch(() => {})
  }, [selectedCountryId])

  useEffect(() => {
    if (showCountryCreateDialog && newCountryInputRef.current) {
      newCountryInputRef.current.focus()
    }
  }, [showCountryCreateDialog])

  useEffect(() => {
    function onMove(e) {
      if (panelDraggingRef.current) {
        setPanelPos({
          x: Math.max(0, e.clientX - panelDragOffset.current.x),
          y: Math.max(0, e.clientY - panelDragOffset.current.y),
        })
      }
      if (panelResizing.current) {
        const delta = e.clientY - panelResizeStart.current.y
        setPanelHeight(Math.max(100, panelResizeStart.current.h + delta))
      }
    }
    function onUp() {
      if (panelDraggingRef.current) { panelDraggingRef.current = false; setPanelDragging(false) }
      panelResizing.current = false
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
    return () => {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
    }
  }, [])

  const handlePanelTitlebarMouseDown = useCallback((e) => {
    panelDraggingRef.current = true
    setPanelDragging(true)
    panelDragOffset.current = { x: e.clientX - panelPos.x, y: e.clientY - panelPos.y }
    e.preventDefault()
  }, [panelPos])

  const handlePanelResizeMouseDown = useCallback((e) => {
    panelResizing.current = true
    panelResizeStart.current = { y: e.clientY, h: panelHeight }
    e.preventDefault()
  }, [panelHeight])

  async function refreshCountries() {
    const data = await fetchCountries()
    setCountries(data)
    return data
  }

  async function handleCreateCountrySubmit() {
    const name = newCountryName.trim()
    if (!name) return
    setShowCountryCreateDialog(false)
    try {
      const c = await createCountryAPI(name)
      await refreshCountries()
      setSelectedCountryId(c.id)
      setCountryError(null)
    } catch (err) {
      setCountryError(err.message)
    }
  }

  async function handleDeleteCountryConfirm() {
    setShowCountryDeleteDialog(false)
    if (!selectedCountryId) return
    try {
      await deleteCountryAPI(selectedCountryId)
      const updated = await refreshCountries()
      setSelectedCountryId(updated.length > 0 ? updated[0].id : null)
      setCountryError(null)
    } catch (err) {
      setCountryError(err.message)
    }
  }

  async function handleRenameCountry(id, name) {
    try {
      await updateCountryAPI(id, name)
      await refreshCountries()
    } catch (err) {
      setCountryError(err.message)
    }
  }

  async function handleUpdateCountryPrices(prices) {
    if (!selectedCountryId) return
    try {
      const updated = await updateCountryPricesAPI(selectedCountryId, prices)
      setCountryPrices(updated)
    } catch (err) {
      setCountryError(err.message)
    }
  }

  const selectedCountry = countries.find(c => c.id === selectedCountryId) || null
  // When no country is selected, show empty prices (avoids stale data)
  const effectivePrices = selectedCountryId ? countryPrices : {}

  function renderCountryCreateDialog() {
    if (!showCountryCreateDialog) return null
    return (
      <div className="win95-dialog-overlay" onClick={() => setShowCountryCreateDialog(false)}>
        <div className="win95-dialog" onClick={e => e.stopPropagation()}>
          <div className="win95-titlebar">
            <span>New Country</span>
            <div className="win95-titlebar-buttons">
              <button className="win95-titlebar-btn" onClick={() => setShowCountryCreateDialog(false)}>X</button>
            </div>
          </div>
          <div className="win95-dialog-body">
            <label htmlFor="new-country-name">Country name:</label>
            <input
              id="new-country-name"
              ref={newCountryInputRef}
              className="win95-input"
              value={newCountryName}
              onChange={e => setNewCountryName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleCreateCountrySubmit() }}
            />
          </div>
          <div className="win95-dialog-buttons">
            <button
              className="win95-btn win95-btn-default"
              disabled={!newCountryName.trim()}
              onClick={handleCreateCountrySubmit}
            >
              OK
            </button>
            <button className="win95-btn" onClick={() => setShowCountryCreateDialog(false)}>
              Cancel
            </button>
          </div>
        </div>
      </div>
    )
  }

  function renderCountryDeleteDialog() {
    if (!showCountryDeleteDialog) return null
    return (
      <div className="win95-dialog-overlay" onClick={() => setShowCountryDeleteDialog(false)}>
        <div className="win95-dialog" onClick={e => e.stopPropagation()}>
          <div className="win95-titlebar">
            <span>Confirm Delete</span>
            <div className="win95-titlebar-buttons">
              <button className="win95-titlebar-btn" onClick={() => setShowCountryDeleteDialog(false)}>X</button>
            </div>
          </div>
          <div className="win95-dialog-body">
            <p style={{ margin: 0 }}>Delete country &quot;{selectedCountry?.name}&quot;?</p>
            <p style={{ margin: '8px 0 0', fontSize: '0.9em' }}>All projects in this country must be deleted first.</p>
          </div>
          <div className="win95-dialog-buttons">
            <button className="win95-btn win95-btn-default" onClick={handleDeleteCountryConfirm}>
              Yes
            </button>
            <button className="win95-btn" onClick={() => setShowCountryDeleteDialog(false)}>
              No
            </button>
          </div>
        </div>
      </div>
    )
  }

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
        <div style={{ flex: 1 }} />
        <div className="win95-taskbar-sep" />
        <CountrySelector
          countries={countries}
          selectedCountryId={selectedCountryId}
          onSelectCountry={setSelectedCountryId}
          onNewCountry={() => { setNewCountryName(''); setShowCountryCreateDialog(true) }}
          onDeleteCountry={() => setShowCountryDeleteDialog(true)}
          onRenameCountry={handleRenameCountry}
        />
        <div className="win95-taskbar-sep" />
        <button
          className={`win95-nav-btn${showPricesPanel ? ' active' : ''}`}
          onClick={() => setShowPricesPanel(p => !p)}
        >
          Prices
        </button>
      </div>

      {countryError && (
        <div style={{ padding: '4px 8px', color: 'red', background: '#fff0f0' }}>{countryError}</div>
      )}

      <Routes>
        <Route path="/" element={
          <div style={{ padding: '8px' }}>
            <BuildingList onBuildingClick={setOpenBuildingId} />
          </div>
        } />
        <Route path="/buildings/:id" element={
          <div style={{ padding: '8px', maxWidth: 700 }}>
            <BuildingDetail />
          </div>
        } />
        <Route path="/projects" element={
          <div style={{ padding: '8px' }}>
            <ProjectView
              countryId={selectedCountryId}
              prices={effectivePrices}
              onBuildingClick={setOpenBuildingId}
            />
          </div>
        } />
      </Routes>

      {renderCountryCreateDialog()}
      {renderCountryDeleteDialog()}

      {openBuildingId && (
        <BuildingInfoWindow
          buildingId={openBuildingId}
          onClose={() => setOpenBuildingId(null)}
        />
      )}

      {showPricesPanel && (
        <div
          className="win95-side-panel"
          style={{ left: panelPos.x, top: panelPos.y, right: 'auto', height: panelHeight }}
        >
          <div
            className={`win95-titlebar${panelDragging ? ' dragging' : ''}`}
            style={{ cursor: panelDragging ? 'grabbing' : 'grab', userSelect: 'none' }}
            onMouseDown={handlePanelTitlebarMouseDown}
          >
            <span>Resource Prices</span>
            <div className="win95-titlebar-buttons">
              <button className="win95-titlebar-btn" onClick={() => setShowPricesPanel(false)}>X</button>
            </div>
          </div>
          <div className="win95-side-panel-body">
            <ResourcePrices
              countryId={selectedCountryId}
              prices={effectivePrices}
              onUpdatePrices={handleUpdateCountryPrices}
            />
          </div>
          <div className="win95-resize-s" onMouseDown={handlePanelResizeMouseDown} />
        </div>
      )}
    </div>
  )
}

export default App
