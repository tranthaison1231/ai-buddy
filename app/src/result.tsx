import { LaunchProps } from "@raycast/api";
import { AskForm, AskRequest, AskView } from "./ask-view";
import { BuddyHome } from "./home";
import { InputForm } from "./input-form";
import { LLMRequest, LLMView } from "./llm-view";
import { VisionFileForm, VisionRequest, VisionView } from "./vision-view";
import { WriteForm, WriteRequest, WriteView } from "./write-view";

type ResultLaunchContext = LLMRequest | AskRequest | VisionRequest | WriteRequest;

// Opened by Buddy commands with a launch context; opened directly, it shows Buddy Home.
export default function Command({ launchContext }: LaunchProps<{ launchContext?: ResultLaunchContext }>) {
  if (!launchContext?.mode) return <BuddyHome />;
  if (launchContext.mode === "write") {
    return launchContext.notes ? (
      <WriteView
        initialNotes={launchContext.notes}
        initialStyle={launchContext.style}
        initialLanguage={launchContext.language}
        fromSelection={launchContext.fromSelection}
        startedAt={launchContext.startedAt}
      />
    ) : (
      <WriteForm initialStyle={launchContext.style} initialLanguage={launchContext.language} />
    );
  }
  if (launchContext.mode === "ask") {
    return launchContext.question ? (
      <AskView
        initialQuestion={launchContext.question}
        context={launchContext.context}
        startedAt={launchContext.startedAt}
      />
    ) : (
      <AskForm initialContext={launchContext.context} />
    );
  }
  if (launchContext.mode === "vision") {
    return launchContext.imagePath && !launchContext.pickFile ? (
      <VisionView
        imagePath={launchContext.imagePath}
        source={launchContext.source}
        initialPrompt={launchContext.prompt}
        initialAction={launchContext.action}
        startedAt={launchContext.startedAt}
      />
    ) : (
      <VisionFileForm initialPrompt={launchContext.prompt} />
    );
  }
  return launchContext.text ? <LLMView {...launchContext} /> : <InputForm mode={launchContext.mode} />;
}
