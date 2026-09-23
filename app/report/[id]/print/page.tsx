/** Print view: the full report in the same design as the interactive
 *  report, tuned for paper. The PDF route renders this page. */
import { notFound } from "next/navigation";
import { getReport } from "@/lib/jobs";
import PrintReport from "./PrintReport";

export const dynamic = "force-dynamic";

export default async function PrintPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const report = getReport(id);
  if (!report) notFound();
  return (
    <>
      <style>{`
        @page { size: Letter; margin: 10mm 11mm; }
        html { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        .pcard { break-inside: auto; }
        .prow { break-inside: avoid; }
        a { color: #005ea2; }
        @media print {
          .prow { padding: 7px 0 !important; }
          .pcard { padding: 12px 14px !important; margin-bottom: 10px !important; }
          .printmain { padding-bottom: 0 !important; }
        }
      `}</style>
      <main className="printmain" style={{ maxWidth: 960, margin: "0 auto", padding: "24px 20px 40px", fontFamily: "system-ui, sans-serif", color: "#1b1b1b", background: "#fff" }}>
        <PrintReport report={report} />
      </main>
    </>
  );
}
