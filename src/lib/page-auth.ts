import {cookies} from "next/headers";
import {redirect} from "next/navigation";
import type {Role} from "./demo-data";
import {users} from "./demo-data";
import {createSupabaseServer} from "./supabase";
export async function requireDemoRole(allowed:Role[]){if(process.env.DEMO_MODE==="true"){const c=await cookies(),role=c.get("ojt_demo_role")?.value,userId=c.get("ojt_demo_user")?.value;if(!role||!userId)redirect("/login");if(!allowed.includes(role as Role))redirect("/?error=permission");const user=users.find(x=>x.id===userId);if(!user||user.role!==role)redirect("/login");return {role:role as Role,user}}const supabase=await createSupabaseServer(),{data:{user:authUser}}=await supabase.auth.getUser();if(!authUser)redirect("/login");const {data:profile}=await supabase.from("user_profiles").select("id,name,email,role,active").eq("auth_user_id",authUser.id).maybeSingle();if(!profile||!profile.active||!allowed.includes(profile.role as Role))redirect("/?error=permission");return {role:profile.role as Role,user:{id:profile.id,name:profile.name,email:profile.email,role:profile.role as Role}}}
