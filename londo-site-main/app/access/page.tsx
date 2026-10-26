import {AccessPageContent} from "@/components/access/access-page-content";
export default function Page(props:{searchParams:Promise<{tab?:string}>}){return <AccessPageContent {...props}/>;}
