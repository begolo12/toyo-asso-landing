import { downloadBlob } from "../shared/dom.js";
import { formatDateTime, todayFileStamp } from "../shared/format.js";
import { toast } from "../shared/toast.js";

function statusLabel(s) {
  if (s === "lolos") return "Lolos";
  if (s === "tidak_lolos") return "Tidak Lolos";
  return "Pending";
}

export function initExports({ getRows, getJobMap }) {
  const headers = ["No", "Nama", "No. HP", "Lowongan", "Lokasi", "Waktu Daftar", "Status"];

  function exportRows() {
    const regs = getRows();
    const jobMap = getJobMap();
    const rows = regs.map((r, i) => {
      const job = jobMap[r.jobId];
      return [
        i + 1,
        r.name || "",
        r.phone || "",
        job ? job.company.romaji : r.jobId,
        job ? job.location : "",
        formatDateTime(r.timestamp),
        statusLabel(r.status || "pending"),
      ];
    });
    return { headers, rows };
  }

  function ensureRows() {
    if (getRows().length === 0) {
      toast({ message: "Tidak ada data untuk diexport.", type: "warning" });
      return false;
    }
    return true;
  }

  function exportCSV() {
    if (!ensureRows()) return;
    const { headers, rows } = exportRows();
    const csv = [headers, ...rows]
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    downloadBlob(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" }), `pendaftar-${todayFileStamp()}.csv`);
  }

  function exportExcel() {
    if (!ensureRows()) return;
    if (typeof XLSX === "undefined") {
      toast({ message: "Library Excel belum dimuat. Refresh halaman.", type: "error" });
      return;
    }
    const { headers, rows } = exportRows();
    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    ws["!cols"] = [
      { wch: 4 }, { wch: 24 }, { wch: 16 }, { wch: 28 }, { wch: 18 }, { wch: 18 }, { wch: 12 },
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Pendaftar");
    XLSX.writeFile(wb, `pendaftar-${todayFileStamp()}.xlsx`);
  }

  function exportPDF() {
    if (!ensureRows()) return;
    if (typeof window.jspdf === "undefined" || !window.jspdf.jsPDF) {
      toast({ message: "Library PDF belum dimuat. Refresh halaman.", type: "error" });
      return;
    }
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("Data Pendaftar - LPK PJB", 40, 40);
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.text(`Dicetak: ${new Date().toLocaleString("id-ID")}  ·  Total: ${getRows().length} pendaftar`, 40, 58);
    const { headers, rows } = exportRows();
    doc.autoTable({
      head: [headers],
      body: rows,
      startY: 72,
      styles: { fontSize: 8, cellPadding: 5, overflow: "linebreak" },
      headStyles: { fillColor: [30, 58, 95], textColor: 255, fontStyle: "bold" },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      columnStyles: {
        0: { cellWidth: 24, halign: "right" },
        1: { cellWidth: 110 },
        2: { cellWidth: 90 },
        3: { cellWidth: 150 },
        4: { cellWidth: 100 },
        5: { cellWidth: 110 },
        6: { cellWidth: 70 },
      },
      margin: { left: 40, right: 40 },
    });
    doc.save(`pendaftar-${todayFileStamp()}.pdf`);
  }

  document.getElementById("btnExportCSV").addEventListener("click", exportCSV);
  document.getElementById("btnExportExcel").addEventListener("click", exportExcel);
  document.getElementById("btnExportPDF").addEventListener("click", exportPDF);
}
