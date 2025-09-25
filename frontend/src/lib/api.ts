import axios from 'axios'

const api = axios.create({
  baseURL: '/api/v1',
})

export interface Task {
  id: number
  url: string
  filename: string
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
  hide_success?: boolean
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
    api.get<TaskListResponse>('/tasks', { params }),
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
}

export default api