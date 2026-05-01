import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
    AgingReportResponse,
    CollectionReportResponse,
    DefaulterReportResponse,
    DailyCashReportResponse,
    FeeStructureResponse,
    LibraryBorrowerSummaryResponse,
    LibraryLoanResponse,
    ParentPreviewReportResponse,
    RevenueByClassReportResponse,
    ResultResponse,
    StudentStatementResponse
} from '../../core/api/api.models';

export interface AdminResultsClassGroup {
    className: string;
    rows: ResultResponse[];
}

export interface AdminResultsSchoolGroup {
    schoolName: string;
    classes: AdminResultsClassGroup[];
}

export interface TeacherClassResultRow {
    studentName: string;
    studentNumber: string;
    testScore: number | null;
    assignmentScore: number | null;
    examScore: number | null;
    finalScore: number | null;
    grade: string;
}

export function buildAccountingReportsPdf(
    schoolName: string,
    generatedAt: Date | string,
    periodLabel: string,
    collection: CollectionReportResponse | null,
    aging: AgingReportResponse | null,
    revenue: RevenueByClassReportResponse | null,
    defaulters: DefaulterReportResponse | null,
    dailyCash: DailyCashReportResponse | null,
    fileName: string
): jsPDF {
    const doc = new jsPDF({ orientation: 'l', unit: 'pt', format: 'a4' });
    const margin = 40;
    const pageWidth = doc.internal.pageSize.getWidth();

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(20);
    doc.setTextColor(17, 24, 39);
    doc.text('Accounting financial statement', margin, 46);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(75, 85, 99);
    doc.text(`School: ${schoolName}`, margin, 64);
    doc.text(`Generated: ${formatDate(generatedAt)}`, margin, 78);
    doc.text(`Period: ${periodLabel}`, margin, 92);

    const totalBilled = collection?.totalBilled ?? 0;
    const totalCollected = collection?.totalCollected ?? 0;
    const outstanding = collection?.outstanding ?? 0;
    const defaulterCount = defaulters?.students.length ?? 0;

    drawMetricCard(doc, margin, 110, 160, 60, 'Billed', totalBilled.toFixed(2), 'Invoice total');
    drawMetricCard(doc, margin + 170, 110, 160, 60, 'Collected', totalCollected.toFixed(2), 'Payments received');
    drawMetricCard(doc, margin + 340, 110, 160, 60, 'Outstanding', outstanding.toFixed(2), 'Current balances');
    drawMetricCard(doc, margin + 510, 110, 160, 60, 'Defaulters', defaulterCount.toString(), 'Students behind');

    let currentY = 198;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(17, 24, 39);
    doc.text('Aging buckets', margin, currentY);
    autoTable(doc, {
        startY: currentY + 10,
        head: [['Bucket', 'Amount', 'Invoice Count']],
        body: (aging?.buckets ?? []).map((bucket) => [bucket.bucket, bucket.amount.toFixed(2), bucket.invoiceCount.toString()]),
        theme: 'striped',
        styles: { fontSize: 8, cellPadding: 4 },
        headStyles: { fillColor: [37, 99, 235] },
        margin: { left: margin, right: margin }
    });

    currentY = (doc as any).lastAutoTable?.finalY ?? currentY + 80;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.text('Defaulters', margin, currentY + 22);
    autoTable(doc, {
        startY: currentY + 32,
        head: [['Student', 'Class', 'Grade', 'Balance', 'Last payment']],
        body: (defaulters?.students ?? []).map((student) => [
            student.studentName,
            student.className,
            student.gradeLevel,
            student.balance.toFixed(2),
            student.lastPaymentAt ? formatDate(student.lastPaymentAt) : '-'
        ]),
        theme: 'grid',
        styles: { fontSize: 8, cellPadding: 4 },
        headStyles: { fillColor: [30, 64, 175] },
        margin: { left: margin, right: margin }
    });

    currentY = (doc as any).lastAutoTable?.finalY ?? currentY + 80;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.text('Revenue by class', margin, currentY + 22);
    autoTable(doc, {
        startY: currentY + 32,
        head: [['Class', 'Grade', 'Billed', 'Collected', 'Outstanding']],
        body: (revenue?.classes ?? []).map((row) => [
            row.className,
            row.gradeLevel,
            row.billed.toFixed(2),
            row.collected.toFixed(2),
            row.outstanding.toFixed(2)
        ]),
        theme: 'striped',
        styles: { fontSize: 8, cellPadding: 4 },
        headStyles: { fillColor: [37, 99, 235] },
        margin: { left: margin, right: margin }
    });

    currentY = (doc as any).lastAutoTable?.finalY ?? currentY + 80;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.text('Daily cash', margin, currentY + 22);
    autoTable(doc, {
        startY: currentY + 32,
        head: [['Method', 'Amount', 'Payments']],
        body: (dailyCash?.methods ?? []).map((row) => [row.method, row.amount.toFixed(2), row.paymentCount.toString()]),
        theme: 'striped',
        styles: { fontSize: 8, cellPadding: 4 },
        headStyles: { fillColor: [16, 185, 129] },
        margin: { left: margin, right: margin }
    });

    doc.save(fileName);
    return doc;
}

