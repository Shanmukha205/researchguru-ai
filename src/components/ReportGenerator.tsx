import { Button } from '@/components/ui/button';
import { Download, FileSpreadsheet } from 'lucide-react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import html2canvas from 'html2canvas';
import { toast } from 'sonner';

interface ReportData {
  projectName: string;
  companyName?: string;
  agentResults: any[];
  insights?: any;
}

export const ReportGenerator = ({ data }: { data: ReportData }) => {
  const generatePDF = async () => {
    try {
      const doc = new jsPDF();
      let yPos = 20;

      // Title
      doc.setFontSize(20);
      doc.text('Research Report', 105, yPos, { align: 'center' });
      yPos += 15;

      // Project info
      doc.setFontSize(12);
      doc.text(`Project: ${data.projectName}`, 20, yPos);
      yPos += 8;
      if (data.companyName) {
        doc.text(`Company: ${data.companyName}`, 20, yPos);
        yPos += 8;
      }
      doc.text(`Generated: ${new Date().toLocaleDateString()}`, 20, yPos);
      yPos += 15;

      // Agent Results Summary
      doc.setFontSize(16);
      doc.text('Agent Results Summary', 20, yPos);
      yPos += 10;

      const tableData = data.agentResults.map(result => [
        result.agent_type,
        result.status,
        result.created_at ? new Date(result.created_at).toLocaleDateString() : 'N/A'
      ]);

      autoTable(doc, {
        startY: yPos,
        head: [['Agent Type', 'Status', 'Date']],
        body: tableData,
        theme: 'grid',
        styles: { fontSize: 10 },
        headStyles: { fillColor: [59, 130, 246] }
      });

      yPos = (doc as any).lastAutoTable.finalY + 15;

      // AI Insights if available
      if (data.insights) {
        if (yPos > 250) {
          doc.addPage();
          yPos = 20;
        }

        doc.setFontSize(16);
        doc.text('Key Findings', 20, yPos);
        yPos += 10;

        doc.setFontSize(10);
        data.insights.keyFindings?.forEach((finding: string, idx: number) => {
          if (yPos > 280) {
            doc.addPage();
            yPos = 20;
          }
          const lines = doc.splitTextToSize(`${idx + 1}. ${finding}`, 170);
          doc.text(lines, 20, yPos);
          yPos += lines.length * 7;
        });

        // Sentiment Analysis
        if (data.insights.sentimentAnalysis) {
          yPos += 10;
          if (yPos > 250) {
            doc.addPage();
            yPos = 20;
          }

          doc.setFontSize(16);
          doc.text('Sentiment Analysis', 20, yPos);
          yPos += 10;

          doc.setFontSize(10);
          const sentiment = data.insights.sentimentAnalysis;
          doc.text(`Positive: ${sentiment.positive}%`, 30, yPos);
          doc.setFillColor(34, 197, 94);
          doc.rect(100, yPos - 5, sentiment.positive, 5, 'F');
          yPos += 10;

          doc.text(`Neutral: ${sentiment.neutral}%`, 30, yPos);
          doc.setFillColor(156, 163, 175);
          doc.rect(100, yPos - 5, sentiment.neutral, 5, 'F');
          yPos += 10;

          doc.text(`Negative: ${sentiment.negative}%`, 30, yPos);
          doc.setFillColor(239, 68, 68);
          doc.rect(100, yPos - 5, sentiment.negative, 5, 'F');
          yPos += 10;
        }

        // Recommendations
        if (data.insights.recommendations?.length > 0) {
          yPos += 10;
          if (yPos > 250) {
            doc.addPage();
            yPos = 20;
          }

          doc.setFontSize(16);
          doc.text('Recommendations', 20, yPos);
          yPos += 10;

          doc.setFontSize(10);
          data.insights.recommendations.forEach((rec: string, idx: number) => {
            if (yPos > 280) {
              doc.addPage();
              yPos = 20;
            }
            const lines = doc.splitTextToSize(`${idx + 1}. ${rec}`, 170);
            doc.text(lines, 20, yPos);
            yPos += lines.length * 7;
          });
        }
      }

      doc.save(`${data.projectName.replace(/\s+/g, '_')}_report.pdf`);
      toast.success('PDF report generated successfully');
    } catch (error) {
      console.error('Error generating PDF:', error);
      toast.error('Failed to generate PDF report');
    }
  };

  const generateExcel = () => {
    try {
      const wb = XLSX.utils.book_new();

      // Agent Results Sheet
      const resultsData = data.agentResults.map(result => ({
        'Agent Type': result.agent_type,
        'Status': result.status,
        'Created At': result.created_at ? new Date(result.created_at).toLocaleString() : 'N/A',
        'Error': result.error_message || 'None'
      }));

      const ws1 = XLSX.utils.json_to_sheet(resultsData);
      XLSX.utils.book_append_sheet(wb, ws1, 'Agent Results');

      // Insights Sheet
      if (data.insights) {
        const insightsData = [
          { Category: 'Key Findings', ...Object.fromEntries(data.insights.keyFindings?.map((f: string, i: number) => [`Finding ${i + 1}`, f]) || []) },
          { Category: 'Sentiment', Positive: data.insights.sentimentAnalysis?.positive, Neutral: data.insights.sentimentAnalysis?.neutral, Negative: data.insights.sentimentAnalysis?.negative },
          { Category: 'Trends', ...Object.fromEntries(data.insights.trends?.map((t: string, i: number) => [`Trend ${i + 1}`, t]) || []) },
          { Category: 'Recommendations', ...Object.fromEntries(data.insights.recommendations?.map((r: string, i: number) => [`Rec ${i + 1}`, r]) || []) }
        ];

        const ws2 = XLSX.utils.json_to_sheet(insightsData);
        XLSX.utils.book_append_sheet(wb, ws2, 'Insights');
      }

      XLSX.writeFile(wb, `${data.projectName.replace(/\s+/g, '_')}_report.xlsx`);
      toast.success('Excel report generated successfully');
    } catch (error) {
      console.error('Error generating Excel:', error);
      toast.error('Failed to generate Excel report');
    }
  };

  return (
    <div className="flex gap-2">
      <Button onClick={generatePDF} variant="outline" size="sm">
        <Download className="h-4 w-4 mr-2" />
        Export PDF
      </Button>
      <Button onClick={generateExcel} variant="outline" size="sm">
        <FileSpreadsheet className="h-4 w-4 mr-2" />
        Export Excel
      </Button>
    </div>
  );
};
