import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import CostCalculator from './CostCalculator'

const mockApi = vi.hoisted(() => ({
  fetchBuildingsList: vi.fn(),
}))

vi.mock('../api', () => mockApi)

const BUILDINGS = [
  { id: 1, name: 'Hospital', category: 'health', source_file: 'hospital.ini', workers_needed: 50, resource_costs: {}, operation_costs: {} },
  { id: 2, name: 'Hospital', category: 'health', source_file: 'hospital_v2.ini', workers_needed: 30, resource_costs: {}, operation_costs: {} },
  { id: 3, name: 'Cement plant', category: 'industry', source_file: 'cement_plant.ini', workers_needed: 30, resource_costs: {}, operation_costs: {} },
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
