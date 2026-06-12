import { Injectable } from '@angular/core';
import type jsPDF from 'jspdf';
import type { ReportSchoolInfo } from './report-pdf';
import type {
    StudentStatementResponse,
    InvoiceResponse,
    CollectionReportResponse,
    AgingReportResponse,
    DefaulterReportResponse,
    DailyCashReportResponse,
    FinancialStatementResponse,
    FeeStructureResponse,
    RevenueByClassReportResponse
} from '../../core/api/api.models';
import type { InvoicePdfData } from './report-pdf';

// Lazy-loaded so jsPDF is not bundled into the initial chunk.
// Import only when a PDF action is triggered.
async function loadJsPDF() {
    const [{ default: JsPDF }, { default: autoTable }] = await Promise.all([
        import('jspdf'),
        import('jspdf-autotable')
    ]);
    return { JsPDF, autoTable };
}

async function loadReportHelpers() {
    return import('./report-pdf');
}

/**
 * Injectable service that centralises PDF generation and lazy-loads jsPDF so
 * it is not included in the initial application bundle.
 *
 * Prefer this service over importing jsPDF directly in page components.
 */
@Injectable({ providedIn: 'root' })
export class PdfGeneratorService {
    /** Returns a fresh jsPDF document instance. */
    async createDoc(opts: { orientation?: 'p' | 'l'; format?: string } = {}): Promise<jsPDF> {
        const { JsPDF } = await loadJsPDF();
        return new JsPDF({
            orientation: opts.orientation ?? 'l',
            unit: 'pt',
            format: opts.format ?? 'a4'
        });
    }

    async buildStudentStatementPdf(
        statement: StudentStatementResponse,
        schoolInfo: ReportSchoolInfo,
        generatedAt: Date | string,
        fileName: string
    ): Promise<jsPDF> {
        const helpers = await loadReportHelpers();
        const { buildStudentStatementPdf } = await import('./student-statement-pdf');
        return buildStudentStatementPdf(statement, schoolInfo, generatedAt, fileName);
    }

    async buildInvoicePdf(invoice: InvoicePdfData, schoolInfo: ReportSchoolInfo): Promise<Blob> {
        const { buildInvoicePdf } = await loadReportHelpers();
        return buildInvoicePdf(invoice, schoolInfo);
    }

    async buildAccountingReportsPdf(
        schoolInfo: ReportSchoolInfo,
        generatedAt: Date | string,
        periodLabel: string,
        collection: CollectionReportResponse | null,
        aging: AgingReportResponse | null,
        revenue: RevenueByClassReportResponse | null,
        defaulters: DefaulterReportResponse | null,
        dailyCash: DailyCashReportResponse | null,
        fileName: string
    ): Promise<jsPDF> {
        const { buildAccountingReportsPdf } = await loadReportHelpers();
        return buildAccountingReportsPdf(schoolInfo, generatedAt, periodLabel, collection, aging, revenue, defaulters, dailyCash, fileName);
    }

    async buildFinancialStatementPdf(
        schoolInfo: ReportSchoolInfo,
        generatedAt: Date | string,
        statement: FinancialStatementResponse,
        fileName: string
    ): Promise<jsPDF> {
        const { buildFinancialStatementPdf } = await loadReportHelpers();
        return buildFinancialStatementPdf(schoolInfo, generatedAt, statement, fileName);
    }

    async buildCollectionReportPdf(
        schoolInfo: ReportSchoolInfo,
        generatedAt: Date | string,
        periodLabel: string,
        collection: CollectionReportResponse,
        fileName: string
    ): Promise<jsPDF> {
        const { buildCollectionReportPdf } = await loadReportHelpers();
        return buildCollectionReportPdf(schoolInfo, generatedAt, periodLabel, collection, fileName);
    }

    async buildAgingBucketsPdf(
        schoolInfo: ReportSchoolInfo,
        generatedAt: Date | string,
        periodLabel: string,
        aging: AgingReportResponse,
        fileName: string
    ): Promise<jsPDF> {
        const { buildAgingBucketsPdf } = await loadReportHelpers();
        return buildAgingBucketsPdf(schoolInfo, generatedAt, periodLabel, aging, fileName);
    }

    async buildDefaultersPdf(
        schoolInfo: ReportSchoolInfo,
        generatedAt: Date | string,
        periodLabel: string,
        defaulters: DefaulterReportResponse,
        fileName: string
    ): Promise<jsPDF> {
        const { buildDefaultersPdf } = await loadReportHelpers();
        return buildDefaultersPdf(schoolInfo, generatedAt, periodLabel, defaulters, fileName);
    }

    async buildRevenueByClassPdf(
        schoolInfo: ReportSchoolInfo,
        generatedAt: Date | string,
        periodLabel: string,
        revenue: RevenueByClassReportResponse,
        fileName: string
    ): Promise<jsPDF> {
        const { buildRevenueByClassPdf } = await loadReportHelpers();
        return buildRevenueByClassPdf(schoolInfo, generatedAt, periodLabel, revenue, fileName);
    }

    async buildDailyCashPdf(
        schoolInfo: ReportSchoolInfo,
        generatedAt: Date | string,
        periodLabel: string,
        dailyCash: DailyCashReportResponse,
        fileName: string
    ): Promise<jsPDF> {
        const { buildDailyCashPdf } = await loadReportHelpers();
        return buildDailyCashPdf(schoolInfo, generatedAt, periodLabel, dailyCash, fileName);
    }

    async buildFeeStructuresPdf(
        schoolInfo: ReportSchoolInfo,
        generatedAt: Date | string,
        feeStructures: FeeStructureResponse[],
        fileName?: string,
        save = true
    ): Promise<jsPDF> {
        const { buildFeeStructuresPdf } = await loadReportHelpers();
        return buildFeeStructuresPdf(schoolInfo, generatedAt, feeStructures, fileName, save);
    }

    setLogoDataUrl(dataUrl: string): void {
        loadReportHelpers().then(({ setLogoDataUrl }) => setLogoDataUrl(dataUrl));
    }
}
