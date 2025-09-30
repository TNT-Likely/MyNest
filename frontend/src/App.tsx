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
import { LogOut, Menu } from 'lucide-react'
import { Button } from './components/ui/button'
import { Sheet, SheetContent, SheetTrigger } from './components/ui/sheet'

function Navigation({ user, onLogout, onRefreshUser }: { user: User | null; onLogout: () => void; onRefreshUser: () => void }) {
  const location = useLocation()
  const [open, setOpen] = useState(false)

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

  const navLinks = [
    { path: '/', label: '下载任务' },
    { path: '/plugins', label: '插件管理' },
    { path: '/settings', label: '系统配置' },
    { path: '/logs', label: '系统日志' },
    { path: '/tokens', label: 'API Token' },
  ]

  return (
    <nav className="border-b bg-card sticky top-0 z-50">
      <div className="w-full px-4">
        <div className="flex h-16 items-center justify-between">
          {/* 左侧：品牌 + 导航 */}
          <div className="flex items-center gap-8">
            {/* Logo */}
            <Link to="/" className="flex items-center space-x-2 flex-shrink-0">
              <h1 className="text-xl font-bold">🪹 MyNest</h1>
              <span className="hidden sm:inline text-sm text-muted-foreground">链接的归巢</span>
              <span className="hidden lg:inline text-xs text-muted-foreground/60 px-2 py-0.5 rounded-full bg-muted/50">
                v{__APP_VERSION__}
              </span>
            </Link>

            {/* 桌面端导航 */}
            <div className="hidden md:flex items-center space-x-6">
              {navLinks.map((link) => (
                <Link
                  key={link.path}
                  to={link.path}
                  className={`text-sm font-medium transition-colors hover:text-primary whitespace-nowrap ${
                    isActive(link.path) ? 'text-primary' : 'text-muted-foreground'
                  }`}
                >
                  {link.label}
                </Link>
              ))}
            </div>
          </div>

          {/* 右侧：用户信息和移动端菜单 */}
          <div className="flex items-center space-x-2">
            {user && (
              <>
                <span className="hidden sm:inline text-sm text-muted-foreground">
                  {user.username}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onLogout}
                  className="hidden sm:flex"
                >
                  <LogOut className="w-4 h-4 mr-2" />
                  退出
                </Button>
              </>
            )}

            {/* 移动端汉堡菜单 */}
            <Sheet open={open} onOpenChange={setOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="sm" className="md:hidden">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-64">
                <div className="flex flex-col space-y-4 mt-8">
                  {user && (
                    <div className="pb-4 border-b">
                      <p className="text-sm font-medium">{user.username}</p>
                      <p className="text-xs text-muted-foreground mt-1">v{__APP_VERSION__}</p>
                    </div>
                  )}
                  {navLinks.map((link) => (
                    <Link
                      key={link.path}
                      to={link.path}
                      onClick={() => setOpen(false)}
                      className={`text-base font-medium transition-colors hover:text-primary py-2 ${
                        isActive(link.path) ? 'text-primary' : 'text-muted-foreground'
                      }`}
                    >
                      {link.label}
                    </Link>
                  ))}
                  <Button
                    variant="ghost"
                    onClick={() => {
                      setOpen(false)
                      onLogout()
                    }}
                    className="justify-start px-0 text-base font-medium text-muted-foreground hover:text-primary"
                  >
                    <LogOut className="w-4 h-4 mr-2" />
                    退出
                  </Button>
                </div>
              </SheetContent>
            </Sheet>
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
              <div className="min-h-screen bg-background overflow-x-hidden">
                <Navigation user={user} onLogout={handleLogout} onRefreshUser={checkAuth} />
                <main className="container mx-auto px-4 sm:px-6 py-6 sm:py-8 max-w-full">
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
        position="top-center"
        toastOptions={{
          className: 'bg-background text-foreground border shadow-lg',
          style: {
            minWidth: '280px',
            maxWidth: '90vw',
            padding: '16px',
            fontSize: '14px',
            fontWeight: '500',
          },
          duration: 3000,
          success: {
            className: 'bg-green-50 border-green-200 text-green-900',
            iconTheme: {
              primary: '#10b981',
              secondary: '#fff',
            },
          },
          error: {
            className: 'bg-red-50 border-red-200 text-red-900',
            iconTheme: {
              primary: '#ef4444',
              secondary: '#fff',
            },
          },
          loading: {
            className: 'bg-blue-50 border-blue-200 text-blue-900',
            iconTheme: {
              primary: '#3b82f6',
              secondary: '#fff',
            },
          },
        }}
      />
    </Router>
  )
}

export default App