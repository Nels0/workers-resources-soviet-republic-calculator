import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import CostCalculator from './CostCalculator'

const mockApi = vi.hoisted(() => ({
  fetchBuildingsList: vi.fn(),
}))

vi.mock('../api', () => mockApi)

const RESOURCES = [
  { id: 1, name: 'Concrete', type: 'material', unit: 't' },
  { id: 2, name: 'Steel', type: 'material', unit: 't' },
]

const BUILDINGS = [
  { id: 1, name: 'Hospital', category: 'health', source_file: 'hospital.ini', workers_needed: 50, resource_costs: {}, operation_costs: {} },
  { id: 2, name: 'Hospital', category: 'health', source_file: 'hospital_v2.ini', workers_needed: 30, resource_costs: {}, operation_costs: {} },
  { id: 3, name: 'Cement plant', category: 'industry', source_file: 'cement_plant.ini', workers_needed: 30, resource_costs: {}, operation_costs: {} },
  { id: 4, name: 'Factory', category: 'industry', source_file: 'factory.ini', workers_needed: 40, resource_costs: { '1': 100, '2': 50 }, operation_costs: {} },
]

function renderCostCalculator(props = {}) {
  const defaults = {
    projectBuildings: [],
    onAdd: vi.fn(),
    onRemove: vi.fn(),
    onUpdateQty: vi.fn(),
  }
  return render(
    <MemoryRouter>
      <CostCalculator {...defaults} {...props} />
    </MemoryRouter>
  )
}

describe('BuildingSearch source_file filtering', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockApi.fetchBuildingsList.mockResolvedValue({ resources: [], buildings: BUILDINGS })
  })

  it('filters by source_file when typing a filename', async () => {
    const user = userEvent.setup()
    renderCostCalculator()

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Search buildings to add...')).toBeInTheDocument()
    })

    await user.type(screen.getByPlaceholderText('Search buildings to add...'), 'hospital_v2')

    await waitFor(() => {
      expect(screen.getByText('hospital_v2.ini')).toBeInTheDocument()
    })
    // Should only show the v2 variant, not both Hospitals
    const items = document.querySelectorAll('.win95-dropdown-item')
    expect(items).toHaveLength(1)
  })

  it('filters by name still works', async () => {
    const user = userEvent.setup()
    renderCostCalculator()

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Search buildings to add...')).toBeInTheDocument()
    })

    await user.type(screen.getByPlaceholderText('Search buildings to add...'), 'Hospital')

    await waitFor(() => {
      const items = document.querySelectorAll('.win95-dropdown-item')
      expect(items).toHaveLength(2)
    })
  })

  it('shows source_file in dropdown items', async () => {
    const user = userEvent.setup()
    renderCostCalculator()

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Search buildings to add...')).toBeInTheDocument()
    })

    await user.type(screen.getByPlaceholderText('Search buildings to add...'), 'Cement')

    await waitFor(() => {
      expect(screen.getByText('cement_plant.ini')).toBeInTheDocument()
    })
  })

  it('shows no matches when source_file query does not match', async () => {
    const user = userEvent.setup()
    renderCostCalculator()

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Search buildings to add...')).toBeInTheDocument()
    })

    await user.type(screen.getByPlaceholderText('Search buildings to add...'), 'nonexistent_file')

    await waitFor(() => {
      expect(screen.getByText('No matches')).toBeInTheDocument()
    })
  })
})

describe('CostCalculator source_file display in project table', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockApi.fetchBuildingsList.mockResolvedValue({ resources: [], buildings: BUILDINGS })
  })

  it('displays source_file next to building name in project rows', async () => {
    renderCostCalculator({
      projectBuildings: [{ buildingId: 1, quantity: 1, position: 0 }],
    })

    await waitFor(() => {
      expect(screen.getByText('hospital.ini')).toBeInTheDocument()
    })

    const sourceEl = screen.getByText('hospital.ini')
    expect(sourceEl.classList.contains('win95-muted')).toBe(true)
  })
})

describe('CostCalculator Total Cost column', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockApi.fetchBuildingsList.mockResolvedValue({ resources: RESOURCES, buildings: BUILDINGS })
  })

  it('does not show Total ₽ column when no prices set', async () => {
    renderCostCalculator({
      projectBuildings: [{ buildingId: 4, quantity: 2, position: 0 }],
      prices: {},
    })

    await waitFor(() => {
      expect(screen.getByText('Factory')).toBeInTheDocument()
    })

    expect(screen.queryByText('Total ₽')).not.toBeInTheDocument()
  })

  it('shows Total ₽ column when prices are set', async () => {
    renderCostCalculator({
      projectBuildings: [{ buildingId: 4, quantity: 2, position: 0 }],
      prices: { '1': 10 },
    })

    await waitFor(() => {
      expect(screen.getByText('Total ₽')).toBeInTheDocument()
    })
  })

  it('computes correct row total cost', async () => {
    // Factory: concrete=100, steel=50. qty=2. price for concrete=10.
    // Grand total = 200*10 = 2000
    renderCostCalculator({
      projectBuildings: [{ buildingId: 4, quantity: 2, position: 0 }],
      prices: { '1': 10 },
    })

    await waitFor(() => {
      expect(screen.getByText('Total ₽')).toBeInTheDocument()
    })

    const grandTotalCell = screen.getByText('Total ₽').closest('tr').querySelector('.num')
    expect(grandTotalCell).toHaveTextContent('2000')
  })

  it('computes correct grand total with multiple priced resources', async () => {
    // Factory: concrete=100, steel=50. qty=1. prices: concrete=10, steel=20.
    // Grand total = 100*10 + 50*20 = 1000 + 1000 = 2000
    renderCostCalculator({
      projectBuildings: [{ buildingId: 4, quantity: 1, position: 0 }],
      prices: { '1': 10, '2': 20 },
    })

    await waitFor(() => {
      expect(screen.getByText('Total ₽')).toBeInTheDocument()
    })

    const grandTotalCell = screen.getByText('Total ₽').closest('tr').querySelector('.num')
    expect(grandTotalCell).toHaveTextContent('2000')
  })
})
