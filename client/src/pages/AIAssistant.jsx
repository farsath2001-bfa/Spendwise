import { useState, useEffect, useRef } from 'react';
import { Bot, Send, Sparkles } from 'lucide-react';
import toast from 'react-hot-toast';
import { getSuggestions, askAssistant } from '../services/aiService';
import { useAuth } from '../context/AuthContext';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { Spinner } from '../components/common/Spinner';
import Avatar from '../components/common/Avatar';

const GREETING =
  "Hi! I'm your AI Assistant - ask me about your real spending, and I'll answer using your actual transactions.";

export default function AIAssistant() {
  const { user } = useAuth();
  const [messages, setMessages] = useState([{ role: 'assistant', text: GREETING }]);
  const [suggestions, setSuggestions] = useState([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const bottomRef = useRef(null);
  const isEmptyConversation = messages.length <= 1;
  // Read by the Dashboard's onboarding checklist - flips true the moment
  // someone actually sends a question, not just when they open this page.
  const [, setHasUsedAI] = useLocalStorage('onboardingUsedAI', false);

  useEffect(() => {
    (async () => {
      try {
        const data = await getSuggestions();
        setSuggestions(data);
      } catch {
        // Suggestion chips are a nice-to-have - a silent skip here still
        // leaves a fully working chat if this one call fails.
      }
    })();
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, sending]);

  const send = async (text) => {
    const question = text.trim();
    if (!question || sending) return;

    setMessages((prev) => [...prev, { role: 'user', text: question }]);
    setInput('');
    setSending(true);
    setHasUsedAI(true);
    try {
      const data = await askAssistant(question);
      setMessages((prev) => [...prev, { role: 'assistant', text: data.answer }]);
    } catch (err) {
      const message = err.response?.data?.message || "Sorry, I couldn't process that just now.";
      setMessages((prev) => [...prev, { role: 'assistant', text: message }]);
      toast.error('Something went wrong asking the assistant.');
    } finally {
      setSending(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    send(input);
  };

  return (
    // The height budget below "100vh minus everything else" differs by
    // breakpoint - a mobile top bar eats extra space that the desktop
    // sidebar layout doesn't have, so a single fixed number either left a
    // gap or pushed the message input off the bottom of small screens.
    <div className="mx-auto flex h-[calc(100vh-10rem)] max-w-2xl flex-col sm:h-[calc(100vh-11rem)] lg:h-[calc(100vh-8rem)]">
      <div className="mb-4">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">AI Assistant</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Ask about your spending, budgets, and savings - answers come straight from your real data.
        </p>
      </div>

      <div className="flex flex-1 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        {isEmptyConversation ? (
          // No real conversation yet - a centered "start here" state reads
          // much better than a single chat bubble floating at the top of a
          // mostly-empty scroll area. Sending anything (typed or a chip)
          // flips messages.length to 2+ and this switches to the normal
          // scrolling chat view below.
          <div className="flex flex-1 flex-col items-center justify-center gap-5 p-6 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400">
              <Bot size={26} />
            </span>
            <div className="max-w-sm">
              <p className="text-base font-semibold text-slate-900 dark:text-white">
                Ask me anything about your money
              </p>
              <p className="mt-1.5 text-sm text-slate-500 dark:text-slate-400">{GREETING}</p>
            </div>
            {suggestions.length > 0 && (
              <div className="flex max-w-md flex-wrap justify-center gap-2">
                {suggestions.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => send(s)}
                    className="flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                  >
                    <Sparkles size={12} className="text-emerald-500" />
                    {s}
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="flex-1 space-y-4 overflow-y-auto p-4">
            {messages.map((m, i) => (
              <div key={i} className={`flex items-end gap-2 ${m.role === 'user' ? 'flex-row-reverse' : ''}`}>
                {m.role === 'assistant' ? (
                  <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400">
                    <Bot size={16} />
                  </span>
                ) : (
                  <Avatar name={user?.name} size={32} />
                )}
                <div
                  className={`max-w-[75%] whitespace-pre-wrap rounded-2xl px-3.5 py-2.5 text-sm ${
                    m.role === 'user'
                      ? 'rounded-br-sm bg-emerald-600 text-white'
                      : 'rounded-bl-sm bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200'
                  }`}
                >
                  {m.text}
                </div>
              </div>
            ))}

            {sending && (
              <div className="flex items-end gap-2">
                <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400">
                  <Bot size={16} />
                </span>
                <div className="flex items-center gap-2 rounded-2xl rounded-bl-sm bg-slate-100 px-3.5 py-2.5 dark:bg-slate-800">
                  <Spinner className="h-3.5 w-3.5 text-slate-400" />
                  <span className="text-xs text-slate-400">Thinking…</span>
                </div>
              </div>
            )}

            <div ref={bottomRef} />
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex items-center gap-2 border-t border-slate-100 p-3 dark:border-slate-800">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about your spending…"
            disabled={sending}
            className="flex-1 rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none transition-colors focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
          />
          <button
            type="submit"
            disabled={sending || !input.trim()}
            className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-emerald-600 text-white transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
            aria-label="Send"
          >
            {sending ? <Spinner className="h-4 w-4" /> : <Send size={16} />}
          </button>
        </form>
      </div>
    </div>
  );
}