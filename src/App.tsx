import { useEffect } from 'react'
import { HashRouter, Routes, Route } from 'react-router-dom'
import { useStore } from './store/useStore'
import { requireAuth } from './lib/supabase'
import { ProjectsHome } from './pages/ProjectsHome'
import { ProjectView } from './pages/ProjectView'
import { Workspace } from './pages/Workspace'
import { Admin } from './pages/Admin'
import { Login } from './pages/Login'
import { NotificationToaster } from './components/NotificationToaster'

export default function App() {
  const initAuth = useStore((s) => s.initAuth)
  const authReady = useStore((s) => s.authReady)
  const session = useStore((s) => s.session)

  useEffect(() => {
    initAuth()
  }, [initAuth])

  // Auth gate (only when VITE_REQUIRE_AUTH is on). Until then the app runs
  // exactly as before — anonymous link-share / local.
  if (requireAuth) {
    if (!authReady) return <div className="loading">불러오는 중…</div>
    if (!session) return <Login />
  }

  return (
    <HashRouter>
      {requireAuth && <NotificationToaster />}
      <Routes>
        <Route path="/" element={<ProjectsHome />} />
        <Route path="/project/:projectId" element={<ProjectView />} />
        <Route path="/asset/:assetId" element={<Workspace />} />
        <Route path="/admin" element={<Admin />} />
      </Routes>
    </HashRouter>
  )
}
