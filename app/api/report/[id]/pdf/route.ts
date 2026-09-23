import { NextRequest, NextResponse } from "next/server";
import { getReport } from "@/lib/jobs";
import { launchAuditBrowser } from "@/lib/browser";

/** Server-side PDF: render the condensed print view in headless Chromium. */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const report = getReport(id);
  if (!report) return NextResponse.json({ error: "Unknown report id." }, { status: 404 });

  const origin = new URL(req.url).origin;
  const browser = await launchAuditBrowser();
  try {
    const page = await browser.newPage();
    await page.goto(`${origin}/report/${id}/print`, { waitUntil: "networkidle", timeout: 60000 });
    const pdf = await page.pdf({
      format: "Letter",
      printBackground: true,
      margin: { top: "14mm", bottom: "14mm", left: "12mm", right: "12mm" },
    });
    return new NextResponse(Buffer.from(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="wcag-audit-${id}.pdf"`,
      },
    });
  } finally {
    await browser.close();
  }
}
