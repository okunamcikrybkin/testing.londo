import { NextResponse } from "next/server";
export async function POST() { return NextResponse.json({ error: "Подача заявок перенесена на сайт LONDO." }, { status: 410 }); }
