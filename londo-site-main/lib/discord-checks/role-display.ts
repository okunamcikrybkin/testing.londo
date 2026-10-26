import type {GuildResult} from "./policy";
export function roleMessage(g:GuildResult):string {
 if(g.roles!==null)return g.roles.length?`Роли получены. ID ролей: ${g.roles.map(id=>g.roleNames?.[id]?`${g.roleNames[id]} (${id})`:id).join(", ")}`:"Ролей нет.";
 switch(g.roleStatus){
 case "NOT_CHECKED":return "Не проверялось";
 case "MISSING_SCOPE":return "Нет необходимого OAuth-разрешения guilds.members.read. Кандидату нужно повторно разрешить проверку на /apply.";
 case "RECONSENT_REQUIRED":return "Discord-разрешение истекло или отозвано. Кандидату нужно повторно разрешить проверку на /apply.";
 case "API_ERROR":return `Discord API вернул ошибку${g.roleHttpStatus?` HTTP ${g.roleHttpStatus}`:""}${g.roleErrorCode?` (код ${g.roleErrorCode})`:""}.`;
 case "RATE_LIMITED":return "Проверка временно ограничена Discord. Повторите позже.";
 default:return "Информация недоступна. Запрос не завершён или Discord не предоставил сведения. Повторите проверку.";
 }
}
