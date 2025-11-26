import React, { StrictMode, useEffect, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import ReactMarkdown from 'react-markdown'
import { asyncLLM } from 'asyncllm'
import { createClient } from '@supabase/supabase-js'
import ensureSupabaseSession from 'supabase-oauth-popup'
import { bootstrapAlert } from 'bootstrap-alert'
import saveform from 'saveform'

// ----- Supabase client (inlined) -----
const supabaseUrl = 'https://nnqutlsuisayoqvfyefh.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5ucXV0bHN1aXNheW9xdmZ5ZWZoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQwOTM0MzksImV4cCI6MjA3OTY2OTQzOX0.y5M_9F2wKDZ9D0BSlmrObE-JRwkrWVUMMYwKZuz1-fo'
const supabase = createClient(supabaseUrl, supabaseKey, { auth: { detectSessionInUrl: true, persistSession: true, autoRefreshToken: true } })

// ----- Global LLM configuration trigger (Bootstrap LLM Provider) -----
window.addEventListener('llm:configure', async () => {
  const { openaiConfig } = await import('bootstrap-llm-provider')
  await openaiConfig({ show: true, defaultBaseUrls: ['https://llmfoundry.straive.com/openai/v1','https://llmfoundry.straivedemo.com/openai/v1'] })
})

// ----- Minimal LLM helpers (inlined) -----
const STORAGE_KEY = 'bootstrapLLMProvider_openaiConfig'
const DEFAULT_BASE_URL = 'https://llmfoundry.straive.com/openai/v1'

async function loadOrInitOpenAIConfig() {
  try { const raw = localStorage.getItem(STORAGE_KEY); if (raw) { const parsed = JSON.parse(raw); if (parsed?.baseUrl) return parsed } } catch {}
  const init = { baseUrl: DEFAULT_BASE_URL, apiKey: '' }
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(init)) } catch {}
  return init
}

async function* streamAIResponse(history) {
  try {
    const cfg = await loadOrInitOpenAIConfig()
    const baseUrl = cfg?.baseUrl || DEFAULT_BASE_URL
    const apiKey = cfg?.apiKey || ''
    console.log(`The models are ${cfg.models}`)
    const model = (cfg?.models?.[0]) || 'gpt-5-nano'
    const body = { model, stream: true, messages: history }
    for await (const { content, error } of asyncLLM(`${baseUrl.replace(/\/$/, '')}/chat/completions`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` }, body: JSON.stringify(body)
    })) { if (error) throw new Error(error); if (content) yield content }
  } catch (e) { console.warn('streamAIResponse failed:', e?.message || e) }
}

async function fetchAIResponse(history) {
  const systemPrompt = [
    'You are a strategy simulation engine.',
    '1. Present a business case study problem to the user.',
    '2. The user is the CEO/Manager.',
    '3. Wait for their decision.',
    '4. Evaluate their decision and move the simulation forward (time passes, consequences happen).',
    '5. Keep it concise.',
  ].join('\n')

  try {
    const cfg = await loadOrInitOpenAIConfig()
    const baseUrl = cfg?.baseUrl || DEFAULT_BASE_URL
    const apiKey = cfg?.apiKey || ''
    const model = (cfg?.models?.[0]) || 'gpt-5-nano'

    let full = ''
    const body = { model, stream: true, messages: [{ role: 'system', content: systemPrompt }, ...history] }
    for await (const { content, error } of asyncLLM(`${baseUrl.replace(/\/$/, '')}/chat/completions`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` }, body: JSON.stringify(body)
    })) { if (error) throw new Error(error); if (content) full = content }
    if (full) return full
  } catch (e) { console.warn('LLM stream failed; falling back to simulator:', e?.message || e) }

  return await new Promise((resolve) => setTimeout(() => resolve('Welcome, CEO. Your company "TechFlow" is losing 10% revenue month-over-month due to a new competitor. You have $1M in the bank. Do you (A) Launch a marketing campaign or (B) Cut costs to survive?'), 600))
}

