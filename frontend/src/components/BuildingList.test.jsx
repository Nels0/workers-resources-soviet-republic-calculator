import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import BuildingList from './BuildingList'

const mockApi = vi.hoisted(() => ({
  fetchBuildingsList: vi.fn(),
}))

vi.mock('../api', () => mockApi)

const RESOURCES = [
  { id: 1, name: 'Wood', unit: 'm3' },
  { id: 2, name: 'Steel', unit: 't' },
  { id: 3, name: 'Coal', unit: 't' },
]

const BUILDINGS = [
  {
    id: 1,
    name: 'Hospital',
    category: 'health',
    source_file: 'hospital.ini',
    workers_needed: 50,
    construction_days: 0,
    resource_costs: {},
    produces: {},
    consumes: {},
  },
  {
    id: 2,
    name: 'Hospital',
    category: 'health',
    source_file: 'hospital_v2.ini',
    workers_needed: 30,
    construction_days: 0,
    resource_costs: {},
    produces: {},
    consumes: {},
  },
  {
    id: 3,
    name: 'Cement plant',
    category: 'industry',
    source_file: 'cement_plant.ini',
    workers_needed: 30,
    construction_days: 0,
    resource_costs: { '1': 100 },
    produces: { '2': 5 },
    consumes: { '3': 2 },
  },
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
    mockApi.fetchBuildingsList.mockResolvedValue({ resources: RESOURCES, buildings: BUILDINGS })
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

describe('BuildingList tab switching', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockApi.fetchBuildingsList.mockResolvedValue({ resources: RESOURCES, buildings: BUILDINGS })
  })

  it('defaults to Construction tab', async () => {
    renderBuildingList()

    await waitFor(() => {
      expect(screen.getByText('hospital.ini')).toBeInTheDocument()
    })

    const constructionTab = screen.getByRole('button', { name: 'Construction' })
    expect(constructionTab.className).toContain('active')
    const productionTab = screen.getByRole('button', { name: 'Production' })
    expect(productionTab.className).not.toContain('active')
  })

  it('clicking Production tab shows only buildings with flow data', async () => {
    const user = userEvent.setup()
    renderBuildingList()

    await waitFor(() => {
      expect(screen.getByText('hospital.ini')).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: 'Production' }))

    // Cement plant has flows, hospitals do not
    await waitFor(() => {
      expect(screen.getByText('cement_plant.ini')).toBeInTheDocument()
    })
    expect(screen.queryByText('hospital.ini')).not.toBeInTheDocument()
    expect(screen.queryByText('hospital_v2.ini')).not.toBeInTheDocument()
  })

  it('switching tabs resets material filter', async () => {
    const user = userEvent.setup()
    renderBuildingList()

    await waitFor(() => {
      expect(screen.getByText('hospital.ini')).toBeInTheDocument()
    })

    // Set material filter on construction tab
    const materialSelect = screen.getByRole('combobox', { name: /Material/i })
    await user.selectOptions(materialSelect, '1')

    // Switch to Production and back
    await user.click(screen.getByRole('button', { name: 'Production' }))
    await user.click(screen.getByRole('button', { name: 'Construction' }))

    // Material filter should be reset — all buildings visible again
    await waitFor(() => {
      expect(screen.getByText('hospital.ini')).toBeInTheDocument()
    })
    expect(screen.getByText('hospital_v2.ini')).toBeInTheDocument()
  })
})

describe('BuildingList column sparseness', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockApi.fetchBuildingsList.mockResolvedValue({ resources: RESOURCES, buildings: BUILDINGS })
  })

  it('Construction tab shows only columns with non-zero values', async () => {
    renderBuildingList()

    await waitFor(() => {
      expect(screen.getByText('hospital.ini')).toBeInTheDocument()
    })

    // Wood (id=1) is used by cement_plant; it appears in both column header and material dropdown
    expect(screen.getAllByText('Wood (m3)').length).toBeGreaterThan(0)
    // Steel and Coal are not construction resources — should not appear at all
    expect(screen.queryAllByText('Steel (t)').length).toBe(0)
    expect(screen.queryAllByText('Coal (t)').length).toBe(0)
  })

  it('Production tab shows only columns with flow data', async () => {
    const user = userEvent.setup()
    renderBuildingList()

    await waitFor(() => {
      expect(screen.getByText('hospital.ini')).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: 'Production' }))

    await waitFor(() => {
      expect(screen.getByText('cement_plant.ini')).toBeInTheDocument()
    })

    // Steel (produces) and Coal (consumes) should appear; Wood is not in flows
    expect(screen.queryAllByText(/Wood/).length).toBe(0)
    // Steel and Coal headers present (with arrow annotations); also appear in resource dropdown
    expect(screen.getAllByText(/Steel/).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/Coal/).length).toBeGreaterThan(0)
  })
})

describe('BuildingList material filter', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockApi.fetchBuildingsList.mockResolvedValue({ resources: RESOURCES, buildings: BUILDINGS })
  })

  it('filters to buildings that use the selected construction material', async () => {
    const user = userEvent.setup()
    renderBuildingList()

    await waitFor(() => {
      expect(screen.getByText('hospital.ini')).toBeInTheDocument()
    })

    const materialSelect = screen.getByRole('combobox', { name: /Material/i })
    await user.selectOptions(materialSelect, '1') // Wood

    await waitFor(() => {
      expect(screen.getByText('cement_plant.ini')).toBeInTheDocument()
    })
    expect(screen.queryByText('hospital.ini')).not.toBeInTheDocument()
    expect(screen.queryByText('hospital_v2.ini')).not.toBeInTheDocument()
  })
})

describe('BuildingList production tab', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockApi.fetchBuildingsList.mockResolvedValue({ resources: RESOURCES, buildings: BUILDINGS })
  })

  it('shows no buildings message when none have flow data', async () => {
    const user = userEvent.setup()
    const noFlowBuildings = BUILDINGS.map(b => ({ ...b, produces: {}, consumes: {} }))
    mockApi.fetchBuildingsList.mockResolvedValue({ resources: RESOURCES, buildings: noFlowBuildings })

    renderBuildingList()

    await waitFor(() => {
      expect(screen.getByText('hospital.ini')).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: 'Production' }))

    await waitFor(() => {
      expect(screen.getByText('No buildings have production or consumption data.')).toBeInTheDocument()
    })
  })

  it('direction filter shows only producing buildings', async () => {
    const user = userEvent.setup()
    renderBuildingList()

    await waitFor(() => {
      expect(screen.getByText('hospital.ini')).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: 'Production' }))

    await waitFor(() => {
      expect(screen.getByText('cement_plant.ini')).toBeInTheDocument()
    })

    const dirSelect = screen.getByRole('combobox', { name: /Direction/i })
    await user.selectOptions(dirSelect, 'produces')

    // Cement plant produces steel, so it stays
    expect(screen.getByText('cement_plant.ini')).toBeInTheDocument()
  })

  it('flow resource filter limits to buildings using that resource', async () => {
    const user = userEvent.setup()
    renderBuildingList()

    await waitFor(() => {
      expect(screen.getByText('hospital.ini')).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: 'Production' }))

    await waitFor(() => {
      expect(screen.getByText('cement_plant.ini')).toBeInTheDocument()
    })

    const resourceSelect = screen.getByRole('combobox', { name: /Resource/i })
    await user.selectOptions(resourceSelect, '2') // Steel

    // Cement plant produces steel, so it remains
    expect(screen.getByText('cement_plant.ini')).toBeInTheDocument()
  })
})
