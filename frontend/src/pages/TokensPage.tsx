import { useState, useEffect } from 'react'
import toast from 'react-hot-toast'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Switch } from '@/components/ui/switch'
import { tokensApi, APIToken } from '@/lib/api'
import { Plus, Copy, Trash2, Eye, EyeOff, Edit } from 'lucide-react'

export default function TokensPage() {
  const [tokens, setTokens] = useState<APIToken[]>([])
  const [loading, setLoading] = useState(true)
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [selectedToken, setSelectedToken] = useState<APIToken | null>(null)
  const [showTokens, setShowTokens] = useState<Record<number, boolean>>({})

  // 创建表单
  const [createForm, setCreateForm] = useState({
    name: '',
    description: '',
  })

  // 编辑表单
  const [editForm, setEditForm] = useState({
    name: '',
    description: '',
    enabled: true,
  })

  useEffect(() => {
    loadTokens()
  }, [])

  const loadTokens = async () => {
    try {
      const response = await tokensApi.list()
      setTokens(response.data.tokens || [])
    } catch (error) {
      console.error('Failed to load tokens:', error)
      toast.error('加载 Token 列表失败')
    } finally {
      setLoading(false)
    }
  }

  const handleCreate = async () => {
    if (!createForm.name.trim()) {
      toast.error('请输入 Token 名称')
      return
    }

    try {
      const response = await tokensApi.create(createForm.name, createForm.description)
      toast.success('✅ Token 创建成功！')

      // 显示新创建的 token
      const newToken = response.data.token
      setShowTokens({ ...showTokens, [newToken.id]: true })

      setCreateDialogOpen(false)
      setCreateForm({ name: '', description: '' })
      loadTokens()
    } catch (error) {
      console.error('Failed to create token:', error)
      toast.error('创建 Token 失败')
    }
  }

  const handleEdit = (token: APIToken) => {
    setSelectedToken(token)
    setEditForm({
      name: token.name,
      description: token.description || '',
      enabled: token.enabled,
    })
    setEditDialogOpen(true)
  }

  const handleUpdate = async () => {
    if (!selectedToken) return

    if (!editForm.name.trim()) {
      toast.error('请输入 Token 名称')
      return
    }

    try {
      await tokensApi.update(
        selectedToken.id,
        editForm.name,
        editForm.description,
        editForm.enabled
      )
      toast.success('✅ Token 更新成功')
      setEditDialogOpen(false)
      loadTokens()
    } catch (error) {
      console.error('Failed to update token:', error)
      toast.error('更新 Token 失败')
    }
  }

  const handleDelete = async (id: number, name: string) => {
    if (!confirm(`确定要删除 Token "${name}" 吗？此操作不可撤销。`)) {
      return
    }

    try {
      await tokensApi.delete(id)
      toast.success('Token 已删除')
      loadTokens()
    } catch (error) {
      console.error('Failed to delete token:', error)
      toast.error('删除 Token 失败')
    }
  }

  const copyToken = (token: string) => {
    navigator.clipboard.writeText(token)
    toast.success('Token 已复制到剪贴板')
  }

  const toggleTokenVisibility = (id: number) => {
    setShowTokens({
      ...showTokens,
      [id]: !showTokens[id],
    })
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('zh-CN')
  }

  const maskToken = (token: string) => {
    if (token.length <= 12) return '••••••••'
    return `${token.substring(0, 8)}${'•'.repeat(token.length - 12)}${token.substring(token.length - 4)}`
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <p className="text-muted-foreground">加载中...</p>
      </div>
    )
  }

  return (
    <div className="container mx-auto py-8 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold mb-2">API Token 管理</h1>
          <p className="text-muted-foreground">
            创建和管理用于扩展插件的 API Token
          </p>
        </div>
        <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              创建 Token
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>创建新的 API Token</DialogTitle>
              <DialogDescription>
                为 Chrome 扩展或其他应用创建一个 API Token
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label htmlFor="create-name">名称 *</Label>
                <Input
                  id="create-name"
                  placeholder="例如：Chrome Extension"
                  value={createForm.name}
                  onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="create-description">描述</Label>
                <Input
                  id="create-description"
                  placeholder="Token 的用途说明"
                  value={createForm.description}
                  onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })}
                />
              </div>
              <div className="flex justify-end gap-2 pt-4">
                <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
                  取消
                </Button>
                <Button onClick={handleCreate}>创建</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Token 列表</CardTitle>
          <CardDescription>
            {tokens.length === 0 ? '还没有创建任何 Token' : `共 ${tokens.length} 个 Token`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {tokens.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <p className="mb-4">还没有创建任何 Token</p>
              <Button onClick={() => setCreateDialogOpen(true)}>
                <Plus className="w-4 h-4 mr-2" />
                创建第一个 Token
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {tokens.map((token) => (
                <div
                  key={token.id}
                  className="border rounded-lg p-4 space-y-3"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold">{token.name}</h3>
                        <Badge variant={token.enabled ? 'default' : 'secondary'}>
                          {token.enabled ? '已启用' : '已禁用'}
                        </Badge>
                      </div>
                      {token.description && (
                        <p className="text-sm text-muted-foreground mb-2">
                          {token.description}
                        </p>
                      )}
                      <div className="text-xs text-muted-foreground space-y-1">
                        <p>创建时间：{formatDate(token.created_at)}</p>
                        {token.last_used_at && (
                          <p>最后使用：{formatDate(token.last_used_at)}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleEdit(token)}
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleDelete(token.id, token.name)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>

                  <div className="bg-muted rounded-md p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <code className="text-sm font-mono">
                        {showTokens[token.id] ? token.token : maskToken(token.token)}
                      </code>
                      <div className="flex gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => toggleTokenVisibility(token.id)}
                        >
                          {showTokens[token.id] ? (
                            <EyeOff className="w-4 h-4" />
                          ) : (
                            <Eye className="w-4 h-4" />
                          )}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => copyToken(token.token)}
                        >
                          <Copy className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      ⚠️ 请妥善保管此 Token，不要分享给他人
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 编辑对话框 */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>编辑 Token</DialogTitle>
            <DialogDescription>
              更新 Token 的名称、描述或启用状态
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">名称 *</Label>
              <Input
                id="edit-name"
                value={editForm.name}
                onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-description">描述</Label>
              <Input
                id="edit-description"
                value={editForm.description}
                onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="edit-enabled">启用状态</Label>
              <Switch
                id="edit-enabled"
                checked={editForm.enabled}
                onCheckedChange={(checked) => setEditForm({ ...editForm, enabled: checked })}
              />
            </div>
            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
                取消
              </Button>
              <Button onClick={handleUpdate}>保存</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}