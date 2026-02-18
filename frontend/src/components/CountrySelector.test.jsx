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
    ...overrides,
  }
  return { ...render(<CountrySelector {...props} />), props }
}

describe('CountrySelector', () => {
  it('renders a label, select, New button, and Delete button', () => {
    renderSelector()
    expect(screen.getByText('Country:')).toBeInTheDocument()
    expect(screen.getByRole('combobox')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'New' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Delete' })).toBeInTheDocument()
  })

  it('renders options matching countries prop', () => {
    renderSelector()
    expect(screen.getByRole('option', { name: 'Alpha' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Beta' })).toBeInTheDocument()
  })

  it('select value matches selectedCountryId', () => {
    renderSelector({ selectedCountryId: 'c2' })
    expect(screen.getByRole('combobox')).toHaveValue('c2')
  })

  it('calls onSelectCountry with id when select changes', async () => {
    const user = userEvent.setup()
    const { props } = renderSelector({ selectedCountryId: 'c1' })

    await user.selectOptions(screen.getByRole('combobox'), 'c2')

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

  it('renders empty select when no countries', () => {
    renderSelector({ countries: [], selectedCountryId: null })
    const select = screen.getByRole('combobox')
    expect(select.options.length).toBe(0)
  })
})
