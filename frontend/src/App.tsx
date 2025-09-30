import { BrowserRouter as Router, Routes, Route, Link, useLocation, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { useState, useEffect, useCallback } from 'react'
import TasksPage from './pages/TasksPage'
import PluginsPage from './pages/PluginsPage'
import SystemConfig from './pages/SystemConfig'
import SystemLogs from './pages/SystemLogs'
import TokensPage from './pages/TokensPage'
import LoginPage from './pages/LoginPage'
import { authApi, User } from './lib/api'
import { LogOut } from 'lucide-react'
import { Button } from './components/ui/button'

function Navigation({ user, onLogout, onRefreshUser }: { user: User | null; onLogout: () => void; onRefreshUser: () => void }) {
  const location = useLocation()

  // 当路由变化时，检查是否需要刷新用户信息
  useEffect(() => {
    const token = localStorage.getItem('auth_token')
    if (token && !user) {
      onRefreshUser()
    }
  }, [location.pathname, user, onRefreshUser])

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
              <Link
                to="/logs"
                className={`text-sm font-medium transition-colors hover:text-primary ${
                  isActive('/logs') ? 'text-primary' : 'text-muted-foreground'
                }`}
              >
                系统日志
              </Link>
              <Link
                to="/tokens"
                className={`text-sm font-medium transition-colors hover:text-primary ${
                  isActive('/tokens') ? 'text-primary' : 'text-muted-foreground'
                }`}
              >
                API Token
              </Link>
            </div>
          </div>
          <div className="flex items-center space-x-4">
            {user && (
              <>
                <span className="text-sm text-muted-foreground">
                  {user.username}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onLogout}
                >
                  <LogOut className="w-4 h-4 mr-2" />
                  退出
                </Button>
              </>
            )}
          </div>
        </div>
      </div>
    </nav>
  )
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const token = localStorage.getItem('auth_token')

  if (!token) {
    return <Navigate to="/login" replace />
  }

  return <>{children}</>
}

function App() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  const checkAuth = useCallback(async () => {
    const token = localStorage.getItem('auth_token')
    if (!token) {
      setLoading(false)
      return
    }

    try {
      const response = await authApi.me()
      setUser(response.data.user)
    } catch (error) {
      console.error('Auth check failed:', error)
      localStorage.removeItem('auth_token')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    checkAuth()
  }, [checkAuth])

  const handleLogout = () => {
    localStorage.removeItem('auth_token')
    setUser(null)
    window.location.href = '/login'
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">加载中...</p>
      </div>
    )
  }

  return (
    <Router>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/*"
          element={
            <ProtectedRoute>
              <div className="min-h-screen bg-background">
                <Navigation user={user} onLogout={handleLogout} onRefreshUser={checkAuth} />
                <main className="container mx-auto px-4 py-8">
                  <Routes>
                    <Route path="/" element={<TasksPage />} />
                    <Route path="/plugins" element={<PluginsPage />} />
                    <Route path="/settings" element={<SystemConfig />} />
                    <Route path="/logs" element={<SystemLogs />} />
                    <Route path="/tokens" element={<TokensPage />} />
                  </Routes>
                </main>
              </div>
            </ProtectedRoute>
          }
        />
      </Routes>
      <Toaster
        position="top-right"
        toastOptions={{
          className: 'bg-background text-foreground border',
        }}
      />
    </Router>
  )
}

export default App