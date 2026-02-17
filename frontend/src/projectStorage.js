import {
  fetchProjects, createProjectAPI, deleteProjectAPI,
  addBuildingAPI, removeBuildingAPI, updateBuildingQtyAPI,
  updatePricesAPI, importProjectsAPI,
} from './api'

const STORAGE_KEY = 'wrsr-projects'

export async function loadProjects() {
  return fetchProjects()
}

export async function createProject(name) {
  return createProjectAPI(name)
}

export async function deleteProject(id) {
  await deleteProjectAPI(id)
  return fetchProjects()
}

export async function addBuilding(projectId, buildingId) {
  await addBuildingAPI(projectId, buildingId)
  return fetchProjects()
}

export async function removeBuilding(projectId, position) {
  await removeBuildingAPI(projectId, position)
  return fetchProjects()
}

export async function updateBuildingQty(projectId, position, qty) {
  await updateBuildingQtyAPI(projectId, position, qty)
  return fetchProjects()
}

export async function updatePrices(projectId, prices) {
  await updatePricesAPI(projectId, prices)
  return fetchProjects()
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
