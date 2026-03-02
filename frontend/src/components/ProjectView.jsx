import { useState, useCallback, useEffect, useRef } from 'react'
import {
  loadProjects, createProject, deleteProject,
  addBuilding, removeBuilding, updateBuildingQty,
  migrateFromLocalStorage
} from '../projectStorage'
import { usePersistedState } from '../usePersistedState'
import CostCalculator from './CostCalculator'
import IncomeAnalysis from './IncomeAnalysis'

function ProjectView({ countryId, prices = {} }) {
  const [projects, setProjects] = useState([])
  const [selectedId, setSelectedId] = usePersistedState('wrsr:selectedProjectId', null)
  const [activeTab, setActiveTab] = useState('construction')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [newProjectName, setNewProjectName] = useState('')
  const nameInputRef = useRef(null)

  const project = projects.find(p => p.id === selectedId) || null

  const refresh = useCallback(async () => {
    try {
      const data = await loadProjects(countryId)
      setProjects(data)
      setError(null)
      return data
    } catch (err) {
      setError(err.message)
      return []
    }
  }, [countryId])

  useEffect(() => {
    async function init() {
      try {
        await migrateFromLocalStorage()
      } catch {
        // migration is best-effort
      }
      const data = await refresh()
      if (data.length > 0 && !data.find(p => p.id === selectedId)) {
        setSelectedId(data[0].id)
      }
      setLoading(false)
    }
    init()
  }, [countryId, refresh])

  useEffect(() => {
    if (showCreateDialog && nameInputRef.current) {
      nameInputRef.current.focus()
    }
  }, [showCreateDialog])

  function openCreateDialog() {
    setNewProjectName('')
    setShowCreateDialog(true)
  }

  async function handleCreateSubmit() {
    const name = newProjectName.trim()
    if (!name) return
    setShowCreateDialog(false)
    try {
      const p = await createProject(name, countryId)
      await refresh()
      setSelectedId(p.id)
    } catch (err) {
      setError(err.message)
    }
  }

  async function handleDeleteConfirm() {
    setShowDeleteDialog(false)
    if (!selectedId) return
    try {
      const updated = await deleteProject(selectedId, countryId)
      setProjects(updated)
      setSelectedId(updated.length > 0 ? updated[0].id : null)
    } catch (err) {
      setError(err.message)
    }
  }

  const handleAdd = useCallback(async (buildingId) => {
    if (!selectedId) return
    try {
      const updated = await addBuilding(selectedId, buildingId, countryId)
      setProjects(updated)
    } catch (err) {
      setError(err.message)
    }
  }, [selectedId, countryId])

  const handleRemove = useCallback(async (position) => {
    if (!selectedId) return
    try {
      const updated = await removeBuilding(selectedId, position, countryId)
      setProjects(updated)
    } catch (err) {
      setError(err.message)
    }
  }, [selectedId, countryId])

  const handleUpdateQty = useCallback(async (position, qty) => {
    if (!selectedId) return
    try {
      const updated = await updateBuildingQty(selectedId, position, qty, countryId)
      setProjects(updated)
    } catch (err) {
      setError(err.message)
    }
  }, [selectedId, countryId])

  function renderCreateDialog() {
    if (!showCreateDialog) return null
    return (
      <div className="win95-dialog-overlay" onClick={() => setShowCreateDialog(false)}>
        <div className="win95-dialog" onClick={e => e.stopPropagation()}>
          <div className="win95-titlebar">
            <span>New Project</span>
            <div className="win95-titlebar-buttons">
              <button className="win95-titlebar-btn" onClick={() => setShowCreateDialog(false)}>X</button>
            </div>
          </div>
          <div className="win95-dialog-body">
            <label htmlFor="new-project-name">Project name:</label>
            <input
              id="new-project-name"
              ref={nameInputRef}
              className="win95-input"
              value={newProjectName}
              onChange={e => setNewProjectName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleCreateSubmit() }}
            />
          </div>
          <div className="win95-dialog-buttons">
            <button
              className="win95-btn win95-btn-default"
              disabled={!newProjectName.trim()}
              onClick={handleCreateSubmit}
            >
              OK
            </button>
            <button className="win95-btn" onClick={() => setShowCreateDialog(false)}>
              Cancel
            </button>
          </div>
        </div>
      </div>
    )
  }

  function renderDeleteDialog() {
    if (!showDeleteDialog) return null
    return (
      <div className="win95-dialog-overlay" onClick={() => setShowDeleteDialog(false)}>
        <div className="win95-dialog" onClick={e => e.stopPropagation()}>
          <div className="win95-titlebar">
            <span>Confirm Delete</span>
            <div className="win95-titlebar-buttons">
              <button className="win95-titlebar-btn" onClick={() => setShowDeleteDialog(false)}>X</button>
            </div>
          </div>
          <div className="win95-dialog-body">
            <p style={{ margin: 0 }}>Delete project &quot;{project?.name}&quot;?</p>
          </div>
          <div className="win95-dialog-buttons">
            <button className="win95-btn win95-btn-default" onClick={handleDeleteConfirm}>
              Yes
            </button>
            <button className="win95-btn" onClick={() => setShowDeleteDialog(false)}>
              No
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (!countryId) {
    return (
      <div className="win95-window">
        <div className="win95-titlebar">
          <span>Projects</span>
          <div className="win95-titlebar-buttons">
            <button className="win95-titlebar-btn">_</button>
            <button className="win95-titlebar-btn">&square;</button>
            <button className="win95-titlebar-btn">X</button>
          </div>
        </div>
        <div style={{ padding: 16, textAlign: 'center' }}>
          <p>Select or create a country to start planning.</p>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="win95-window">
        <div className="win95-titlebar">
          <span>Projects</span>
          <div className="win95-titlebar-buttons">
            <button className="win95-titlebar-btn">_</button>
            <button className="win95-titlebar-btn">&square;</button>
            <button className="win95-titlebar-btn">X</button>
          </div>
        </div>
        <div className="win95-statusbar">Loading...</div>
      </div>
    )
  }

  if (projects.length === 0) {
    return (
      <div className="win95-window">
        <div className="win95-titlebar">
          <span>Projects</span>
          <div className="win95-titlebar-buttons">
            <button className="win95-titlebar-btn">_</button>
            <button className="win95-titlebar-btn">&square;</button>
            <button className="win95-titlebar-btn">X</button>
          </div>
        </div>
        <div style={{ padding: 16, textAlign: 'center' }}>
          {error && <p style={{ color: 'red' }}>{error}</p>}
          <p>No projects yet. Create one to start planning.</p>
          <button className="win95-btn win95-btn-default" onClick={openCreateDialog}>
            New Project
          </button>
        </div>
        {renderCreateDialog()}
      </div>
    )
  }

  return (
    <div className="win95-window">
      <div className="win95-titlebar">
        <span>Projects</span>
        <div className="win95-titlebar-buttons">
          <button className="win95-titlebar-btn">_</button>
          <button className="win95-titlebar-btn">&square;</button>
          <button className="win95-titlebar-btn">X</button>
        </div>
      </div>

      {error && (
        <div style={{ padding: '4px 8px', color: 'red', background: '#fff0f0' }}>{error}</div>
      )}

      <div className="win95-toolbar">
        <label>Project:</label>
        <select
          className="win95-select"
          value={selectedId || ''}
          onChange={e => setSelectedId(e.target.value)}
        >
          {projects.map(p => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
        <button className="win95-btn" onClick={openCreateDialog}>New</button>
        <button className="win95-btn" onClick={() => setShowDeleteDialog(true)}>Delete</button>
      </div>

      <div className="win95-tabs">
        <button
          className={`win95-tab${activeTab === 'construction' ? ' active' : ''}`}
          onClick={() => setActiveTab('construction')}
        >
          Construction
        </button>
        <button
          className={`win95-tab${activeTab === 'operation' ? ' active' : ''}`}
          onClick={() => setActiveTab('operation')}
        >
          Operation
        </button>
      </div>

      <div style={{ padding: 4 }}>
        {activeTab === 'construction' && (
          <CostCalculator
            projectBuildings={project?.buildings || []}
            prices={prices}
            onAdd={handleAdd}
            onRemove={handleRemove}
            onUpdateQty={handleUpdateQty}
          />
        )}
        {activeTab === 'operation' && (
          <IncomeAnalysis
            projectId={project?.id}
            projectBuildings={project?.buildings || []}
            prices={prices}
            defaultProductivity={project?.productivity ?? 1.0}
          />
        )}
      </div>

      {renderCreateDialog()}
      {renderDeleteDialog()}
    </div>
  )
}

export default ProjectView
