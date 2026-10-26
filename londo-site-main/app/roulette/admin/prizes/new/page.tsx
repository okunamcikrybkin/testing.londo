import Link from "next/link";
import { PrizeForm } from "../../forms";
export default function Page(){return <><Link href="/roulette/admin" className="inline-flex text-sm text-muted transition hover:text-white">← Вернуться к наградам</Link><h1 className="mb-2 mt-6 text-3xl font-semibold text-white">Новая награда</h1><p className="mb-7 text-sm text-muted">Добавьте приз, который смогут получить участники.</p><PrizeForm/></>;}
