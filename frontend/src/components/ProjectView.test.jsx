import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import ProjectView from './ProjectView'

// Mock child components to isolate ProjectView
vi.mock('./CostCalculator', () => ({
  default: () => <div data-testid="cost-calculator" />
}))
vi.mock('./OperationCosts', () => ({
  default: () => <div data-testid="operation-costs" />
}))
vi.mock('./ResourcePrices', () => ({
  default: () => <div data-testid="resource-prices" />
}))

// Mock projectStorage
const mockStorage = vi.hoisted(() => ({
  loadProjects: vi.fn(),
  createProject: vi.fn(),
  deleteProject: vi.fn(),
  addBuilding: vi.fn(),
  removeBuilding: vi.fn(),
  updateBuildingQty: vi.fn(),
  updateCountryPrices: vi.fn(),
  migrateFromLocalStorage: vi.fn(),
}))

vi.mock('../projectStorage', () => mockStorage)

function renderProjectView(props = {}) {
  const defaults = {
    countryId: 'c1',
    prices: {},
    onUpdatePrices: vi.fn(),
  }
  return render(
    <MemoryRouter>
      <ProjectView {...defaults} {...props} />
    </MemoryRouter>
  )
}

describe('ProjectView create project', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockStorage.migrateFromLocalStorage.mockResolvedValue(false)
  })

  it('shows empty state with New Project button when no projects exist', async () => {
    mockStorage.loadProjects.mockResolvedValue([])

    renderProjectView()

    await waitFor(() => {
      expect(screen.getByText('No projects yet. Create one to start planning.')).toBeInTheDocument()
    })
    expect(screen.getByRole('button', { name: 'New Project' })).toBeInTheDocument()
  })

  it('shows no-country state when countryId is null', async () => {
    renderProjectView({ countryId: null })

    await waitFor(() => {
      expect(screen.getByText('Select or create a country to start planning.')).toBeInTheDocument()
    })
  })

  it('opens create dialog when New Project button is clicked', async () => {
    mockStorage.loadProjects.mockResolvedValue([])
    const user = userEvent.setup()

    renderProjectView()

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'New Project' })).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: 'New Project' }))

    expect(screen.getByText('New Project', { selector: '.win95-titlebar span' })).toBeInTheDocument()
    expect(screen.getByLabelText('Project name:')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'OK' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument()
  })

  it('disables OK button when name input is empty', async () => {
    mockStorage.loadProjects.mockResolvedValue([])
    const user = userEvent.setup()

    renderProjectView()

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'New Project' })).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: 'New Project' }))

    expect(screen.getByRole('button', { name: 'OK' })).toBeDisabled()
  })

  it('enables OK button when name is typed', async () => {
    mockStorage.loadProjects.mockResolvedValue([])
    const user = userEvent.setup()

    renderProjectView()

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'New Project' })).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: 'New Project' }))
    await user.type(screen.getByLabelText('Project name:'), 'My Base')

    expect(screen.getByRole('button', { name: 'OK' })).toBeEnabled()
  })

  it('calls createProject with name and countryId when OK is clicked', async () => {
    const newProject = { id: 'p1', name: 'My Base', buildings: [], country_id: 'c1' }
    mockStorage.loadProjects
      .mockResolvedValueOnce([])          // initial load
      .mockResolvedValueOnce([newProject]) // refresh after create
    mockStorage.createProject.mockResolvedValue(newProject)

    const user = userEvent.setup()

    renderProjectView({ countryId: 'c1' })

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'New Project' })).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: 'New Project' }))
    await user.type(screen.getByLabelText('Project name:'), 'My Base')
    await user.click(screen.getByRole('button', { name: 'OK' }))

    await waitFor(() => {
      expect(mockStorage.createProject).toHaveBeenCalledWith('My Base', 'c1')
    })

    await waitFor(() => {
      expect(mockStorage.loadProjects).toHaveBeenCalledTimes(2)
    })
  })

  it('calls createProject when Enter is pressed in the input', async () => {
    const newProject = { id: 'p1', name: 'My Base', buildings: [], country_id: 'c1' }
    mockStorage.loadProjects
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([newProject])
    mockStorage.createProject.mockResolvedValue(newProject)

    const user = userEvent.setup()

    renderProjectView()

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'New Project' })).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: 'New Project' }))
    await user.type(screen.getByLabelText('Project name:'), 'My Base{Enter}')

    await waitFor(() => {
      expect(mockStorage.createProject).toHaveBeenCalledWith('My Base', 'c1')
    })
  })

  it('closes dialog when Cancel is clicked without creating', async () => {
    mockStorage.loadProjects.mockResolvedValue([])
    const user = userEvent.setup()

    renderProjectView()

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'New Project' })).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: 'New Project' }))
    expect(screen.getByLabelText('Project name:')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(screen.queryByLabelText('Project name:')).not.toBeInTheDocument()
    expect(mockStorage.createProject).not.toHaveBeenCalled()
  })

  it('closes dialog when overlay is clicked', async () => {
    mockStorage.loadProjects.mockResolvedValue([])
    const user = userEvent.setup()

    renderProjectView()

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'New Project' })).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: 'New Project' }))
    expect(screen.getByLabelText('Project name:')).toBeInTheDocument()

    // Click the overlay (the outermost dialog div)
    await user.click(document.querySelector('.win95-dialog-overlay'))

    expect(screen.queryByLabelText('Project name:')).not.toBeInTheDocument()
    expect(mockStorage.createProject).not.toHaveBeenCalled()
  })

  it('shows the new project in the selector after creation', async () => {
    const newProject = { id: 'p1', name: 'My Base', buildings: [], country_id: 'c1' }
    mockStorage.loadProjects
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([newProject])
    mockStorage.createProject.mockResolvedValue(newProject)

    const user = userEvent.setup()

    renderProjectView()

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'New Project' })).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: 'New Project' }))
    await user.type(screen.getByLabelText('Project name:'), 'My Base')
    await user.click(screen.getByRole('button', { name: 'OK' }))

    // After creation, the project should appear in the UI
    await waitFor(() => {
      expect(screen.getByText('My Base')).toBeInTheDocument()
    })
  })
})

describe('ProjectView Resource Prices tab', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockStorage.migrateFromLocalStorage.mockResolvedValue(false)
  })

  it('renders Resource Prices tab and shows ResourcePrices component when clicked', async () => {
    const project = { id: 'p1', name: 'Test', buildings: [], country_id: 'c1' }
    mockStorage.loadProjects.mockResolvedValue([project])
    const user = userEvent.setup()

    renderProjectView({ prices: { '1': 10.0 }, countryId: 'c1' })

    await waitFor(() => {
      expect(screen.getByText('Resource Prices')).toBeInTheDocument()
    })

    await user.click(screen.getByText('Resource Prices'))

    expect(screen.getByTestId('resource-prices')).toBeInTheDocument()
    expect(screen.queryByTestId('cost-calculator')).not.toBeInTheDocument()
    expect(screen.queryByTestId('operation-costs')).not.toBeInTheDocument()
  })
})
