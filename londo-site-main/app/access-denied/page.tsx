import Link from "next/link";
import {Header} from "@/components/header";
import {getCurrentUser} from "@/lib/auth/session";
export default async function Page(){const user=await getCurrentUser();return <div className="londo-page min-h-screen"><Header user={user}/><main className="mx-auto max-w-xl px-6 py-20"><p className="londo-eyebrow">LONDO / ДОСТУП</p><h1 className="mt-4 text-3xl font-bold">Недостаточно прав</h1><p className="my-6 text-muted">Этот раздел недоступен с вашим текущим уровнем доступа.</p><Link className="londo-button px-5 py-3" href={user?"/profile":"/"}>Вернуться</Link>{user&&<Link className="ml-4 text-sm" href="/access">Мой доступ</Link>}</main></div>;}
