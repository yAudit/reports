---
tags: ["solidity"]
title: 2025-07-Centrifuge
description: Electisec Centrifuge report
---

<div id="pdf-container" style="width: 100%; height: 1000px;">
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
    const pdfPath = '/pdf/2025-07-report-centrifuge.pdf';
    const fullPdfUrl = `${baseUrl}${pdfPath}`;
    const googleViewerUrl = `https://docs.google.com/gview?embedded=true&url=${encodeURIComponent(fullPdfUrl)}`;
    
    document.getElementById('pdf-iframe').src = googleViewerUrl;
  });
</script>