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
    title="PDF Report">
  </iframe>
</div>

<script>
  document.addEventListener('DOMContentLoaded', function() {
    // Define the PDF name here
    const fullPdfUrl = "https://reports.electisec.com/pdf/2025-07-centrifuge.pdf"
    const iframe = document.getElementById('pdf-iframe');
    
    // Check if localhost - use direct PDF
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      iframe.src = fullPdfUrl;
    } else {
      // Try Google Viewer first
      const googleViewerUrl = `https://docs.google.com/gview?embedded=true&url=${encodeURIComponent(fullPdfUrl)}`;
      iframe.src = googleViewerUrl;
      
      // Fallback to direct PDF if Google Viewer fails
      iframe.addEventListener('error', function() {
        iframe.src = fullPdfUrl;
      });
    }
  });
</script>