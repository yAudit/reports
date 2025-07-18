---
tags: ["solidity"]
title: 2025-07-Centrifuge
description: Electisec Centrifuge report
---

<div id="pdf-container" style="width: 100%; height: 100vh;">
  <iframe
    id="pdf-iframe"
    width="100%"
    height="100%"
    style="border: none;"
    title="2025-07-report-centrifuge">
  </iframe>
</div>

<script>
  document.addEventListener('DOMContentLoaded', function() {
    const baseUrl = window.location.origin;
    const currentPath = window.location.pathname;
    const reportName = currentPath.split('/').pop() || '2025-07-centrifuge';
    const pdfPath = `/pdf/${reportName}.pdf`;
    const fullPdfUrl = `${baseUrl}${pdfPath}`;
    const iframe = document.getElementById('pdf-iframe');
    
    // Try Mozilla's viewer first
    const viewerUrl = `https://mozilla.github.io/pdf.js/web/viewer.html?file=${encodeURIComponent(fullPdfUrl)}#toolbar=1&navpanes=0&scrollbar=1`;
    iframe.src = viewerUrl;
    
    // Fallback to direct PDF if CORS fails
    iframe.addEventListener('error', function() {
      iframe.src = fullPdfUrl;
    });
    
    // Alternative fallback after timeout
    setTimeout(function() {
      if (!iframe.contentDocument) {
        iframe.src = fullPdfUrl;
      }
    }, 5000);
  });
</script>