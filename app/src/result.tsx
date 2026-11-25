import { LaunchProps } from "@raycast/api";
import { BuddyHome } from "./home";
import { InputForm } from "./input-form";
import { LLMRequest, LLMView } from "./llm-view";

// Opened by Buddy Translate / Draft Reply / Polish English with a launch context:
// with text it shows the result, without text an input form. Opened directly, it is the home screen.
export default function Command({ launchContext }: LaunchProps<{ launchContext?: LLMRequest }>) {
  if (!launchContext?.mode) return <BuddyHome />;
  return launchContext.text ? <LLMView {...launchContext} /> : <InputForm mode={launchContext.mode} />;
}
