import { useEffect, useRef, useState } from "react";
import { askQabas } from "../services/api";

// Ask QABAS: a friendly chat that answers only from the QABAS dataset
// and shows the records behind each answer.

const GREETING =
  "Hi! I'm QABAS, your guide to NASA's spacecraft fire experiments. Ask me about a material, a test, or which investigations matter for a safety question. I only answer from the records on this site, and I'll always show you where an answer comes from.";

const EXAMPLES = [
  "Which material spread flame fastest in microgravity?",
  "What happened to Nomex?",
  "How did silicone behave on Earth compared with space?",
  "Which investigations matter for smoke detection?",
  "Can this data tell us about fire on the Moon?",
];

function AskQabas({ onOpenTest }) {
  const [question, setQuestion] = useState("");
  const [busy, setBusy] = useState(false);
  const [exchanges, setExchanges] = useState([]);
  const listRef = useRef(null);

  // Keep the newest message in view.
  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [exchanges, busy]);

  async function send(text) {
    const q = text.trim();
    if (!q || busy) return;
    setBusy(true);
    setQuestion("");
    setExchanges((list) => [...list, { question: q, pending: true }]);

    // The last few answered exchanges go along, so follow-up questions make sense.
    const history = exchanges
      .filter((item) => item.answer && item.mode !== "error")
      .slice(-3)
      .map((item) => ({ question: item.question, answer: item.answer }));

    let reply;
    try {
      reply = await askQabas(q, history);
    } catch {
      reply = {
        mode: "error",
        answer: "Sorry, I couldn't reach my data just now. Give it a minute and try again.",
        sources: [],
      };
    }
    setExchanges((list) => [...list.slice(0, -1), { question: q, ...reply }]);
    setBusy(false);
  }

  return (
    <div className="ask">
      <div className="chat" ref={listRef} aria-live="polite">
        <div className="bubble bubble-bot">
          <p className="bubble-name">QABAS</p>
          <p>{GREETING}</p>
        </div>

        {exchanges.map((item, index) => (
          <div key={index} className="chat-turn">
            <div className="bubble bubble-user">
              <p dir="auto">{item.question}</p>
            </div>

            <div className="bubble bubble-bot">
              <p className="bubble-name">QABAS</p>
              {item.pending ? (
                <p className="typing">Thinking…</p>
              ) : (
                <>
                  <p dir="auto" className="ask-answer">
                    {item.answer}
                  </p>
                  {item.sources.length > 0 && (
                    <div className="ask-sources">
                      <span className="lab-label">
                        {item.mode === "ai" ? "Where this comes from" : "Closest records"}
                      </span>
                      <div className="ask-source-list">
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
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="tabs ask-examples">
        {EXAMPLES.map((example) => (
          <button key={example} className="tab" onClick={() => send(example)} disabled={busy}>
            {example}
          </button>
        ))}
      </div>

      <form
        className="ask-form"
        onSubmit={(event) => {
          event.preventDefault();
          send(question);
        }}
      >
        <input
          type="text"
          dir="auto"
          aria-label="Your message"
          placeholder="Say hi, or ask about the tests, materials or investigations"
          maxLength={500}
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
        />
        <button className="primary" type="submit" disabled={busy || !question.trim()}>
          Send
        </button>
      </form>

      <p className="lab-note">
        QABAS is an AI model that is given only the QABAS dataset and told to point to the record
        behind every statement. It can still make mistakes: open the cited records to check.
      </p>
    </div>
  );
}

export default AskQabas;