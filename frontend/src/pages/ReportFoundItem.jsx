import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import {
  ArrowRight,
  ArrowLeft,
  Calendar,
  Clock,
  MapPin,
  Tag,
  FileText,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Sparkles,
  HeartHandshake,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext.jsx'
import Sidebar from '../components/dashboard/Sidebar.jsx'
import DashboardHeader from '../components/dashboard/DashboardHeader.jsx'
import ImageUploader from '../components/lost/ImageUploader.jsx'
import { LOST_ITEM_CATEGORIES, CAMPUS_LOCATIONS } from '../data/lostItemOptions.js'
import { reportFoundItem, uploadItemImage, FoundItemApiError } from '../api/foundItems.js'
import './ReportFoundItem.css'

export default function ReportFoundItem() {
  const { user, token, loading, logout, isAuthenticated } = useAuth()
  const navigate = useNavigate()

  // Layout state
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  // Form Fields State
  const [title, setTitle] = useState('')
  const [category, setCategory] = useState('')
  const [description, setDescription] = useState('')
  const [location, setLocation] = useState('')
  const [customLocation, setCustomLocation] = useState('')
  const [foundDate, setFoundDate] = useState(() => {
    // Default to today's date in YYYY-MM-DD
    const now = new Date()
    return now.toISOString().split('T')[0]
  })
  const [foundTime, setFoundTime] = useState('')

  // Image state
  const [imageFile, setImageFile] = useState(null)
  const [imagePreview, setImagePreview] = useState(null)
  const [imageError, setImageError] = useState('')
  const [uploadedUrl, setUploadedUrl] = useState(null)

  const handleSetImageFile = (file) => {
    setImageFile(file)
    setUploadedUrl(null)
  }

  // Validation and Submission State
  const [fieldErrors, setFieldErrors] = useState({})
  const [touched, setTouched] = useState({})
  const [submitting, setSubmitting] = useState(false)
  const [serverError, setServerError] = useState('')
  const [createdItem, setCreatedItem] = useState(null)

  // Max allowed date is today
  const todayStr = new Date().toISOString().split('T')[0]

  // Route protection
  useEffect(() => {
    if (!loading && !isAuthenticated) {
      navigate('/login')
    }
  }, [loading, isAuthenticated, navigate])

  function handleBlur(field) {
    setTouched((prev) => ({ ...prev, [field]: true }))
    validateField(field)
  }

  function validateField(field) {
    const nextErrors = { ...fieldErrors }

    if (field === 'title') {
      if (!title.trim()) {
        nextErrors.title = 'Please enter what you found (e.g. Black Leather Wallet).'
      } else if (title.trim().length < 2) {
        nextErrors.title = 'Title must be at least 2 characters long.'
      } else {
        delete nextErrors.title
      }
    }

    if (field === 'category') {
      if (!category) {
        nextErrors.category = 'Please select a category for the found item.'
      } else {
        delete nextErrors.category
      }
    }

    if (field === 'description') {
      if (!description.trim()) {
        nextErrors.description = 'Please describe the item (color, brand, distinguishing features).'
      } else if (description.trim().length < 5) {
        nextErrors.description = 'Description must be at least 5 characters long.'
      } else {
        delete nextErrors.description
      }
    }

    if (field === 'location') {
      if (!location) {
        nextErrors.location = 'Please select where you found the item.'
      } else if (location === 'Other' && !customLocation.trim()) {
        nextErrors.location = 'Please specify the campus location details.'
      } else {
        delete nextErrors.location
      }
    }

    if (field === 'foundDate') {
      if (!foundDate) {
        nextErrors.foundDate = 'Please select the date the item was found.'
      } else if (foundDate > todayStr) {
        nextErrors.foundDate = 'Date found cannot be in the future.'
      } else {
        delete nextErrors.foundDate
      }
    }

    setFieldErrors(nextErrors)
    return Object.keys(nextErrors).length === 0
  }

  function validateAll() {
    const errors = {}

    if (!title.trim()) {
      errors.title = 'Please enter what you found.'
    } else if (title.trim().length < 2) {
      errors.title = 'Title must be at least 2 characters.'
    }

    if (!category) {
      errors.category = 'Please select a category.'
    }

    if (!description.trim()) {
      errors.description = 'Please describe the item.'
    } else if (description.trim().length < 5) {
      errors.description = 'Description must be at least 5 characters.'
    }

    if (!location) {
      errors.location = 'Please select a campus location.'
    } else if (location === 'Other' && !customLocation.trim()) {
      errors.location = 'Please specify the campus location.'
    }

    if (!foundDate) {
      errors.foundDate = 'Please select the date found.'
    } else if (foundDate > todayStr) {
      errors.foundDate = 'Date found cannot be in the future.'
    }

    setFieldErrors(errors)
    setTouched({
      title: true,
      category: true,
      description: true,
      location: true,
      foundDate: true,
    })

    return Object.keys(errors).length === 0
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setServerError('')

    if (!validateAll()) {
      return
    }

    if (imageError) {
      return
    }

    setSubmitting(true)

    try {
      let finalImageUrl = uploadedUrl

      // Step 1: Upload image to server if selected and not already uploaded
      if (imageFile && !finalImageUrl) {
        const uploadResult = await uploadItemImage(imageFile, token)
        finalImageUrl = uploadResult.image_url
        setUploadedUrl(finalImageUrl)
      }

      // Step 2: Submit report to FastAPI backend
      const finalLocation = location === 'Other' ? customLocation.trim() : location
      const reportPayload = {
        title: title.trim(),
        category,
        description: description.trim(),
        location: finalLocation,
        found_date: foundDate,
        found_time: foundTime.trim() || null,
        image_url: finalImageUrl,
      }

      const created = await reportFoundItem(reportPayload, token)
      setCreatedItem(created)
    } catch (err) {
      console.error('Report found item error:', err)
      const message =
        err instanceof FoundItemApiError
          ? err.message
          : 'Unable to submit your report. Please check your connection and try again.'
      setServerError(message)
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="dashboard-loading">
        <div className="dashboard-loading__spinner" />
        <p>Loading Tracelt&hellip;</p>
      </div>
    )
  }

  if (!user) return null

  return (
    <div className="dashboard-app">
      {/* Sidebar */}
      <Sidebar
        activeTab="found-items"
        setActiveTab={(tab) => {
          navigate(tab === 'dashboard' ? '/dashboard' : `/${tab}`)
        }}
        user={user}
        logout={logout}
        mobileOpen={mobileMenuOpen}
        setMobileOpen={setMobileMenuOpen}
      />

      {/* Main Area */}
      <div className="dashboard-main-area">
        <DashboardHeader
          activeTabTitle="Report a Found Item"
          user={user}
          logout={logout}
          onOpenNotifications={() => navigate('/dashboard')}
          onOpenReportModal={(type) => {
            if (type === 'lost') navigate('/report-lost')
            else navigate('/report-found')
          }}
          onOpenMobileMenu={() => setMobileMenuOpen(true)}
          onSelectTab={(tab) => navigate(tab === 'dashboard' ? '/dashboard' : `/${tab}`)}
        />

        <main className="dashboard-content report-page-content">
          <div className="report-page-container">
            {/* Back Navigation Row */}
            <div className="report-back-row">
              <Link to="/dashboard" className="report-back-link">
                <ArrowLeft size={16} /> Back to Dashboard
              </Link>
            </div>

            {/* Success State Screen */}
            {createdItem ? (
              <div className="report-success-card" role="status" aria-live="polite">
                <div className="success-icon-wrap">
                  <CheckCircle2 size={38} />
                </div>
                <div className="success-badge">
                  <HeartHandshake size={14} /> Found Item Reported
                </div>
                <h2 className="success-title">Thanks for helping out!</h2>
                <p className="success-desc">
                  Thanks for helping return this item to its owner. Your report has been successfully added to Tracelt.
                </p>

                <div className="success-item-summary">
                  {createdItem.image_url ? (
                    <img
                      src={createdItem.image_url}
                      alt={createdItem.title}
                      className="success-item-thumb"
                    />
                  ) : (
                    <div className="success-item-thumb-placeholder">
                      <Tag size={26} />
                    </div>
                  )}
                  <div className="success-item-meta">
                    <div className="success-item-title">{createdItem.title}</div>
                    <div className="success-item-sub">
                      <span>
                        <Tag size={13} /> {createdItem.category}
                      </span>
                      <span>
                        <MapPin size={13} /> {createdItem.location}
                      </span>
                      <span>
                        <Calendar size={13} /> {createdItem.found_date}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="success-actions">
                  <button
                    type="button"
                    onClick={() => navigate('/my-found-items')}
                    className="btn-primary"
                  >
                    View My Found Items <ArrowRight size={16} />
                  </button>
                  <button
                    type="button"
                    onClick={() => navigate('/dashboard')}
                    className="btn-secondary"
                  >
                    Back to Dashboard
                  </button>
                </div>
              </div>
            ) : (
              /* Report Found Item Form */
              <div className="report-form-card">
                <header className="report-form-header">
                  <div className="report-badge">
                    <span className="live-dot" /> Campus Reconnect Initiative
                  </div>
                  <h1 className="report-form-title">Report a Found Item</h1>
                  <p className="report-form-subtitle">
                    Help reunite this item with its owner. Provide as much information as possible about where and when you found it.
                  </p>
                </header>

                {serverError && (
                  <div className="report-server-error" role="alert">
                    <AlertCircle size={18} />
                    <span>{serverError}</span>
                  </div>
                )}

                <form onSubmit={handleSubmit} noValidate>
                  <div className="form-section">
                    {/* Item Title */}
                    <div className="form-group">
                      <label htmlFor="found-title" className="form-label">
                        <Tag size={15} /> Item Title <span className="required-mark">*</span>
                      </label>
                      <input
                        id="found-title"
                        type="text"
                        placeholder="e.g. Black Leather Wallet, Silver Casio Watch"
                        value={title}
                        onChange={(e) => {
                          setTitle(e.target.value)
                          if (touched.title) validateField('title')
                        }}
                        onBlur={() => handleBlur('title')}
                        className={`form-input ${touched.title && fieldErrors.title ? 'has-error' : ''}`}
                        disabled={submitting}
                        autoFocus
                      />
                      {touched.title && fieldErrors.title ? (
                        <p className="form-error">
                          <AlertCircle size={13} /> {fieldErrors.title}
                        </p>
                      ) : (
                        <p className="form-hint">
                          Provide a clear, brief title that describes the found item.
                        </p>
                      )}
                    </div>

                    {/* Category & Found Location (2 Columns) */}
                    <div className="form-row-2col">
                      {/* Category */}
                      <div className="form-group">
                        <label htmlFor="found-category" className="form-label">
                          <Tag size={15} /> Category <span className="required-mark">*</span>
                        </label>
                        <select
                          id="found-category"
                          value={category}
                          onChange={(e) => {
                            setCategory(e.target.value)
                            if (touched.category) validateField('category')
                          }}
                          onBlur={() => handleBlur('category')}
                          className={`form-select ${touched.category && fieldErrors.category ? 'has-error' : ''}`}
                          disabled={submitting}
                        >
                          <option value="">Select category ▼</option>
                          {LOST_ITEM_CATEGORIES.map((cat) => (
                            <option key={cat} value={cat}>
                              {cat}
                            </option>
                          ))}
                        </select>
                        {touched.category && fieldErrors.category && (
                          <p className="form-error">
                            <AlertCircle size={13} /> {fieldErrors.category}
                          </p>
                        )}
                      </div>

                      {/* Found Location */}
                      <div className="form-group">
                        <label htmlFor="found-location" className="form-label">
                          <MapPin size={15} /> Where did you find it? <span className="required-mark">*</span>
                        </label>
                        <select
                          id="found-location"
                          value={location}
                          onChange={(e) => {
                            setLocation(e.target.value)
                            if (touched.location) validateField('location')
                          }}
                          onBlur={() => handleBlur('location')}
                          className={`form-select ${touched.location && fieldErrors.location ? 'has-error' : ''}`}
                          disabled={submitting}
                        >
                          <option value="">Select campus location ▼</option>
                          {CAMPUS_LOCATIONS.map((loc) => (
                            <option key={loc} value={loc}>
                              {loc}
                            </option>
                          ))}
                        </select>
                        {location === 'Other' && (
                          <input
                            type="text"
                            placeholder="Specify location details (e.g. Near Fountain, Lab 304)..."
                            value={customLocation}
                            onChange={(e) => setCustomLocation(e.target.value)}
                            className="form-input custom-loc-input"
                            disabled={submitting}
                          />
                        )}
                        {touched.location && fieldErrors.location && (
                          <p className="form-error">
                            <AlertCircle size={13} /> {fieldErrors.location}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Date Found & Time Found (2 Columns) */}
                    <div className="form-row-2col">
                      {/* Date Found */}
                      <div className="form-group">
                        <label htmlFor="found-date" className="form-label">
                          <Calendar size={15} /> Date Found <span className="required-mark">*</span>
                        </label>
                        <input
                          id="found-date"
                          type="date"
                          max={todayStr}
                          value={foundDate}
                          onChange={(e) => {
                            setFoundDate(e.target.value)
                            if (touched.foundDate) validateField('foundDate')
                          }}
                          onBlur={() => handleBlur('foundDate')}
                          className={`form-input ${touched.foundDate && fieldErrors.foundDate ? 'has-error' : ''}`}
                          disabled={submitting}
                        >
                        </input>
                        {touched.foundDate && fieldErrors.foundDate && (
                          <p className="form-error">
                            <AlertCircle size={13} /> {fieldErrors.foundDate}
                          </p>
                        )}
                      </div>

                      {/* Approximate Time */}
                      <div className="form-group">
                        <label htmlFor="found-time" className="form-label">
                          <Clock size={15} /> Approximate Time
                        </label>
                        <input
                          id="found-time"
                          type="time"
                          value={foundTime}
                          onChange={(e) => setFoundTime(e.target.value)}
                          className="form-input"
                          disabled={submitting}
                        />
                        <p className="form-hint">Optional: approximate time you spotted or recovered it.</p>
                      </div>
                    </div>

                    {/* Description */}
                    <div className="form-group">
                      <label htmlFor="found-description" className="form-label">
                        <FileText size={15} /> Description & Identifying Details <span className="required-mark">*</span>
                      </label>
                      <textarea
                        id="found-description"
                        rows={4}
                        placeholder="Describe the item, its condition, color, brand, or any identifying details that may help the owner recognize it..."
                        value={description}
                        onChange={(e) => {
                          setDescription(e.target.value)
                          if (touched.description) validateField('description')
                        }}
                        onBlur={() => handleBlur('description')}
                        className={`form-textarea ${touched.description && fieldErrors.description ? 'has-error' : ''}`}
                        disabled={submitting}
                      />
                      {touched.description && fieldErrors.description ? (
                        <p className="form-error">
                          <AlertCircle size={13} /> {fieldErrors.description}
                        </p>
                      ) : (
                        <p className="form-hint">
                          Include color, brand, condition, or other details that could help identify the owner. Do not reveal private passcodes or sensitive data.
                        </p>
                      )}
                    </div>

                    {/* Image Uploader (Reusing ImageUploader Component) */}
                    <div className="form-group">
                      <ImageUploader
                        imageFile={imageFile}
                        setImageFile={handleSetImageFile}
                        imagePreview={imagePreview}
                        setImagePreview={setImagePreview}
                        error={imageError}
                        setError={setImageError}
                        disabled={submitting}
                      />
                    </div>
                  </div>

                  {/* Submit Actions */}
                  <div className="form-actions">
                    <button
                      type="button"
                      onClick={() => navigate('/dashboard')}
                      className="btn-secondary"
                      disabled={submitting}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="btn-primary"
                      disabled={submitting}
                    >
                      {submitting ? (
                        <>
                          <Loader2 size={16} className="animate-spin" />
                          Reporting...
                        </>
                      ) : (
                        <>
                          Report Found Item <ArrowRight size={16} />
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  )
}
