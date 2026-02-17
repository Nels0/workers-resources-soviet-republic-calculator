import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import BuildingList from './BuildingList'

const mockApi = vi.hoisted(() => ({
  fetchBuildingsList: vi.fn(),
}))

vi.mock('../api', () => mockApi)

const BUILDINGS = [
  { id: 1, name: 'Hospital', category: 'health', source_file: 'hospital.ini', workers_needed: 50, construction_days: 0, resource_costs: {} },
  { id: 2, name: 'Hospital', category: 'health', source_file: 'hospital_v2.ini', workers_needed: 30, construction_days: 0, resource_costs: {} },
  { id: 3, name: 'Cement plant', category: 'industry', source_file: 'cement_plant.ini', workers_needed: 30, construction_days: 0, resource_costs: {} },
]

function renderBuildingList() {
  return render(
    <MemoryRouter>
      <BuildingList />
    </MemoryRouter>
  )
}

describe('BuildingList source_file display', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockApi.fetchBuildingsList.mockResolvedValue({ resources: [], buildings: BUILDINGS })
  })

  it('displays source_file next to each building name', async () => {
    renderBuildingList()

    await waitFor(() => {
      expect(screen.getByText('hospital.ini')).toBeInTheDocument()
    })
    expect(screen.getByText('hospital_v2.ini')).toBeInTheDocument()
    expect(screen.getByText('cement_plant.ini')).toBeInTheDocument()
  })

  it('renders source_file with muted styling', async () => {
    renderBuildingList()

    await waitFor(() => {
      expect(screen.getByText('hospital.ini')).toBeInTheDocument()
    })

    const sourceEl = screen.getByText('hospital.ini')
    expect(sourceEl.classList.contains('win95-muted')).toBe(true)
    expect(sourceEl.style.fontSize).toBe('0.85em')
  })
})
