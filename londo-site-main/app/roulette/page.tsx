import {requireFeaturePage} from "@/lib/permissions/guards";
import { playerState } from "@/lib/roulette/data";
import { RoulettePlayer } from "./player";
export default async function Page() {
  const user = await requireFeaturePage("roulette");
  return <RoulettePlayer initial={await playerState(user)}/>;
}
