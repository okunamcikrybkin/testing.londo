import {requireFeaturePage} from "@/lib/permissions/guards";
import {AccessPageContent} from "@/components/access/access-page-content";
export default async function Page(props: {searchParams:Promise<{tab?:string}>}){await requireFeaturePage("accessManagement");return <AccessPageContent {...props} managementOnly/>;}
