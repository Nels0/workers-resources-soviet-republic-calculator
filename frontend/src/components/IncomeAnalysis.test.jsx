import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import IncomeAnalysis from './IncomeAnalysis'

vi.mock('../api', () => ({
  fetchBuildingsList: vi.fn(),
  fetchProjectChains: vi.fn(),
  bulkReplaceProjectChainsAPI: vi.fn(),
  updateProjectChainAPI: vi.fn(),
  deleteProjectChainAPI: vi.fn(),
  updateChainMembersAPI: vi.fn(),
  createProjectChainAPI: vi.fn(),
}))

import {
  fetchBuildingsList,
  fetchProjectChains,
  bulkReplaceProjectChainsAPI,
  updateProjectChainAPI,
  createProjectChainAPI,
} from '../api'

const RESOURCES = [
  { id: 10, name: 'Steel', type: 'material', unit: 't' },
  { id: 20, name: 'Coal', type: 'material', unit: 't' },
]

const BUILDING_WITH_FLOWS = {
  id: 1,
  name: 'Steel Mill',
  source_file: 'steel_mill.ini',
  category: 'industry',
  produces: { '10': 5 },
  consumes: { '20': 3 },
}

const BUILDING_NO_FLOWS = {
  id: 2,
  name: 'Warehouse',
  source_file: 'warehouse.ini',
  category: 'logistics',
  produces: {},
  consumes: {},
}

const PROJECT_BUILDINGS_FLOW_ONLY = [
  { buildingId: 1, quantity: 2, position: 0 },
]

const PROJECT_BUILDINGS_MIXED = [
  { buildingId: 1, quantity: 2, position: 0 },
  { buildingId: 2, quantity: 1, position: 1 },
]

const PRICES_PARTIAL = { '10': { import: 100, export: 0 } } // Steel (import) priced at 100, Coal unpriced

function renderIncomeAnalysis(props = {}) {
  const defaults = {
    projectId: 'proj-1',
    projectBuildings: PROJECT_BUILDINGS_FLOW_ONLY,
    prices: {},
  }
  return render(
    <MemoryRouter>
      <IncomeAnalysis {...defaults} {...props} />
    </MemoryRouter>
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  fetchBuildingsList.mockResolvedValue({
    buildings: [BUILDING_WITH_FLOWS, BUILDING_NO_FLOWS],
    resources: RESOURCES,
  })
  fetchProjectChains.mockResolvedValue([])
  bulkReplaceProjectChainsAPI.mockResolvedValue([])
  updateProjectChainAPI.mockResolvedValue({})
  createProjectChainAPI.mockResolvedValue({
    id: 'chain-new',
    name: 'Chain 1',
    position: 0,
    members: [],
  })
})

// --- Gap 8: Loading/error feedback ---

describe('Gap 8: loading/error feedback during auto-detect', () => {
  it('disables buttons and shows saving status while auto-detect is in flight', async () => {
    let resolveCall
    const inflightPromise = new Promise(r => { resolveCall = r })
    bulkReplaceProjectChainsAPI.mockReturnValueOnce(inflightPromise)

    renderIncomeAnalysis()
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Auto-detect chains' })).toBeInTheDocument()
    )

    const user = userEvent.setup({ delay: null })
    await user.click(screen.getByRole('button', { name: 'Auto-detect chains' }))

    expect(screen.getByRole('button', { name: 'Auto-detect chains' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Clear chains' })).toBeDisabled()
    expect(screen.getByText('Saving chains\u2026')).toBeInTheDocument()

    resolveCall([])
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Auto-detect chains' })).not.toBeDisabled()
    )
    expect(screen.queryByText('Saving chains\u2026')).not.toBeInTheDocument()
  })

  it('shows error message when auto-detect fails', async () => {
    bulkReplaceProjectChainsAPI.mockRejectedValueOnce(new Error('Server error'))

    renderIncomeAnalysis()
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Auto-detect chains' })).toBeInTheDocument()
    )

    const user = userEvent.setup({ delay: null })
    await user.click(screen.getByRole('button', { name: 'Auto-detect chains' }))

    await waitFor(() =>
      expect(screen.getByText(/Failed to save chains/)).toBeInTheDocument()
    )
    expect(screen.getByRole('button', { name: 'Auto-detect chains' })).not.toBeDisabled()
  })
})

