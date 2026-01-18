const FIGMA_API_URL = 'https://api.figma.com/v1'

function getToken(): string {
  const token = process.env.FIGMA_ACCESS_TOKEN
  if (!token) {
    throw new Error('FIGMA_ACCESS_TOKEN environment variable not set. Get one at https://www.figma.com/developers/api#access-tokens')
  }
  return token
}

async function figmaApi<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const token = getToken()
  const response = await fetch(`${FIGMA_API_URL}${endpoint}`, {
    ...options,
    headers: {
      'X-Figma-Token': token,
      'Content-Type': 'application/json',
      ...options?.headers
    }
  })
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({})) as { err?: string; message?: string }
    throw new Error(error.err || error.message || `API error: ${response.status}`)
  }
  
  return response.json() as Promise<T>
}

export interface Comment {
  id: string
  file_key: string
  parent_id?: string
  user: { id: string; handle: string; img_url: string }
  created_at: string
  resolved_at?: string
  message: string
  client_meta?: { node_id?: string; node_offset?: { x: number; y: number } }
  order_id?: string
}

export interface Version {
  id: string
  created_at: string
  label?: string
  description?: string
  user: { id: string; handle: string; img_url: string }
}

export interface User {
  id: string
  handle: string
  img_url: string
  email?: string
}

export interface Project {
  id: string
  name: string
}

export interface ProjectFile {
  key: string
  name: string
  thumbnail_url: string
  last_modified: string
}

export async function getComments(fileKey: string): Promise<Comment[]> {
  const data = await figmaApi<{ comments: Comment[] }>(`/files/${fileKey}/comments`)
  return data.comments
}

export async function postComment(fileKey: string, message: string, nodeId?: string, replyTo?: string): Promise<Comment> {
  const body: Record<string, unknown> = { message }
  if (replyTo) body.comment_id = replyTo
  if (nodeId) body.client_meta = { node_id: nodeId, node_offset: { x: 0, y: 0 } }
  
  return figmaApi<Comment>(`/files/${fileKey}/comments`, {
    method: 'POST',
    body: JSON.stringify(body)
  })
}

export async function deleteComment(fileKey: string, commentId: string): Promise<void> {
  await figmaApi(`/files/${fileKey}/comments/${commentId}`, { method: 'DELETE' })
}

export async function getVersions(fileKey: string): Promise<Version[]> {
  const data = await figmaApi<{ versions: Version[] }>(`/files/${fileKey}/versions`)
  return data.versions
}

export async function getMe(): Promise<User> {
  return figmaApi<User>('/me')
}

export async function getTeamProjects(teamId: string): Promise<Project[]> {
  const data = await figmaApi<{ projects: Project[] }>(`/teams/${teamId}/projects`)
  return data.projects
}

export async function getProjectFiles(projectId: string): Promise<ProjectFile[]> {
  const data = await figmaApi<{ files: ProjectFile[] }>(`/projects/${projectId}/files`)
  return data.files
}

export async function getFileInfo(fileKey: string): Promise<{ name: string; lastModified: string; thumbnailUrl: string; version: string }> {
  return figmaApi<{ name: string; lastModified: string; thumbnailUrl: string; version: string }>(`/files/${fileKey}?depth=1`)
}
