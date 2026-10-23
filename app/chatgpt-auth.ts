import { redirect } from 'next/navigation';
export type ChatGPTUser = {userId:string;displayName:string;email:string;fullName:string|null};
// Vercel does not verify legacy Sites identity headers. Never trust them.
export async function getChatGPTUser(): Promise<ChatGPTUser|null> {return null;}
export async function requireChatGPTUser(returnTo:string): Promise<ChatGPTUser> {redirect(chatGPTSignInPath(returnTo));}
export function chatGPTSignInPath(returnTo:string) {return '/owner/login?returnTo='+encodeURIComponent(returnTo.startsWith('/')&&!returnTo.startsWith('//')?returnTo:'/owner');}
export function chatGPTSignOutPath() {return '/owner/login';}
