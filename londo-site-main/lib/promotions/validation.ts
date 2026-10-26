export type Family = "MEMPHIS";
export function familyOf(value: unknown): Family { if(value!=="MEMPHIS")throw new Error("Неизвестная семья."); return value; }
export function object(value: unknown): Record<string,unknown> { if(!value||typeof value!=="object"||Array.isArray(value))throw new Error("Некорректные данные."); return value as Record<string,unknown>; }
export function str(value:unknown,max:number,min=0):string { if(typeof value!=="string"||value.trim().length<min||value.trim().length>max)throw new Error(`Ожидается текст длиной ${min}–${max}.`);return value.trim(); }
function integer(value:unknown,min:number,max:number):number { if(typeof value!=="number"||!Number.isInteger(value)||value<min||value>max)throw new Error("Недопустимое число.");return value; }
function bool(value:unknown):boolean { if(typeof value!=="boolean")throw new Error("Недопустимый переключатель.");return value; }
export function snowflake(value:unknown):string { const id=str(value,20,17);if(!/^\d{17,20}$/.test(id))throw new Error("Недопустимый Discord ID.");return id; }
export function rankInput(value:unknown) {
 const v=object(value);if(!Array.isArray(v.criteria)||v.criteria.length>20)throw new Error("Максимум 20 критериев.");
 if(!Array.isArray(v.questions)||v.questions.length<1||v.questions.length>5)throw new Error("Для формы нужен 1–5 вопросов.");
 const questions=v.questions.map((raw,sortOrder)=>{const q=object(raw);const type=q.type;if(type!=="SHORT"&&type!=="PARAGRAPH")throw new Error("Неизвестный тип вопроса.");const minLength=integer(q.minLength??0,0,4000),maxLength=integer(q.maxLength??1000,1,4000);if(minLength>maxLength)throw new Error("Минимальная длина больше максимальной.");return {label:str(q.label,45,1),placeholder:str(q.placeholder??"",100),type:type as "SHORT"|"PARAGRAPH",required:bool(q.required),minLength,maxLength,sortOrder};});
 const isPosition=bool(v.isPosition),removePreviousRank=bool(v.removePreviousRank);if(isPosition&&removePreviousRank)throw new Error("Должность не заменяет основной ранг.");
 return {name:str(v.name,80,1),description:str(v.description??"",1000),discordRoleId:snowflake(v.discordRoleId),sortOrder:integer(v.sortOrder,-10000,10000),isActive:bool(v.isActive),isPosition,removePreviousRank,criteria:v.criteria.map((raw,sortOrder)=>{const c=object(raw);return {text:str(c.text,500,1),isRequired:bool(c.isRequired),sortOrder};}),questions};
}
export function settingsInput(value:unknown) { const v=object(value);return {title:str(v.title,100,1),description:str(v.description,1500),isEnabled:bool(v.isEnabled),discordChannelId:v.discordChannelId?snowflake(v.discordChannelId):null}; }
export function answerInput(value:unknown,questions:{id:string;label:string;required:boolean;minLength:number|null;maxLength:number|null}[]) {
 const data=object(value);if(Object.keys(data).some(id=>!questions.some(q=>q.id===id)))throw new Error("Форма изменилась. Откройте её заново.");
 return questions.map(q=>{const answer=str(data[q.id]??"",q.maxLength??4000);if((q.required&&!answer)||(answer.length>0&&answer.length<(q.minLength??0)))throw new Error(`Проверьте ответ: ${q.label}`);return {questionId:q.id,label:q.label,value:answer};});
}
