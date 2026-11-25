import { Action, ActionPanel, Form, useNavigation } from "@raycast/api";
import { useState } from "react";
import { LLMView, Mode } from "./llm-view";

const LABELS: Record<Mode, { title: string; action: string; field: string; placeholder: string; icon: string }> = {
  translate: {
    title: "Buddy Translate",
    action: "Translate",
    field: "📝 Input",
    placeholder: "Input text",
    icon: "buddy-translate.png",
  },
  reply: {
    title: "Buddy Draft Reply",
    action: "Draft Reply",
    field: "❓ Question",
    placeholder: "Input question",
    icon: "buddy-draft-reply.png",
  },
  rewrite: {
    title: "Buddy Polish English",
    action: "Polish",
    field: "📝 Input",
    placeholder: "Input draft",
    icon: "buddy-polish.png",
  },
};

/** Shown when a command runs with nothing typed and nothing selected: type the text, then run. */
export function InputForm({ mode }: { mode: Mode }) {
  const { push } = useNavigation();
  const [error, setError] = useState<string>();
  const label = LABELS[mode];

  return (
    <Form
      navigationTitle={label.title}
      actions={
        <ActionPanel>
          <Action.SubmitForm
            title={label.action}
            icon={label.icon}
            onSubmit={({ text }: { text: string }) => {
              if (!text.trim()) return setError("Please input some text");
              push(<LLMView mode={mode} text={text.trim()} startedAt={Date.now()} />);
            }}
          />
        </ActionPanel>
      }
    >
      <Form.TextArea
        id="text"
        title={label.field}
        placeholder={label.placeholder}
        error={error}
        onChange={() => error && setError(undefined)}
        autoFocus
      />
      <Form.Description text={`⌘↵ to ${label.action.toLowerCase()}`} />
    </Form>
  );
}
