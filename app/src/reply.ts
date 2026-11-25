import { LaunchProps } from "@raycast/api";
import { launchWithSelection, TextArgs } from "./launch";

export default async function Command(props: LaunchProps<TextArgs>) {
  await launchWithSelection("reply", props.arguments.text);
}
