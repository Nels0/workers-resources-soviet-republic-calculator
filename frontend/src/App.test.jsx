import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import App from './App'

// Mock heavy child routes to isolate App-level logic
vi.mock('./components/BuildingList', () => ({
  default: () => <div data-testid="building-list" />
}))
vi.mock('./components/BuildingDetail', () => ({
  default: () => <div data-testid="building-detail" />
}))
vi.mock('./components/ProjectView', () => ({
  default: ({ countryId }) => (
    <div data-testid="project-view" data-country-id={countryId} />
  )
}))

// Mock api module
const mockApi = vi.hoisted(() => ({
  fetchCountries: vi.fn(),
  createCountryAPI: vi.fn(),
  deleteCountryAPI: vi.fn(),
  updateCountryAPI: vi.fn(),
  fetchCountryPrices: vi.fn(),
  updateCountryPricesAPI: vi.fn(),
  fetchProjects: vi.fn(),
  createProjectAPI: vi.fn(),
  deleteProjectAPI: vi.fn(),
  addBuildingAPI: vi.fn(),
  removeBuildingAPI: vi.fn(),
  updateBuildingQtyAPI: vi.fn(),
  importProjectsAPI: vi.fn(),
}))

vi.mock('./api', () => mockApi)

function renderApp(route = '/') {
  return render(
    <MemoryRouter initialEntries={[route]}>
      <App />
    </MemoryRouter>
  )
}

describe('App country selector', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockApi.fetchCountryPrices.mockResolvedValue({})
  })

  it('fetches countries on mount', async () => {
    mockApi.fetchCountries.mockResolvedValue([])

    renderApp()

    await waitFor(() => {
      expect(mockApi.fetchCountries).toHaveBeenCalledTimes(1)
    })
  })

  it('renders CountrySelector in taskbar', async () => {
    mockApi.fetchCountries.mockResolvedValue([
      { id: 'c1', name: 'Country A' }
    ])

    renderApp()

    await waitFor(() => {
      expect(screen.getByText('Country:')).toBeInTheDocument()
      // WinComboBox shows selected label in display
      expect(screen.getByText('Country A')).toBeInTheDocument()
    })
  })

  it('auto-selects first country on load', async () => {
    mockApi.fetchCountries.mockResolvedValue([
      { id: 'c1', name: 'Country A' },
      { id: 'c2', name: 'Country B' },
    ])

    renderApp()

    await waitFor(() => {
      // First country's name should be displayed in the combo box
      expect(screen.getByText('Country A')).toBeInTheDocument()
    })
  })

  it('shows placeholder when no countries loaded', async () => {
    mockApi.fetchCountries.mockResolvedValue([])

    renderApp()

    await waitFor(() => {
      expect(screen.getByText('-- Select --')).toBeInTheDocument()
    })
  })

  it('shows create country dialog when New button is clicked', async () => {
    mockApi.fetchCountries.mockResolvedValue([])
    const user = userEvent.setup()

    renderApp()

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'New' })).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: 'New' }))

    expect(screen.getByText('New Country', { selector: '.win95-titlebar span' })).toBeInTheDocument()
    expect(screen.getByLabelText('Country name:')).toBeInTheDocument()
  })

  it('creates country and selects it on submit', async () => {
    const newCountry = { id: 'c-new', name: 'My Country', created_at: '2026-01-01T00:00:00' }
    mockApi.fetchCountries
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([newCountry])
    mockApi.createCountryAPI.mockResolvedValue(newCountry)

    const user = userEvent.setup()
    renderApp()

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'New' })).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: 'New' }))
    await user.type(screen.getByLabelText('Country name:'), 'My Country')
    await user.click(screen.getByRole('button', { name: 'OK' }))

    await waitFor(() => {
      expect(mockApi.createCountryAPI).toHaveBeenCalledWith('My Country')
    })

    await waitFor(() => {
      expect(screen.getByText('My Country')).toBeInTheDocument()
    })
  })

  it('shows delete country dialog when Delete button is clicked', async () => {
    mockApi.fetchCountries.mockResolvedValue([{ id: 'c1', name: 'Alpha' }])
    const user = userEvent.setup()

    renderApp()

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Delete' })).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: 'Delete' }))

    expect(screen.getByText('Confirm Delete', { selector: '.win95-titlebar span' })).toBeInTheDocument()
  })

  it('deletes country and selects next on confirm', async () => {
    mockApi.fetchCountries
      .mockResolvedValueOnce([
        { id: 'c1', name: 'Alpha' },
        { id: 'c2', name: 'Beta' },
      ])
      .mockResolvedValueOnce([{ id: 'c2', name: 'Beta' }])
    mockApi.deleteCountryAPI.mockResolvedValue({ ok: true })

    const user = userEvent.setup()
    renderApp()

    await waitFor(() => {
      expect(screen.getByText('Alpha')).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: 'Delete' }))
    await user.click(screen.getByRole('button', { name: 'Yes' }))

    await waitFor(() => {
      expect(mockApi.deleteCountryAPI).toHaveBeenCalledWith('c1')
    })

    await waitFor(() => {
      expect(screen.getByText('Beta')).toBeInTheDocument()
    })
  })
})
