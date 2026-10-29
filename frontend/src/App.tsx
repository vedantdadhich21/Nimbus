import { Navigate, Outlet, Route, Routes } from 'react-router-dom'
import { Shell } from '@/components/Shell'
import { useSession } from '@/lib/useSession'
import { Mark } from '@/components/ui'
import { DriveScreen } from '@/screens/Drive'
import { RecentScreen } from '@/screens/Recent'
import { SearchScreen } from '@/screens/Search'
import { TrashScreen } from '@/screens/Trash'
import { SettingsScreen } from '@/screens/Settings'
import { ViewerScreen } from '@/screens/Viewer'
import { SetupScreen } from '@/screens/Setup'
import { UnlockScreen } from '@/screens/Unlock'

function Splash() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-paper text-ink">
      <Mark size={20} />
      <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-faint">loading local index</p>
    </div>
  )
}

function RequireUnlocked() {
  const { data, isLoading } = useSession()
  if (isLoading || !data) return <Splash />
  if (data.state === 'needs_setup') return <Navigate to="/setup" replace />
  if (data.state === 'locked') return <Navigate to="/unlock" replace />
  return <Outlet />
}

function SetupRoute() {
  const { data, isLoading } = useSession()
  if (isLoading || !data) return <Splash />
  if (data.state === 'unlocked') return <Navigate to="/drive" replace />
  if (data.state === 'locked') return <Navigate to="/unlock" replace />
  return <SetupScreen />
}

function UnlockRoute() {
  const { data, isLoading } = useSession()
  if (isLoading || !data) return <Splash />
  if (data.state === 'needs_setup') return <Navigate to="/setup" replace />
  if (data.state === 'unlocked') return <Navigate to="/drive" replace />
  return <UnlockScreen />
}

export default function App() {
  return (
    <Routes>
      <Route path="/setup" element={<SetupRoute />} />
      <Route path="/unlock" element={<UnlockRoute />} />

      <Route element={<RequireUnlocked />}>
        <Route element={<Shell />}>
          <Route path="/drive" element={<DriveScreen />} />
          <Route path="/drive/:folderId" element={<DriveScreen />} />
          <Route path="/recent" element={<RecentScreen />} />
          <Route path="/search" element={<SearchScreen />} />
          <Route path="/trash" element={<TrashScreen />} />
          <Route path="/settings" element={<SettingsScreen />} />
          <Route path="/file/:fileId" element={<ViewerScreen />} />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/drive" replace />} />
    </Routes>
  )
}
