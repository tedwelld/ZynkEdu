import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { StudentStatementResponse } from '../../../core/api/api.models';

export function buildStudentStatementPdf(
    statement: StudentStatementResponse,
    schoolName: string,
    generatedAt: Date | string,
    fileName: string
): jsPDF {
    const doc = new jsPDF({ orientation: 'l', unit: 'pt', format: 'a4' });
    const margin = 40;
    const pageWidth = doc.internal.pageSize.getWidth();

    // Header
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(20);
    doc.setTextColor(17, 24, 39);
    doc.text('Student financial statement', margin, 46);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(75, 85, 99);
    doc.text(`Student: ${statement.studentName}`, margin, 64);
    doc.text(`Term: ${statement.statementTerm ?? 'All time'}`, margin, 78);
    doc.text(`Currency: ${statement.currency}`, margin, 92);
    doc.text(`Opening balance: ${statement.openingBalance.toLocaleString('en-US', { style: 'currency', currency: statement.currency })}`, margin, 106);
    doc.text(`Closing balance: ${statement.closingBalance.toLocaleString('en-US', { style: 'currency', currency: statement.currency })}`, margin, 120);

    // Transactions table
    autoTable(doc, {
        startY: 140,
        head: [['ID', 'Date', 'Type', 'Status', 'Reference', 'Debit', 'Credit', 'Balance']],
        body: statement.transactions.map((line) => [
            line.transactionId.toString(),
            line.transactionDate.toLocaleDateString('en-GB'),
            line.type,
            line.status,
            line.reference ?? '-',
            line.debit.toLocaleString('en-US', { style: 'currency', currency: statement.currency }),
            line.credit.toLocaleString('en-US', { style: 'currency', currency: statement.currency }),
            line.runningBalance.toLocaleString('en-US', { style: 'currency', currency: statement.currency })
        ]),
        theme: 'grid',
        styles: { fontSize: 8, cellPadding: 4 },
        headStyles: { fillColor: [37, 99, 235] },
        columnStyles: {
            5: { halign: 'right' },
            6: { halign: 'right' },
            7: { halign: 'right', fontStyle: 'bold' }
        },
        margin: { left: margin, right: margin }
    });

    doc.save(fileName);
    return doc;
}

