import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import CountrySelector from './CountrySelector'

const countries = [
  { id: 'c1', name: 'Alpha' },
  { id: 'c2', name: 'Beta' },
]

function renderSelector(overrides = {}) {
  const props = {
    countries,
    selectedCountryId: 'c1',
    onSelectCountry: vi.fn(),
    onNewCountry: vi.fn(),
    onDeleteCountry: vi.fn(),
    onRenameCountry: vi.fn(),
    ...overrides,
  }
  return { ...render(<CountrySelector {...props} />), props }
}

describe('CountrySelector', () => {
  it('renders a label, combobox display, New button, and Delete button', () => {
    renderSelector()
    expect(screen.getByText('Country:')).toBeInTheDocument()
    // WinComboBox shows the selected label as text in display area
    expect(screen.getByText('Alpha')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'New' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Delete' })).toBeInTheDocument()
  })

  it('renders options matching countries prop when opened', async () => {
    const user = userEvent.setup()
    renderSelector()
    // Click the arrow button to open dropdown
    await user.click(screen.getByText('▼'))
    expect(screen.getAllByText('Alpha').length).toBeGreaterThan(0)
    expect(screen.getByText('Beta')).toBeInTheDocument()
  })

  it('shows selected country label in display', () => {
    renderSelector({ selectedCountryId: 'c2' })
    expect(screen.getByText('Beta')).toBeInTheDocument()
  })

  it('calls onSelectCountry with id when option is clicked', async () => {
    const user = userEvent.setup()
    const { props } = renderSelector({ selectedCountryId: 'c1' })

    // Open dropdown
    await user.click(screen.getByText('▼'))
    // Click Beta option
    await user.click(screen.getByText('Beta'))

    expect(props.onSelectCountry).toHaveBeenCalledWith('c2')
  })

  it('calls onNewCountry when New button is clicked', async () => {
    const user = userEvent.setup()
    const { props } = renderSelector()

    await user.click(screen.getByRole('button', { name: 'New' }))

    expect(props.onNewCountry).toHaveBeenCalledTimes(1)
  })

  it('calls onDeleteCountry when Delete button is clicked', async () => {
    const user = userEvent.setup()
    const { props } = renderSelector()

    await user.click(screen.getByRole('button', { name: 'Delete' }))

    expect(props.onDeleteCountry).toHaveBeenCalledTimes(1)
  })

  it('Delete button is disabled when selectedCountryId is null', () => {
    renderSelector({ selectedCountryId: null })
    expect(screen.getByRole('button', { name: 'Delete' })).toBeDisabled()
  })

  it('Delete button is enabled when a country is selected', () => {
    renderSelector({ selectedCountryId: 'c1' })
    expect(screen.getByRole('button', { name: 'Delete' })).toBeEnabled()
  })

  it('shows placeholder when no country selected and no countries', () => {
    renderSelector({ countries: [], selectedCountryId: null })
    expect(screen.getByText('-- Select --')).toBeInTheDocument()
  })

  it('calls onRenameCountry when double-clicking display and committing edit', async () => {
    const user = userEvent.setup()
    const { props } = renderSelector({ selectedCountryId: 'c1' })

    // Double-click display to enter edit mode
    const display = screen.getByText('Alpha').closest('.win95-combobox-display')
    await user.dblClick(display)

    // Clear and type new name
    const input = screen.getByRole('textbox')
    await user.clear(input)
    await user.type(input, 'New Name')
    await user.keyboard('{Enter}')

    expect(props.onRenameCountry).toHaveBeenCalledWith('c1', 'New Name')
  })
})
