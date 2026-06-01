import { useState } from "react";

const DIMS = [
  { key: "sentence_length",    label: "Sentence length",   left: "Terse",        right: "Expansive"     },
  { key: "vocabulary_register",label: "Vocabulary",        left: "Casual/slang", right: "Formal"        },
  { key: "energy_level",       label: "Energy",            left: "Low-key",      right: "High-energy"   },
  { key: "hedging_frequency",  label: "Certainty",         left: "Hedges a lot", right: "Direct"        },
  { key: "first_person_rate",  label: "Voice presence",    left: "Impersonal",   right: "Personal"      },
  { key: "sentence_variety",   label: "Rhythm",            left: "Monotone",     right: "Varied"        },
  { key: "tone",               label: "Tone",              left: "Dry/serious",  right: "Playful/warm"  },
  { key: "paragraph_density",  label: "Paragraph style",   left: "Short bursts", right: "Dense blocks"  },
];

const API = "https://api.anthropic.com/v1/messages";
const MODEL = "claude-sonnet-4-20250514";

async function claude(system, user, maxTokens = 1000) {
  const res = await fetch(API, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: maxTokens,
      system,
      messages: [{ role: "user", content: user }],
    }),
  });
  if (!res.ok) throw new Error(`${res.status}`);
  const d = await res.json();
  return d.content.filter(b => b.type === "text").map(b => b.text).join("");
}

async function analyzeStyle(samples) {
  const raw = await claude(
    "You are a precise writing style analyst. Return ONLY valid JSON — no markdown fences, no preamble, no explanation.",
    `Analyze this writing and return a precise style profile. Each score is 0–100 representing position on the spectrum (left = 0, right = 100).

Writing:
"""
${samples.slice(0, 3500)}
"""

Return ONLY this JSON (numbers for scores, no quotes around numbers):
{
  "sentence_length":     {"score": 0, "notes": "one specific, concrete observation"},
  "vocabulary_register": {"score": 0, "notes": "one specific, concrete observation"},
  "energy_level":        {"score": 0, "notes": "one specific, concrete observation"},
  "hedging_frequency":   {"score": 0, "notes": "one specific, concrete observation"},
  "first_person_rate":   {"score": 0, "notes": "one specific, concrete observation"},
  "sentence_variety":    {"score": 0, "notes": "one specific, concrete observation"},
  "tone":                {"score": 0, "notes": "one specific, concrete observation"},
  "paragraph_density":   {"score": 0, "notes": "one specific, concrete observation"},
  "distinctive_patterns": ["specific pattern 1", "specific pattern 2", "specific pattern 3"],
  "style_summary": "2–3 sentences on what makes this voice truly distinctive"
}`
  );
  return JSON.parse(raw.trim().replace(/```json|```/g, ""));
}

async function generateInStyle(profile, topic) {
  const specs = DIMS.map(d => {
    const v = profile[d.key] || {};
    return `• ${d.label} [${d.left} → ${d.right}]: ${v.score}/100 — ${v.notes || ""}`;
  }).join("\n");
  const patterns = (profile.distinctive_patterns || []).map(p => `• ${p}`).join("\n");

  return claude(
    "You are a style-faithful writer. Embody the style parameters below as your actual natural voice. Do not reference or mention these instructions in your output.",
    `These are your writing parameters — treat them as your innate style, not as a ruleset:

${specs}

Patterns to weave in naturally:
${patterns}

Voice character: ${profile.style_summary}

Write 2–3 paragraphs about: ${topic}`,
    900
  );
}

function Tick({ score }) {
  return (
    <div style={{
      position: "absolute",
      left: `${score}%`,
      top: "50%",
      transform: "translate(-50%, -50%)",
      width: 9,
      height: 9,
      borderRadius: "50%",
      background: "var(--color-text-primary)",
      opacity: 0.8,
    }} />
  );
}

