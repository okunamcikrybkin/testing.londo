"use client";
import Link from "next/link";
import { useEffect, useRef } from "react";
import {familySettingsForAccess, familySettingsTabForPath} from "@/lib/permissions/features";
import styles from "./family-settings-layout.module.css";

/** Shared navigation shell for the existing, independently guarded management pages. */
export function FamilySettingsLayout({access,pathname}:{access:string;pathname:string}) {
 const tabs=familySettingsForAccess(access);
 const current=familySettingsTabForPath(pathname);
 const tabsRef=useRef<HTMLElement>(null);
 useEffect(()=>{tabsRef.current?.querySelector<HTMLAnchorElement>('a[aria-current="page"]')?.scrollIntoView({block:"nearest",inline:"nearest"});},[current?.feature]);
 if(!current || !tabs.some(tab=>tab.feature===current.feature))return null;
 return <section className={styles.shell} aria-label="Панель администратора">
   <div className={styles.topline}>
     <nav className={styles.breadcrumb} aria-label="Навигация по панели">
       <Link href="/family-settings">Панель администратора</Link><span aria-hidden="true">/</span>
       <span aria-current="page">{current.label}</span>
     </nav>
   </div>
   <nav ref={tabsRef} className={styles.tabs} aria-label="Разделы панели администратора">
     {tabs.map(tab=><Link key={tab.href} href={tab.href} aria-current={current.feature===tab.feature?"page":undefined}>{tab.label}</Link>)}
   </nav>
 </section>;
}
