import axios from 'axios'

const api = axios.create({
  baseURL: '/api/v1',
})

// 请求拦截器：自动添加 token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('auth_token')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

// 响应拦截器：处理 401 错误
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('auth_token')
      window.location.href = '/login'
    }
    return Promise.reject(error)
  }
)

export interface Task {
  id: number
  url: string
  filename: string
  file_path?: string
  status: string
  plugin_name: string
  category: string
  gid: string
  error_msg?: string
  created_at: string
  completed_at?: string
}

export interface TaskProgress {
  total_length: number
  completed_length: number
  download_speed: number
  progress: number
  status: string
}

export interface Plugin {
  id: number
  name: string
  version: string
  enabled: boolean
  config?: Record<string, any>
  endpoint: string
  running?: boolean
}

export interface TaskQueryParams {
  page?: number
  page_size?: number
  status?: string[]
  plugin_name?: string
  category?: string
  filename?: string
}

export interface TaskListResponse {
  success: boolean
  data: Task[]
  pagination: {
    page: number
    page_size: number
    total: number
    total_pages: number
  }
}

export const tasksApi = {
  list: (params?: TaskQueryParams) =>
    api.get<TaskListResponse>('/tasks', {
      params,
      paramsSerializer: {
        indexes: null // 让数组参数变成 status=a&status=b 而不是 status[0]=a&status[1]=b
      }
    }),
  get: (id: number) => api.get<{ success: boolean; task: Task }>(`/tasks/${id}`),
  getProgress: (id: number) => api.get<{ success: boolean; task: Task; progress: TaskProgress }>(`/tasks/${id}/progress`),
  retry: (id: number) => api.post(`/tasks/${id}/retry`),
  delete: (id: number) => api.delete(`/tasks/${id}`),
  pause: (id: number) => api.post(`/tasks/${id}/pause`),
  clearFailed: () => api.delete<{ success: boolean; message: string; cleared_count: number }>('/tasks/failed'),
}

export const pluginsApi = {
  list: () => api.get<{ success: boolean; plugins: Plugin[] }>('/plugins'),
  enable: (name: string, config: Record<string, any>) =>
    api.post(`/plugins/${name}/enable`, { config }),
  disable: (name: string) => api.post(`/plugins/${name}/disable`),
  start: (name: string) => api.post(`/plugins/${name}/start`),
  stop: (name: string) => api.post(`/plugins/${name}/stop`),
  restart: (name: string, config?: Record<string, any>) =>
    api.post(`/plugins/${name}/restart`, { config }),
}

export interface APIToken {
  id: number
  name: string
  token: string
  description?: string
  enabled: boolean
  last_used_at?: string
  created_at: string
  updated_at: string
}

export const tokensApi = {
  list: () => api.get<{ success: boolean; tokens: APIToken[] }>('/tokens'),
  create: (name: string, description?: string) =>
    api.post<{ success: boolean; message: string; token: APIToken }>('/tokens', {
      name,
      description,
    }),
  get: (id: number) => api.get<{ success: boolean; token: APIToken }>(`/tokens/${id}`),
  update: (id: number, name: string, description: string, enabled: boolean) =>
    api.put<{ success: boolean; message: string }>(`/tokens/${id}`, {
      name,
      description,
      enabled,
    }),
  delete: (id: number) => api.delete<{ success: boolean; message: string }>(`/tokens/${id}`),
}

export interface User {
  id: number
  username: string
  is_admin: boolean
}

export const authApi = {
  login: (username: string, password: string) =>
    api.post<{ success: boolean; message: string; token: string }>('/auth/login', {
      username,
      password,
    }),
  me: () => api.get<{ success: boolean; user: User }>('/auth/me'),
  changePassword: (oldPassword: string, newPassword: string) =>
    api.post<{ success: boolean; message: string }>('/auth/change-password', {
      old_password: oldPassword,
      new_password: newPassword,
    }),
}

export default api