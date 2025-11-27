import React, { StrictMode, useEffect, useRef, useState } from "react"
import { createRoot } from "react-dom/client"
import ReactMarkdown from "react-markdown"
import { asyncLLM } from "asyncllm"
import { createClient } from "@supabase/supabase-js"
import ensureSupabaseSession from "supabase-oauth-popup"
import { bootstrapAlert } from "bootstrap-alert"
import saveform from "saveform"

// Supabase client
const supabaseUrl = "https://nnqutlsuisayoqvfyefh.supabase.co"
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5ucXV0bHN1aXNheW9xdmZ5ZWZoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQwOTM0MzksImV4cCI6MjA3OTY2OTQzOX0.y5M_9F2wKDZ9D0BSlmrObE-JRwkrWVUMMYwKZuz1-fo"
const supabase = createClient(supabaseUrl, supabaseKey, { auth: { detectSessionInUrl: true, persistSession: true, autoRefreshToken: true } })

// Global LLM configuration trigger
window.addEventListener("llm:configure", async () => {
  const { openaiConfig } = await import("bootstrap-llm-provider")
  await openaiConfig({ show: true, defaultBaseUrls: ["https://llmfoundry.straive.com/openai/v1","https://llmfoundry.straivedemo.com/openai/v1"] })
})

// LLM helpers
const STORAGE_KEY = "bootstrapLLMProvider_openaiConfig"
const DEFAULT_BASE_URL = "https://llmfoundry.straive.com/openai/v1"

async function loadOrInitOpenAIConfig() {
  try { const raw = localStorage.getItem(STORAGE_KEY); if (raw) { const parsed = JSON.parse(raw); if (parsed?.baseUrl) return parsed } } catch {}
  const init = { baseUrl: DEFAULT_BASE_URL, apiKey: "" }
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(init)) } catch {}
  return init
}

async function* streamAIResponse(history) {
  try {
    const cfg = await loadOrInitOpenAIConfig()
    const baseUrl = cfg?.baseUrl || DEFAULT_BASE_URL
    const apiKey = cfg?.apiKey || ""
    const model = (cfg?.models?.[0]) || "gpt-5-nano"
    const body = { model, stream: true, messages: history }
    for await (const { content, error } of asyncLLM(`${baseUrl.replace(/\/$/, "")}/chat/completions`, {
      method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` }, body: JSON.stringify(body)
    })) { if (error) throw new Error(error); if (content) yield content }
  } catch (e) { console.warn("streamAIResponse failed:", e?.message || e) }
}

async function fetchAIResponse(history) {
  const systemPrompt = [
  "You are 'The Executive', a high-fidelity, text-based business simulation engine.",
  "",
  "### CORE DIRECTIVES:",
  "1. **Realism is Key:** Scenarios must be gritty and complex. No easy wins. Every decision has trade-offs (e.g., cutting costs hurts morale; raising prices risks churn).",
  "2. **Visual Hierarchy:** You must use Markdown aggressively to make the UI beautiful and scannable.",
  "   - Use 📊 for Stats/KPIs.",
  "   - Use ⚠️ for Crises/Risks.",
  "   - Use 💡 for Opportunities.",
  "   - Use Blockquotes (>) for news headlines or employee whispers.",
  "3. **The Loop:**",
  "   - PHASE 1: **The Fallout.** Summarize the direct consequences of the user's previous action.",
  "   - PHASE 2: **The Dashboard.** Show a mini-table of current Company Health (Cash, Morale, Market Share, Stock).",
  "   - PHASE 3: **The Crisis.** Present the new challenge clearly.",
  "   - PHASE 4: **The Decision.** Offer 3 distinct strategic options (A, B, C) but also allow for custom open-ended input.",
  "",
  "### TONE:",
  "Professional, urgent, and immersive. You are the narrator of a high-stakes corporate thriller.",
  "",
  "### FORMATTING RULES:",
  "- Never output walls of text. Break paragraphs often.",
  "- Highlight **key numbers** and **critical entities** in bold.",
  "- Keep the simulation moving fast. Time skips (e.g., '3 Months Later') are encouraged between turns.",
  "",
  "START THE GAME by asking the user to choose their Company Type (e.g., Tech Startup, Failing Retail Giant, EV Manufacturer) to begin."
].join("\n")

  try {
    const cfg = await loadOrInitOpenAIConfig()
    const baseUrl = cfg?.baseUrl || DEFAULT_BASE_URL
    const apiKey = cfg?.apiKey || ""
    const model = (cfg?.models?.[0]) || "gpt-5-nano"

    let full = ""
    const body = { model, stream: true, messages: [{ role: "system", content: systemPrompt }, ...history] }
    for await (const { content, error } of asyncLLM(`${baseUrl.replace(/\/$/, "")}/chat/completions`, {
      method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` }, body: JSON.stringify(body)
    })) { if (error) throw new Error(error); if (content) full = content }
    if (full) return full
  } catch (e) { console.warn("LLM stream failed; falling back to simulator:", e?.message || e) }

  return await new Promise((resolve) => setTimeout(() => resolve("Welcome, CEO. Your company 'TechFlow' is losing 10% revenue month-over-month due to a new competitor. You have $1M in the bank. Do you (A) Launch a marketing campaign or (B) Cut costs to survive?"), 600))
}

