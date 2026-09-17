import { useState, useEffect, useLayoutEffect, useCallback } from 'react';
import { X } from 'lucide-react';

// No `selector` = a centered, un-anchored card (the welcome/closing steps).
// Anchored steps are skipped automatically if their target isn't currently
// on screen (e.g. the sidebar nav links are hidden below the `lg`
// breakpoint), so the tour quietly shrinks to whatever actually applies on
// the viewport it's running on instead of pointing at nothing.
const STEPS = [
  {
    title: 'Welcome to SpendWise AI 👋',
    body: "Here's a 30-second look at the essentials - skip any time.",
  },
  {
    selector: '[data-tour="quick-add"]',
    title: 'Log money in seconds',
    body: 'Add income or an expense right from here - no need to open another page first.',
  },
  {
    selector: '[data-tour="nav-transactions"]',
    title: 'Every transaction, searchable',
    body: 'Filter by date or category, edit anything, or attach a receipt photo.',
  },
  {
    selector: '[data-tour="nav-budget"]',
    title: 'Set it once, track it automatically',
    body: "Put a monthly limit on a category and SpendWise watches it for you all month.",
  },
  {
    title: "That's the basics!",
    body: 'Savings goals, analytics, and the AI Assistant are all in the sidebar whenever you want to dig deeper.',
  },
];

function isVisible(el) {
  if (!el) return false;
  const rect = el.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0;
}

export default function ProductTour({ onDismiss }) {
  const [runnableSteps, setRunnableSteps] = useState(null); // null = not computed yet
  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState(null);

  // Decide once, at mount, which anchored steps actually have something to
  // point at right now - the anchor elements are always in the DOM (not
  // conditionally rendered), so a single check after mount is enough.
  useEffect(() => {
    const steps = STEPS.filter((s) => !s.selector || isVisible(document.querySelector(s.selector)));
    setRunnableSteps(steps);
  }, []);

  const measure = useCallback(() => {
    if (!runnableSteps) return;
    const step = runnableSteps[index];
    if (!step?.selector) {
      setRect(null);
      return;
    }
    const el = document.querySelector(step.selector);
    if (!el) {
      setRect(null);
      return;
    }
    el.scrollIntoView({ block: 'center', behavior: 'smooth' });
    // Let the scroll settle a beat before measuring.
    setTimeout(() => setRect(el.getBoundingClientRect()), 250);
  }, [runnableSteps, index]);

  useLayoutEffect(() => {
    measure();
  }, [measure]);

  useEffect(() => {
    window.addEventListener('resize', measure);
    window.addEventListener('scroll', measure, true);
    return () => {
      window.removeEventListener('resize', measure);
      window.removeEventListener('scroll', measure, true);
    };
  }, [measure]);

  if (!runnableSteps || runnableSteps.length === 0) return null;

  const step = runnableSteps[index];
  const isLast = index === runnableSteps.length - 1;

  const finish = () => onDismiss();
  const next = () => (isLast ? finish() : setIndex((i) => i + 1));
  const back = () => setIndex((i) => Math.max(0, i - 1));

  // Tooltip card position: right under the highlighted element by default,
  // flipped above it if there isn't room, clamped so it never runs off the
  // sides of the viewport. Falls back to dead-center for the un-anchored
  // welcome/closing steps.
  let cardStyle = {};
  if (rect) {
    const cardWidth = 320;
    const margin = 12;
    const preferBelow = rect.bottom + 200 < window.innerHeight;
    const top = preferBelow ? rect.bottom + margin : Math.max(margin, rect.top - margin);
    const left = Math.min(Math.max(rect.left, margin), window.innerWidth - cardWidth - margin);
    cardStyle = preferBelow
      ? { position: 'fixed', top, left, width: cardWidth }
      : { position: 'fixed', bottom: window.innerHeight - rect.top + margin, left, width: cardWidth };
  }

  return (
    <div className="fixed inset-0 z-[60]">
      {/* Dark everywhere except a cutout around the highlighted element - a
          giant box-shadow on a rect-sized box is a lighter-weight trick than
          an SVG mask for a single rectangular cutout. */}
      {rect ? (
        <div
          className="pointer-events-none fixed rounded-lg ring-2 ring-emerald-400 transition-all duration-300"
          style={{
            top: rect.top - 6,
            left: rect.left - 6,
            width: rect.width + 12,
            height: rect.height + 12,
            boxShadow: '0 0 0 9999px rgba(15, 23, 42, 0.65)',
          }}
        />
      ) : (
        <div className="fixed inset-0 bg-slate-900/65" />
      )}

      <div
        className="pointer-events-auto rounded-xl border border-slate-200 bg-white p-4 shadow-2xl dark:border-slate-800 dark:bg-slate-900"
        style={
          rect
            ? cardStyle
            : { position: 'fixed', top: '50%', left: '50%', width: 320, transform: 'translate(-50%, -50%)' }
        }
      >
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm font-semibold text-slate-900 dark:text-white">{step.title}</p>
          <button
            type="button"
            onClick={finish}
            aria-label="Skip tour"
            className="-mr-1 -mt-1 flex-shrink-0 rounded-lg p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-300"
          >
            <X size={15} />
          </button>
        </div>
        <p className="mt-1.5 text-sm text-slate-600 dark:text-slate-400">{step.body}</p>

        <div className="mt-4 flex items-center justify-between">
          <div className="flex gap-1">
            {runnableSteps.map((_, i) => (
              <span
                key={i}
                className={`h-1.5 w-1.5 rounded-full ${
                  i === index ? 'bg-emerald-500' : 'bg-slate-200 dark:bg-slate-700'
                }`}
              />
            ))}
          </div>
          <div className="flex items-center gap-2">
            {index > 0 && (
              <button
                type="button"
                onClick={back}
                className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-500 transition-colors hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
              >
                Back
              </button>
            )}
            <button
              type="button"
              onClick={next}
              className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-emerald-700"
            >
              {isLast ? 'Got it' : 'Next'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}