export function buildCollectionReportPdf(
    schoolName: string,
    generatedAt: Date | string,
    periodLabel: string,
    collection: CollectionReportResponse,
    fileName: string
): jsPDF {
    const doc = new jsPDF({ orientation: 'l', unit: 'pt', format: 'a4' });
    const margin = 40;

    writeReportHeading(doc, 'Collection summary', schoolName, generatedAt, periodLabel, margin);
    drawMetricCard(doc, margin, 110, 180, 60, 'Billed', collection.totalBilled.toFixed(2), 'Invoice total');
    drawMetricCard(doc, margin + 190, 110, 180, 60, 'Collected', collection.totalCollected.toFixed(2), 'Payments received');
    drawMetricCard(doc, margin + 380, 110, 180, 60, 'Outstanding', collection.outstanding.toFixed(2), 'Current balances');
    drawMetricCard(doc, margin + 570, 110, 130, 60, 'Invoices', collection.invoiceCount.toString(), 'Count');

    autoTable(doc, {
        startY: 198,
        head: [['Metric', 'Value']],
        body: [
            ['Billed', collection.totalBilled.toFixed(2)],
            ['Collected', collection.totalCollected.toFixed(2)],
            ['Outstanding', collection.outstanding.toFixed(2)],
            ['Invoice count', collection.invoiceCount.toString()],
            ['Payment count', collection.paymentCount.toString()]
        ],
        theme: 'grid',
        styles: { fontSize: 9, cellPadding: 4 },
        headStyles: { fillColor: [37, 99, 235] },
        margin: { left: margin, right: margin }
    });

    doc.save(fileName);
    return doc;
}

export function buildAgingBucketsPdf(
    schoolName: string,
    generatedAt: Date | string,
    periodLabel: string,
    aging: AgingReportResponse,
    fileName: string
): jsPDF {
    const doc = new jsPDF({ orientation: 'l', unit: 'pt', format: 'a4' });
    const margin = 40;

    writeReportHeading(doc, 'Aging buckets', schoolName, generatedAt, periodLabel, margin);
    autoTable(doc, {
        startY: 110,
        head: [['Bucket', 'Amount', 'Invoice Count']],
        body: aging.buckets.map((bucket) => [bucket.bucket, bucket.amount.toFixed(2), bucket.invoiceCount.toString()]),
        theme: 'striped',
        styles: { fontSize: 9, cellPadding: 4 },
        headStyles: { fillColor: [37, 99, 235] },
        margin: { left: margin, right: margin }
    });

    doc.save(fileName);
    return doc;
}

