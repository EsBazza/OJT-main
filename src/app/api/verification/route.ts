import { NextResponse } from "next/server";
import { Role } from "@/generated/prisma";
import { z } from "zod";
import { getSessionProfile } from "@/lib/page-auth";
import { prisma } from "@/lib/prisma";
import { loadSignedVersion, verifyLoadedVersion } from "@/lib/verify";

export async function POST(request: Request) {
  const profile = await getSessionProfile();
  if (!profile) return NextResponse.json({ error: "Sign in to verify signatures." }, { status: 401 });
  if (profile.role !== Role.COORDINATOR) return NextResponse.json({ error: "Only coordinators can verify signatures." }, { status: 403 });

  const body = await request.json().catch(() => null);
  const parsed = z.object({ documentId: z.string().uuid() }).safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid document id" }, { status: 400 });

  const version = await loadSignedVersion(parsed.data.documentId);
  const verified = version && verifyLoadedVersion(version);
  if (!version || !verified) return NextResponse.json({ error: "Signed document not found" }, { status: 404 });

  await prisma.auditLog.create({ data: { actorId: profile.id, action: "SIGNATURE_VERIFIED", targetType: "document_version", targetId: version.id, details: { result: verified.result.result, digest: verified.result.digest } } });
  return NextResponse.json(verified.result);
}
