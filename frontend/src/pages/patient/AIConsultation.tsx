import { useState } from 'react';
import { apiRequest } from '../../lib/api';
import { Icon } from '../../components/Icon';
import { useAuth } from '../../context/AuthContext';

const MODEL_NAME = 'random_forest';

interface Patient { name: string; age: number | string; gender: string }
interface ConsultResult {
  disease: string;
  confidence: number;
  description: string;
  precautions: string[];
  quote: string;
  severity: number;
}
interface ChatResponse {
  step: 'welcome' | 'symptoms' | 'refinement' | 'complete';
  patient: Patient;
  model_name: string;
  symptoms: string[];
  symptoms_to_ask: string[];
  current_question_idx: number;
  predicted_disease?: string;
  bot_messages: string[];
  suggested_actions: string[];
  result?: ConsultResult;
}
interface TranscriptEntry { from: 'bot' | 'user'; text: string }

function severityColor(ratio: number): string {
  if (ratio < 0.3) return '#15803d';
  if (ratio < 0.55) return '#B57BC4';
  if (ratio < 0.8) return 'var(--amber-700)';
  return 'var(--red-600)';
}

function severityBand(ratio: number): string {
  if (ratio < 0.3) return 'Low';
  if (ratio < 0.55) return 'Moderate';
  if (ratio < 0.8) return 'Elevated';
  return 'High';
}

