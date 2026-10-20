import {PrismaClient,Role,DocumentStatus} from "@prisma/client";
const prisma=new PrismaClient();
async function main(){
 const maya=await prisma.userProfile.upsert({where:{email:"maya@demo.school"},update:{},create:{authUserId:"demo-student-maya",email:"maya@demo.school",name:"Maya Santos",role:Role.STUDENT,student:{create:{studentNumber:"2024-01842",program:"BS Information Technology"}}}});
 const adrian=await prisma.userProfile.upsert({where:{email:"adrian@demo.company"},update:{},create:{authUserId:"demo-supervisor-adrian",email:"adrian@demo.company",name:"Adrian Cruz",role:Role.SUPERVISOR}});
 await prisma.userProfile.upsert({where:{email:"elena@demo.school"},update:{},create:{authUserId:"demo-coordinator-elena",email:"elena@demo.school",name:"Elena Reyes",role:Role.COORDINATOR}});
 const company=await prisma.company.upsert({where:{id:"demo-northstar"},update:{},create:{id:"demo-northstar",name:"Northstar Digital Solutions",approved:true,address:"Makati City, Metro Manila"}});
 await prisma.supervisorAssignment.upsert({where:{userId:adrian.id},update:{companyId:company.id},create:{userId:adrian.id,companyId:company.id,canSign:true}});
 const student=await prisma.student.findUniqueOrThrow({where:{userId:maya.id}});
 await prisma.ojtPlacement.upsert({where:{studentId:student.id},update:{status:"APPROVED"},create:{studentId:student.id,companyId:company.id,status:"APPROVED"}});
 const doc=await prisma.dailyDocumentation.upsert({where:{studentId_day:{studentId:student.id,day:1}},update:{},create:{studentId:student.id,day:1,status:DocumentStatus.SUBMITTED}});
 await prisma.documentVersion.upsert({where:{documentationId_version:{documentationId:doc.id,version:1}},update:{},create:{documentationId:doc.id,version:1,activities:"Reviewed team workflow and configured development environment.",skills:"Git collaboration and sprint planning",challenges:"Learning the existing codebase",submittedAt:new Date()}});
 console.log("Seeded sample users, company, placement and a daily report. Demo Auth IDs are placeholders; provision real Supabase users before production use.");
}
main().catch(e=>{console.error(e);process.exitCode=1}).finally(()=>prisma.$disconnect());