export function buildDefaultersPdf(
    schoolName: string,
    generatedAt: Date | string,
    periodLabel: string,
    defaulters: DefaulterReportResponse,
    fileName: string
): jsPDF {
    const doc = new jsPDF({ orientation: 'l', unit: 'pt', format: 'a4' });
    const margin = 40;

    writeReportHeading(doc, 'Defaulters list', schoolName, generatedAt, periodLabel, margin);
    autoTable(doc, {
        startY: 110,
        head: [['Student', 'Class', 'Grade', 'Balance', 'Last payment', 'Last invoice']],
        body: defaulters.students.map((student) => [
            student.studentName,
            student.className,
            student.gradeLevel,
            student.balance.toFixed(2),
            student.lastPaymentAt ? formatDate(student.lastPaymentAt) : '-',
            student.lastInvoiceAt ? formatDate(student.lastInvoiceAt) : '-'
        ]),
        theme: 'grid',
        styles: { fontSize: 8, cellPadding: 4 },
        headStyles: { fillColor: [30, 64, 175] },
        margin: { left: margin, right: margin }
    });

    doc.save(fileName);
    return doc;
}

export function buildRevenueByClassPdf(
    schoolName: string,
    generatedAt: Date | string,
    periodLabel: string,
    revenue: RevenueByClassReportResponse,
    fileName: string
): jsPDF {
    const doc = new jsPDF({ orientation: 'l', unit: 'pt', format: 'a4' });
    const margin = 40;

    writeReportHeading(doc, 'Revenue by class', schoolName, generatedAt, periodLabel, margin);
    autoTable(doc, {
        startY: 110,
        head: [['Class', 'Grade', 'Billed', 'Collected', 'Outstanding']],
        body: revenue.classes.map((row) => [row.className, row.gradeLevel, row.billed.toFixed(2), row.collected.toFixed(2), row.outstanding.toFixed(2)]),
        theme: 'striped',
        styles: { fontSize: 8, cellPadding: 4 },
        headStyles: { fillColor: [37, 99, 235] },
        margin: { left: margin, right: margin }
    });

    doc.save(fileName);
    return doc;
}

export function buildDailyCashPdf(
    schoolName: string,
    generatedAt: Date | string,
    periodLabel: string,
    dailyCash: DailyCashReportResponse,
    fileName: string
): jsPDF {
    const doc = new jsPDF({ orientation: 'l', unit: 'pt', format: 'a4' });
    const margin = 40;

    writeReportHeading(doc, 'Daily cash report', schoolName, generatedAt, periodLabel, margin);
    autoTable(doc, {
        startY: 110,
        head: [['Method', 'Amount', 'Payments']],
        body: dailyCash.methods.map((row) => [row.method, row.amount.toFixed(2), row.paymentCount.toString()]),
        theme: 'striped',
        styles: { fontSize: 9, cellPadding: 4 },
        headStyles: { fillColor: [16, 185, 129] },
        margin: { left: margin, right: margin }
    });

    doc.save(fileName);
    return doc;
}

export function buildLibraryOverdueLoansPdf(
    schoolName: string,
    generatedAt: Date | string,
    loans: LibraryLoanResponse[],
    fileName: string
): jsPDF {
    const doc = new jsPDF({ orientation: 'l', unit: 'pt', format: 'a4' });
    const margin = 40;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(20);
    doc.setTextColor(17, 24, 39);
    doc.text('Library overdue loans', margin, 44);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(75, 85, 99);
    doc.text(`School: ${schoolName}`, margin, 62);
    doc.text(`Generated: ${formatDate(generatedAt)}`, margin, 76);
    doc.text(`Records: ${loans.length}`, margin, 90);

    autoTable(doc, {
        startY: 108,
        head: [['Book', 'Borrower', 'Due date', 'Status', 'Copy', 'Author']],
        body: loans.map((loan) => [
            loan.bookTitle,
            loan.borrowerDisplayName,
            formatDate(loan.dueAt),
            loan.isOverdue ? 'Overdue' : 'Open',
            loan.copyAccessionNumber || `Copy ${loan.libraryBookCopyId}`,
            loan.bookAuthor || '-'
        ]),
        theme: 'striped',
        styles: { fontSize: 8, cellPadding: 4 },
        headStyles: { fillColor: [220, 38, 38] },
        margin: { left: margin, right: margin }
    });

    doc.save(fileName);
    return doc;
}

