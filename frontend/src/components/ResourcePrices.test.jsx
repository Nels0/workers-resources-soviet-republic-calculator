import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ResourcePrices from './ResourcePrices'

const mockApi = vi.hoisted(() => ({
  fetchBuildingsList: vi.fn(),
}))

const mockStorage = vi.hoisted(() => ({
  loadProjects: vi.fn(),
}))

vi.mock('../api', () => mockApi)
vi.mock('../projectStorage', () => mockStorage)

const RESOURCES = [
  { id: 1, name: 'Concrete', type: 'material', unit: 't' },
  { id: 2, name: 'Steel', type: 'material', unit: 't' },
  { id: 3, name: 'Workers', type: 'workforce', unit: 'workers' },
]

const BUILDINGS = [
  {
    id: 10, name: 'Hospital', source_file: 'hospital.ini',
    resource_costs: { '1': 100, '2': 50 },
    operation_costs: { '3': 10 },
  },
]

const PROJECTS = [
  { id: 'p1', name: 'Test', buildings: [{ buildingId: 10, quantity: 1, position: 0 }], country_id: 'c1' },
]

function renderResourcePrices(props = {}) {
  const defaults = {
    countryId: 'c1',
    prices: {},
    onUpdatePrices: vi.fn(),
  }
  return render(<ResourcePrices {...defaults} {...props} />)
}

describe('ResourcePrices', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockApi.fetchBuildingsList.mockResolvedValue({
      resources: RESOURCES,
      buildings: BUILDINGS,
    })
    mockStorage.loadProjects.mockResolvedValue(PROJECTS)
  })

  it('renders used resources from both construction and operation', async () => {
    renderResourcePrices()

    await waitFor(() => {
      expect(screen.getByText('Concrete')).toBeInTheDocument()
      expect(screen.getByText('Steel')).toBeInTheDocument()
      expect(screen.getByText('Workers')).toBeInTheDocument()
    })
  })

  it('pre-fills prices from prop', async () => {
    renderResourcePrices({ prices: { '1': { import: 10.5, export: 0 } } })

    await waitFor(() => {
      expect(screen.getByText('Concrete')).toBeInTheDocument()
    })

    // First spinbutton is Import ₽ for Concrete
    const inputs = screen.getAllByRole('spinbutton')
    expect(inputs[0].value).toBe('10.5')
  })

  it('shows empty state when no projects have buildings', async () => {
    mockStorage.loadProjects.mockResolvedValue([
      { id: 'p1', name: 'Empty', buildings: [], country_id: 'c1' },
    ])
    renderResourcePrices()

    await waitFor(() => {
      expect(screen.getByText(/No buildings in any projects yet/)).toBeInTheDocument()
    })
  })

  it('auto-saves after typing with debounce', async () => {
    const onUpdatePrices = vi.fn()
    const user = userEvent.setup({ delay: null })
    renderResourcePrices({ prices: {}, onUpdatePrices })

    await waitFor(() => {
      expect(screen.getByText('Concrete')).toBeInTheDocument()
    })

    const inputs = screen.getAllByRole('spinbutton')
    await user.type(inputs[0], '15')

    // Not called immediately — debounce is pending
    expect(onUpdatePrices).not.toHaveBeenCalled()

    // Wait up to 2s for the 600ms debounce to fire
    await waitFor(() => {
      expect(onUpdatePrices).toHaveBeenCalledWith({ '1': { import: 15, export: 0 } })
    }, { timeout: 2000 })
  })

  it('does not auto-save immediately after typing', async () => {
    const onUpdatePrices = vi.fn()
    const user = userEvent.setup({ delay: null })
    renderResourcePrices({ prices: {}, onUpdatePrices })

    await waitFor(() => {
      expect(screen.getByText('Concrete')).toBeInTheDocument()
    })

    const inputs = screen.getAllByRole('spinbutton')
    await user.type(inputs[0], '5')

    expect(onUpdatePrices).not.toHaveBeenCalled()
  })
})
