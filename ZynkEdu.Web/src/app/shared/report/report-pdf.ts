import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { ParentPreviewReportResponse, ResultResponse } from '../../core/api/api.models';

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
