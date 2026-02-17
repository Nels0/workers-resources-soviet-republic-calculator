const BASE = '/api';

async function fetchJSON(url, options) {
  const res = await fetch(`${BASE}${url}`, options);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || res.statusText);
  }
  return res.json();
}

export function fetchBuildingsList(search = '', category = '') {
  const params = new URLSearchParams();
  if (search) params.set('search', search);
  if (category) params.set('category', category);
  const qs = params.toString();
  return fetchJSON(`/buildings${qs ? '?' + qs : ''}`);
}

export function fetchBuildings(search = '', category = '') {
  return fetchBuildingsList(search, category).then(data => data.buildings);
}

export function fetchBuilding(id) {
  return fetchJSON(`/buildings/${id}`);
}

export function fetchResources() {
  return fetchJSON('/resources');
}

export function calculateCosts(items) {
  return fetchJSON('/calculate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ items }),
  });
}

// Project API

export function fetchProjects() {
  return fetchJSON('/projects');
}

export function createProjectAPI(name) {
  return fetchJSON('/projects', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  });
}

export function deleteProjectAPI(id) {
  return fetchJSON(`/projects/${id}`, { method: 'DELETE' });
}

export function addBuildingAPI(projectId, buildingId) {
  return fetchJSON(`/projects/${projectId}/buildings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ buildingId }),
  });
}

export function removeBuildingAPI(projectId, pos) {
  return fetchJSON(`/projects/${projectId}/buildings/${pos}`, {
    method: 'DELETE',
  });
}

export function updateBuildingQtyAPI(projectId, pos, quantity) {
  return fetchJSON(`/projects/${projectId}/buildings/${pos}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ quantity }),
  });
}

export function updatePricesAPI(projectId, prices) {
  return fetchJSON(`/projects/${projectId}/prices`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prices }),
  });
}

export function importProjectsAPI(projects) {
  return fetchJSON('/projects/import', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ projects }),
  });
}