// Auth view
function AuthView() {
  useEffect(() => { try { saveform("#auth-form") } catch {} }, [])
  const [email, setEmail] = useState("")
  const [loading, setLoading] = useState(false)

  const handleMagicLink = async (e) => {
    e.preventDefault(); setLoading(true)
    const { error } = await supabase.auth.signInWithOtp({ email })
    if (error) bootstrapAlert({ title: "Login Failed", body: error.message, color: "danger" })
    else bootstrapAlert({ title: "Magic Link Sent", body: "Check your email to log in!", color: "info" })
    setLoading(false)
  }

  const handleOAuth = async (provider) => {
    try {
      setLoading(true)
      const session = await ensureSupabaseSession(supabase, { provider })
      bootstrapAlert({ title: "Login Successful", body: `Signed in as ${session?.user?.email || "user"}!`, color: "success", replace: true })
    } catch (err) {
      bootstrapAlert({ title: "Login Failed", body: err?.message || String(err), color: "danger" })
    } finally { setLoading(false) }
  }

  return (
    <div className="container d-flex align-items-center justify-content-center min-vh-100">
      <div className="card shadow-sm" style={{ maxWidth: 420, width: "100%" }}>
        <div className="card-body">
          <h1 className="h4 mb-2 text-center">Case Study Login</h1>
          <p className="text-muted text-center mb-4">Sign in to save your progress</p>
          <div className="d-grid gap-2 mb-3">
            <button onClick={() => handleOAuth("google")} disabled={loading} className="btn btn-danger"><i className="bi bi-google me-2"></i> Continue with Google</button>
            <button onClick={() => handleOAuth("github")} disabled={loading} className="btn btn-dark"><i className="bi bi-github me-2"></i> Continue with GitHub</button>
          </div>
          <div className="text-center text-muted small my-2">or</div>
          <form id="auth-form" onSubmit={handleMagicLink} className="d-grid gap-2">
            <input className="form-control" type="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required />
            <button className="btn btn-primary" disabled={loading}>{loading ? "Sending link..." : "Send Magic Link"}</button>
          </form>
        </div>
      </div>
    </div>
  )
}

