async function request(path, options = {}) {
  const response = await fetch(path, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options,
  })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(payload.detail || '服务器请求失败')
  return payload
}

export const getDeveloperStatus = () => request('/api/auth/status')
export const createDeveloperPassword = (username, password) => request('/api/auth/setup', { method: 'POST', body: JSON.stringify({ username, password }) })
export async function verifyDeveloperPassword(username, password) {
  await request('/api/auth/login', { method: 'POST', body: JSON.stringify({ username, password }) })
  return true
}
export const closeDeveloperSession = () => request('/api/auth/logout', { method: 'POST' })
