import { useEffect } from 'react'
import { HashRouter, Routes, Route } from 'react-router-dom'
import { useStore } from './store/useStore'
import { ProjectsHome } from './pages/ProjectsHome'
import { ProjectView } from './pages/ProjectView'
import { Workspace } from './pages/Workspace'

export default function App() {
  const init = useStore((s) => s.init)
  useEffect(() => {
    init()
  }, [init])

  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<ProjectsHome />} />
        <Route path="/project/:projectId" element={<ProjectView />} />
        <Route path="/asset/:assetId" element={<Workspace />} />
      </Routes>
    </HashRouter>
  )
}
