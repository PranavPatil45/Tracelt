import { useState, useEffect, useRef, useMemo } from "react";
import {
  User,
  Mail,
  Phone,
  FileText,
  MapPin,
  GraduationCap,
  Camera,
  Trash2,
  Lock,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ChevronDown,
  Building2,
  Check,
  Info,
  X,
} from "lucide-react";
import { useAuth } from "../../../context/AuthContext.jsx";
import {
  updateUserProfile,
  uploadProfileAvatar,
  removeProfileAvatar,
  fetchCampuses,
  fetchDepartments,
} from "../../../api/auth.js";
import { getItemImageUrl } from "../../../utils/imageUrl.js";
import { CAMPUSES, DEPARTMENTS } from "../../../data/campuses.js";
import "./Subviews.css";
import "./ProfileView.css";

const MAX_BIO_LENGTH = 500;
const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB
const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
const ALLOWED_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp"];

export default function ProfileView({ user: propUser }) {
  const { user: authUser, token, updateUser, loading: authLoading } = useAuth();
  const currentUser = authUser || propUser;

  // Available campuses and departments (predefined institutional directories)
  const [availableCampuses, setAvailableCampuses] = useState(CAMPUSES);
  const [availableDepartments, setAvailableDepartments] = useState(DEPARTMENTS);

  // Form Fields State
  const [formData, setFormData] = useState({
    fullName: "",
    phone: "",
    bio: "",
    campus: "",
    department: "",
  });

  // Initial State Snapshot to detect changes
  const [initialState, setInitialState] = useState({
    fullName: "",
    phone: "",
    bio: "",
    campus: "",
    department: "",
    profileImage: null,
  });

  // Avatar Management State
  const [avatarFile, setAvatarFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [removeAvatar, setRemoveAvatar] = useState(false);
  const fileInputRef = useRef(null);

  // UI States
  const [saving, setSaving] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});
  const [statusMessage, setStatusMessage] = useState(null); // { type: 'success' | 'error', text: string }

  // Sync state when currentUser is loaded or updated
  useEffect(() => {
    if (currentUser) {
      const initial = {
        fullName: currentUser.full_name || "",
        phone: currentUser.phone || "",
        bio: currentUser.bio || "",
        campus: currentUser.campus || CAMPUSES[0] || "",
        department: currentUser.department || "",
        profileImage: currentUser.profile_image || null,
      };
      setFormData({
        fullName: initial.fullName,
        phone: initial.phone,
        bio: initial.bio,
        campus: initial.campus,
        department: initial.department,
      });
      setInitialState(initial);
      setRemoveAvatar(false);
      setAvatarFile(null);
      setPreviewUrl(null);
    }
  }, [currentUser]);

  // Optionally fetch fresh campuses and departments from backend
  useEffect(() => {
    let mounted = true;
    async function loadInstitutionalData() {
      const [campusesData, deptsData] = await Promise.all([
        fetchCampuses(),
        fetchDepartments(),
      ]);
      if (mounted) {
        if (Array.isArray(campusesData) && campusesData.length > 0) {
          setAvailableCampuses(campusesData);
        }
        if (Array.isArray(deptsData) && deptsData.length > 0) {
          setAvailableDepartments(deptsData);
        }
      }
    }
    loadInstitutionalData();
    return () => {
      mounted = false;
    };
  }, []);

  // Clean up object URLs to prevent memory leaks
  useEffect(() => {
    return () => {
      if (previewUrl && previewUrl.startsWith("blob:")) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  // Ensure current user's campus and department are in options list if non-standard
  const campusesOptions = useMemo(() => {
    const list = [...availableCampuses];
    if (formData.campus && !list.includes(formData.campus)) {
      list.unshift(formData.campus);
    }
    return list;
  }, [availableCampuses, formData.campus]);

  const departmentsOptions = useMemo(() => {
    const list = [...availableDepartments];
    if (formData.department && !list.includes(formData.department)) {
      list.unshift(formData.department);
    }
    return list;
  }, [availableDepartments, formData.department]);

  // Determine if the form has unsaved modifications
  const isDirty = useMemo(() => {
    const textChanged =
      formData.fullName.trim() !== initialState.fullName.trim() ||
      formData.phone.trim() !== (initialState.phone || "").trim() ||
      formData.bio.trim() !== (initialState.bio || "").trim() ||
      formData.campus.trim() !== (initialState.campus || "").trim() ||
      formData.department.trim() !== (initialState.department || "").trim();

    const avatarChanged = Boolean(avatarFile) || removeAvatar;
    return textChanged || avatarChanged;
  }, [formData, initialState, avatarFile, removeAvatar]);

  // Initials computation for avatar placeholder
  const initials = useMemo(() => {
    const name = formData.fullName.trim() || currentUser?.full_name || "User";
    return (
      name
        .split(/\s+/)
        .map((part) => part[0])
        .filter(Boolean)
        .slice(0, 2)
        .join("")
        .toUpperCase() || "U"
    );
  }, [formData.fullName, currentUser?.full_name]);

  // Compute active avatar source (priority: temporary preview > current user image unless removed > initials)
  const activeAvatarImage = useMemo(() => {
    if (previewUrl) return previewUrl;
    if (removeAvatar) return null;
    if (currentUser?.profile_image)
      return getItemImageUrl(currentUser.profile_image);
    return null;
  }, [previewUrl, removeAvatar, currentUser?.profile_image]);

  // Form Field Change Handlers
  function handleInputChange(field, value) {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (fieldErrors[field]) {
      setFieldErrors((prev) => ({ ...prev, [field]: null }));
    }
    if (statusMessage) {
      setStatusMessage(null);
    }
  }

  // Handle Photo File Selection
  function handlePhotoSelect(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    setFieldErrors((prev) => ({ ...prev, avatar: null }));

    // 1. Validate file extension
    const nameLower = file.name.toLowerCase();
    const hasValidExt = ALLOWED_EXTENSIONS.some((ext) =>
      nameLower.endsWith(ext),
    );
    if (!hasValidExt || !ALLOWED_IMAGE_TYPES.includes(file.type)) {
      setFieldErrors((prev) => ({
        ...prev,
        avatar:
          "Invalid image format. Please select a JPG, PNG, or WEBP image.",
      }));
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    // 2. Validate file size (<= 5MB)
    if (file.size > MAX_IMAGE_SIZE_BYTES) {
      setFieldErrors((prev) => ({
        ...prev,
        avatar: "Image file size exceeds 5MB. Please choose a smaller image.",
      }));
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    if (previewUrl && previewUrl.startsWith("blob:")) {
      URL.revokeObjectURL(previewUrl);
    }

    const objectUrl = URL.createObjectURL(file);
    setPreviewUrl(objectUrl);
    setAvatarFile(file);
    setRemoveAvatar(false);
  }

  // Handle Photo Removal
  function handlePhotoRemove() {
    if (previewUrl && previewUrl.startsWith("blob:")) {
      URL.revokeObjectURL(previewUrl);
    }
    setPreviewUrl(null);
    setAvatarFile(null);
    setRemoveAvatar(true);
    setFieldErrors((prev) => ({ ...prev, avatar: null }));
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  // Validation
  function validateForm() {
    const errors = {};

    const trimmedName = formData.fullName.trim();
    if (!trimmedName) {
      errors.fullName = "Full name is required.";
    } else if (trimmedName.length < 2) {
      errors.fullName = "Full name must contain at least 2 characters.";
    } else if (trimmedName.length > 255) {
      errors.fullName = "Full name must be under 255 characters.";
    }

    if (!formData.campus.trim()) {
      errors.campus = "Please select a campus.";
    }

    if (formData.phone.trim().length > 50) {
      errors.phone = "Phone number is too long (maximum 50 characters).";
    }

    if (formData.bio.length > MAX_BIO_LENGTH) {
      errors.bio = `Bio cannot exceed ${MAX_BIO_LENGTH} characters.`;
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }

  // Cancel Handler: Revert all changes to initial state
  function handleCancel() {
    if (previewUrl && previewUrl.startsWith("blob:")) {
      URL.revokeObjectURL(previewUrl);
    }
    setFormData({
      fullName: initialState.fullName,
      phone: initialState.phone,
      bio: initialState.bio,
      campus: initialState.campus,
      department: initialState.department,
    });
    setAvatarFile(null);
    setPreviewUrl(null);
    setRemoveAvatar(false);
    setFieldErrors({});
    setStatusMessage(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  // Save Handler
  async function handleSubmit(e) {
    e.preventDefault();
    if (saving || !isDirty) return;

    setStatusMessage(null);

    if (!validateForm()) {
      return;
    }

    setSaving(true);

    try {
      let finalProfileImage = currentUser?.profile_image || null;

      // 1. If user uploaded a new photo file, upload it
      if (avatarFile) {
        const uploadRes = await uploadProfileAvatar(avatarFile, token);
        finalProfileImage = uploadRes.profile_image;
      } else if (removeAvatar) {
        // If user explicitly removed photo
        await removeProfileAvatar(token);
        finalProfileImage = null;
      }

      // 2. Persist profile field updates
      const patchPayload = {
        full_name: formData.fullName.trim(),
        phone: formData.phone.trim() || null,
        bio: formData.bio.trim() || null,
        campus: formData.campus.trim(),
        department: formData.department.trim() || null,
        profile_image: finalProfileImage,
      };

      const updatedUser = await updateUserProfile(patchPayload, token);

      // 3. Update global AuthContext and local snapshots
      if (updateUser) {
        updateUser(updatedUser);
      }

      const newSnapshot = {
        fullName: updatedUser.full_name || "",
        phone: updatedUser.phone || "",
        bio: updatedUser.bio || "",
        campus: updatedUser.campus || "",
        department: updatedUser.department || "",
        profileImage: updatedUser.profile_image || null,
      };

      setInitialState(newSnapshot);
      setFormData({
        fullName: newSnapshot.fullName,
        phone: newSnapshot.phone,
        bio: newSnapshot.bio,
        campus: newSnapshot.campus,
        department: newSnapshot.department,
      });
      setAvatarFile(null);
      setPreviewUrl(null);
      setRemoveAvatar(false);
      if (fileInputRef.current) fileInputRef.current.value = "";

      setStatusMessage({
        type: "success",
        text: "Profile updated successfully.",
      });
    } catch (err) {
      console.error("Failed to update profile:", err);
      setStatusMessage({
        type: "error",
        text:
          err?.message || "Unable to update your profile. Please try again.",
      });
    } finally {
      setSaving(false);
    }
  }

  // Initial Loading Skeleton State
  if (authLoading && !currentUser) {
    return (
      <div
        className="profile-view"
        aria-busy="true"
        aria-label="Loading profile"
      >
        <div
          className="profile-skeleton-card profile-skeleton-pulse"
          style={{ height: "140px" }}
        />
        <div className="profile-grid-2col">
          <div
            className="profile-skeleton-card profile-skeleton-pulse"
            style={{ height: "360px" }}
          />
          <div className="profile-grid-column">
            <div
              className="profile-skeleton-card profile-skeleton-pulse"
              style={{ height: "200px" }}
            />
            <div
              className="profile-skeleton-card profile-skeleton-pulse"
              style={{ height: "180px" }}
            />
          </div>
        </div>
      </div>
    );
  }

  const bioRemainingChars = MAX_BIO_LENGTH - formData.bio.length;

  return (
    <div className="subview-container profile-view-subview">
      <div className="subview-header">
        <div>
          <h2 className="subview-title">Campus Profile &amp; Settings</h2>
          <p className="subview-subtitle">
            Manage your personal contact details, campus credentials, and
            institutional profile.
          </p>
        </div>
      </div>

      <div className="profile-view">
        {/* 1. Profile Header Card */}
        <section className="profile-header-card" aria-label="Profile Header">
          <div className="profile-header-card__inner">
            <div className="profile-header-avatar">
              {activeAvatarImage ? (
                <img
                  src={activeAvatarImage}
                  alt={formData.fullName || "User avatar"}
                  className="profile-header-avatar__img"
                />
              ) : (
                <span>{initials}</span>
              )}
            </div>

            <div className="profile-header-meta">
              <div className="profile-header-name-row">
                <h2 className="profile-header-name">
                  {formData.fullName.trim() ||
                    currentUser?.full_name ||
                    "Campus Member"}
                </h2>
                <span className="profile-verified-badge">
                  <ShieldCheck size={13} />
                  {currentUser?.role && currentUser.role !== "student"
                    ? `${currentUser.role.toUpperCase()} Member`
                    : "Verified Campus Member"}
                </span>
              </div>

              <div className="profile-header-email">
                <Mail size={14} />
                <span>{currentUser?.email || "email@campus.edu"}</span>
              </div>

              <p className="profile-header-desc">
                Manage your personal information and profile details.
              </p>
            </div>
          </div>
        </section>

        {/* Status Alerts (Success / Error Notification) */}
        {statusMessage && (
          <div
            className={`profile-alert ${
              statusMessage.type === "success"
                ? "profile-alert--success"
                : "profile-alert--error"
            }`}
            role="status"
            aria-live="polite"
          >
            <div className="profile-alert__content">
              {statusMessage.type === "success" ? (
                <CheckCircle2 size={18} />
              ) : (
                <AlertCircle size={18} />
              )}
              <span>{statusMessage.text}</span>
            </div>
            <button
              type="button"
              className="profile-alert__close"
              onClick={() => setStatusMessage(null)}
              aria-label="Dismiss alert"
            >
              <X size={15} />
            </button>
          </div>
        )}

        {/* Main Profile Form */}
        <form onSubmit={handleSubmit} noValidate>
          <div className="profile-grid-2col">
            {/* Left Column: Personal Information Card */}
            <div className="profile-grid-column">
              <section
                className="profile-card"
                aria-labelledby="personal-info-title"
              >
                <div className="profile-card__header">
                  <div className="profile-card__title-row">
                    <User size={18} className="profile-card__icon" />
                    <h3 id="personal-info-title">Personal Information</h3>
                  </div>
                  <p className="profile-card__subtitle">
                    Update the basic contact information and identity linked to
                    your account.
                  </p>
                </div>

                <div className="profile-fields-list">
                  {/* Full Name */}
                  <div className="profile-field">
                    <div className="profile-field__label-row">
                      <label
                        htmlFor="profile-full-name"
                        className="profile-label"
                      >
                        Full Name{" "}
                        <span className="profile-label__required">*</span>
                      </label>
                    </div>
                    <div
                      className={`profile-input-wrapper ${
                        fieldErrors.fullName
                          ? "profile-input-wrapper--error"
                          : ""
                      }`}
                    >
                      <User size={16} className="profile-input__icon" />
                      <input
                        id="profile-full-name"
                        type="text"
                        className="profile-input"
                        value={formData.fullName}
                        onChange={(e) =>
                          handleInputChange("fullName", e.target.value)
                        }
                        placeholder="e.g. Pranav Patil"
                        required
                        aria-invalid={Boolean(fieldErrors.fullName)}
                        aria-describedby={
                          fieldErrors.fullName
                            ? "profile-name-error"
                            : undefined
                        }
                      />
                    </div>
                    {fieldErrors.fullName ? (
                      <span
                        id="profile-name-error"
                        className="profile-error-text"
                      >
                        <AlertCircle size={13} /> {fieldErrors.fullName}
                      </span>
                    ) : (
                      <span className="profile-help-text">
                        Visible on items you report or match across campus.
                      </span>
                    )}
                  </div>

                  {/* Email Address (Read-Only) */}
                  <div className="profile-field">
                    <div className="profile-field__label-row">
                      <label htmlFor="profile-email" className="profile-label">
                        Email Address
                      </label>
                      <span className="profile-readonly-badge">
                        <Lock size={11} /> Read-Only
                      </span>
                    </div>
                    <div className="profile-input-wrapper profile-input-wrapper--readonly">
                      <Mail size={16} className="profile-input__icon" />
                      <input
                        id="profile-email"
                        type="email"
                        className="profile-input"
                        value={currentUser?.email || ""}
                        readOnly
                        disabled
                        aria-describedby="profile-email-help"
                      />
                    </div>
                    <span id="profile-email-help" className="profile-help-text">
                      Permanently associated with your authenticated Tracelt
                      campus account.
                    </span>
                  </div>

                  {/* Phone Number (Optional) */}
                  <div className="profile-field">
                    <div className="profile-field__label-row">
                      <label htmlFor="profile-phone" className="profile-label">
                        Phone Number{" "}
                        <span className="profile-label__optional">
                          (Optional)
                        </span>
                      </label>
                    </div>
                    <div
                      className={`profile-input-wrapper ${
                        fieldErrors.phone ? "profile-input-wrapper--error" : ""
                      }`}
                    >
                      <Phone size={16} className="profile-input__icon" />
                      <input
                        id="profile-phone"
                        type="tel"
                        className="profile-input"
                        value={formData.phone}
                        onChange={(e) =>
                          handleInputChange("phone", e.target.value)
                        }
                        placeholder="+1 (555) 012-3456"
                        aria-invalid={Boolean(fieldErrors.phone)}
                        aria-describedby={
                          fieldErrors.phone
                            ? "profile-phone-error"
                            : "profile-phone-help"
                        }
                      />
                    </div>
                    {fieldErrors.phone ? (
                      <span
                        id="profile-phone-error"
                        className="profile-error-text"
                      >
                        <AlertCircle size={13} /> {fieldErrors.phone}
                      </span>
                    ) : (
                      <span
                        id="profile-phone-help"
                        className="profile-help-text"
                      >
                        Used strictly for urgent recovery contact. Kept private
                        and not exposed publicly.
                      </span>
                    )}
                  </div>

                  {/* Bio (Optional) */}
                  <div className="profile-field">
                    <div className="profile-field__label-row">
                      <label htmlFor="profile-bio" className="profile-label">
                        Bio{" "}
                        <span className="profile-label__optional">
                          (Optional)
                        </span>
                      </label>
                      <span
                        className={`profile-char-count ${
                          bioRemainingChars < 50
                            ? "profile-char-count--warn"
                            : ""
                        }`}
                      >
                        {bioRemainingChars} / {MAX_BIO_LENGTH}
                      </span>
                    </div>
                    <textarea
                      id="profile-bio"
                      className={`profile-textarea ${
                        fieldErrors.bio ? "profile-textarea--error" : ""
                      }`}
                      value={formData.bio}
                      onChange={(e) => handleInputChange("bio", e.target.value)}
                      maxLength={MAX_BIO_LENGTH}
                      placeholder="Tell your campus community about yourself, e.g. class year, academic department, or favorite campus spots..."
                      rows={4}
                      aria-describedby="profile-bio-help"
                    />
                    {fieldErrors.bio ? (
                      <span className="profile-error-text">
                        <AlertCircle size={13} /> {fieldErrors.bio}
                      </span>
                    ) : (
                      <span id="profile-bio-help" className="profile-help-text">
                        A brief description displayed to staff when handling
                        item handovers.
                      </span>
                    )}
                  </div>
                </div>
              </section>
            </div>

            {/* Right Column: Profile Photo + Campus Information */}
            <div className="profile-grid-column">
              {/* 4. Profile Photo Card */}
              <section
                className="profile-card"
                aria-labelledby="profile-photo-title"
              >
                <div className="profile-card__header">
                  <div className="profile-card__title-row">
                    <Camera size={18} className="profile-card__icon" />
                    <h3 id="profile-photo-title">Profile Photo</h3>
                  </div>
                  <p className="profile-card__subtitle">
                    Upload an avatar so staff and finders can recognize you
                    during recovery handovers.
                  </p>
                </div>

                <div className="profile-photo-container">
                  <div className="profile-photo-preview-box">
                    {activeAvatarImage ? (
                      <img
                        src={activeAvatarImage}
                        alt={formData.fullName || "Selected avatar"}
                        className="profile-photo-preview__img"
                      />
                    ) : (
                      <span>{initials}</span>
                    )}
                    {previewUrl && (
                      <span className="profile-photo-preview__badge">
                        Preview
                      </span>
                    )}
                  </div>

                  {fieldErrors.avatar && (
                    <span className="profile-error-text">
                      <AlertCircle size={13} /> {fieldErrors.avatar}
                    </span>
                  )}

                  <div className="profile-photo-actions-row">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      style={{ display: "none" }}
                      onChange={handlePhotoSelect}
                      aria-label="Upload profile photo"
                    />
                    <button
                      type="button"
                      className="profile-btn-photo-change"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <Camera size={15} />
                      <span>
                        {activeAvatarImage ? "Change Photo" : "Upload Photo"}
                      </span>
                    </button>

                    <button
                      type="button"
                      className="profile-btn-photo-remove"
                      onClick={handlePhotoRemove}
                      disabled={!activeAvatarImage}
                      title="Remove profile image and use default initials"
                    >
                      <Trash2 size={14} />
                      <span>Remove</span>
                    </button>
                  </div>

                  <p className="profile-photo-meta-note">
                    Supports JPG, PNG, or WEBP up to 5MB. Stored securely on
                    Tracelt infrastructure.
                  </p>
                </div>
              </section>

              {/* 3. Campus Information Card */}
              <section
                className="profile-card"
                aria-labelledby="campus-info-title"
              >
                <div className="profile-card__header">
                  <div className="profile-card__title-row">
                    <Building2 size={18} className="profile-card__icon" />
                    <h3 id="campus-info-title">Campus Information</h3>
                  </div>
                  <p className="profile-card__subtitle">
                    Select your primary campus location and department
                    affiliation.
                  </p>
                </div>

                <div className="profile-fields-list">
                  {/* Campus Select */}
                  <div className="profile-field">
                    <div className="profile-field__label-row">
                      <label htmlFor="profile-campus" className="profile-label">
                        Campus{" "}
                        <span className="profile-label__required">*</span>
                      </label>
                    </div>
                    <div
                      className={`profile-input-wrapper ${
                        fieldErrors.campus ? "profile-input-wrapper--error" : ""
                      }`}
                    >
                      <MapPin size={16} className="profile-input__icon" />
                      <select
                        id="profile-campus"
                        className="profile-select"
                        value={formData.campus}
                        onChange={(e) =>
                          handleInputChange("campus", e.target.value)
                        }
                        required
                        aria-invalid={Boolean(fieldErrors.campus)}
                        aria-describedby={
                          fieldErrors.campus
                            ? "profile-campus-error"
                            : undefined
                        }
                      >
                        <option value="" disabled>
                          Select your campus
                        </option>
                        {campusesOptions.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>
                      <ChevronDown
                        size={15}
                        className="profile-select__chevron"
                      />
                    </div>
                    {fieldErrors.campus ? (
                      <span
                        id="profile-campus-error"
                        className="profile-error-text"
                      >
                        <AlertCircle size={13} /> {fieldErrors.campus}
                      </span>
                    ) : null}
                  </div>

                  {/* Department Select */}
                  <div className="profile-field">
                    <div className="profile-field__label-row">
                      <label
                        htmlFor="profile-department"
                        className="profile-label"
                      >
                        Department{" "}
                        <span className="profile-label__optional">
                          (Optional)
                        </span>
                      </label>
                    </div>
                    <div className="profile-input-wrapper">
                      <GraduationCap
                        size={16}
                        className="profile-input__icon"
                      />
                      <select
                        id="profile-department"
                        className="profile-select"
                        value={formData.department}
                        onChange={(e) =>
                          handleInputChange("department", e.target.value)
                        }
                      >
                        <option value="">
                          General Campus Community / None
                        </option>
                        {departmentsOptions.map((dept) => (
                          <option key={dept} value={dept}>
                            {dept}
                          </option>
                        ))}
                      </select>
                      <ChevronDown
                        size={15}
                        className="profile-select__chevron"
                      />
                    </div>
                  </div>

                  {/* Institutional Note */}
                  <div className="profile-campus-callout">
                    <Info size={16} className="profile-campus-callout__icon" />
                    <p className="profile-campus-callout__text">
                      Campus affiliation determines your local Lost &amp; Found
                      feed and helps matching algorithms localize item
                      discovery. Predefined from verified institutional
                      directories.
                    </p>
                  </div>
                </div>
              </section>
            </div>
          </div>

          {/* 5. Bottom Sticky Save / Cancel Action Bar */}
          <div
            className="profile-action-bar"
            role="region"
            aria-label="Profile actions"
          >
            <div className="profile-action-bar__left">
              {isDirty ? (
                <span className="profile-dirty-indicator">
                  <span className="profile-dirty-indicator__dot" />
                  You have unsaved changes
                </span>
              ) : (
                <span className="profile-clean-indicator">
                  <CheckCircle2 size={15} color="#10b981" />
                  All changes saved
                </span>
              )}
            </div>

            <div className="profile-action-bar__right">
              <button
                type="button"
                className="profile-btn-cancel"
                onClick={handleCancel}
                disabled={!isDirty || saving}
              >
                Cancel
              </button>

              <button
                type="submit"
                className="profile-btn-save"
                disabled={!isDirty || saving}
              >
                {saving ? (
                  <>
                    <Loader2 size={16} className="profile-spinner" />
                    <span>Saving...</span>
                  </>
                ) : (
                  <>
                    <Check size={16} />
                    <span>Save Changes</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
