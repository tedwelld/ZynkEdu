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
    const doc = new jsPDF({ orientation: 'p', unit: 'pt', format: 'a4' });
    const margin = 40;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.text('Parent preview report', margin, 42);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text(`Student: ${report.studentName}`, margin, 60);
    doc.text(`Student number: ${report.studentNumber}`, margin, 74);
    doc.text(`School: ${report.schoolName}`, margin, 88);
    doc.text(`Class: ${report.class} | Level: ${report.level}`, margin, 102);
    doc.text(`Enrollment year: ${report.enrollmentYear}`, margin, 116);
    doc.text(`Generated: ${formatDate(new Date())}`, margin, 130);
    doc.text(`Overall average: ${report.overallAverageMark.toFixed(1)}%`, margin, 144);

    autoTable(doc, {
        startY: 162,
        head: [['Subject', 'Average', 'Actual', 'Grade', 'Teacher', 'Comment', 'Term']],
        body: report.subjects.map((subject) => [
            subject.subjectName,
            `${subject.averageMark.toFixed(1)}%`,
            subject.actualMark === null || subject.actualMark === undefined ? 'N/A' : `${subject.actualMark.toFixed(1)}%`,
            subject.grade ?? 'N/A',
            subject.teacherName ?? 'N/A',
            subject.teacherComment ?? 'No comment yet.',
            subject.term ?? 'N/A'
        ]),
        theme: 'striped',
        styles: { fontSize: 8, cellPadding: 5, valign: 'top' },
        headStyles: { fillColor: [37, 99, 235] },
        columnStyles: {
            0: { cellWidth: 92 },
            1: { cellWidth: 48 },
            2: { cellWidth: 48 },
            3: { cellWidth: 40 },
            4: { cellWidth: 70 },
            5: { cellWidth: 150 },
            6: { cellWidth: 48 }
        }
    });

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
