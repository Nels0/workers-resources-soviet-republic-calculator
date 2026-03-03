import WinComboBox from './WinComboBox'

function CountrySelector({ countries, selectedCountryId, onSelectCountry, onNewCountry, onDeleteCountry, onRenameCountry }) {
  const items = countries.map(c => ({ id: c.id, label: c.name }))

  return (
    <>
      <span className="win95-nav-label">Country:</span>
      <WinComboBox
        items={items}
        selectedId={selectedCountryId}
        onSelect={onSelectCountry}
        onRename={onRenameCountry}
        placeholder="-- Select --"
      />
      <button className="win95-btn" onClick={onNewCountry}>New</button>
      <button
        className="win95-btn"
        onClick={onDeleteCountry}
        disabled={!selectedCountryId}
      >
        Delete
      </button>
    </>
  )
}

export default CountrySelector
