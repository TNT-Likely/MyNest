import { BrowserRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import TasksPage from './pages/TasksPage'
import PluginsPage from './pages/PluginsPage'
import SystemConfig from './pages/SystemConfig'

function Navigation() {
  const location = useLocation()

  const isActive = (path: string) => {
    return location.pathname === path
  }

  return (
    <nav className="border-b bg-card">
      <div className="container mx-auto px-4">
        <div className="flex h-16 items-center justify-between">
          <div className="flex items-center space-x-8">
            <div className="flex items-center space-x-2">
              <h1 className="text-xl font-bold">🪹 MyNest</h1>
              <span className="text-sm text-muted-foreground">链接的归巢</span>
            </div>
            <div className="flex items-center space-x-6">
              <Link
                to="/"
                className={`text-sm font-medium transition-colors hover:text-primary ${
                  isActive('/') ? 'text-primary' : 'text-muted-foreground'
                }`}
              >
                下载任务
              </Link>
              <Link
                to="/plugins"
                className={`text-sm font-medium transition-colors hover:text-primary ${
                  isActive('/plugins') ? 'text-primary' : 'text-muted-foreground'
                }`}
              >
                插件管理
              </Link>
              <Link
                to="/settings"
                className={`text-sm font-medium transition-colors hover:text-primary ${
                  isActive('/settings') ? 'text-primary' : 'text-muted-foreground'
                }`}
              >
                系统配置
              </Link>
            </div>
          </div>
        </div>
      </div>
    </nav>
  )
}

function App() {
  return (
    <Router>
      <div className="min-h-screen bg-background">
        <Navigation />

        <main className="container mx-auto px-4 py-8">
          <Routes>
            <Route path="/" element={<TasksPage />} />
            <Route path="/plugins" element={<PluginsPage />} />
            <Route path="/settings" element={<SystemConfig />} />
          </Routes>
        </main>
        <Toaster
          position="top-right"
          toastOptions={{
            className: 'bg-background text-foreground border',
          }}
        />
      </div>
    </Router>
  )
}

export default App