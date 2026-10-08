"use client";

import { FormEvent, useState } from "react";
import type { ConversationState } from "../adapters/prequalification/state";
import type { PrequalificationResult } from "../adapters/prequalification/processMessage";

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

export default function Home() {
  const [input, setInput] = useState("");
  const [currentState, setCurrentState] = useState<ConversationState | null>(
    null,
  );
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const message = input.trim();

    if (!message || loading) {
      return;
    }

    setMessages((previous) => [
      ...previous,
      {
        role: "user",
        content: message,
      },
    ]);

    setInput("");
    setLoading(true);

    try {
      const response = await fetch("/api/prequalification", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message,
          state: currentState,
        }),
      });

      const data: PrequalificationResult = await response.json();

      if (!data.ok) {
        setMessages((previous) => [
          ...previous,
          {
            role: "assistant",
            content: "Impossible de traiter la demande pour le moment.",
          },
        ]);

        return;
      }

      setCurrentState(data.state);

      const nextQuestions = data.questions.map((question) => question.text);

      if (nextQuestions.length > 0) {
        setMessages((previous) => [
          ...previous,
          {
            role: "assistant",
            content: nextQuestions.join("\n"),
          },
        ]);
      } else {
        setMessages((previous) => [
          ...previous,
          {
            role: "assistant",
            content:
              data.qualification === "complete"
                ? "Merci. J'ai maintenant les informations nécessaires pour préparer votre demande."
                : "Le dossier reste incomplet. Aucune question supplémentaire n’est disponible pour ce tour.",
          },
        ]);
      }
    } catch {
      setMessages((previous) => [
        ...previous,
        {
          role: "assistant",
          content: "Impossible de traiter la demande pour le moment.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main
      style={{
        maxWidth: "800px",
        margin: "0 auto",
        padding: "40px 20px",
        fontFamily: "sans-serif",
      }}
    >
      <h1>Assistant de préqualification</h1>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "16px",
          marginTop: "32px",
          marginBottom: "32px",
        }}
      >
        {messages.map((message, index) => (
          <div key={index}>
            <strong>
              {message.role === "user" ? "Prospect" : "Assistant"}
            </strong>

            <p style={{ whiteSpace: "pre-wrap" }}>{message.content}</p>
          </div>
        ))}

        {loading && <p>Analyse en cours...</p>}
      </div>

      <form onSubmit={handleSubmit}>
        <textarea
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder="Décrivez votre projet..."
          rows={5}
          style={{
            width: "100%",
            padding: "12px",
            boxSizing: "border-box",
          }}
        />

        <button
          type="submit"
          disabled={loading}
          style={{
            marginTop: "12px",
            padding: "10px 16px",
          }}
        >
          Envoyer
        </button>
      </form>

      {currentState && (
        <section style={{ marginTop: "40px" }}>
          <h2>État actuel du dossier</h2>

          <pre
            style={{
              whiteSpace: "pre-wrap",
              padding: "16px",
              background: "#111",
            }}
          >
            {JSON.stringify(currentState.dossier, null, 2)}
          </pre>
        </section>
      )}
    </main>
  );
}
