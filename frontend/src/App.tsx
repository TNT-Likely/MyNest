import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom'
import TasksPage from './pages/TasksPage'
import PluginsPage from './pages/PluginsPage'
import SystemConfig from './pages/SystemConfig'

function App() {
  return (
    <Router>
      <div className="min-h-screen bg-background">
        <nav className="border-b bg-card">
          <div className="container mx-auto px-4">
            <div className="flex h-16 items-center justify-between">
              <div className="flex items-center space-x-8">
                <div className="flex items-center space-x-2">
                  <h1 className="text-2xl font-bold">🪹 MyNest</h1>
                  <span className="text-sm text-muted-foreground">链接的归巢</span>
                </div>
                <div className="flex space-x-6">
                  <Link
                    to="/"
                    className="text-sm font-medium transition-colors hover:text-primary"
                  >
                    下载任务
                  </Link>
                  <Link
                    to="/plugins"
                    className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
                  >
                    插件管理
                  </Link>
                  <Link
                    to="/settings"
                    className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
                  >
                    系统配置
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </nav>

        <main className="container mx-auto px-4 py-8">
          <Routes>
            <Route path="/" element={<TasksPage />} />
            <Route path="/plugins" element={<PluginsPage />} />
            <Route path="/settings" element={<SystemConfig />} />
          </Routes>
        </main>
      </div>
    </Router>
  )
}

export default App