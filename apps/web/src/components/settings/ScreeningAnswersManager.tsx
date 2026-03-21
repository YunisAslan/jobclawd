"use client";

import { useState } from "react";
import { useScreeningAnswers, useUpsertScreeningAnswer, useDeleteScreeningAnswer } from "@/hooks/use-screening";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { Button } from "@/components/ui/Button";
import { Label } from "@/components/ui/Label";
import { Plus, Trash2, Loader2, Save } from "lucide-react";

const COMMON_QUESTIONS = [
  "Are you legally authorized to work in this country?",
  "Will you now or in the future require sponsorship?",
  "What are your salary expectations?",
  "How many years of relevant experience do you have?",
  "Are you willing to relocate?",
  "When can you start?",
  "Do you have experience with [specific technology]?",
  "Are you comfortable working in a hybrid/remote environment?",
];

export default function ScreeningAnswersManager() {
  const { data: answers = [], isLoading } = useScreeningAnswers();
  const upsert = useUpsertScreeningAnswer();
  const remove = useDeleteScreeningAnswer();

  const [newQuestion, setNewQuestion] = useState("");
  const [newAnswer, setNewAnswer] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editAnswer, setEditAnswer] = useState("");

  function handleAdd() {
    const q = newQuestion.trim();
    const a = newAnswer.trim();
    if (!q) return;
    upsert.mutate({ question: q, answer: a }, {
      onSuccess: () => {
        setNewQuestion("");
        setNewAnswer("");
      },
    });
  }

  function handleSaveEdit(id: number, question: string) {
    upsert.mutate({ question, answer: editAnswer.trim() }, {
      onSuccess: () => setEditingId(null),
    });
  }

  function handleQuickAdd(question: string) {
    if (answers.some((a) => a.question === question)) return;
    setNewQuestion(question);
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const existingQuestions = new Set(answers.map((a) => a.question));
  const suggestions = COMMON_QUESTIONS.filter((q) => !existingQuestions.has(q));

  return (
    <div className="space-y-5">
      <p className="text-xs text-muted-foreground">
        Save answers to common screening questions. These will be reused across future applications.
      </p>

      {/* Existing answers */}
      {answers.length > 0 && (
        <div className="space-y-3">
          {answers.map((a) => (
            <div key={a.id} className="border border-border/60 rounded-lg p-3 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-medium leading-snug flex-1">{a.question}</p>
                <div className="flex items-center gap-1 shrink-0">
                  {editingId === a.id ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-7 text-success hover:text-success"
                      onClick={() => handleSaveEdit(a.id!, a.question)}
                      disabled={upsert.isPending}
                    >
                      <Save className="size-3.5" />
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-xs text-muted-foreground"
                      onClick={() => {
                        setEditingId(a.id!);
                        setEditAnswer(a.answer);
                      }}
                    >
                      Edit
                    </Button>
                  )}
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-7 text-muted-foreground hover:text-destructive"
                    onClick={() => a.id && remove.mutate(a.id)}
                    disabled={remove.isPending}
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              </div>
              {editingId === a.id ? (
                <Textarea
                  value={editAnswer}
                  onChange={(e) => setEditAnswer(e.target.value)}
                  rows={2}
                  className="resize-y min-h-16 text-sm"
                  autoFocus
                />
              ) : (
                <p className="text-xs text-muted-foreground whitespace-pre-wrap">
                  {a.answer || <span className="italic">No answer yet</span>}
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Add new */}
      <div className="border border-dashed border-border rounded-lg p-3 space-y-3">
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Question</Label>
          <Input
            placeholder="Type a screening question..."
            value={newQuestion}
            onChange={(e) => setNewQuestion(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Your answer</Label>
          <Textarea
            placeholder="Your standard answer..."
            rows={2}
            value={newAnswer}
            onChange={(e) => setNewAnswer(e.target.value)}
            className="resize-y min-h-16"
          />
        </div>
        <Button
          type="button"
          size="sm"
          onClick={handleAdd}
          disabled={!newQuestion.trim() || upsert.isPending}
          className="gap-1.5 text-xs"
        >
          {upsert.isPending ? <Loader2 className="size-3.5 animate-spin" /> : <Plus className="size-3.5" />}
          Save answer
        </Button>
      </div>

      {/* Quick-add suggestions */}
      {suggestions.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground font-medium">Common questions</p>
          <div className="flex flex-wrap gap-1.5">
            {suggestions.slice(0, 5).map((q) => (
              <Button
                key={q}
                type="button"
                variant="outline"
                size="sm"
                className="h-auto py-1 px-2 text-[11px] font-normal text-muted-foreground hover:text-foreground whitespace-normal text-left"
                onClick={() => handleQuickAdd(q)}
              >
                + {q}
              </Button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
