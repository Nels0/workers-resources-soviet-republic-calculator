import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ResourcePrices from './ResourcePrices'

const mockApi = vi.hoisted(() => ({
  fetchBuildingsList: vi.fn(),
}))

vi.mock('../api', () => mockApi)

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

function renderResourcePrices(props = {}) {
  const defaults = {
    projectBuildings: [{ buildingId: 10, quantity: 1, position: 0 }],
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
    renderResourcePrices({ prices: { '1': 10.5 } })

    await waitFor(() => {
      expect(screen.getByText('Concrete')).toBeInTheDocument()
    })

    const inputs = screen.getAllByRole('spinbutton')
    const concreteInput = inputs[0]
    expect(concreteInput.value).toBe('10.5')
  })

  it('Save button is disabled when no changes', async () => {
    renderResourcePrices({ prices: {} })

    await waitFor(() => {
      expect(screen.getByText('Save Prices')).toBeInTheDocument()
    })

    expect(screen.getByText('Save Prices')).toBeDisabled()
  })

  it('Save button enables after editing a price', async () => {
    const user = userEvent.setup()
    renderResourcePrices({ prices: {} })

    await waitFor(() => {
      expect(screen.getByText('Concrete')).toBeInTheDocument()
    })

    const inputs = screen.getAllByRole('spinbutton')
    await user.type(inputs[0], '15')

    expect(screen.getByText('Save Prices')).toBeEnabled()
  })

  it('calls onUpdatePrices with cleaned prices on Save', async () => {
    const onUpdatePrices = vi.fn()
    const user = userEvent.setup()
    renderResourcePrices({ prices: {}, onUpdatePrices })

    await waitFor(() => {
      expect(screen.getByText('Concrete')).toBeInTheDocument()
    })

    const inputs = screen.getAllByRole('spinbutton')
    await user.type(inputs[0], '15')
    await user.click(screen.getByText('Save Prices'))

    expect(onUpdatePrices).toHaveBeenCalledWith({ '1': 15 })
  })

  it('shows empty state when no buildings in project', async () => {
    renderResourcePrices({ projectBuildings: [] })

    await waitFor(() => {
      expect(screen.getByText(/No buildings in project/)).toBeInTheDocument()
    })
  })
})