export function buildLibraryBorrowersPdf(
    schoolName: string,
    generatedAt: Date | string,
    borrowers: LibraryBorrowerSummaryResponse[],
    fileName: string
): jsPDF {
    const doc = new jsPDF({ orientation: 'l', unit: 'pt', format: 'a4' });
    const margin = 40;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(20);
    doc.setTextColor(17, 24, 39);
    doc.text('Library borrowers', margin, 44);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(75, 85, 99);
    doc.text(`School: ${schoolName}`, margin, 62);
    doc.text(`Generated: ${formatDate(generatedAt)}`, margin, 76);
    doc.text(`Records: ${borrowers.length}`, margin, 90);

    autoTable(doc, {
        startY: 108,
        head: [['Name', 'Reference', 'Type', 'Open loans', 'Overdue']],
        body: borrowers.map((borrower) => [
            borrower.displayName,
            borrower.reference || '-',
            borrower.borrowerType,
            borrower.activeLoanCount.toString(),
            borrower.overdueLoanCount.toString()
        ]),
        theme: 'grid',
        styles: { fontSize: 8, cellPadding: 4 },
        headStyles: { fillColor: [22, 163, 74] },
        margin: { left: margin, right: margin }
    });

    doc.save(fileName);
    return doc;
}

export function buildFeeStructuresPdf(
    schoolName: string,
    generatedAt: Date | string,
    feeStructures: FeeStructureResponse[],
    fileName: string
): jsPDF {
    const doc = new jsPDF({ orientation: 'l', unit: 'pt', format: 'a4' });
    const margin = 40;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(20);
    doc.setTextColor(17, 24, 39);
    doc.text('Fee structures', margin, 44);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(75, 85, 99);
    doc.text(`School: ${schoolName}`, margin, 62);
    doc.text(`Generated: ${formatDate(generatedAt)}`, margin, 76);
    doc.text(`Records: ${feeStructures.length}`, margin, 90);

    autoTable(doc, {
        startY: 108,
        head: [['Grade level', 'Term', 'Amount', 'Description', 'Updated']],
        body: feeStructures.map((fee) => [
            fee.gradeLevel,
            fee.term,
            fee.amount.toFixed(2),
            fee.description ?? '-',
            formatDate(fee.updatedAt)
        ]),
        theme: 'striped',
        styles: { fontSize: 8, cellPadding: 4 },
        headStyles: { fillColor: [37, 99, 235] },
        margin: { left: margin, right: margin }
    });

    doc.save(fileName);
    return doc;
}

export function buildStudentStatementPdf(statement: StudentStatementResponse, fileName: string): jsPDF {
    const doc = new jsPDF({ orientation: 'l', unit: 'pt', format: 'a4' });
    const margin = 40;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(20);
    doc.setTextColor(17, 24, 39);
    doc.text('Student financial statement', margin, 44);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(75, 85, 99);
    doc.text(`Student: ${statement.studentName}`, margin, 62);
    doc.text(`School ID: ${statement.schoolId}`, margin, 76);
    doc.text(`Opening balance: ${statement.openingBalance.toFixed(2)}`, margin, 90);
    doc.text(`Closing balance: ${statement.closingBalance.toFixed(2)}`, margin, 104);

    autoTable(doc, {
        startY: 122,
        head: [['Date', 'Type', 'Status', 'Reference', 'Debit', 'Credit', 'Running']],
        body: statement.transactions.map((line) => [
            formatDate(line.transactionDate),
            line.type,
            line.status,
            line.reference ?? '-',
            line.debit.toFixed(2),
            line.credit.toFixed(2),
            line.runningBalance.toFixed(2)
        ]),
        theme: 'grid',
        styles: { fontSize: 8, cellPadding: 4 },
        headStyles: { fillColor: [37, 99, 235] },
        margin: { left: margin, right: margin }
    });

    doc.save(fileName);
    return doc;
}