// Dark theme toggle
const VALID_THEMES = ["light", "dark", "auto"]
const getStoredTheme = () => { try { const t = localStorage.getItem("theme"); return VALID_THEMES.includes(t) ? t : "auto" } catch { return "auto" } }
const resolveTheme = (t) => t === "auto" ? (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light") : t
const applyTheme = (t) => { const v = resolveTheme(t); document.documentElement.setAttribute("data-bs-theme", v) }

function DarkThemeToggle() {
  const [theme, setTheme] = useState(getStoredTheme())
  useEffect(() => { applyTheme(theme) }, [theme])
  const set = (t) => { const v = VALID_THEMES.includes(t) ? t : "auto"; try { localStorage.setItem("theme", v) } catch {}; setTheme(v) }
  const isActive = (v) => theme === v
  return (
    <div className="position-relative" role="group" aria-label="Toggle dark mode" title="Toggle Dark Mode">
      <button className="dark-theme-toggle btn btn-outline-secondary btn-sm dropdown-toggle" type="button" data-bs-toggle="dropdown" aria-expanded="false" aria-label="Open navigation menu">
        <i className="bi bi-circle-half"></i>
      </button>
      <ul className="dropdown-menu dropdown-menu-end">
        <li><button className={"dropdown-item" + (isActive("light") ? " active" : "")} aria-pressed={isActive("light") ? "true" : "false"} onClick={() => set("light")} data-bs-theme-value="light"><i className="me-2 bi bi-sun-fill"></i> Light</button></li>
        <li><button className={"dropdown-item" + (isActive("dark") ? " active" : "")} aria-pressed={isActive("dark") ? "true" : "false"} onClick={() => set("dark")} data-bs-theme-value="dark"><i className="me-2 bi bi-moon-stars-fill"></i> Dark</button></li>
        <li><button className={"dropdown-item" + (isActive("auto") ? " active" : "")} aria-pressed={isActive("auto") ? "true" : "false"} onClick={() => set("auto")} data-bs-theme-value="auto"><i className="me-2 bi bi-circle-half"></i> Auto</button></li>
      </ul>
    </div>
  )
}

// Simple hero/intro section shown before starting a case
function AppHero({ onStart }) {
  return (
    <section className="bg-body-secondary py-5">
      <div className="container-lg">
        <h1 className="display-5 fw-bold text-center mb-1">Case Study Simulator</h1>
        <p className="lead text-center text-muted mb-4">What decisions should leaders make under pressure?</p>
        <div className="mx-auto" style={{ maxWidth: 960 }}>
          <p className="mb-3">
            In complex scenarios, selecting the right actions is critical. This simulator presents realistic business situations so managers can practice
            making clear, accountable decisions.
          </p>
          <ol className="mb-3">
            <li>Revenue drivers, costs and breakpoints</li>
            <li>Customers, product-market fit and competitive responses</li>
            <li>Hiring plans, performance targets and incentives</li>
            <li>Risk controls, compliance and data privacy considerations</li>
            <li>Waivers, offsets, SLAs and credits</li>
          </ol>
          <p className="mb-3">
            This demo summarizes key terms and produces a readable decision log, flagging omissions and ambiguities so teams can validate assumptions and refine strategy.
          </p>
          <p className="mb-4">
            For finance, operations, vendor management and reporting teams needing a quick first-pass decision review based on users (vendors) or AUM/bps (clients).
          </p>
          <h2 className="h4">How It Works</h2>
          <ul className="mb-3">
            <li>Client-side text extraction </li>
            <li>Private LLMs via your OpenAI-compatible endpoint; optional streaming output</li>
            <li>Clear status and alerts; form state saved locally</li>
            <li>Clickable examples: try it without any documents</li>
          </ul>
          <p className="text-muted small mb-4">Accuracy note: LLMs can make mistakes. Treat results as a draft; validate figures and assumptions.</p>
          <div className="text-center">
            <button onClick={onStart} className="btn btn-primary btn-lg"><i className="bi bi-play-fill me-2"></i>Start Case</button>
          </div>
        </div>
      </div>
    </section>
  )
}

function GameView({ session }) {
  const [gameSessionId, setGameSessionId] = useState(null)
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef(null)

  const [showProfile, setShowProfile] = useState(false)
  const [sessions, setSessions] = useState([])
  const [loadingSessions, setLoadingSessions] = useState(false)
  const [selectedSession, setSelectedSession] = useState(null)
  const [selectedMessages, setSelectedMessages] = useState([])
  const [loadingMessages, setLoadingMessages] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const openProfile = async () => {
    setShowProfile(true); setSelectedSession(null); setSelectedMessages([]); setLoadingSessions(true)
    const { data, error } = await supabase.from("game_sessions").select("*").eq("user_id", session.user.id).order("created_at", { ascending: false })
    if (!error && data) setSessions(data); setLoadingSessions(false)
  }

  const viewSession = async (sess) => {
    setSelectedSession(sess); setLoadingMessages(true)
    const { data, error } = await supabase.from("chat_messages").select("role, content, created_at").eq("session_id", sess.id).order("created_at", { ascending: true })
    if (!error && data) setSelectedMessages(data); setLoadingMessages(false)
  }

  const continueFromSelected = () => {
    if (!selectedSession || loadingMessages) return
    setGameSessionId(selectedSession.id)
    const mapped = selectedMessages.map((m) => ({ role: m.role, content: m.content }))
    setMessages(mapped); setShowProfile(false)
  }

  const deleteSelectedSession = async () => {
    if (!selectedSession) return
    if (!confirm("Delete this session? This will remove its transcript.")) return
    try {
      setDeleting(true)
      await supabase.from("chat_messages").delete().eq("session_id", selectedSession.id)
      await supabase.from("game_sessions").delete().eq("id", selectedSession.id).eq("user_id", session.user.id)
      setSessions((prev) => prev.filter((s) => s.id !== selectedSession.id))
      setSelectedSession(null)
      setSelectedMessages([])
      if (gameSessionId === selectedSession.id) { setGameSessionId(null); setMessages([]) }
      bootstrapAlert({ title: "Deleted", body: "Session removed.", color: "success", replace: true })
    } catch (err) {
      bootstrapAlert({ title: "Delete Failed", body: err?.message || String(err), color: "danger" })
    } finally { setDeleting(false) }
  }

  const goHome = () => {
    // Reset to initial home/hero view without reloading
    setShowProfile(false);
    setSelectedSession(null);
    setSelectedMessages([]);
    setGameSessionId(null);
    setMessages([]);
    try { window.history.pushState({}, '', '/home') } catch {}
  }

  const startNewGame = async () => {
    setLoading(true)
    const { data, error } = await supabase.from("game_sessions").insert([{ user_id: session.user.id }]).select()
    if (error) { console.error("Error creating session:", error); setLoading(false); return }
    const newSessionId = data[0].id
    setGameSessionId(newSessionId); setMessages([])
    await processTurn([], newSessionId); setLoading(false)
  }

  const processTurn = async (currentHistory, sessionId) => {
    setLoading(true)

    // Skip streaming for initial turn (no user input yet)
    if (!currentHistory || currentHistory.length === 0) {
      const full = await fetchAIResponse([])
      setMessages((prev) => [...prev.filter((x) => x.role !== "ai-temp"), { role: "ai", content: full }])
      await supabase.from("chat_messages").insert([{ session_id: sessionId, role: "ai", content: full }])
      setLoading(false)
      return
    }

    let full = ""
    try {
      const stream = streamAIResponse(currentHistory.map((m) => ({ role: m.role === "ai" ? "assistant" : "user", content: m.content })))
      if (stream && stream[Symbol.asyncIterator]) {
        for await (const partial of stream) {
          full = partial
          setMessages((prev) => [...prev.filter((x) => x.role !== "ai-temp"), { role: "ai-temp", content: partial }])
        }
      }
    } catch {}

    if (!full) {
      full = await fetchAIResponse(currentHistory.map((m) => ({ role: m.role === "ai" ? "assistant" : "user", content: m.content })))
      setMessages((prev) => [...prev, { role: "ai", content: full }])
    } else {
      setMessages((prev) => [...prev.filter((x) => x.role !== "ai-temp"), { role: "ai", content: full }])
    }

    await supabase.from("chat_messages").insert([{ session_id: sessionId, role: "ai", content: full }])
    setLoading(false)
  }

  const handleSend = async () => {
    if (!input.trim()) return
    const userText = input; setInput("")
    const newHistory = [...messages.filter((m) => m.role !== "ai-temp"), { role: "user", content: userText }]
    setMessages(newHistory)
    await supabase.from("chat_messages").insert([{ session_id: gameSessionId, role: "user", content: userText }])
    await processTurn(newHistory, gameSessionId)
  }

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }) }, [messages])

  return (
    <div className="container-fluid min-vh-100 d-flex flex-column bg-body p-0">
      {/* Full-width navbar with better title styling */}
      <nav className="navbar navbar-expand-lg bg-body-tertiary border-bottom sticky-top w-100">
        <div className="container-fluid">
          <a className="navbar-brand d-flex align-items-center gap-2" href="/">
            <i className="bi bi-diagram-3"></i>
            <span className="fw-bold fs-4">Case Study Simulator</span>
          </a>
                    <div className="ms-auto d-flex gap-2 align-items-center">
            <DarkThemeToggle />
            <button onClick={() => window.dispatchEvent(new CustomEvent("llm:configure"))} className="btn btn-outline-secondary btn-sm">Configure LLM</button>
            <div className="dropdown">
              <button className="btn btn-primary btn-sm dropdown-toggle" type="button" data-bs-toggle="dropdown" aria-expanded="false">
                Menu
              </button>
              <ul className="dropdown-menu dropdown-menu-end">
                <li><button className="dropdown-item" onClick={goHome}><i className="bi bi-house-door me-2"></i>Home</button></li>
<li><button className="dropdown-item" onClick={() => startNewGame()} disabled={loading}><i className="bi bi-play-fill me-2"></i>Start</button></li>
                <li><button className="dropdown-item" onClick={openProfile}><i className="bi bi-person-lines-fill me-2"></i>Profile</button></li>
                <li><hr className="dropdown-divider" /></li>
                <li><button className="dropdown-item text-danger" onClick={() => supabase.auth.signOut()}><i className="bi bi-box-arrow-right me-2"></i>Sign Out</button></li>
              </ul>
            </div>
          </div>
        </div>
      </nav>

      {!gameSessionId ? (
        <>
          <AppHero onStart={startNewGame} />
        </>
      ) : (
        <>
          <div className="flex-1 overflow-auto card shadow-sm mb-3 p-3 mx-3 mx-lg-4 mt-3">
            {messages.map((msg, i) => (
              <div key={i} className={`mb-2 d-flex justify-content-start`}>
                <div className={`p-3 rounded-3 shadow-sm ${msg.role === "user" ? "text-white" : (msg.role === "ai-temp" ? "bg-body-secondary text-secondary" : "bg-body-secondary text-body")}`} style={{ maxWidth: "100%", wordBreak: "break-word", backgroundColor: (msg.role === "user" ? "#75b798" : undefined) }}>
                  <div className="d-flex align-items-center gap-2 mb-1">{msg.role === "ai" || msg.role === "ai-temp" ? (<><i className="bi bi-cpu-fill"></i><span className="fw-semibold">Advisor</span></>) : (<i className="bi bi-person-circle"></i>)}</div>
                  <div className="markdown-body"><ReactMarkdown>{msg.content}</ReactMarkdown></div>
                </div>
              </div>
            ))}
            {loading && <div className="text-muted small d-flex align-items-center gap-2"><div className="spinner-border spinner-border-sm"></div><span>Streaming response...</span></div>}
            <div ref={bottomRef}></div>
          </div>

          <form className="d-flex gap-2 align-items-start mx-3 mx-lg-4 mb-4" onSubmit={(e) => { e.preventDefault(); handleSend() }}>
            <textarea className="form-control" placeholder="What is your decision? (Ctrl/Cmd+Enter to send)" style={{ width: "100%" }} rows={3} value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); handleSend() } }} disabled={loading} />
            <button type="submit" disabled={loading} className="btn btn-primary">Send</button>
          </form>
        </>
      )}

      {showProfile && (
        <div>
          <div className="modal fade show" style={{ display: "block", background: "rgba(0,0,0,.4)" }}>
            <div className="modal-dialog modal-dialog-scrollable modal-lg">
              <div className="modal-content">
                <div className="modal-header">
                  <h5 className="modal-title">Your Sessions</h5>
                  <button type="button" className="btn-close" onClick={() => setShowProfile(false)}></button>
                </div>
                <div className="modal-body">
                  <div className="row g-3">
                    <div className="col-12 col-lg-5">
                      <div className="list-group small" style={{ maxHeight: 570, overflow: "auto" }}>
                        {loadingSessions && <div className="text-muted d-flex align-items-center gap-2"><div className="spinner-border spinner-border-sm"></div><span>Loading sessions...</span></div>}
                        {!loadingSessions && sessions.length === 0 && <div className="text-muted">No sessions found</div>}
                        {sessions.map((s) => (
                          <button key={s.id} className={`list-group-item list-group-item-action ${selectedSession?.id === s.id ? "active" : ""}`} onClick={() => viewSession(s)}>
                            <div className="d-flex align-items-center justify-content-between">
                              <div>Session {String(s.id).slice(0, 8)}</div>
                              <small>{s.created_at ? new Date(s.created_at).toLocaleString() : ""}</small>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="col-12 col-lg-7">
                      {!selectedSession && <div className="text-muted">Select a session to view transcript</div>}
                      {selectedSession && (
                        <div className="border rounded p-2" style={{ maxHeight: 570, overflow: "auto" }}>
                          {loadingMessages && <div className="text-muted d-flex align-items-center gap-2"><div className="spinner-border spinner-border-sm"></div><span>Loading transcript...</span></div>}
                          {!loadingMessages && selectedMessages.map((m, i) => (
                            <div key={i} className="mb-2">
                              <div className="d-flex align-items-center gap-2 mb-1">{m.role === "ai" ? (<><i className="bi bi-cpu-fill"></i><span className="fw-semibold">Advisor</span></>) : (<i className="bi bi-person-circle"></i>)}</div>
                              <div className="markdown-body"><ReactMarkdown>{m.content}</ReactMarkdown></div>
                              <div className="text-muted" style={{ fontSize: "0.75rem" }}>{m.created_at ? new Date(m.created_at).toLocaleString() : ""}</div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                <div className="modal-footer">
                  {selectedSession && <>
                    <button className="btn btn-primary" onClick={continueFromSelected} disabled={loadingMessages}>Continue Session</button>
                    <button className="btn btn-outline-danger" onClick={deleteSelectedSession} disabled={deleting}>Delete Session</button>
                  </>}
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

function App() {
  const [session, setSession] = useState(null)
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setSession(session))
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => setSession(session))
    return () => subscription.unsubscribe()
  }, [])
  return <div className="container-fluid p-0">{!session ? <AuthView /> : <GameView session={session} />}</div>
}

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <App />
  </StrictMode>
)