// --- Gap 2: Auto-detect confirmation dialog ---

describe('Gap 2: auto-detect confirmation dialog', () => {
  const EXISTING_CHAIN = { id: 'chain-1', name: 'Iron Chain', position: 0, members: [0] }

  it('shows confirmation dialog when chains already exist', async () => {
    fetchProjectChains.mockResolvedValue([EXISTING_CHAIN])

    renderIncomeAnalysis()
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Auto-detect chains' })).toBeInTheDocument()
    )

    const user = userEvent.setup({ delay: null })
    await user.click(screen.getByRole('button', { name: 'Auto-detect chains' }))

    expect(screen.getByText(/This will replace your current chains/)).toBeInTheDocument()
  })

  it('does not call API and closes dialog when No is clicked', async () => {
    fetchProjectChains.mockResolvedValue([EXISTING_CHAIN])

    renderIncomeAnalysis()
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Auto-detect chains' })).toBeInTheDocument()
    )

    const user = userEvent.setup({ delay: null })
    await user.click(screen.getByRole('button', { name: 'Auto-detect chains' }))
    await user.click(screen.getByRole('button', { name: 'No' }))

    expect(bulkReplaceProjectChainsAPI).not.toHaveBeenCalled()
    expect(screen.queryByText(/This will replace your current chains/)).not.toBeInTheDocument()
    expect(screen.getByDisplayValue('Iron Chain')).toBeInTheDocument()
  })

  it('runs auto-detect when Yes is clicked', async () => {
    fetchProjectChains.mockResolvedValue([EXISTING_CHAIN])
    bulkReplaceProjectChainsAPI.mockResolvedValue([
      { id: 'new-1', name: 'Steel', position: 0, members: [] },
    ])

    renderIncomeAnalysis()
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Auto-detect chains' })).toBeInTheDocument()
    )

    const user = userEvent.setup({ delay: null })
    await user.click(screen.getByRole('button', { name: 'Auto-detect chains' }))
    await user.click(screen.getByRole('button', { name: 'Yes' }))

    await waitFor(() => expect(bulkReplaceProjectChainsAPI).toHaveBeenCalled())
    expect(screen.queryByText(/This will replace your current chains/)).not.toBeInTheDocument()
  })

  it('runs auto-detect immediately when no chains exist', async () => {
    fetchProjectChains.mockResolvedValue([])
    bulkReplaceProjectChainsAPI.mockResolvedValue([])

    renderIncomeAnalysis()
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Auto-detect chains' })).toBeInTheDocument()
    )

    const user = userEvent.setup({ delay: null })
    await user.click(screen.getByRole('button', { name: 'Auto-detect chains' }))

    expect(screen.queryByText(/This will replace your current chains/)).not.toBeInTheDocument()
    await waitFor(() => expect(bulkReplaceProjectChainsAPI).toHaveBeenCalled())
  })
})

// --- Gap 3: Omitted buildings note ---

describe('Gap 3: omitted buildings note', () => {
  it('shows count of omitted buildings when some have no flows', async () => {
    renderIncomeAnalysis({ projectBuildings: PROJECT_BUILDINGS_MIXED })

    await waitFor(() =>
      expect(
        screen.getByText(/1 building\(s\) not shown: no production flows/)
      ).toBeInTheDocument()
    )
  })

  it('does not show note when all buildings have flows', async () => {
    renderIncomeAnalysis({ projectBuildings: PROJECT_BUILDINGS_FLOW_ONLY })

    await waitFor(() => expect(screen.getAllByText('Steel Mill').length).toBeGreaterThan(0))
    expect(screen.queryByText(/not shown: no production flows/)).not.toBeInTheDocument()
  })
})

// --- Gap 7: Move dropdown excludes current chain ---

