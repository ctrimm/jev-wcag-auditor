import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createJob } from "@/lib/jobs";

const Body = z.object({
  url: z.string().min(4).max(500),
  wcagVersions: z.array(z.enum(["2.0", "2.1", "2.2"])).min(1).default(["2.1"]),
  includeLevelA: z.boolean().default(true),
  laws: z.array(z.string()).default(["508"]),
  jevMode: z.enum(["off", "judgement", "full"]).default("judgement"),
});

export async function POST(req: NextRequest) {
  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid audit options." }, { status: 400 });
  }
  try {
    // Validate URL shape early so typos fail fast.
    let u = parsed.data.url.trim();
    if (!/^https?:\/\//i.test(u)) u = "https://" + u;
    new URL(u);
    const job = createJob({ ...parsed.data, url: u });
    return NextResponse.json({ id: job.id });
  } catch {
    return NextResponse.json({ error: "That URL does not look valid." }, { status: 400 });
  }
}
