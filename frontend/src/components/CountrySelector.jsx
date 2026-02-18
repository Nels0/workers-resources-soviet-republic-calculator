function CountrySelector({ countries, selectedCountryId, onSelectCountry, onNewCountry, onDeleteCountry }) {
  return (
    <>
      <span className="win95-nav-label">Country:</span>
      <select
        className="win95-select"
        value={selectedCountryId || ''}
        onChange={e => onSelectCountry(e.target.value)}
      >
        {countries.map(c => (
          <option key={c.id} value={c.id}>{c.name}</option>
        ))}
      </select>
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