export function buildAdminResultsReportPdf(
    title: string,
    description: string,
    scope: string,
    filters: string,
    generatedAt: Date | string,
    groups: AdminResultsSchoolGroup[],
    fileName: string
): jsPDF {
    const doc = new jsPDF({ orientation: 'l', unit: 'pt', format: 'a4' });
    const margin = 40;
    const pageWidth = doc.internal.pageSize.getWidth();

    doc.setTextColor(17, 24, 39);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(20);
    doc.text(title, margin, 46);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(75, 85, 99);
    doc.text(description, margin, 64, { maxWidth: pageWidth - margin * 2 });
    doc.text(`Scope: ${scope}`, margin, 82);
    doc.text(`Filters: ${filters}`, margin, 96);
    doc.text(`Generated: ${formatDate(generatedAt)}`, margin, 110);

    let currentY = 126;
    for (const schoolGroup of groups) {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(13);
        doc.setTextColor(17, 24, 39);
        doc.text(schoolGroup.schoolName, margin, currentY);
        currentY += 14;

        for (const classGroup of schoolGroup.classes) {
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(11);
            doc.setTextColor(37, 99, 235);
            doc.text(`${classGroup.className} (${classGroup.rows.length} row(s))`, margin, currentY);
            currentY += 10;

            autoTable(doc, {
                startY: currentY,
                head: [['Year', 'Student', 'Subject', 'Teacher', 'Score', 'Grade', 'Term', 'Date']],
                body: classGroup.rows.map((result) => [
                    result.resultYear.toString(),
                    `${result.studentName} (${result.studentNumber})`,
                    result.subjectName,
                    result.teacherName,
                    `${result.score.toFixed(1)}%`,
                    result.grade,
                    result.term,
                    formatDate(result.createdAt)
                ]),
                theme: 'striped',
                styles: {
                    fontSize: 8,
                    cellPadding: 4
                },
                headStyles: {
                    fillColor: [37, 99, 235]
                },
                margin: {
                    left: margin,
                    right: margin
                }
            });

            currentY = (doc as any).lastAutoTable?.finalY ? (doc as any).lastAutoTable.finalY + 18 : currentY + 110;
            if (currentY > doc.internal.pageSize.getHeight() - 120) {
                doc.addPage();
                currentY = 40;
            }
        }
    }

    doc.save(fileName);
    return doc;
}

