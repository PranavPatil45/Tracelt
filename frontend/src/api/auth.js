// Auth API integration layer.
//
// This is intentionally a thin, real fetch wrapper and NOT a mock. There is
// no fake/simulated authentication here — wire `API_BASE_URL` to your
// FastAPI service and the flow below (POST /login) will work as written.

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api'

/**
 * Custom error carrying a user-facing message plus the original status,
 * so the UI can distinguish "bad credentials" from "server unreachable".
 */
export class AuthError extends Error {
  constructor(message, status) {
    super(message)
    this.name = 'AuthError'
    this.status = status
  }
}

/**
 * POST /login against the FastAPI backend.
 *
 * Expected backend contract:
 *   Request:  { email: string, password: string }
 *   Success:  200 { access_token: string, token_type: 'bearer', user: {...} }
 *   Failure:  401 { detail: 'Incorrect email or password' }
 *
 * @param {{ email: string, password: string, remember: boolean }} credentials
 * @returns {Promise<{ accessToken: string, user: object }>}
 */
export async function loginUser({ email, password, remember }) {
  let response
  try {
    response = await fetch(`${API_BASE_URL}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, remember }),
    })
  } catch (networkError) {
    throw new AuthError('Can\u2019t reach Tracelt right now. Check your connection and try again.', 0)
  }

  let data = null
  try {
    data = await response.json()
  } catch {
    // No JSON body — fall through to status-based handling below.
  }

  if (!response.ok) {
    const message =
      data?.detail ||
      (response.status === 401
        ? 'That email and password don\u2019t match our records.'
        : 'Something went wrong signing you in. Please try again.')
    throw new AuthError(message, response.status)
  }

  return {
    accessToken: data?.access_token,
    user: data?.user ?? null,
  }
}

/**
 * POST /register against the FastAPI backend.
 *
 * Expected backend contract:
 *   Request:  { full_name, email, password, campus, department }
 *   Success:  201 { access_token: string, token_type: 'bearer', user: {...} }
 *   Failure:  400/409 { detail: 'An account with this email already exists.' }
 *
 * @param {{ fullName: string, email: string, password: string, campus: string, department?: string }} details
 * @returns {Promise<{ accessToken: string, user: object }>}
 */
export async function registerUser({ fullName, email, password, campus, department }) {
  let response
  try {
    response = await fetch(`${API_BASE_URL}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        full_name: fullName,
        email,
        password,
        campus,
        department: department || null,
      }),
    })
  } catch (networkError) {
    throw new AuthError('Can\u2019t reach Tracelt right now. Check your connection and try again.', 0)
  }

  let data = null
  try {
    data = await response.json()
  } catch {
    // No JSON body — fall through to status-based handling below.
  }

  if (!response.ok) {
    const message =
      data?.detail ||
      (response.status === 409
        ? 'An account with this email already exists.'
        : 'Something went wrong creating your account. Please try again.')
    throw new AuthError(message, response.status)
  }

  return {
    accessToken: data?.access_token,
    user: data?.user ?? null,
  }
}

/**
 * GET /me against the FastAPI backend using a Bearer token.
 *
 * @param {string} token
 * @returns {Promise<object>}
 */
export async function getCurrentUser(token) {
  if (!token) {
    throw new AuthError('No authentication token provided.', 401)
  }

  let response
  try {
    response = await fetch(`${API_BASE_URL}/me`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    })
  } catch (networkError) {
    throw new AuthError('Can\u2019t reach Tracelt right now. Check your connection and try again.', 0)
  }

  let data = null
  try {
    data = await response.json()
  } catch {
    // No JSON body
  }

  if (!response.ok) {
    const message = data?.detail || 'Session expired. Please sign in again.'
    throw new AuthError(message, response.status)
  }

  return data
}

/**
 * Placeholder for Google OAuth. Point this at your backend's OAuth
 * redirect/callback endpoint once it exists.
 */
export function startGoogleLogin() {
  window.location.href = `${API_BASE_URL}/auth/google`
}

