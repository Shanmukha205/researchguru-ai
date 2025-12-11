import { useState } from "react";
import { FileSpreadsheet } from "lucide-react";
import DatasetVisualizationStudio from "@/components/DatasetVisualizationStudio";

export default function DatasetStudio() {
  return (
    <div className="p-6 md:p-8 space-y-8 animate-fade-in">
      <div className="space-y-2 text-center">
        <div className="flex items-center justify-center gap-3">
          <FileSpreadsheet className="h-8 w-8 text-primary" />
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight">
            Dataset Visualization Studio
          </h1>
        </div>
        <p className="text-muted-foreground max-w-2xl mx-auto">
          Upload CSV or Excel files and generate AI-powered visual insights with trend analysis, anomaly detection, and pattern recognition.
        </p>
      </div>

      <DatasetVisualizationStudio />
    </div>
  );
}
