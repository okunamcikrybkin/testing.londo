"use client";
import Link from "next/link";
import {useState} from "react";
import {FamilyServerIcon} from "@/components/family-server-icon";
import {Badge,date,Field,Icon,memberName,Section,type Application,type Family,type Run} from "./ui";
import styles from "./promotions.module.css";

export function ApplicationDetail({application:a,family,backHref,busy,run}:{application:Application;family:Family;backHref:string;busy:boolean;run:Run}){
 const [rejecting,setRejecting]=useState(false),[reason,setReason]=useState("");
 const identity=a.identitySnapshot;
 return <>
  <Link className={styles.back} href={backHref}><Icon name="back"/>К заявкам</Link>
  <header className={styles.detailHeading}><div><p className={styles.eyebrow}>Заявка на повышение · <FamilyServerIcon family={family} size="inline" /> {family}</p><h1>{memberName(a)}{identity.staticId&&<> <span className="text-muted">| {identity.staticId}</span></>}</h1><p>{a.rankName} · {date(a.createdAt)}</p></div><Badge status={a.status}/></header>
  <div className={styles.detailGrid}>
   <Section title="Участник"><dl className={styles.facts}><div><dt>Discord</dt><dd>{identity.username?`@${identity.username}`:identity.displayName}</dd></div><div><dt>Discord ID</dt><dd>{a.discordUserId}</dd></div><div><dt>Игровой nickname</dt><dd>{identity.gameNickname||"Не указан"}</dd></div><div><dt>Static ID</dt><dd>{identity.staticId||"Не указан"}</dd></div></dl></Section>
   <Section title="Повышение"><dl className={styles.facts}><div><dt>Семья</dt><dd><span className={styles.familyPill}><FamilyServerIcon family={family} size="inline" /> {family}</span></dd></div><div><dt>Текущий ранг</dt><dd>{a.currentRank||"Не определён"}</dd></div><div><dt>Запрашивает</dt><dd className={styles.requested}>{a.rankName}</dd></div><div><dt>Дата подачи</dt><dd>{date(a.createdAt)}</dd></div></dl></Section>
  </div>
  <div className={styles.detailStack}>
   <Section title="Критерии" description="Условия на момент подачи заявки. Выполнение проверяется по ответам участника."><ol className={styles.criteria}>{a.criteriaSnapshot.map((criterion,i)=><li className={styles.criterion} key={i}><span className={styles.number}>{i+1}</span><div><p>{criterion.text}</p><small>{criterion.isRequired?"Обязательный критерий":"Дополнительный критерий"}</small></div></li>)}</ol>{!a.criteriaSnapshot.length&&<p className={styles.smallText}>Для этого ранга критерии не были указаны.</p>}</Section>
   <Section title="Ответы участника" description="Сохранённая форма заявки"><dl className={styles.answers}>{a.answers.map((answer,i)=><div className={styles.answer} key={i}><dt><span>{String(i+1).padStart(2,"0")}</span>{answer.label}</dt><dd>{answer.value||"Ответ не указан"}</dd></div>)}</dl>{!a.answers.length&&<p className={styles.smallText}>Ответов нет.</p>}</Section>
   {a.reviewedAt&&<Section title={a.status==="APPROVING"?"Рассмотрение заявки":"Результат рассмотрения"}><dl className={styles.facts}><div><dt>Рассмотрел</dt><dd>{a.reviewedByDiscordId||"Не указан"}</dd></div><div><dt>Дата</dt><dd>{date(a.reviewedAt)}</dd></div></dl>{a.rejectionReason&&<div className={`${styles.notice} mt-5`} data-tone="error"><div><strong>Причина отклонения</strong><p className="mt-1 whitespace-pre-wrap">{a.rejectionReason}</p></div></div>}</Section>}
  </div>
  {a.lastError&&<p className={`${styles.notice} mt-5`} data-tone="error" role="status">{a.lastError}</p>}
  {a.status==="APPROVING"&&<div className={styles.decision}><Icon name="clock"/><p><strong>Заявка рассматривается</strong>Выдача роли ещё не завершена. Обновите данные через некоторое время.</p></div>}
  {a.status==="PENDING"&&<section className={styles.decision} aria-label="Решение по заявке"><p><strong>Решение по заявке</strong>Проверьте критерии и ответы перед одобрением.</p><div className={styles.actions}><button className={styles.danger} disabled={busy} onClick={()=>setRejecting(v=>!v)} aria-expanded={rejecting}><Icon name="close"/>Отклонить</button><button className={styles.primary} disabled={busy} onClick={()=>run({operation:"review",id:a.id,action:"approve"})}><Icon name="check"/>Одобрить</button></div>
   {rejecting&&<form className={styles.rejectForm} onSubmit={async e=>{e.preventDefault();if(await run({operation:"review",id:a.id,action:"reject",reason}))setRejecting(false);}}><Field title="Причина отклонения" hint="Укажите, какие требования не выполнены или что нужно исправить."><textarea ref={node=>{node?.focus();}} required maxLength={1000} value={reason} onChange={e=>setReason(e.target.value)} placeholder="Напишите причину отказа…"/></Field><div className={styles.actions}><button type="button" className={styles.button} disabled={busy} onClick={()=>setRejecting(false)}>Отмена</button><button className={styles.danger} disabled={busy||!reason.trim()}>Подтвердить отклонение</button></div></form>}
  </section>}
 </>;
}
