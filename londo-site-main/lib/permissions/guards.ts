import {redirect} from "next/navigation";
import {getCurrentUser} from "@/lib/auth/session";
import {canUseFeature,type Feature} from "./features";
export async function getFeatureUser(feature:Feature){const user=await getCurrentUser();return user&&canUseFeature(user.effectiveAccess,feature)?user:null;}
export async function requireFeaturePage(feature:Feature){const user=await getCurrentUser();if(!user)redirect("/");if(!canUseFeature(user.effectiveAccess,feature))redirect("/access-denied");return user;}