describe('Gap 7: move dropdown excludes current chain', () => {
  it('does not include the current chain as a dropdown option', async () => {
    const STEEL_CHAIN = { id: 'chain-steel', name: 'Steel', position: 0, members: [0] }
    fetchProjectChains.mockResolvedValue([STEEL_CHAIN])

    renderIncomeAnalysis()
    await waitFor(() =>
      expect(screen.getByTitle('Move to chain')).toBeInTheDocument()
    )

    const select = screen.getByTitle('Move to chain')
    const optionTexts = Array.from(select.options).map(o => o.text)
    expect(optionTexts).not.toContain('Steel')
    expect(optionTexts).toContain('Ungrouped')
  })
})

// --- Gap 4: Partial price indicator (+?) ---

describe('Gap 4: partial price indicator (+?)', () => {
  it('shows (+?) in ₽ Net cell when some resources are unpriced', async () => {
    renderIncomeAnalysis({
      projectBuildings: PROJECT_BUILDINGS_FLOW_ONLY,
      prices: PRICES_PARTIAL,
    })

    await waitFor(() => {
      const matches = screen.getAllByText(/\(\+\?\)/)
      expect(matches.length).toBeGreaterThanOrEqual(1)
    })
  })

  it('shows (+?) in footer ₽ total when some resources are unpriced', async () => {
    renderIncomeAnalysis({
      projectBuildings: PROJECT_BUILDINGS_FLOW_ONLY,
      prices: PRICES_PARTIAL,
    })

    await waitFor(() => {
      const matches = screen.getAllByText(/\(\+\?\)/)
      expect(matches.length).toBeGreaterThanOrEqual(2)
    })
  })
})

// --- Gap 1: New chain button ---

describe('Gap 1: new chain button', () => {
  it('creates a new empty chain on click', async () => {
    createProjectChainAPI.mockResolvedValue({
      id: 'chain-new',
      name: 'Chain 1',
      position: 0,
      members: [],
    })

    renderIncomeAnalysis()
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'New chain' })).toBeInTheDocument()
    )

    const user = userEvent.setup({ delay: null })
    await user.click(screen.getByRole('button', { name: 'New chain' }))

    await waitFor(() =>
      expect(screen.getByDisplayValue('Chain 1')).toBeInTheDocument()
    )
    expect(createProjectChainAPI).toHaveBeenCalledWith('proj-1', 'Chain 1')
  })
})

// --- Gap 6: Chain reorder with ▲/▼ ---

describe('Gap 6: chain reorder with ▲/▼ buttons', () => {
  const CHAIN_A = { id: 'chain-a', name: 'Chain A', position: 0, members: [] }
  const CHAIN_B = { id: 'chain-b', name: 'Chain B', position: 1, members: [] }

  beforeEach(() => {
    fetchProjectChains.mockResolvedValue([CHAIN_A, CHAIN_B])
    updateProjectChainAPI.mockResolvedValue({})
  })

  it('moves chain A below chain B when ▼ is clicked on A', async () => {
    renderIncomeAnalysis()
    await waitFor(() => {
      expect(screen.getByDisplayValue('Chain A')).toBeInTheDocument()
      expect(screen.getByDisplayValue('Chain B')).toBeInTheDocument()
    })

    const downButtons = screen.getAllByTitle('Move down')
    const user = userEvent.setup({ delay: null })
    await user.click(downButtons[0])

    await waitFor(() => {
      const allInputs = screen.getAllByRole('textbox')
      const aIdx = allInputs.findIndex(el => el.value === 'Chain A')
      const bIdx = allInputs.findIndex(el => el.value === 'Chain B')
      expect(bIdx).toBeLessThan(aIdx)
    })
  })

  it('calls updateProjectChainAPI twice when reordering', async () => {
    renderIncomeAnalysis()
    await waitFor(() => expect(screen.getByDisplayValue('Chain A')).toBeInTheDocument())

    const downButtons = screen.getAllByTitle('Move down')
    const user = userEvent.setup({ delay: null })
    await user.click(downButtons[0])

    await waitFor(() => expect(updateProjectChainAPI).toHaveBeenCalledTimes(2))
  })
})
