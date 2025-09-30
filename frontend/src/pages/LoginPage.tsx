import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { authApi } from '@/lib/api'

export default function LoginPage() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [checking, setChecking] = useState(true)
  const [form, setForm] = useState({
    username: 'admin', // 默认填充 admin
    password: '',
  })

  // 检查是否已登录
  useEffect(() => {
    const checkAuth = async () => {
      const token = localStorage.getItem('auth_token')
      if (token) {
        try {
          await authApi.me()
          // 已登录，跳转到首页
          navigate('/', { replace: true })
        } catch (error) {
          // Token 无效，清除并继续显示登录页
          localStorage.removeItem('auth_token')
        }
      }
      setChecking(false)
    }

    checkAuth()
  }, [navigate])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    const username = form.username?.trim() || ''
    const password = form.password?.trim() || ''

    console.log('Login attempt:', { username, passwordLength: password.length })

    if (!username) {
      toast.error('请输入用户名')
      return
    }

    if (!password) {
      toast.error('请输入密码')
      return
    }

    setLoading(true)
    try {
      const response = await authApi.login(username, password)

      if (response.data.success) {
        // 保存 token
        localStorage.setItem('auth_token', response.data.token)
        toast.success('登录成功')

        // 跳转到首页
        navigate('/')
      } else {
        toast.error('登录失败')
      }
    } catch (error: any) {
      console.error('Login error:', error)
      const errorMsg = error.response?.data?.error || '登录失败，请重试'
      toast.error(errorMsg)
    } finally {
      setLoading(false)
    }
  }

  // 正在检查登录状态时显示加载
  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">加载中...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#8B4513]/10 via-background to-[#2563EB]/10">
      <div className="w-full max-w-md px-4">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold mb-2">🪹 MyNest</h1>
          <p className="text-muted-foreground">链接的归巢</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>登录</CardTitle>
            <CardDescription>
              请使用管理员账号登录
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="username">用户名</Label>
                <Input
                  id="username"
                  name="username"
                  type="text"
                  placeholder="admin"
                  value={form.username}
                  onChange={(e) => setForm({ ...form, username: e.target.value })}
                  disabled={loading}
                  autoComplete="username"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">密码</Label>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  placeholder="请输入密码"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  disabled={loading}
                  autoComplete="current-password"
                />
              </div>

              <Button
                type="submit"
                className="w-full"
                disabled={loading}
              >
                {loading ? '登录中...' : '登录'}
              </Button>
            </form>

            <div className="mt-6 text-sm text-muted-foreground text-center">
              <p className="mb-1">💡 首次启动时</p>
              <p>默认用户名：<code className="bg-muted px-1 py-0.5 rounded">admin</code></p>
              <p>密码请查看服务启动日志</p>
            </div>
          </CardContent>
        </Card>

        <div className="mt-6 text-center text-sm text-muted-foreground">
          <p>MyNest v1.0.0</p>
        </div>
      </div>
    </div>
  )
}