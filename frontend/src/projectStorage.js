import {
  fetchProjects, createProjectAPI, deleteProjectAPI,
  addBuildingAPI, removeBuildingAPI, updateBuildingQtyAPI,
  updateBuildingProductivityAPI,
  updateCountryPricesAPI, importProjectsAPI,
} from './api'

const STORAGE_KEY = 'wrsr-projects'

export async function loadProjects(countryId = null) {
  return fetchProjects(countryId)
}

export async function createProject(name, countryId = null) {
  return createProjectAPI(name, countryId)
}

export async function deleteProject(id, countryId = null) {
  await deleteProjectAPI(id)
  return fetchProjects(countryId)
}

export async function addBuilding(projectId, buildingId, countryId = null) {
  await addBuildingAPI(projectId, buildingId)
  return fetchProjects(countryId)
}

export async function removeBuilding(projectId, position, countryId = null) {
  await removeBuildingAPI(projectId, position)
  return fetchProjects(countryId)
}

export async function updateBuildingQty(projectId, position, qty, countryId = null) {
  await updateBuildingQtyAPI(projectId, position, qty)
  return fetchProjects(countryId)
}

export async function updateBuildingProductivity(projectId, position, productivity, countryId = null) {
  await updateBuildingProductivityAPI(projectId, position, productivity)
  return fetchProjects(countryId)
}

export async function updateCountryPrices(countryId, prices) {
  return updateCountryPricesAPI(countryId, prices)
}

export async function migrateFromLocalStorage() {
  const raw = localStorage.getItem(STORAGE_KEY)
  if (!raw) return false
  try {
    const projects = JSON.parse(raw)
    if (projects.length > 0) {
      await importProjectsAPI(projects)
    }
    localStorage.removeItem(STORAGE_KEY)
    return true
  } catch {
    return false
  }
}
