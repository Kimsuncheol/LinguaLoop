export interface User { id: string; name: string }
export async function currentUser(): Promise<User | null> {
  const response = await fetch('/api/auth/me', { credentials: 'same-origin' })
  if (response.status === 401) return null
  if (!response.ok) throw new Error('Unable to load your session. Please try again.')
  return response.json()
}
export async function logout(): Promise<void> {
  const response = await fetch('/api/auth/logout', {
    method: 'POST', headers: { 'X-Requested-With': 'LinguaLoop' },
  })
  if (!response.ok) throw new Error('Unable to sign out. Please try again.')
}
