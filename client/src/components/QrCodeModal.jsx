import React, { useState, useRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Copy, Check } from 'lucide-react';
import Modal from './Modal.jsx';

export function QrCodeModal({ code, isOpen, onClose }) {
  const [copied, setCopied] = useState(false);
  const inputRef = useRef(null);

  const sessionUrl = `${window.location.origin}/session/${code}`;

  const handleCopy = async () => {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(sessionUrl);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } else {
        throw new Error('Clipboard API unavailable');
      }
    } catch (err) {
      // Fallback for non-secure contexts
      if (inputRef.current) {
        inputRef.current.select();
        try {
          document.execCommand('copy');
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        } catch (e) {
          // Instruct user to copy manually
        }
      }
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Scan QR code">
      <div className="modal-body">
        <div className="qr-container">
          <QRCodeSVG
            value={sessionUrl}
            size={200}
            bgColor="#FFFFFF"
            fgColor="#1C1917"
            level="M"
            includeMargin={true}
          />
        </div>

        <div className="code-display">
          <span className="code-label">Session code:</span>
          <span className="code-value">{code}</span>
        </div>

        <p className="modal-instructions">
          Scan with a mobile camera or share this link:
        </p>

        <div className="share-input-group">
          <input
            ref={inputRef}
            type="text"
            readOnly
            value={sessionUrl}
            className="input-text share-input"
            onClick={(e) => e.target.select()}
          />
          <button
            type="button"
            onClick={handleCopy}
            className="btn btn-primary btn-sm"
            aria-label={copied ? 'Link copied' : 'Copy link'}
          >
            {copied ? <Check size={16} strokeWidth={1.5} /> : <Copy size={16} strokeWidth={1.5} />}
            <span>{copied ? 'Copied' : 'Copy'}</span>
          </button>
        </div>
        <div aria-live="polite" className="sr-only">
          {copied ? 'Link copied to clipboard' : ''}
        </div>
      </div>
    </Modal>
  );
}

export default QrCodeModal;
