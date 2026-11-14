import { useState } from "react";
import { askQabas } from "../services/api";

// Ask QABAS: questions answered only from the QABAS dataset, with the records cited.

const EXAMPLES = [
  "Which material spread flame fastest in microgravity?",
  "What happened to Nomex?",
  "How did silicone behave on Earth compared with space?",
  "Can this data tell us about fire on the Moon?",
];

function AskQabas({ onOpenTest }) {
  const [question, setQuestion] = useState("");
  const [busy, setBusy] = useState(false);
  const [exchanges, setExchanges] = useState([]);

  async function send(text) {
    const q = text.trim();
    if (!q || busy) return;
    setBusy(true);
    setQuestion("");
    try {
      const reply = await askQabas(q);
      setExchanges((list) => [{ question: q, ...reply }, ...list]);
    } catch {
      setExchanges((list) => [
        { question: q, mode: "error", answer: "Could not reach the assistant. Try again in a minute.", sources: [] },
        ...list,
      ]);
    }
    setBusy(false);
  }

  return (
    <div className="ask">
      <form
        className="ask-form"
        onSubmit={(event) => {
          event.preventDefault();
          send(question);
        }}
      >
        <input
          type="text"
          aria-label="Your question"
          placeholder="Ask about the tests, materials or findings"
          maxLength={500}
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
        />
        <button className="primary" type="submit" disabled={busy || !question.trim()}>
          {busy ? "Thinking…" : "Ask"}
        </button>
      </form>

      <div className="tabs">
        {EXAMPLES.map((example) => (
          <button key={example} className="tab" onClick={() => send(example)} disabled={busy}>
            {example}
          </button>
        ))}
      </div>

      {exchanges.map((item, index) => (
        <article className="ask-item" key={exchanges.length - index}>
          <p className="ask-question">{item.question}</p>
          <p className="ask-answer">{item.answer}</p>

          {item.sources.length > 0 && (
            <div className="ask-sources">
              <span className="lab-label">
                {item.mode === "ai" ? "Records cited" : "Closest records"}
              </span>
              {item.sources.map((source) => (
                <div className="ask-source" key={source.id}>
                  {source.kind === "test" ? (
                    <button className="tab" onClick={() => onOpenTest(source.id)}>
                      {source.id} · open test
                    </button>
                  ) : (
                    <span className="badge">{source.id}</span>
                  )}
                  {source.text && <p className="hint">{source.text}</p>}
                </div>
              ))}
            </div>
          )}
        </article>
      ))}

      <p className="lab-note">
        Answers are written by an AI model that is given only the QABAS dataset and told to cite
        the record behind every statement. It can still make mistakes: open the cited records to
        check.
      </p>
    </div>
  );
}

export default AskQabas;