// ----- Auth view (inlined) -----
function AuthView() {
  useEffect(() => { try { saveform('#auth-form') } catch {} }, [])
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)

  const handleMagicLink = async (e) => {
    e.preventDefault(); setLoading(true)
    const { error } = await supabase.auth.signInWithOtp({ email })
    if (error) bootstrapAlert({ title: 'Login Failed', body: error.message, color: 'danger' })
    else bootstrapAlert({ title: 'Magic Link Sent', body: 'Check your email to log in!', color: 'info' })
    setLoading(false)
  }

  const handleOAuth = async (provider) => {
    try {
      setLoading(true)
      const session = await ensureSupabaseSession(supabase, { provider })
      bootstrapAlert({ title: 'Login Successful', body: `Signed in as ${session?.user?.email || 'user'}!`, color: 'success', replace: true })
    } catch (err) {
      bootstrapAlert({ title: 'Login Failed', body: err?.message || String(err), color: 'danger' })
    } finally { setLoading(false) }
  }

  return (
    <div className="container d-flex align-items-center justify-content-center min-vh-100">
      <div className="card shadow-sm" style={{ maxWidth: 420, width: '100%' }}>
        <div className="card-body">
          <h1 className="h4 mb-2 text-center">Case Study Login</h1>
          <p className="text-muted text-center mb-4">Sign in to save your progress</p>
          <div className="d-grid gap-2 mb-3">
            <button onClick={() => handleOAuth('google')} disabled={loading} className="btn btn-danger"><i className="bi bi-google me-2"></i> Continue with Google</button>
            <button onClick={() => handleOAuth('github')} disabled={loading} className="btn btn-dark"><i className="bi bi-github me-2"></i> Continue with GitHub</button>
          </div>
          <div className="text-center text-muted small my-2">or</div>
          <form id="auth-form" onSubmit={handleMagicLink} className="d-grid gap-2">
            <input className="form-control" type="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required />
            <button className="btn btn-primary" disabled={loading}>{loading ? 'Sending link...' : 'Send Magic Link'}</button>
          </form>
        </div>
      </div>
    </div>
  )
}

// ----- Dark theme toggle (React implementation for proper navbar placement) -----
const VALID_THEMES = ['light', 'dark', 'auto']
const getStoredTheme = () => { try { const t = localStorage.getItem('theme'); return VALID_THEMES.includes(t) ? t : 'auto' } catch { return 'auto' } }
const resolveTheme = (t) => t === 'auto' ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light') : t
const applyTheme = (t) => { const v = resolveTheme(t); document.documentElement.setAttribute('data-bs-theme', v) }

function DarkThemeToggle() {
  const [theme, setTheme] = useState(getStoredTheme())
  useEffect(() => { applyTheme(theme) }, [theme])
  const set = (t) => { const v = VALID_THEMES.includes(t) ? t : 'auto'; try { localStorage.setItem('theme', v) } catch {}; setTheme(v) }
  const isActive = (v) => theme === v
  return (
    <div className="position-relative" role="group" aria-label="Toggle dark mode" title="Toggle Dark Mode">
      <button className="dark-theme-toggle btn btn-outline-secondary btn-sm dropdown-toggle" type="button" data-bs-toggle="dropdown" aria-expanded="false" aria-label="Open navigation menu">
        <i className="bi bi-circle-half"></i>
      </button>
      <ul className="dropdown-menu dropdown-menu-end">
        <li><button className={"dropdown-item" + (isActive('light') ? " active" : "")} aria-pressed={isActive('light') ? "true" : "false"} onClick={() => set('light')} data-bs-theme-value="light">
          <i className="me-2 bi bi-sun-fill"></i> Light
        </button></li>
        <li><button className={"dropdown-item" + (isActive('dark') ? " active" : "")} aria-pressed={isActive('dark') ? "true" : "false"} onClick={() => set('dark')} data-bs-theme-value="dark">
          <i className="me-2 bi bi-moon-stars-fill"></i> Dark
        </button></li>
        <li><button className={"dropdown-item" + (isActive('auto') ? " active" : "")} aria-pressed={isActive('auto') ? "true" : "false"} onClick={() => set('auto')} data-bs-theme-value="auto">
          <i className="me-2 bi bi-circle-half"></i> Auto
        </button></li>
      </ul>
    </div>
  )
}

