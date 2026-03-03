import { useState, useEffect } from 'react'
import {
  fetchProjectChains,
  autoDetectChainsAPI,
  bulkReplaceProjectChainsAPI,
  createProjectChainAPI,
  updateProjectChainAPI,
  deleteProjectChainAPI,
  updateChainMembersAPI,
} from '../api'

export function useChains(projectId) {
  const [chains, setChains] = useState([])
  const [savingChains, setSavingChains] = useState(false)
  const [chainError, setChainError] = useState(null)

  useEffect(() => {
    if (!projectId) {
      setChains([])
      return
    }
    fetchProjectChains(projectId)
      .then(setChains)
      .catch(console.error)
  }, [projectId])

  async function autoDetectChains() {
    setSavingChains(true)
    setChainError(null)
    try {
      const { chains: suggestions } = await autoDetectChainsAPI(projectId)
      const saved = await bulkReplaceProjectChainsAPI(projectId, suggestions)
      setChains(saved)
    } catch (e) {
      console.error(e)
      setChainError('Failed to save chains. Try again.')
    } finally {
      setSavingChains(false)
    }
  }

  async function clearChains() {
    setSavingChains(true)
    setChainError(null)
    try {
      await bulkReplaceProjectChainsAPI(projectId, [])
      setChains([])
    } catch (e) {
      console.error(e)
      setChainError('Failed to save chains. Try again.')
    } finally {
      setSavingChains(false)
    }
  }

  async function createChain() {
    const nextNum = chains.length + 1
    setSavingChains(true)
    setChainError(null)
    try {
      const created = await createProjectChainAPI(projectId, `Chain ${nextNum}`)
      setChains(prev => [...prev, created])
    } catch (e) {
      console.error(e)
      setChainError('Failed to create chain. Try again.')
    } finally {
      setSavingChains(false)
    }
  }

  function renameChain(chainId, value) {
    setChains(prev => prev.map(c => c.id === chainId ? { ...c, name: value } : c))
  }

  function commitChainName(chainId) {
    const chain = chains.find(c => c.id === chainId)
    if (chain && chain.name.trim()) {
      updateProjectChainAPI(projectId, chainId, chain.name.trim()).catch(console.error)
    }
  }

  async function reorderChain(chainId, direction) {
    const sorted = [...chains].sort((a, b) => a.position - b.position)
    const idx = sorted.findIndex(c => c.id === chainId)
    if (direction === 'up' && idx <= 0) return
    if (direction === 'down' && idx >= sorted.length - 1) return

    const otherIdx = direction === 'up' ? idx - 1 : idx + 1
    const chainA = sorted[Math.min(idx, otherIdx)]
    const chainB = sorted[Math.max(idx, otherIdx)]

    setChains(prev => prev.map(c => {
      if (c.id === chainA.id) return { ...c, position: chainB.position }
      if (c.id === chainB.id) return { ...c, position: chainA.position }
      return c
    }))
    try {
      await Promise.all([
        updateProjectChainAPI(projectId, chainA.id, chainA.name, chainB.position),
        updateProjectChainAPI(projectId, chainB.id, chainB.name, chainA.position),
      ])
    } catch (e) {
      console.error(e)
      fetchProjectChains(projectId).then(setChains).catch(console.error)
    }
  }

  async function dissolveChain(chainId) {
    try {
      await deleteProjectChainAPI(projectId, chainId)
      setChains(prev => prev.filter(c => c.id !== chainId))
    } catch (e) {
      console.error(e)
    }
  }

  async function updateChainMembers(buildingPos, targetChainId) {
    const currentChainId = chains.find(c => c.members.includes(buildingPos))?.id || 'ungrouped'
    if (currentChainId === targetChainId) return

    const currentChain = chains.find(c => c.id === currentChainId)
    const targetChain = chains.find(c => c.id === targetChainId)

    setChains(prev => prev.map(c => {
      if (c.id === currentChainId) return { ...c, members: c.members.filter(p => p !== buildingPos) }
      if (c.id === targetChainId) return { ...c, members: [...c.members, buildingPos] }
      return c
    }))

    try {
      if (targetChainId === 'ungrouped') {
        if (currentChain) {
          await updateChainMembersAPI(projectId, currentChainId, currentChain.members.filter(p => p !== buildingPos))
        }
      } else if (targetChain) {
        const newMembers = [...targetChain.members.filter(p => p !== buildingPos), buildingPos]
        const updated = await updateChainMembersAPI(projectId, targetChainId, newMembers)
        setChains(prev => prev.map(c => c.id === targetChainId ? updated : c))
      }
    } catch (e) {
      console.error(e)
      fetchProjectChains(projectId).then(setChains).catch(console.error)
    }
  }

  return {
    chains,
    setChains,
    savingChains,
    chainError,
    autoDetectChains,
    clearChains,
    createChain,
    renameChain,
    commitChainName,
    reorderChain,
    dissolveChain,
    updateChainMembers,
  }
}
