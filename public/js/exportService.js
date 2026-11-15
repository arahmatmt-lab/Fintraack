/**
 * FINTRACK — Ekspor Laporan PDF (jsPDF) & Excel (SheetJS / XLSX)
 * Bagian 3 & 5.9 Dokumen Rancangan
 */

import { formatRp, formatDateID } from './utils.js';

export function exportReportPDF({ user, periodLabel, incomeTotal, expenseTotal, netTotal, transactions, categoriesMap, walletsMap, categorySummary }) {
  const jsPDFCtor = window.jspdf?.jsPDF || window.jsPDF;
  if (!jsPDFCtor) {
    throw new Error('Library jsPDF belum termuat.');
  }

  const doc = new jsPDFCtor({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  // Header Navy Brandkit (#142B4A)
  doc.setFillColor(20, 43, 74);
  doc.rect(0, 0, 210, 34, 'F');
  doc.setTextColor(248, 250, 252);
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text('FINTRACK — Laporan Keuangan Pribadi', 14, 15);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`Pengguna: ${user?.name || '-'} (${user?.username || user?.email || '-'})`, 14, 22);
  doc.text(`Periode: ${periodLabel}  |  Dicetak: ${new Date().toLocaleDateString('id-ID')}`, 14, 28);

  // Ringkasan Kartu
  let y = 44;
  doc.setTextColor(30, 41, 59);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('Ringkasan Periode', 14, y);
  y += 6;

  doc.setFillColor(241, 245, 249);
  doc.roundedRect(14, y, 182, 22, 3, 3, 'F');
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text('Total Pemasukan', 20, y + 7);
  doc.text('Total Pengeluaran', 82, y + 7);
  doc.text('Selisih Bersih', 146, y + 7);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11.5);
  doc.setTextColor(16, 185, 129);
  doc.text(formatRp(incomeTotal), 20, y + 16);
  doc.setTextColor(20, 43, 74);
  doc.text(formatRp(expenseTotal), 82, y + 16);
  doc.setTextColor(netTotal >= 0 ? 29 : 220, netTotal >= 0 ? 78 : 38, netTotal >= 0 ? 216 : 38);
  doc.text(formatRp(netTotal, true), 146, y + 16);

  y += 32;

  // Ringkasan Kategori Pengeluaran
  if (categorySummary.length > 0) {
    doc.setTextColor(20, 43, 74);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Pengeluaran per Kategori', 14, y);
    y += 6;
    doc.setFontSize(9.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(30, 41, 59);
    for (const item of categorySummary.slice(0, 8)) {
      doc.text(`• ${item.name}`, 16, y);
      doc.text(formatRp(item.amount), 160, y, { align: 'right' });
      y += 5.5;
    }
    y += 5;
  }

  // Tabel Transaksi
  doc.setTextColor(20, 43, 74);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text(`Rincian Transaksi (${transactions.length})`, 14, y);
  y += 6;

  doc.setFillColor(20, 43, 74);
  doc.rect(14, y, 182, 7, 'F');
  doc.setTextColor(248, 250, 252);
  doc.setFontSize(8.5);
  doc.text('Tanggal', 16, y + 4.8);
  doc.text('Keterangan', 42, y + 4.8);
  doc.text('Kategori', 108, y + 4.8);
  doc.text('Dompet', 142, y + 4.8);
  doc.text('Nominal', 193, y + 4.8, { align: 'right' });
  y += 10;

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(30, 41, 59);

  for (const tx of transactions) {
    if (y > 275) {
      doc.addPage();
      y = 18;
    }
    const catName = categoriesMap.get(tx.category_id)?.category_name || '-';
    const walName = walletsMap.get(tx.wallet_id)?.wallet_name || '-';
    const prefix = tx.transaction_type === 'income' ? '+' : tx.transaction_type === 'expense' ? '-' : '';
    doc.text(formatDateID(tx.transaction_date), 16, y);
    doc.text(String(tx.description || '-').slice(0, 32), 42, y);
    doc.text(String(catName).slice(0, 18), 108, y);
    doc.text(String(walName).slice(0, 16), 142, y);
    doc.text(`${prefix}${formatRp(tx.amount)}`, 193, y, { align: 'right' });
    doc.setDrawColor(226, 232, 240);
    doc.line(14, y + 1.8, 196, y + 1.8);
    y += 6.5;
  }

  const fileSafePeriod = periodLabel.replace(/[^a-zA-Z0-9_-]+/g, '_');
  doc.save(`FINTRACK_Laporan_${fileSafePeriod}.pdf`);
}

export function exportReportExcel({ user, periodLabel, incomeTotal, expenseTotal, netTotal, transactions, wallets, categoriesMap, walletsMap }) {
  const XLSX = window.XLSX;
  if (!XLSX) {
    throw new Error('Library SheetJS (XLSX) belum termuat.');
  }

  const wb = XLSX.utils.book_new();

  const summaryRows = [
    ['FINTRACK — Laporan Keuangan Pribadi'],
    ['Pengguna', user?.name || '-'],
    ['Username', user?.username || user?.email || '-'],
    ['Periode', periodLabel],
    ['Tanggal Ekspor', new Date().toISOString().slice(0, 10)],
    [],
    ['Metrik', 'Nilai (IDR)'],
    ['Total Pemasukan', incomeTotal],
    ['Total Pengeluaran', expenseTotal],
    ['Selisih Bersih', netTotal]
  ];
  const wsSummary = XLSX.utils.aoa_to_sheet(summaryRows);
  XLSX.utils.book_append_sheet(wb, wsSummary, 'Ringkasan');

  const txRows = transactions.map((tx) => ({
    ID: tx.transaction_id,
    Tanggal: tx.transaction_date,
    Jenis: tx.transaction_type,
    Kategori: categoriesMap.get(tx.category_id)?.category_name || '-',
    Dompet: walletsMap.get(tx.wallet_id)?.wallet_name || '-',
    Nominal: Number(tx.amount || 0),
    Keterangan: tx.description || ''
  }));
  const wsTx = XLSX.utils.json_to_sheet(txRows.length ? txRows : [{ Info: 'Tidak ada transaksi pada periode ini' }]);
  XLSX.utils.book_append_sheet(wb, wsTx, 'Transaksi');

  const walletRows = wallets.map((w) => ({
    Nama_Dompet: w.wallet_name,
    Tipe: w.wallet_type,
    Saldo_Awal: Number(w.initial_balance || 0),
    Saldo_Terkini: Number(w.current_balance || 0),
    Status: w.is_active ? 'Aktif' : 'Diarsipkan'
  }));
  const wsWal = XLSX.utils.json_to_sheet(walletRows);
  XLSX.utils.book_append_sheet(wb, wsWal, 'Dompet');

  const fileSafePeriod = periodLabel.replace(/[^a-zA-Z0-9_-]+/g, '_');
  XLSX.writeFile(wb, `FINTRACK_Laporan_${fileSafePeriod}.xlsx`);
}
