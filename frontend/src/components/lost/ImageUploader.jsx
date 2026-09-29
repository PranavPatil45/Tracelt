import { useState, useRef } from 'react'
import { UploadCloud, Image as ImageIcon, X, AlertCircle } from 'lucide-react'
import './ImageUploader.css'

const ALLOWED_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp']
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5MB

export default function ImageUploader({
  imageFile,
  setImageFile,
  imagePreview,
  setImagePreview,
  error,
  setError,
  disabled = false,
}) {
  const [isDragging, setIsDragging] = useState(false)
  const inputRef = useRef(null)

  function validateFile(file) {
    if (!file) return false

    // Check MIME type
    if (!ALLOWED_MIME_TYPES.includes(file.type.toLowerCase())) {
      const ext = file.name.split('.').pop().toLowerCase()
      if (!ALLOWED_EXTENSIONS.includes(ext)) {
        setError('Unsupported image format. Please select a JPG, PNG, or WEBP file.')
        return false
      }
    }

    // Check size
    if (file.size > MAX_FILE_SIZE) {
      setError('Image exceeds the 5MB size limit. Please choose a smaller image.')
      return false
    }

    setError('')
    return true
  }

  function handleFileSelected(file) {
    if (!file) return
    if (!validateFile(file)) return

    setImageFile(file)
    const previewUrl = URL.createObjectURL(file)
    setImagePreview(previewUrl)
  }

  function handleInputChange(e) {
    const file = e.target.files?.[0]
    handleFileSelected(file)
  }

  function handleDragOver(e) {
    e.preventDefault()
    e.stopPropagation()
    if (!disabled) setIsDragging(true)
  }

  function handleDragLeave(e) {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
  }

  function handleDrop(e) {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
    if (disabled) return

    const file = e.dataTransfer.files?.[0]
    handleFileSelected(file)
  }

  function handleRemove() {
    if (imagePreview) {
      URL.revokeObjectURL(imagePreview)
    }
    setImageFile(null)
    setImagePreview(null)
    setError('')
    if (inputRef.current) {
      inputRef.current.value = ''
    }
  }

  return (
    <div className="image-uploader">
      <label className="image-uploader__label">
        Item Image <span className="image-uploader__optional">(Optional)</span>
      </label>

      {imagePreview ? (
        <div className="image-uploader__preview-wrap">
          <div className="image-uploader__preview-frame">
            <img
              src={imagePreview}
              alt="Preview of reported lost item"
              className="image-uploader__preview-img"
            />
            <button
              type="button"
              className="image-uploader__remove-btn"
              onClick={handleRemove}
              disabled={disabled}
              aria-label="Remove uploaded image"
              title="Remove image"
            >
              <X size={16} />
              <span>Remove</span>
            </button>
          </div>
          <div className="image-uploader__file-info">
            <ImageIcon size={14} className="image-icon" />
            <span className="filename">{imageFile?.name}</span>
            <span className="filesize">
              {imageFile?.size ? `(${(imageFile.size / (1024 * 1024)).toFixed(2)} MB)` : ''}
            </span>
          </div>
        </div>
      ) : (
        <div
          className={`image-uploader__dropzone ${isDragging ? 'image-uploader__dropzone--dragging' : ''} ${
            error ? 'image-uploader__dropzone--error' : ''
          }`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => !disabled && inputRef.current?.click()}
          role="button"
          tabIndex={disabled ? -1 : 0}
          onKeyDown={(e) => {
            if ((e.key === 'Enter' || e.key === ' ') && !disabled) {
              inputRef.current?.click()
            }
          }}
          aria-label="Upload item image by drag and drop or browse"
        >
          <input
            ref={inputRef}
            type="file"
            accept=".jpg,.jpeg,.png,.webp"
            onChange={handleInputChange}
            disabled={disabled}
            className="image-uploader__hidden-input"
            aria-hidden="true"
          />

          <div className="image-uploader__icon-box">
            <UploadCloud size={28} />
          </div>

          <div className="image-uploader__prompt">
            <p className="image-uploader__title">
              <strong>Drag &amp; drop image here</strong> or <span className="browse-link">browse from device</span>
            </p>
            <p className="image-uploader__hint">Supports JPG, PNG, WEBP &bull; Maximum 5MB</p>
          </div>
        </div>
      )}

      {error && (
        <div className="image-uploader__error" role="alert">
          <AlertCircle size={14} />
          <span>{error}</span>
        </div>
      )}
    </div>
  )
}