function GameView({ session }) {
  const [gameSessionId, setGameSessionId] = useState(null)
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef(null)

  const [showProfile, setShowProfile] = useState(false)
  const [sessions, setSessions] = useState([])
  const [loadingSessions, setLoadingSessions] = useState(false)
  const [selectedSession, setSelectedSession] = useState(null)
  const [selectedMessages, setSelectedMessages] = useState([])
  const [loadingMessages, setLoadingMessages] = useState(false)

  const _busy = loading || loadingSessions || loadingMessages

  const openProfile = async () => {
    setShowProfile(true); setSelectedSession(null); setSelectedMessages([]); setLoadingSessions(true)
    const { data, error } = await supabase.from('game_sessions').select('*').eq('user_id', session.user.id).order('created_at', { ascending: false })
    if (!error && data) setSessions(data); setLoadingSessions(false)
  }

  const viewSession = async (sess) => {
    setSelectedSession(sess); setLoadingMessages(true)
    const { data, error } = await supabase.from('chat_messages').select('role, content, created_at').eq('session_id', sess.id).order('created_at', { ascending: true })
    if (!error && data) setSelectedMessages(data); setLoadingMessages(false)
  }

  const continueFromSelected = () => {
    if (!selectedSession || loadingMessages) return
    setGameSessionId(selectedSession.id)
    const mapped = selectedMessages.map((m) => ({ role: m.role, content: m.content }))
    setMessages(mapped); setShowProfile(false)
  }

  const startNewGame = async () => {
    setLoading(true)
    const { data, error } = await supabase.from('game_sessions').insert([{ user_id: session.user.id }]).select()
    if (error) { console.error('Error creating session:', error); setLoading(false); return }
    const newSessionId = data[0].id
    setGameSessionId(newSessionId); setMessages([])
    await processTurn([], newSessionId); setLoading(false)
  }

  const processTurn = async (currentHistory, sessionId) => {
    setLoading(true)
    let full = ''
    try {
      const stream = streamAIResponse(currentHistory.map((m) => ({ role: m.role === 'ai' ? 'assistant' : 'user', content: m.content })))
      if (stream && stream[Symbol.asyncIterator]) {
        for await (const partial of stream) {
          full = partial
          setMessages((prev) => { const base = prev.filter((x) => x.role !== 'ai-temp'); return [...base, { role: 'ai-temp', content: partial }] })
        }
      }
    } catch {}

    if (!full) {
      full = await fetchAIResponse(currentHistory.map((m) => ({ role: m.role === 'ai' ? 'assistant' : 'user', content: m.content })))
      setMessages((prev) => [...prev, { role: 'ai', content: full }])
    } else {
      setMessages((prev) => { const base = prev.filter((x) => x.role !== 'ai-temp'); return [...base, { role: 'ai', content: full }] })
    }

    await supabase.from('chat_messages').insert([{ session_id: sessionId, role: 'ai', content: full }])
    setLoading(false)
  }

  const handleSend = async () => {
    if (!input.trim()) return
    const userText = input; setInput('')
    const newHistory = [...messages.filter((m) => m.role !== 'ai-temp'), { role: 'user', content: userText }]
    setMessages(newHistory)
    await supabase.from('chat_messages').insert([{ session_id: gameSessionId, role: 'user', content: userText }])
    await processTurn(newHistory, gameSessionId)
  }

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  return (
    <div className="container-fluid min-vh-100 d-flex flex-column bg-body">
      <div className="navbar navbar-expand-lg bg-body-tertiary shadow-sm mb-0">
        <a className="navbar-brand" href="/">Case Study Simulator</a>
        <div className="ms-auto d-flex gap-2 align-items-center">
          <DarkThemeToggle />
          
          <button onClick={() => window.dispatchEvent(new CustomEvent('llm:configure'))} className="btn btn-outline-secondary btn-sm">Configure LLM</button>
          <button onClick={() => startNewGame()} disabled={loading} className="btn btn-success btn-sm">New Case</button>
          <button onClick={openProfile} className="btn btn-outline-primary btn-sm">Profile</button>
          <button onClick={() => supabase.auth.signOut()} className="btn btn-outline-danger btn-sm">Sign Out</button>
        </div>
      </div>

      { (loading || loadingSessions || loadingMessages) && (
        <div className="progress rounded-0"><div className="progress-bar progress-bar-striped progress-bar-animated" style={{ width: '100%' }}></div></div>
      )}

      {!gameSessionId ? (
        <div className="flex-1 d-flex align-items-center justify-content-center">
          <button onClick={startNewGame} className="btn btn-primary btn-lg shadow">Start New Case Study</button>
        </div>
      ) : (
        <>
          <div className="flex-1 overflow-auto card shadow-sm mb-3 p-3">
            {messages.map((msg, i) => (
              <div key={i} className={`mb-2 d-flex ${msg.role === 'user' ? 'justify-content-end' : 'justify-content-start'}`}>
                <div className={`p-2 rounded ${msg.role === 'user' ? 'bg-primary text-white' : (msg.role === 'ai-temp' ? 'bg-light text-secondary' : 'bg-light text-dark')}`} style={{ maxWidth: '80%' }}>
                  <div className="fw-semibold mb-1">{msg.role === 'ai' || msg.role === 'ai-temp' ? 'Advisor' : 'You'}:</div>
                  <div className="markdown-body"><ReactMarkdown>{msg.content}</ReactMarkdown></div>
                </div>
              </div>
            ))}
            {loading && <div className="text-muted small d-flex align-items-center gap-2"><div className="spinner-border spinner-border-sm"></div><span>Streaming response...</span></div>}
            <div ref={bottomRef}></div>
          </div>

          <form className="d-flex gap-2 align-items-start" onSubmit={(e) => { e.preventDefault(); handleSend() }}>
            <textarea className="form-control" placeholder="What is your decision? (Ctrl/Cmd+Enter to send)" style={{ width: '100%' }} rows={3} value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); handleSend() } }} disabled={loading} />
            <button type="submit" disabled={loading} className="btn btn-primary">Send</button>
          </form>
        </>
      )}

      {showProfile && (
        <div>
          <div className="modal fade show" style={{ display: 'block', background: 'rgba(0,0,0,.4)' }}>
            <div className="modal-dialog modal-dialog-scrollable modal-lg">
              <div className="modal-content">
                <div className="modal-header">
                  <h5 className="modal-title">Your Sessions</h5>
                  <button type="button" className="btn-close" onClick={() => setShowProfile(false)}></button>
                </div>
                <div className="modal-body">
                  <div className="row g-3">
                    <div className="col-5">
                      <div className="list-group small">
                        {loadingSessions && <div className="text-muted d-flex align-items-center gap-2"><div className="spinner-border spinner-border-sm"></div><span>Loading sessions...</span></div>}
                        {!loadingSessions && sessions.length === 0 && <div className="text-muted">No sessions found</div>}
                        {sessions.map((s) => (
                          <button key={s.id} className={`list-group-item list-group-item-action ${selectedSession?.id === s.id ? 'active' : ''}`} onClick={() => viewSession(s)}>
                            <div className="d-flex justify-content-between">
                              <div>Session {String(s.id).slice(0, 8)}</div>
                              <small>{s.created_at ? new Date(s.created_at).toLocaleString() : ''}</small>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="col-7">
                      {!selectedSession && <div className="text-muted">Select a session to view transcript</div>}
                      {selectedSession && (
                        <div className="border rounded p-2" style={{ maxHeight: 400, overflow: 'auto' }}>
                          {loadingMessages && <div className="text-muted d-flex align-items-center gap-2"><div className="spinner-border spinner-border-sm"></div><span>Loading transcript...</span></div>}
                          {!loadingMessages && selectedMessages.map((m, i) => (
                            <div key={i} className="mb-2">
                              <strong>{m.role === 'ai' ? 'Advisor' : 'You'}:</strong>
                              <div className="markdown-body"><ReactMarkdown>{m.content}</ReactMarkdown></div>
                              <div className="text-muted" style={{ fontSize: '0.75rem' }}>{m.created_at ? new Date(m.created_at).toLocaleString() : ''}</div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                <div className="modal-footer">
                  {selectedSession && <button className="btn btn-primary" onClick={continueFromSelected} disabled={loadingMessages}>Continue Session</button>}
                  <button className="btn btn-secondary" onClick={() => setShowProfile(false)}>Close</button>
                </div>
              </div>
            </div>
          </div>
          <div className="modal-backdrop fade show"></div>
        </div>
      )}
    </div>
  )
}

// ----- App (inlined) -----
function App() {
  const [session, setSession] = useState(null)
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setSession(session))
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => setSession(session))
    return () => subscription.unsubscribe()
  }, [])
  return <div className="container-fluid p-0">{!session ? <AuthView /> : <GameView session={session} />}</div>
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>
)



