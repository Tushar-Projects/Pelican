import React, { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';

export function QrCodeModal({ code, isOpen, onClose }) {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const sessionUrl = `${window.location.origin}/session/${code}`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(sessionUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy session link:', err);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="modal-title">Scan QR Code to Join</h3>
          <button className="modal-close" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="modal-body">
          <div className="qr-container">
            <QRCodeSVG
              value={sessionUrl}
              size={220}
              bgColor="#ffffff"
              fgColor="#0f172a"
              level="M"
              includeMargin={true}
            />
          </div>

          <div className="code-display">
            <span className="code-label">Session Code:</span>
            <span className="code-value">{code}</span>
          </div>

          <p className="modal-instructions">
            Scan with your mobile camera or share the direct link below:
          </p>

          <div className="share-input-group">
            <input type="text" readOnly value={sessionUrl} className="share-input" />
            <button onClick={handleCopy} className="btn-primary btn-sm">
              {copied ? '✓ Copied' : 'Copy Link'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default QrCodeModal;
