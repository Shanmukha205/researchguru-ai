import { Button } from '@/components/ui/button';
import { Download, FileSpreadsheet } from 'lucide-react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { toast } from 'sonner';

interface ReportData {
  projectName: string;
  companyName?: string;
  agentResults: any[];
  insights?: any;
  perplexityData?: any;
  researchMode?: string;
}

export const ReportGenerator = ({ data }: { data: ReportData }) => {
  const generatePDF = async () => {
    try {
      const doc = new jsPDF();
      let yPos = 20;

      // Header with styling
      doc.setFillColor(59, 130, 246);
      doc.rect(0, 0, 210, 40, 'F');
      
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(24);
      doc.setFont('helvetica', 'bold');
      doc.text('Market Research Report', 105, 20, { align: 'center' });
      
      doc.setFontSize(12);
      doc.setFont('helvetica', 'normal');
      doc.text(data.projectName, 105, 30, { align: 'center' });

      yPos = 50;
      doc.setTextColor(0, 0, 0);

      // Project Info Section
      doc.setFillColor(245, 245, 245);
      doc.rect(15, yPos - 5, 180, 25, 'F');
      
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.text('PROJECT DETAILS', 20, yPos);
      yPos += 8;
      
      doc.setFont('helvetica', 'normal');
      doc.text(`Product/Company: ${data.projectName}`, 20, yPos);
      if (data.companyName) {
        yPos += 6;
        doc.text(`Brand: ${data.companyName}`, 20, yPos);
      }
      yPos += 6;
      doc.text(`Generated: ${new Date().toLocaleString()}`, 20, yPos);
      if (data.researchMode) {
        doc.text(`Research Mode: ${data.researchMode.toUpperCase()}`, 120, yPos);
      }
      yPos += 15;

      // Agent Results Summary
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(59, 130, 246);
      doc.text('AGENT ANALYSIS SUMMARY', 20, yPos);
      doc.setTextColor(0, 0, 0);
      yPos += 8;

      const tableData = data.agentResults.map(result => [
        result.agent_type?.toUpperCase() || 'N/A',
        result.status === 'completed' ? '✓ Completed' : result.status || 'N/A',
        result.results?.confidence ? `${result.results.confidence}%` : 'N/A',
        result.created_at ? new Date(result.created_at).toLocaleDateString() : 'N/A'
      ]);

      autoTable(doc, {
        startY: yPos,
        head: [['Agent', 'Status', 'Confidence', 'Date']],
        body: tableData,
        theme: 'striped',
        styles: { fontSize: 9, cellPadding: 4 },
        headStyles: { fillColor: [59, 130, 246], textColor: 255, fontStyle: 'bold' },
        alternateRowStyles: { fillColor: [245, 247, 250] }
      });

      yPos = (doc as any).lastAutoTable.finalY + 15;

      // Key Findings Section
      if (data.insights?.keyFindings?.length > 0) {
        if (yPos > 230) {
          doc.addPage();
          yPos = 20;
        }

        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(59, 130, 246);
        doc.text('KEY FINDINGS', 20, yPos);
        doc.setTextColor(0, 0, 0);
        yPos += 10;

        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        data.insights.keyFindings.forEach((finding: string, idx: number) => {
          if (yPos > 270) {
            doc.addPage();
            yPos = 20;
          }
          
          // Highlight box for key findings
          doc.setFillColor(255, 251, 235);
          const lines = doc.splitTextToSize(`${finding}`, 165);
          doc.rect(18, yPos - 4, 174, lines.length * 6 + 4, 'F');
          
          doc.setTextColor(59, 130, 246);
          doc.text(`${idx + 1}.`, 20, yPos);
          doc.setTextColor(0, 0, 0);
          doc.text(lines, 28, yPos);
          yPos += lines.length * 6 + 8;
        });
      }

      // Sentiment Analysis Section
      if (data.insights?.sentimentAnalysis) {
        yPos += 5;
        if (yPos > 220) {
          doc.addPage();
          yPos = 20;
        }

        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(59, 130, 246);
        doc.text('SENTIMENT ANALYSIS', 20, yPos);
        doc.setTextColor(0, 0, 0);
        yPos += 12;

        const sentiment = data.insights.sentimentAnalysis;
        
        // Sentiment bars with labels
        doc.setFontSize(10);
        doc.text('Positive', 25, yPos);
        doc.setFillColor(34, 197, 94);
        doc.rect(60, yPos - 4, Math.min(sentiment.positive, 100), 6, 'F');
        doc.text(`${sentiment.positive}%`, 165, yPos);
        yPos += 12;

        doc.text('Neutral', 25, yPos);
        doc.setFillColor(156, 163, 175);
        doc.rect(60, yPos - 4, Math.min(sentiment.neutral, 100), 6, 'F');
        doc.text(`${sentiment.neutral}%`, 165, yPos);
        yPos += 12;

        doc.text('Negative', 25, yPos);
        doc.setFillColor(239, 68, 68);
        doc.rect(60, yPos - 4, Math.min(sentiment.negative, 100), 6, 'F');
        doc.text(`${sentiment.negative}%`, 165, yPos);
        yPos += 15;
      }

      // Recommendations Section
      if (data.insights?.recommendations?.length > 0) {
        if (yPos > 230) {
          doc.addPage();
          yPos = 20;
        }

        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(59, 130, 246);
        doc.text('RECOMMENDATIONS', 20, yPos);
        doc.setTextColor(0, 0, 0);
        yPos += 10;

        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        data.insights.recommendations.forEach((rec: string, idx: number) => {
          if (yPos > 270) {
            doc.addPage();
            yPos = 20;
          }
          const lines = doc.splitTextToSize(`→ ${rec}`, 170);
          doc.text(lines, 22, yPos);
          yPos += lines.length * 6 + 4;
        });
      }

      // Limitations Section (if available)
      const limitations = data.perplexityData?.limitations || data.insights?.limitations;
      if (limitations?.length > 0) {
        yPos += 10;
        if (yPos > 230) {
          doc.addPage();
          yPos = 20;
        }

        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(217, 119, 6);
        doc.text('LIMITATIONS & DATA GAPS', 20, yPos);
        doc.setTextColor(0, 0, 0);
        yPos += 10;

        doc.setFontSize(9);
        limitations.forEach((item: string, idx: number) => {
          if (yPos > 270) {
            doc.addPage();
            yPos = 20;
          }
          const lines = doc.splitTextToSize(`• ${item}`, 170);
          doc.text(lines, 22, yPos);
          yPos += lines.length * 5 + 3;
        });
      }

      // Footer
      const pageCount = doc.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(128, 128, 128);
        doc.text(
          `Page ${i} of ${pageCount} | Generated by Market Research Platform`,
          105,
          290,
          { align: 'center' }
        );
      }

      doc.save(`${data.projectName.replace(/\s+/g, '_')}_report.pdf`);
      toast.success('Professional PDF report generated');
    } catch (error) {
      console.error('Error generating PDF:', error);
      toast.error('Failed to generate PDF report');
    }
  };

  const generateExcel = () => {
    try {
      const wb = XLSX.utils.book_new();

      // Summary Sheet
      const summaryData = [
        ['MARKET RESEARCH REPORT'],
        [''],
        ['Project Details'],
        ['Product/Company', data.projectName],
        ['Brand', data.companyName || 'N/A'],
        ['Generated', new Date().toLocaleString()],
        ['Research Mode', data.researchMode || 'Standard'],
        [''],
      ];
      const ws0 = XLSX.utils.aoa_to_sheet(summaryData);
      XLSX.utils.book_append_sheet(wb, ws0, 'Summary');

      // Agent Results Sheet
      const resultsData = data.agentResults.map(result => ({
        'Agent Type': result.agent_type?.toUpperCase() || 'N/A',
        'Status': result.status || 'N/A',
        'Confidence Score': result.results?.confidence ? `${result.results.confidence}%` : 'N/A',
        'Created At': result.created_at ? new Date(result.created_at).toLocaleString() : 'N/A',
        'Error': result.error_message || 'None'
      }));
      const ws1 = XLSX.utils.json_to_sheet(resultsData);
      XLSX.utils.book_append_sheet(wb, ws1, 'Agent Results');

      // Insights Sheet
      if (data.insights) {
        const insightsRows: any[] = [];
        
        if (data.insights.keyFindings) {
          insightsRows.push(['KEY FINDINGS']);
          data.insights.keyFindings.forEach((f: string, i: number) => {
            insightsRows.push([`${i + 1}. ${f}`]);
          });
          insightsRows.push(['']);
        }
        
        if (data.insights.sentimentAnalysis) {
          insightsRows.push(['SENTIMENT ANALYSIS']);
          insightsRows.push(['Positive', `${data.insights.sentimentAnalysis.positive}%`]);
          insightsRows.push(['Neutral', `${data.insights.sentimentAnalysis.neutral}%`]);
          insightsRows.push(['Negative', `${data.insights.sentimentAnalysis.negative}%`]);
          insightsRows.push(['']);
        }
        
        if (data.insights.recommendations) {
          insightsRows.push(['RECOMMENDATIONS']);
          data.insights.recommendations.forEach((r: string, i: number) => {
            insightsRows.push([`${i + 1}. ${r}`]);
          });
        }

        const ws2 = XLSX.utils.aoa_to_sheet(insightsRows);
        XLSX.utils.book_append_sheet(wb, ws2, 'Insights');
      }

      // Limitations Sheet
      const limitations = data.perplexityData?.limitations || data.insights?.limitations;
      const suggestions = data.perplexityData?.suggestions || data.insights?.suggestions;
      if (limitations?.length || suggestions?.length) {
        const limitRows: any[] = [['LIMITATIONS & SUGGESTIONS'], ['']];
        
        if (limitations?.length) {
          limitRows.push(['Data Gaps & Limitations:']);
          limitations.forEach((l: string) => limitRows.push([`• ${l}`]));
          limitRows.push(['']);
        }
        
        if (suggestions?.length) {
          limitRows.push(['Suggestions for Improvement:']);
          suggestions.forEach((s: string) => limitRows.push([`• ${s}`]));
        }

        const ws3 = XLSX.utils.aoa_to_sheet(limitRows);
        XLSX.utils.book_append_sheet(wb, ws3, 'Limitations');
      }

      XLSX.writeFile(wb, `${data.projectName.replace(/\s+/g, '_')}_report.xlsx`);
      toast.success('Excel report generated');
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
