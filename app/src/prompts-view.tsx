import {
  Action,
  ActionPanel,
  Alert,
  Color,
  confirmAlert,
  Form,
  Icon,
  List,
  showToast,
  Toast,
  useNavigation,
} from "@raycast/api";
import { useState } from "react";
import { ui } from "./i18n";
import { loadCustomPrompts, PROMPT_IDS, PromptId, PROMPTS, saveInstructions } from "./prompts";

const fence = (text: string) => "```\n" + text + "\n```";

/** Buddy Home → Prompts: view, edit and reset the instructions of each buddy. */
export function PromptList() {
  const t = ui();
  const [custom, setCustom] = useState(loadCustomPrompts);
  const refresh = () => setCustom(loadCustomPrompts());

  return (
    <List isShowingDetail navigationTitle="Prompts">
      {PROMPT_IDS.map((id) => {
        const def = PROMPTS[id];
        const edited = custom[id] !== undefined;
        const instructions = custom[id] ?? def.default;
        return (
          <List.Item
            key={id}
            title={def.title}
            subtitle={t.promptSubtitle[id]}
            icon={def.icon}
            accessories={edited ? [{ tag: { value: t.edited, color: Color.Orange } }] : []}
            detail={
              <List.Item.Detail
                markdown={`### ✍️ ${t.instructions} ${t.instructionsState(edited)}
${fence(instructions)}
### 🔒 ${t.fixedPart}
_${t.fixedPartNote}_
${fence(def.contract(id === "translate" || id === "lookup" || id === "summarize" ? "<English | Vietnamese>" : ""))}`}
              />
            }
            actions={
              <ActionPanel>
                <Action.Push title="Edit Prompt" icon={Icon.Pencil} target={<PromptForm id={id} onSaved={refresh} />} />
                {edited && (
                  <Action
                    title="Reset to Default"
                    icon={Icon.ArrowCounterClockwise}
                    style={Action.Style.Destructive}
                    shortcut={{ modifiers: ["ctrl"], key: "x" }}
                    onAction={async () => {
                      const ok = await confirmAlert({
                        title: `Reset "${def.title}" to default?`,
                        primaryAction: { title: "Reset", style: Alert.ActionStyle.Destructive },
                      });
                      if (!ok) return;
                      saveInstructions(id, "");
                      refresh();
                      await showToast({ style: Toast.Style.Success, title: "Prompt reset to default" });
                    }}
                  />
                )}
                <Action.CopyToClipboard title="Copy Prompt" content={instructions} />
              </ActionPanel>
            }
          />
        );
      })}
    </List>
  );
}

function PromptForm({ id, onSaved }: { id: PromptId; onSaved: () => void }) {
  const { pop } = useNavigation();
  const t = ui();
  const def = PROMPTS[id];
  const [text, setText] = useState(loadCustomPrompts()[id] ?? def.default);

  return (
    <Form
      navigationTitle={`Prompt · ${def.title}`}
      actions={
        <ActionPanel>
          <Action.SubmitForm
            title="Save Prompt"
            icon={Icon.Check}
            onSubmit={async () => {
              saveInstructions(id, text);
              onSaved();
              await showToast({ style: Toast.Style.Success, title: "Prompt saved" });
              pop();
            }}
          />
          <Action
            title="Fill in Default"
            icon={Icon.ArrowCounterClockwise}
            shortcut={{ modifiers: ["ctrl"], key: "x" }}
            onAction={() => setText(def.default)}
          />
        </ActionPanel>
      }
    >
      <Form.TextArea
        id="instructions"
        title={`✍️ ${t.instructions}`}
        value={text}
        onChange={setText}
        enableMarkdown={false}
      />
      <Form.Description title={`🔒 ${t.formNoteTitle}`} text={t.formNote} />
    </Form>
  );
}