export function buildParentPreviewReportPdf(report: ParentPreviewReportResponse): jsPDF {
    const doc = new jsPDF({ orientation: 'l', unit: 'pt', format: 'a4' });
    const margin = 40;
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const contentWidth = pageWidth - margin * 2;
    const accent: [number, number, number] = [37, 99, 235];
    const accentDark: [number, number, number] = [30, 64, 175];
    const surface: [number, number, number] = [248, 250, 252];
    const text: [number, number, number] = [15, 23, 42];
    const muted: [number, number, number] = [75, 85, 99];
    const border: [number, number, number] = [226, 232, 240];

    doc.setFillColor(...accent);
    doc.rect(0, 0, pageWidth, 118, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(20);
    doc.text('Guardian result slip', margin, 38);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    doc.text('A structured summary for the selected learner and level.', margin, 56);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text(report.schoolName, pageWidth - margin, 38, { align: 'right' });
    doc.setFont('helvetica', 'normal');
    doc.text(`Generated ${formatDate(new Date())}`, pageWidth - margin, 56, { align: 'right' });
    doc.text(`Class ${report.class} | ${report.level}`, pageWidth - margin, 72, { align: 'right' });

    drawSummaryCard(doc, margin, 138, 250, 58, 'Student name', report.studentName, 'Learner', accentDark, surface, border, text, muted);
    drawSummaryCard(doc, margin + 260, 138, 110, 58, 'Student number', report.studentNumber, 'Reference', accent, surface, border, text, muted);
    drawSummaryCard(doc, margin + 380, 138, 110, 58, 'Class', report.class, report.level, [16, 185, 129], surface, border, text, muted);
    drawSummaryCard(doc, margin + 500, 138, 110, 58, 'Enrollment', report.enrollmentYear.toString(), 'Year', [168, 85, 247], surface, border, text, muted);
    drawSummaryCard(doc, margin + 620, 138, 110, 58, 'Average', `${report.overallAverageMark.toFixed(1)}%`, `${report.subjects.length} subjects`, [245, 158, 11], surface, border, text, muted);

    doc.setTextColor(...text);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.text('Subject results', margin, 224);
    doc.setDrawColor(...border);
    doc.setLineWidth(1);
    doc.line(margin, 232, pageWidth - margin, 232);

    autoTable(doc, {
        startY: 244,
        head: [['Subject', 'Score', 'Grade', 'Term']],
        body: report.subjects.map((subject) => [
            subject.subjectName,
            `${(subject.actualMark ?? subject.averageMark).toFixed(1)}%`,
            subject.grade ?? 'N/A',
            subject.term ?? 'N/A'
        ]),
        theme: 'grid',
        styles: {
            fontSize: 8,
            cellPadding: 6,
            valign: 'middle',
            overflow: 'linebreak',
            textColor: text,
            lineColor: border,
            lineWidth: 0.6
        },
        headStyles: {
            fillColor: accentDark,
            textColor: 255,
            fontStyle: 'bold'
        },
        alternateRowStyles: {
            fillColor: surface
        },
        columnStyles: {
            0: { cellWidth: 425 },
            1: { cellWidth: 75, halign: 'right' },
            2: { cellWidth: 60, halign: 'center' },
            3: { cellWidth: 202 }
        },
        tableWidth: contentWidth,
        rowPageBreak: 'avoid',
        margin: {
            left: margin,
            right: margin,
            top: 80,
            bottom: 64
        },
        didParseCell: (data) => {
            if (data.section === 'body' && data.column.index === 0) {
                data.cell.styles.fontStyle = 'bold';
            }

            if (data.section === 'body' && data.column.index === 3) {
                const term = String(data.cell.raw ?? '');
                if (term.startsWith('A')) {
                    data.cell.styles.fillColor = [220, 252, 231];
                } else if (term.startsWith('B')) {
                    data.cell.styles.fillColor = [254, 249, 195];
                } else if (term.startsWith('C')) {
                    data.cell.styles.fillColor = [255, 237, 213];
                } else if (term.startsWith('D') || term.startsWith('E') || term.startsWith('F')) {
                    data.cell.styles.fillColor = [254, 226, 226];
                }
            }
        },
        didDrawPage: (data) => {
            if (data.pageNumber > 1) {
                doc.setFillColor(...accent);
                doc.rect(0, 0, pageWidth, 34, 'F');
                doc.setTextColor(255, 255, 255);
                doc.setFont('helvetica', 'bold');
                doc.setFontSize(11);
                doc.text(`${report.studentName} - ${report.class}`, margin, 22);
            }

            doc.setTextColor(...muted);
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(9);
            doc.text(`Page ${data.pageNumber}`, pageWidth - margin, pageHeight - 18, { align: 'right' });
        }
    });

    const finalY = (doc as any).lastAutoTable?.finalY ?? 244;
    const footerLines = [
        'This slip includes only the subjects assigned to the student\'s current level.',
        'Please contact the school if any subject or score appears incorrect.'
    ];
    let notesY = finalY + 18;
    if (notesY > pageHeight - 42) {
        doc.addPage();
        notesY = 60;
    }

    doc.setFont('helvetica', 'italic');
    doc.setFontSize(9);
    doc.setTextColor(...muted);
    doc.text(footerLines[0], margin, notesY);
    doc.text(footerLines[1], margin, notesY + 14);

    return doc;
}

export function buildTeacherClassResultsPdf(
    className: string,
    subjectName: string,
    term: string,
    generatedAt: Date | string,
    rows: TeacherClassResultRow[]
): jsPDF {
    const doc = new jsPDF({ orientation: 'p', unit: 'pt', format: 'a4' });
    const margin = 40;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.text(`Class results - ${className}`, margin, 42);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text(`Subject: ${subjectName}`, margin, 60);
    doc.text(`Term: ${term}`, margin, 74);
    doc.text(`Generated: ${formatDate(generatedAt)}`, margin, 88);

    autoTable(doc, {
        startY: 106,
        head: [['Student', 'Number', 'Test', 'Assignment', 'Exam', 'Total', 'Grade']],
        body: rows.map((row) => [
            row.studentName,
            row.studentNumber,
            row.testScore?.toFixed(1) ?? '',
            row.assignmentScore?.toFixed(1) ?? '',
            row.examScore?.toFixed(1) ?? '',
            row.finalScore?.toFixed(1) ?? '',
            row.grade
        ]),
        theme: 'striped',
        styles: { fontSize: 8.5, cellPadding: 5 },
        headStyles: { fillColor: [37, 99, 235] }
    });

    return doc;
}

function formatDate(value: Date | string): string {
    return new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}

function writeReportHeading(doc: jsPDF, title: string, schoolName: string, generatedAt: Date | string, periodLabel: string, margin: number): void {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(20);
    doc.setTextColor(17, 24, 39);
    doc.text(title, margin, 44);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(75, 85, 99);
    doc.text(`School: ${schoolName}`, margin, 62);
    doc.text(`Period: ${periodLabel}`, margin, 76);
    doc.text(`Generated: ${formatDate(generatedAt)}`, margin, 90);
}

function drawMetricCard(doc: jsPDF, x: number, y: number, width: number, height: number, label: string, value: string, secondary: string): void {
    doc.setDrawColor(226, 232, 240);
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(x, y, width, height, 8, 8, 'FD');
    doc.setFillColor(37, 99, 235);
    doc.roundedRect(x, y, width, 7, 8, 8, 'F');

    doc.setTextColor(75, 85, 99);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.text(label.toUpperCase(), x + 10, y + 22);

    doc.setTextColor(17, 24, 39);
    doc.setFontSize(13);
    doc.text(value, x + 10, y + 40);

    doc.setTextColor(75, 85, 99);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.text(secondary, x + 10, y + height - 10);
}

function drawSummaryCard(
    doc: jsPDF,
    x: number,
    y: number,
    width: number,
    height: number,
    label: string,
    value: string,
    secondary: string,
    accent: readonly [number, number, number],
    surface: readonly [number, number, number],
    border: readonly [number, number, number],
    text: readonly [number, number, number],
    muted: readonly [number, number, number]
): void {
    doc.setDrawColor(...border);
    doc.setFillColor(...surface);
    doc.roundedRect(x, y, width, height, 10, 10, 'FD');
    doc.setFillColor(...accent);
    doc.roundedRect(x, y, width, 7, 10, 10, 'F');

    doc.setTextColor(...muted);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.text(label.toUpperCase(), x + 12, y + 22);

    doc.setTextColor(...text);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.text(value, x + 12, y + 40, { maxWidth: width - 24 });

    doc.setTextColor(...muted);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.text(secondary, x + 12, y + height - 10, { maxWidth: width - 24 });
}