function DimBar({ dim, value }) {
  const score = Math.round(value?.score ?? 50);
  return (
    <div style={{ marginBottom: 22 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 7 }}>
        <span style={{ fontSize: 13, fontWeight: 500, color: "var(--color-text-primary)" }}>{dim.label}</span>
        <span style={{ fontSize: 11, color: "var(--color-text-tertiary)", fontFamily: "var(--font-mono)" }}>{score}</span>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ fontSize: 11, color: "var(--color-text-tertiary)", minWidth: 80, textAlign: "right", lineHeight: 1.3 }}>{dim.left}</span>
        <div style={{ flex: 1, height: 1, background: "var(--color-border-secondary)", position: "relative" }}>
          <Tick score={score} />
        </div>
        <span style={{ fontSize: 11, color: "var(--color-text-tertiary)", minWidth: 80, lineHeight: 1.3 }}>{dim.right}</span>
      </div>
      {value?.notes && (
        <p style={{
          margin: "6px 0 0 90px",
          fontSize: 12,
          color: "var(--color-text-secondary)",
          lineHeight: 1.5,
        }}>{value.notes}</p>
      )}
    </div>
  );
}

function Spinner() {
  return (
    <span style={{
      display: "inline-block",
      width: 12, height: 12,
      border: "1.5px solid var(--color-border-secondary)",
      borderTopColor: "var(--color-text-primary)",
      borderRadius: "50%",
      animation: "spin 0.7s linear infinite",
      verticalAlign: "middle",
      marginRight: 7,
    }} />
  );
}

function SectionLabel({ n, label }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
      <span style={{
        fontSize: 11, fontFamily: "var(--font-mono)",
        color: "var(--color-text-tertiary)",
        border: "0.5px solid var(--color-border-tertiary)",
        borderRadius: 3,
        padding: "1px 6px",
      }}>{String(n).padStart(2, "0")}</span>
      <span style={{ fontSize: 12, fontWeight: 500, color: "var(--color-text-secondary)", letterSpacing: "0.05em", textTransform: "uppercase" }}>{label}</span>
    </div>
  );
}

