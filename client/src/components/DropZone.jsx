import React, { useState, useRef } from 'react';
import { Upload } from 'lucide-react';

export function DropZone({ onFilesSelected, disabled = false }) {
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef(null);

  const handleDragEnter = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled) setIsDragOver(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    if (disabled) return;

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      onFilesSelected(Array.from(e.dataTransfer.files));
    }
  };

  const handleFileInputChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      onFilesSelected(Array.from(e.target.files));
      e.target.value = '';
    }
  };

  const triggerPicker = () => {
    if (!disabled && fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleKeyDown = (e) => {
    if (disabled) return;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      triggerPicker();
    }
  };

  return (
    <div
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-disabled={disabled}
      aria-label={disabled ? 'File selection disabled' : 'Select files to send'}
      className={`dropzone ${isDragOver ? 'dropzone-active' : ''} ${disabled ? 'dropzone-disabled' : ''}`}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      onClick={triggerPicker}
      onKeyDown={handleKeyDown}
    >
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileInputChange}
        multiple
        style={{ display: 'none' }}
        disabled={disabled}
        aria-hidden="true"
      />
      <div className="dropzone-content">
        <div className="dropzone-icon" aria-hidden="true">
          <Upload size={32} strokeWidth={1.5} />
        </div>
        <h3 className="dropzone-title">
          {disabled ? 'Waiting for the other device to connect' : 'Drop files here or tap to browse'}
        </h3>
        <p className="dropzone-subtitle">
          {disabled
            ? 'Files can be selected once the connection is established'
            : 'Any file type or size, direct device-to-device'}
        </p>
      </div>
    </div>
  );
}

export default DropZone;
