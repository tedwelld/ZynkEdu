import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { StudentStatementResponse } from '../../../core/api/api.models';
import { ReportSchoolInfo, drawLetterhead } from './report-pdf';

export function buildStudentStatementPdf(
    statement: StudentStatementResponse,
    schoolInfo: ReportSchoolInfo,
    generatedAt: Date | string,
    fileName: string
): jsPDF {
    const doc = new jsPDF({ orientation: 'l', unit: 'pt', format: 'a4' });
    const margin = 40;
    const pageWidth = doc.internal.pageSize.getWidth();

    const startY = drawLetterhead(doc, schoolInfo, 'Student financial statement', margin, pageWidth, [
        `Student: ${statement.studentName}`,
        `Term: ${statement.statementTerm ?? 'All time'}`,
        `Currency: ${statement.currency}`,
        `Opening balance: ${statement.openingBalance.toLocaleString('en-US', { style: 'currency', currency: statement.currency })}`,
        `Closing balance: ${statement.closingBalance.toLocaleString('en-US', { style: 'currency', currency: statement.currency })}`
    ]);

    autoTable(doc, {
        startY,
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
