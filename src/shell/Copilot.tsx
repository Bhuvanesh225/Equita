/**
 * The copilot.
 *
 * A drawer that answers questions about the work by reading the same engine
 * output the rest of the app reads. There is no language model behind it, and
 * that is the point: every sentence is assembled from a figure that was computed
 * a moment earlier, and every answer shows the figures it used. A student asking
 * "am I doing enough?" gets the hours, not encouragement.
 */
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useApi } from "../lib/live";
import { post, qs } from "../lib/api";
import { useUi } from "./AppShell";
import { Drawer } from "../components/overlays";
import { Spinner } from "../components/ui";
import { IconArrowRight, IconSparkle } from "../components/icons";
import type { CopilotAnswer } from "../lib/types";

interface Turn {
  id: number;
  question: string;
  answer?: CopilotAnswer;
  error?: string;
}

export function Copilot() {
  const { copilot, closeCopilot } = useUi();
  const [question, setQuestion] = useState("");
  const [turns, setTurns] = useState<Turn[]>([]);
  const [asking, setAsking] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const counter = useRef(0);

  const scope = qs({ projectId: copilot.projectId ?? undefined, classroomId: copilot.classroomId ?? undefined });
  const { data: starters } = useApi<{ questions: string[] }>(copilot.open ? `/api/insights/copilot/starters${scope}` : null, { live: false });

  useEffect(() => {
    if (copilot.open) setQuestion(copilot.question ?? "");
  }, [copilot.open, copilot.question]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [turns.length]);

  const send = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || asking) return;
    counter.current += 1;
    const id = counter.current;
    setTurns((list) => [...list, { id, question: trimmed }]);
    setQuestion("");
    setAsking(true);
    try {
      const answer = await post<CopilotAnswer>("/api/insights/copilot", {
        question: trimmed,
        projectId: copilot.projectId ?? null,
        classroomId: copilot.classroomId ?? null,
      });
      setTurns((list) => list.map((turn) => (turn.id === id ? { ...turn, answer } : turn)));
    } catch (error) {
      setTurns((list) => list.map((turn) => (turn.id === id ? { ...turn, error: (error as Error).message } : turn)));
    } finally {
      setAsking(false);
    }
  };

  return (
    <Drawer
      open={copilot.open}
      onClose={closeCopilot}
      title="Ask about the work"
      sub="Every answer is computed from the project's own numbers."
      footer={
        <form
          className="copilot__ask"
          onSubmit={(event) => {
            event.preventDefault();
            void send(question);
          }}
        >
          <label className="visually-hidden" htmlFor="copilot-input">
            Your question
          </label>
          <input
            id="copilot-input"
            className="input"
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            placeholder="Who has too much on?"
            autoComplete="off"
          />
          <button type="submit" className="btn btn--primary" disabled={asking || !question.trim()}>
            {asking ? "…" : <IconArrowRight size={15} />}
            <span className="visually-hidden">Ask</span>
          </button>
        </form>
      }
    >
      <div className="stack stack--loose">
        {turns.length === 0 ? (
          <div className="stack">
            <div className="callout callout--accent">
              <p>
                <strong>This is not a chatbot.</strong> It reads the same equity, allocation and deadline figures the rest of
                Equita reads, and it will only tell you something the numbers actually support.
              </p>
            </div>
            <p className="label">Things worth asking</p>
            <div className="row row--wrap">
              {(starters?.questions ?? ["What should I do next?", "Is the work split fairly?"]).map((starter) => (
                <button key={starter} type="button" className="chip" onClick={() => void send(starter)}>
                  <IconSparkle size={12} />
                  {starter}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {turns.map((turn) => (
          <div key={turn.id} className="stack">
            <p style={{ fontWeight: 600, fontSize: "var(--text-sm)" }}>{turn.question}</p>
            {turn.error ? (
              <div className="flag flag--critical">
                <span className="flag__body">
                  <span className="flag__title">That did not work</span>
                  <span className="flag__detail">{turn.error}</span>
                </span>
              </div>
            ) : turn.answer ? (
              <div className="copilot__answer">
                <p className="copilot__said">{turn.answer.answer}</p>
                {turn.answer.facts.length ? (
                  <div className="copilot__facts">
                    <p className="label" style={{ paddingTop: "0.5rem" }}>
                      The figures behind it
                    </p>
                    <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
                      {turn.answer.facts.map((fact, index) => (
                        <li key={index} className="rowitem">
                          <span className="rowitem__title" style={{ whiteSpace: "normal" }}>
                            {fact.label}
                          </span>
                          <span className="rowitem__sub nowrap">{fact.value}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                {turn.answer.actions.length ? (
                  <div className="row row--wrap">
                    {turn.answer.actions.map((action) => (
                      <Link key={action.href + action.label} to={action.href} className="btn btn--outline btn--sm" onClick={closeCopilot}>
                        {action.label}
                      </Link>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : (
              <Spinner label="Reading the numbers" />
            )}
          </div>
        ))}
        <div ref={endRef} />
      </div>
    </Drawer>
  );
}