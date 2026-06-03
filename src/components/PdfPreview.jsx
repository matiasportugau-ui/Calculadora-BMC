import { useCallback, useEffect, useState } from 'react';
import { sampleClientVisualData } from '../utils/quotationPreviewSampleData.js';
import { render as renderBmcPdf } from '../pdf-templates/bmc-pdf.js';

export default function PdfPreview() {
  const [pdfUrl, setPdfUrl] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedSample, setSelectedSample] = useState('default');

  const samples = {
    default: sampleClientVisualData,
  };

  const generatePdf = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const quoteData = samples[selectedSample] || samples.default;
      const html = renderBmcPdf(quoteData);

      const response = await fetch('/api/pdf/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ html, filename: 'preview-quote.pdf' }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`PDF generation failed: ${errorData.error || response.statusText}`);
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      setPdfUrl(url);
    } catch (err) {
      setError(err.message);
      console.error('PDF generation error:', err);
    } finally {
      setLoading(false);
    }
  }, [selectedSample, samples]);

  useEffect(() => {
    generatePdf();
  }, [generatePdf]);

  return (
    <div style={{ display: 'flex', height: '100vh', background: '#f5f5f7' }}>
      {/* Left Sidebar */}
      <div
        style={{
          width: '280px',
          background: 'white',
          borderRight: '1px solid #e5e5e7',
          display: 'flex',
          flexDirection: 'column',
          padding: '20px',
          gap: '16px',
          overflowY: 'auto',
        }}
      >
        <h2 style={{ fontSize: '14px', fontWeight: '600', margin: 0, color: '#333' }}>
          PDF Preview
        </h2>

        <div style={{ fontSize: '12px', color: '#666', lineHeight: '1.5' }}>
          <p style={{ margin: '0 0 8px 0' }}>
            <strong>Tips:</strong>
          </p>
          <ul style={{ margin: 0, paddingLeft: '16px' }}>
            <li>Edit templates in <code style={{ background: '#f0f0f0', padding: '2px 4px' }}>src/pdf-templates/</code></li>
            <li>Preview refreshes on template changes</li>
            <li>Use sample data selector below</li>
            <li>Open DevTools (⌘D) for console errors</li>
          </ul>
        </div>

        <div style={{ borderTop: '1px solid #e5e5e7', paddingTop: '16px' }}>
          <label style={{ fontSize: '12px', fontWeight: '600', color: '#333', display: 'block', marginBottom: '8px' }}>
            Sample Quote
          </label>
          <select
            value={selectedSample}
            onChange={(e) => setSelectedSample(e.target.value)}
            style={{
              width: '100%',
              padding: '8px 12px',
              fontSize: '13px',
              border: '1px solid #d5d5d7',
              borderRadius: '6px',
              background: 'white',
            }}
          >
            <option value="default">Default (BMC-2026-0112)</option>
          </select>
        </div>

        <button
          onClick={generatePdf}
          disabled={loading}
          style={{
            padding: '10px 16px',
            background: loading ? '#ccc' : '#0071E3',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            fontSize: '13px',
            fontWeight: '600',
            cursor: loading ? 'not-allowed' : 'pointer',
          }}
        >
          {loading ? 'Generating…' : 'Refresh PDF'}
        </button>

        {error && (
          <div
            style={{
              padding: '12px',
              background: '#FEE7E6',
              border: '1px solid #D97C73',
              borderRadius: '6px',
              fontSize: '11px',
              color: '#A41E34',
            }}
          >
            <strong>Error:</strong> {error}
          </div>
        )}
      </div>

      {/* Main PDF Viewer */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '40px',
          background: '#f5f5f7',
        }}
      >
        {loading ? (
          <div style={{ fontSize: '14px', color: '#666' }}>Generating PDF…</div>
        ) : pdfUrl ? (
          <iframe
            src={pdfUrl}
            style={{
              width: '100%',
              height: '100%',
              border: 'none',
              borderRadius: '8px',
              boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
            }}
          />
        ) : (
          <div style={{ fontSize: '14px', color: '#999' }}>No PDF loaded</div>
        )}
      </div>
    </div>
  );
}