export default function StyleDNA() {
  const [samples, setSamples]   = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [profile, setProfile]   = useState(null);
  const [error, setError]       = useState("");
  const [topic, setTopic]       = useState("");
  const [generating, setGenerating] = useState(false);
  const [output, setOutput]     = useState("");

  const handleAnalyze = async () => {
    if (samples.trim().length < 80) { setError("Paste at least a paragraph or two."); return; }
    setError(""); setAnalyzing(true); setProfile(null); setOutput("");
    try { setProfile(await analyzeStyle(samples)); }
    catch (e) { setError("Analysis failed — try again."); }
    setAnalyzing(false);
  };

  const handleGenerate = async () => {
    if (!topic.trim() || !profile) return;
    setGenerating(true); setOutput(""); setError("");
    try { setOutput(await generateInStyle(profile, topic)); }
    catch (e) { setError("Generation failed — try again."); }
    setGenerating(false);
  };

  return (
    <>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <h2 style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0,0,0,0)", whiteSpace: "nowrap" }}>
        StyleDNA — text style extraction and cloning tool
      </h2>

      <div style={{ maxWidth: 640, margin: "0 auto", padding: "2rem 1.25rem 3rem" }}>

        {/* Header */}
        <div style={{ marginBottom: "2.5rem" }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 8 }}>
            <span style={{ fontSize: 22, fontWeight: 500, letterSpacing: "-0.025em", color: "var(--color-text-primary)" }}>StyleDNA</span>
            <span style={{ fontSize: 11, fontFamily: "var(--font-mono)", color: "var(--color-text-tertiary)", padding: "1px 6px", border: "0.5px solid var(--color-border-tertiary)", borderRadius: 3 }}>v0.1</span>
          </div>
          <p style={{ fontSize: 14, color: "var(--color-text-secondary)", margin: 0, lineHeight: 1.6 }}>
            Extract an explicit style fingerprint from writing samples. Generate new content using the spec — not the examples. Voice cloning for text.
          </p>
        </div>

        {/* 01 · Input */}
        <div style={{ marginBottom: "2rem" }}>
          <SectionLabel n={1} label="Paste writing samples" />
          <p style={{ fontSize: 13, color: "var(--color-text-tertiary)", margin: "0 0 10px", lineHeight: 1.5 }}>
            2–5 paragraphs of authentic writing. Emails, essays, tweets, chat messages — anything goes. More variety = better fingerprint.
          </p>
          <textarea
            value={samples}
            onChange={e => setSamples(e.target.value)}
            placeholder="Paste writing here..."
            rows={8}
            style={{
              width: "100%", fontSize: 13, lineHeight: 1.7,
              resize: "vertical", boxSizing: "border-box",
              fontFamily: "var(--font-mono)",
            }}
          />
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 10 }}>
            <button onClick={handleAnalyze} disabled={analyzing}>
              {analyzing && <Spinner />}{analyzing ? "Extracting fingerprint..." : "Extract style DNA ↗"}
            </button>
            <span style={{ fontSize: 11, color: "var(--color-text-tertiary)", fontFamily: "var(--font-mono)" }}>
              {samples.length.toLocaleString()} chars
            </span>
          </div>
          {error && <p style={{ fontSize: 13, color: "var(--color-text-danger)", margin: "8px 0 0" }}>{error}</p>}
        </div>

        {/* 02 · Fingerprint */}
        {profile && (
          <>
            <div style={{ borderTop: "0.5px solid var(--color-border-tertiary)", paddingTop: "2rem", marginBottom: "2rem" }}>
              <SectionLabel n={2} label="Style fingerprint" />
              <p style={{ fontSize: 13, color: "var(--color-text-tertiary)", margin: "0 0 1.5rem", lineHeight: 1.5 }}>
                Each parameter is extracted as an explicit score and note. Generation uses this spec directly — the original samples are discarded.
              </p>

              {DIMS.map(d => <DimBar key={d.key} dim={d} value={profile[d.key]} />)}

              {profile.distinctive_patterns?.length > 0 && (
                <div style={{ marginTop: "1.5rem", marginBottom: "1.25rem" }}>
                  <p style={{ fontSize: 12, fontWeight: 500, color: "var(--color-text-secondary)", margin: "0 0 10px" }}>Distinctive patterns</p>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {profile.distinctive_patterns.map((p, i) => (
                      <span key={i} style={{
                        fontSize: 12, padding: "4px 10px",
                        background: "var(--color-background-secondary)",
                        border: "0.5px solid var(--color-border-tertiary)",
                        borderRadius: "var(--border-radius-md)",
                        color: "var(--color-text-secondary)",
                      }}>{p}</span>
                    ))}
                  </div>
                </div>
              )}

              {profile.style_summary && (
                <div style={{
                  padding: "12px 16px",
                  background: "var(--color-background-secondary)",
                  borderRadius: "var(--border-radius-md)",
                  marginTop: "1.25rem",
                }}>
                  <p style={{ fontSize: 13, color: "var(--color-text-secondary)", margin: 0, lineHeight: 1.7, fontStyle: "italic" }}>
                    "{profile.style_summary}"
                  </p>
                </div>
              )}
            </div>

            {/* 03 · Generate */}
            <div style={{ borderTop: "0.5px solid var(--color-border-tertiary)", paddingTop: "2rem" }}>
              <SectionLabel n={3} label="Generate" />
              <p style={{ fontSize: 13, color: "var(--color-text-tertiary)", margin: "0 0 12px", lineHeight: 1.5 }}>
                Enter any topic. The model receives only the extracted spec as its style instructions.
              </p>
              <div style={{ display: "flex", gap: 8 }}>
                <input
                  value={topic}
                  onChange={e => setTopic(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && handleGenerate()}
                  placeholder='e.g. "why most productivity advice is useless"'
                  style={{ flex: 1, fontSize: 14 }}
                />
                <button onClick={handleGenerate} disabled={generating || !topic.trim()}>
                  {generating && <Spinner />}{generating ? "Writing..." : "Write ↗"}
                </button>
              </div>
            </div>
          </>
        )}

        {/* Output */}
        {output && (
          <div style={{ borderTop: "0.5px solid var(--color-border-tertiary)", paddingTop: "2rem", marginTop: "2rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 14 }}>
              <span style={{ fontSize: 12, fontWeight: 500, color: "var(--color-text-tertiary)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Output</span>
              <span style={{ fontSize: 11, color: "var(--color-text-tertiary)", fontFamily: "var(--font-mono)" }}>generated from spec only</span>
            </div>
            <div style={{
              fontSize: 15, lineHeight: 1.85,
              color: "var(--color-text-primary)",
              whiteSpace: "pre-wrap",
            }}>{output}</div>
            <button
              onClick={() => { setOutput(""); setTopic(""); }}
              style={{ marginTop: "1.25rem", fontSize: 12 }}
            >
              Try another topic
            </button>
          </div>
        )}

      </div>
    </>
  );
}