/** New feature (not ported from the old PHP app): the Patient Portal's AI Consultation page, proxied through Laravel to the ai-service Flask microservice. */
export function AIConsultation() {
  const { user } = useAuth();

  const [phase, setPhase] = useState<'form' | 'chat' | 'complete'>('form');
  const [fullName, setFullName] = useState(user?.name ?? '');
  const [age, setAge] = useState('');
  const [gender, setGender] = useState('');
  const [symptomsText, setSymptomsText] = useState('');
  const [answerBusy, setAnswerBusy] = useState(false);

  const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);
  const [session, setSession] = useState<Omit<ChatResponse, 'bot_messages' | 'suggested_actions' | 'result'> | null>(null);
  const [suggestedActions, setSuggestedActions] = useState<string[]>([]);
  const [result, setResult] = useState<ConsultResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setPhase('form');
    setTranscript([]);
    setSession(null);
    setSuggestedActions([]);
    setResult(null);
    setError(null);
    setSymptomsText('');
  };

  const submitOnboarding = () => {
    setError(null);
    if (!fullName.trim() || !age.trim() || !gender) {
      setError('Please fill in name, age, and gender to continue.');
      return;
    }
    if (!symptomsText.trim()) {
      setError('Please describe your symptoms to continue.');
      return;
    }
    const patient: Patient = { name: fullName.trim(), age: Number(age) || age, gender };
    runChat({
      step: 'symptoms',
      patient,
      model_name: MODEL_NAME,
      user_input: symptomsText.trim(),
    }, symptomsText.trim());
  };

  const answer = (yesNo: 'Yes' | 'No') => {
    if (!session) return;
    runChat({
      step: 'refinement',
      patient: session.patient,
      model_name: session.model_name,
      symptoms: session.symptoms,
      symptoms_to_ask: session.symptoms_to_ask,
      current_question_idx: session.current_question_idx,
      predicted_disease: session.predicted_disease,
      user_input: yesNo,
    }, yesNo, setAnswerBusy);
  };

  const runChat = (body: Record<string, unknown>, userText: string, busySetter: (v: boolean) => void = setLoading) => {
    setError(null);
    busySetter(true);
    if (userText) setTranscript((prev) => [...prev, { from: 'user', text: userText }]);
    apiRequest<ChatResponse>('post', '/api/patient/ai-consultation/chat', body).then((res) => {
      busySetter(false);
      if (!res.ok) {
        setError(res.data.message ?? 'The AI consultation service is unavailable right now.');
        return;
      }
      const data = res.data;
      setTranscript((prev) => [...prev, ...data.bot_messages.map((text) => ({ from: 'bot' as const, text }))]);
      setSuggestedActions(data.suggested_actions ?? []);
      setSession({
        step: data.step,
        patient: data.patient,
        model_name: data.model_name,
        symptoms: data.symptoms,
        symptoms_to_ask: data.symptoms_to_ask,
        current_question_idx: data.current_question_idx,
        predicted_disease: data.predicted_disease,
      });

      if (data.step === 'complete' && data.result) {
        setResult(data.result);
        setPhase('complete');
      } else if (data.step === 'refinement') {
        setPhase('chat');
      } else {
        setPhase('chat');
      }
    });
  };

  const severityRatio = result ? Math.min(1, result.severity / 7) : 0;

  return (
    <>
      <div className="page-header">
        <div>
          <h1>AI Consultation</h1>
          <p>Clinical onboarding &amp; symptom classification</p>
        </div>
      </div>

      <div className="card p-4 mb-6 flex items-start gap-3" style={{ background: 'var(--purple-50)', border: '1px solid var(--purple-100)' }}>
        <Icon name="alert-circle" className="icon icon-16" style={{ color: 'var(--purple-700)', flexShrink: 0, marginTop: '.125rem' }} />
        <p className="text-xs" style={{ color: 'var(--purple-700)' }}>
          This tool offers decision-support suggestions only and is not a medical diagnosis. Always consult a qualified healthcare professional for any health concerns.
        </p>
      </div>

      <div className="card p-6 lg:p-8 mb-6">
        <div className="flex items-center gap-2 mb-1">
          <Icon name="heart-pulse" className="icon icon-20" style={{ color: '#5B3F8D' }} />
          <h3 className="text-lg font-semibold text-gray-800 font-heading">Clinical Onboarding</h3>
        </div>

        {phase === 'form' && (
          <>
            <p className="text-sm text-gray-400 mb-5">Enter patient details to initialize the consultation.</p>
            <div className="space-y-4">
              {error && <div className="text-sm" style={{ color: 'var(--red-600)' }}>{error}</div>}
              <div className="grid md:grid-cols-3 gap-4">
                <div>
                  <label className="text-xs font-medium text-gray-500 mb-1 block">Full Name</label>
                  <input className="form-input" placeholder="Full name" value={fullName} onChange={(e) => setFullName(e.target.value)} />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500 mb-1 block">Age</label>
                  <input type="number" min={0} max={120} className="form-input" placeholder="Age" value={age} onChange={(e) => setAge(e.target.value)} />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500 mb-1 block">Gender</label>
                  <select className="form-select" value={gender} onChange={(e) => setGender(e.target.value)}>
                    <option value="">Select</option>
                    <option>Male</option>
                    <option>Female</option>
                    <option>Other</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 mb-1 block">Describe your symptoms</label>
                <textarea rows={6} className="form-textarea w-full" placeholder="e.g. I have high fever and stomach pain" value={symptomsText} onChange={(e) => setSymptomsText(e.target.value)} />
              </div>
              <button className="btn btn-brand w-full md:w-auto md:px-12" disabled={loading} onClick={submitOnboarding}>
                {loading ? (
                  <><Icon name="refresh-cw" className="icon icon-16" /> Analyzing…</>
                ) : (
                  <><Icon name="brain-circuit" className="icon icon-16" /> Initialize Consultation</>
                )}
              </button>
            </div>
          </>
        )}

        {phase !== 'form' && (
          <div className="max-w-2xl">
            <div className="flex flex-col gap-2 mb-4 mt-4" style={{ maxHeight: '20rem', overflowY: 'auto' }}>
              {transcript.map((t, i) => (
                <div
                  key={i}
                  className="text-sm"
                  style={{
                    alignSelf: t.from === 'bot' ? 'flex-start' : 'flex-end',
                    background: t.from === 'bot' ? 'var(--gray-50)' : 'var(--purple-50)',
                    color: t.from === 'bot' ? 'var(--gray-700)' : 'var(--purple-700)',
                    padding: '.5rem .75rem',
                    borderRadius: '.75rem',
                    maxWidth: '85%',
                  }}
                >
                  {t.text}
                </div>
              ))}
            </div>

            {error && <div className="text-sm mb-3" style={{ color: 'var(--red-600)' }}>{error}</div>}

            {phase === 'chat' && suggestedActions.length > 0 && (
              <div className="flex gap-3">
                {suggestedActions.map((a) => (
                  <button
                    key={a}
                    className={`btn flex-1 ${a === 'Yes' ? 'btn-brand' : 'btn-ghost'}`}
                    disabled={answerBusy}
                    onClick={() => answer(a as 'Yes' | 'No')}
                  >
                    {a}
                  </button>
                ))}
              </div>
            )}

            {phase === 'chat' && suggestedActions.length === 0 && session?.step === 'symptoms' && (
              <div className="space-y-3">
                <textarea rows={3} className="form-textarea" placeholder="Try describing your symptoms differently…" value={symptomsText} onChange={(e) => setSymptomsText(e.target.value)} />
                <button
                  className="btn btn-brand w-full"
                  disabled={loading}
                  onClick={() => {
                    if (!symptomsText.trim()) return;
                    runChat({ step: 'symptoms', patient: session.patient, model_name: session.model_name, user_input: symptomsText.trim() }, symptomsText.trim());
                    setSymptomsText('');
                  }}
                >
                  {loading ? <><Icon name="refresh-cw" className="icon icon-16" /> Analyzing…</> : 'Retry'}
                </button>
              </div>
            )}

            {phase === 'complete' && result && (
              <button className="btn btn-secondary w-full" onClick={reset}>Start New Consultation</button>
            )}
          </div>
        )}
      </div>

      {result && (
        <div className="card p-6 lg:p-8">
          <div className="flex items-center gap-2 mb-5">
            <Icon name="gauge" className="icon icon-20" style={{ color: '#5B3F8D' }} />
            <h3 className="text-lg font-semibold text-gray-800 font-heading">Consultation Result</h3>
          </div>

          <div className="grid lg:grid-cols-2 gap-8">
            <div>
              <div className="text-xs text-gray-500 mb-1">Severity Index</div>
              <div className="flex items-end justify-between mb-2">
                <span className="text-3xl font-bold font-heading" style={{ color: severityColor(severityRatio) }}>{result.severity}<span className="text-base text-gray-400 font-normal">/7</span></span>
                <span className="text-sm font-semibold" style={{ color: severityColor(severityRatio) }}>{severityBand(severityRatio)}</span>
              </div>
              <div className="progress-track"><div className="progress-fill" style={{ width: `${severityRatio * 100}%`, background: severityColor(severityRatio) }} /></div>
              <p className="text-xs text-gray-400 mt-3">Model confidence: {result.confidence}%</p>

              <div className="rounded-2xl p-4 mt-5" style={{ background: 'var(--purple-50)' }}>
                <div className="text-xs text-gray-500 mb-1">Predicted condition</div>
                <div className="text-xl font-bold font-heading" style={{ color: '#5B3F8D' }}>{result.disease}</div>
              </div>
            </div>

            <div>
              <p className="text-sm text-gray-600 mb-4">{result.description}</p>
              <div className="text-xs font-semibold text-gray-500 mb-2">Suggested precautions</div>
              <ul className="space-y-1">
                {result.precautions.map((p, i) => (
                  <li key={i} className="text-sm text-gray-700 flex items-center gap-2">
                    <Icon name="check-circle" className="icon icon-14" style={{ color: '#15803d', flexShrink: 0 }} /> {p}
                  </li>
                ))}
              </ul>
              <p className="text-xs text-gray-400 italic mt-4">{result.quote}</p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
