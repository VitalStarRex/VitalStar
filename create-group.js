// ============================================================
// VITALSTAR — create-group.js
// Handles: auth guard, live preview sync, cover/avatar upload
// to Cloudinary, dynamic rules list, validation, and creating
// the group document (+ owner membership) in Firestore.
// ===========================================================



import { auth, db } from "./firebase.js";

import { onAuthStateChanged }
from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

import {
  doc,
  collection,
  setDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";




// ============================================================
// CLOUDINARY CONFIG — reused across the whole project
// ============================================================
const CLOUDINARY_CLOUD_NAME = 'm0scmqqv';
const CLOUDINARY_UPLOAD_PRESET = 'vitalstar_upload';

/**
 * Uploads a single file to Cloudinary using the unsigned upload
 * preset. Returns the secure URL of the uploaded asset.
 * This is the shared upload method — reuse it anywhere the app
 * needs to send an image or video to Cloudinary.
 * @param {File} file
 * @param {(percent: number) => void} [onProgress]
 * @returns {Promise<string>} secure_url of the uploaded asset
 */
function uploadToCloudinary(file, onProgress) {
  return new Promise((resolve, reject) => {
    const url = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/auto/upload`;
    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);

    const xhr = new XMLHttpRequest();
    xhr.open('POST', url, true);

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && typeof onProgress === 'function') {
        onProgress(Math.round((event.loaded / event.total) * 100));
      }
    };

    xhr.onload = () => {
      try {
        const response = JSON.parse(xhr.responseText);
        if (xhr.status >= 200 && xhr.status < 300 && response.secure_url) {
          resolve(response.secure_url);
        } else {
          reject(new Error(response.error?.message || 'Upload to Cloudinary failed.'));
        }
      } catch (err) {
        reject(new Error('Unexpected response from Cloudinary.'));
      }
    };

    xhr.onerror = () => reject(new Error('Network error while uploading to Cloudinary.'));
    xhr.send(formData);
  });
}

// ============================================================
// DOM REFERENCES
// ============================================================
const form = document.getElementById('createGroupForm');
const createGroupBtn = document.getElementById('createGroupBtn');

const nameInput = document.getElementById('groupNameInput');
const nameField = document.getElementById('groupNameField');
const nameCharCount = document.getElementById('nameCharCount');

const descInput = document.getElementById('groupDescInput');
const descField = document.getElementById('groupDescField');
const descCharCount = document.getElementById('descCharCount');

const categorySelect = document.getElementById('categorySelect');
const categoryField = document.getElementById('categoryField');

const coverDropzone = document.getElementById('coverDropzone');
const coverUploadInput = document.getElementById('coverUploadInput');
const avatarDropzone = document.getElementById('avatarDropzone');
const avatarUploadInput = document.getElementById('avatarUploadInput');

const privacyRadios = document.querySelectorAll('input[name="privacy"]');
const groupTypeRadios = document.querySelectorAll('input[name="groupType"]');
const premiumPriceWrapper = document.getElementById('premiumPriceWrapper');
const priceInput = document.getElementById('priceInput');
const priceField = document.getElementById('priceField');

const rulesList = document.getElementById('rulesList');
const rulesEmptyState = document.getElementById('rulesEmptyState');
const ruleInput = document.getElementById('ruleInput');
const addRuleBtn = document.getElementById('addRuleBtn');

const navUserAvatar = document.getElementById('navUserAvatar');

// Preview panel
const previewCover = document.getElementById('previewCover');
const previewAvatar = document.getElementById('previewAvatar');
const previewName = document.getElementById('previewName');
const previewDesc = document.getElementById('previewDesc');
const previewPrivacyBadge = document.getElementById('previewPrivacyBadge');
const previewPremiumBadge = document.getElementById('previewPremiumBadge');
const previewCategoryChip = document.getElementById('previewCategoryChip');
const previewCategoryText = document.getElementById('previewCategoryText');

const toastContainer = document.getElementById('toast-container');

// ============================================================
// STATE
// ============================================================
const state = {
  currentUser: null,
  coverFile: null,
  avatarFile: null,
  rules: [],
  isSubmitting: false
};

const CATEGORY_LABELS = {
  technology: 'Technology',
  gaming: 'Gaming',
  programming: 'Programming',
  music: 'Music',
  'movies-tv': 'Movies & TV',
  anime: 'Anime',
  sports: 'Sports',
  education: 'Education',
  business: 'Business',
  entertainment: 'Entertainment',
  news: 'News',
  science: 'Science',
  fashion: 'Fashion',
  travel: 'Travel',
  politics: 'Politics',
  religion: 'Religion',
  general: 'General',
  other: 'Other'
};

// ============================================================
// TOASTS
// ============================================================
function showToast(message, type = 'info') {
  const icons = {
    success: 'fa-circle-check',
    error: 'fa-circle-exclamation',
    info: 'fa-circle-info'
  };

  const toast = document.createElement('div');
  toast.className = `toast toast--${type}`;
  toast.innerHTML = `<i class="fa-solid ${icons[type] || icons.info}"></i><span>${escapeHtml(message)}</span>`;
  toastContainer.appendChild(toast);

  setTimeout(() => {
    toast.classList.add('is-leaving');
    toast.addEventListener('animationend', () => toast.remove(), { once: true });
  }, 3800);
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// ============================================================
// AUTH GUARD
// ============================================================
onAuthStateChanged(auth, (user) => {
  if (!user) {
    window.location.href = 'login.html';
    return;
  }
  state.currentUser = user;

  if (user.photoURL) {
    navUserAvatar.style.backgroundImage = `url(${user.photoURL})`;
    navUserAvatar.style.backgroundSize = 'cover';
    navUserAvatar.style.backgroundPosition = 'center';
    navUserAvatar.innerHTML = '';
  }
});

// ============================================================
// LIVE PREVIEW SYNC
// ============================================================
function syncNamePreview() {
  const value = nameInput.value.trim();
  previewName.textContent = value || 'Your group name';
  nameCharCount.textContent = `${nameInput.value.length}/60`;
}

function syncDescPreview() {
  const value = descInput.value.trim();
  descCharCount.textContent = `${descInput.value.length}/500`;
  if (value) {
    previewDesc.textContent = value;
    previewDesc.classList.remove('is-empty');
  } else {
    previewDesc.textContent = 'Your group description will appear here as you type.';
    previewDesc.classList.add('is-empty');
  }
}

function syncCategoryPreview() {
  const value = categorySelect.value;
  if (value) {
    previewCategoryChip.style.display = 'inline-flex';
    previewCategoryText.textContent = CATEGORY_LABELS[value] || value;
  } else {
    previewCategoryChip.style.display = 'none';
  }
}

function syncPrivacyPreview() {
  const value = document.querySelector('input[name="privacy"]:checked').value;
  if (value === 'private') {
    previewPrivacyBadge.className = 'badge badge--private';
    previewPrivacyBadge.innerHTML = '<i class="fa-solid fa-lock" style="font-size:9px;"></i> Private';
  } else {
    previewPrivacyBadge.className = 'badge badge--public';
    previewPrivacyBadge.innerHTML = '<i class="fa-solid fa-globe" style="font-size:9px;"></i> Public';
  }
}

function syncGroupTypePreview() {
  const value = document.querySelector('input[name="groupType"]:checked').value;
  const isPremium = value === 'premium';
  previewPremiumBadge.style.display = isPremium ? 'inline-flex' : 'none';
  premiumPriceWrapper.classList.toggle('is-visible', isPremium);
  if (!isPremium) {
    priceInput.value = '';
    priceField.classList.remove('has-error');
  }
}

nameInput.addEventListener('input', syncNamePreview);
descInput.addEventListener('input', syncDescPreview);
categorySelect.addEventListener('change', syncCategoryPreview);
privacyRadios.forEach((radio) => radio.addEventListener('change', syncPrivacyPreview));
groupTypeRadios.forEach((radio) => radio.addEventListener('change', syncGroupTypePreview));

// ============================================================
// MEDIA UPLOAD HANDLERS (with local preview before actual upload)
// ============================================================
coverDropzone.addEventListener('click', () => coverUploadInput.click());
avatarDropzone.addEventListener('click', () => avatarUploadInput.click());

coverUploadInput.addEventListener('change', () => {
  const file = coverUploadInput.files[0];
  if (!file) return;

  if (!file.type.startsWith('image/')) {
    showToast('Please choose an image file for the cover photo.', 'error');
    coverUploadInput.value = '';
    return;
  }
  if (file.size > 8 * 1024 * 1024) {
    showToast('Cover photo must be under 8MB.', 'error');
    coverUploadInput.value = '';
    return;
  }

  state.coverFile = file;
  const objectUrl = URL.createObjectURL(file);
  coverDropzone.style.backgroundImage = `url(${objectUrl})`;
  coverDropzone.classList.add('has-image');
  previewCover.style.backgroundImage = `url(${objectUrl})`;
});

avatarUploadInput.addEventListener('change', () => {
  const file = avatarUploadInput.files[0];
  if (!file) return;

  if (!file.type.startsWith('image/')) {
    showToast('Please choose an image file for the profile picture.', 'error');
    avatarUploadInput.value = '';
    return;
  }
  if (file.size > 5 * 1024 * 1024) {
    showToast('Profile picture must be under 5MB.', 'error');
    avatarUploadInput.value = '';
    return;
  }

  state.avatarFile = file;
  const objectUrl = URL.createObjectURL(file);
  avatarDropzone.style.backgroundImage = `url(${objectUrl})`;
  avatarDropzone.classList.add('has-image');
  previewAvatar.style.backgroundImage = `url(${objectUrl})`;
  previewAvatar.innerHTML = '';
});

// ============================================================
// RULES LIST
// ============================================================
function renderRules() {
  rulesList.innerHTML = '';

  if (state.rules.length === 0) {
    rulesEmptyState.style.display = 'block';
    return;
  }
  rulesEmptyState.style.display = 'none';

  state.rules.forEach((rule, index) => {
    const item = document.createElement('div');
    item.className = 'rule-item';
    item.innerHTML = `
      <span class="rule-item__index">${index + 1}</span>
      <span class="rule-item__text"></span>
      <button type="button" class="rule-item__remove" aria-label="Remove rule">
        <i class="fa-solid fa-xmark"></i>
      </button>
    `;
    item.querySelector('.rule-item__text').textContent = rule;
    item.querySelector('.rule-item__remove').addEventListener('click', () => {
      state.rules.splice(index, 1);
      renderRules();
    });
    rulesList.appendChild(item);
  });
}

function addRuleFromInput() {
  const value = ruleInput.value.trim();
  if (!value) return;
  if (state.rules.length >= 20) {
    showToast('You can add up to 20 rules.', 'error');
    return;
  }
  state.rules.push(value);
  ruleInput.value = '';
  renderRules();
}

addRuleBtn.addEventListener('click', addRuleFromInput);
ruleInput.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') {
    event.preventDefault();
    addRuleFromInput();
  }
});

// ============================================================
// VALIDATION
// ============================================================
function setFieldError(fieldEl, hasError) {
  fieldEl.classList.toggle('has-error', hasError);
}

function validateForm() {
  let isValid = true;

  const nameValue = nameInput.value.trim();
  if (nameValue.length < 2 || nameValue.length > 60) {
    setFieldError(nameField, true);
    isValid = false;
  } else {
    setFieldError(nameField, false);
  }

  const descValue = descInput.value.trim();
  if (descValue.length < 10 || descValue.length > 500) {
    setFieldError(descField, true);
    isValid = false;
  } else {
    setFieldError(descField, false);
  }

  if (!categorySelect.value) {
    setFieldError(categoryField, true);
    isValid = false;
  } else {
    setFieldError(categoryField, false);
  }

  const groupType = document.querySelector('input[name="groupType"]:checked').value;
  if (groupType === 'premium') {
    const price = parseFloat(priceInput.value);
    if (isNaN(price) || price < 1) {
      setFieldError(priceField, true);
      isValid = false;
    } else {
      setFieldError(priceField, false);
    }
  }

  return isValid;
}

// ============================================================
// SLUG GENERATION (for readable, shareable group URLs)
// ============================================================
function slugify(text) {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 50);
}

/**
 * Builds an array of lowercase substrings/tokens from the group
 * name and category, used for simple prefix search in Firestore
 * (array-contains queries) without needing a separate search service.
 */
function buildSearchTokens(name, category) {
  const tokens = new Set();
  const words = `${name} ${category}`.toLowerCase().split(/\s+/).filter(Boolean);

  words.forEach((word) => {
    for (let i = 1; i <= word.length; i++) {
      tokens.add(word.slice(0, i));
    }
  });

  return Array.from(tokens).slice(0, 150);
}

// ============================================================
// FORM SUBMISSION
// ============================================================
form.addEventListener('submit', async (event) => {
  event.preventDefault();

  if (state.isSubmitting) return;
  if (!state.currentUser) {
    showToast('You need to be signed in to create a group.', 'error');
    return;
  }
  if (!validateForm()) {
    showToast('Please fix the highlighted fields.', 'error');
    return;
  }

  state.isSubmitting = true;
  createGroupBtn.disabled = true;
  createGroupBtn.classList.add('is-loading');

  try {
    // Upload media to Cloudinary first (if provided)
    let coverURL = '';
    let avatarURL = '';

    if (state.coverFile) {
      coverURL = await uploadToCloudinary(state.coverFile);
    }
    if (state.avatarFile) {
      avatarURL = await uploadToCloudinary(state.avatarFile);
    }

    const name = nameInput.value.trim();
    const description = descInput.value.trim();
    const category = categorySelect.value;
    const privacy = document.querySelector('input[name="privacy"]:checked').value;
    const groupType = document.querySelector('input[name="groupType"]:checked').value;
    const isPremium = groupType === 'premium';
    const price = isPremium ? Math.round(parseFloat(priceInput.value) * 100) / 100 : 0;

    const groupRef = doc(collection(db, 'groups'));
    const groupId = groupRef.id;
    const user = state.currentUser;

    // ------------------------------------------------------------
    // Scalable Firestore document shape.
    // Membership, subscribers, and posts live in subcollections
    // (not arrays) so the group document stays small and fast to
    // read even for groups with millions of members.
    // ------------------------------------------------------------
    const groupData = {
      groupId,
      name,
      slug: `${slugify(name)}-${groupId.slice(0, 6)}`,
      description,
      category,
      searchTokens: buildSearchTokens(name, category),

      coverURL,
      avatarURL,

      privacy,        // 'public' | 'private'
      type: groupType, // 'free' | 'premium'

      ownerId: user.uid,
      ownerName: user.displayName || 'VitalStar Member',

      verified: false,
      level: 1,

      memberCount: 1,
      postCount: 0,
      onlineCount: 1,

      rules: state.rules,

      // Subscription system — data structure only, ready to plug
      // into Paystack / Flutterwave. No payment processing yet.
      subscription: isPremium
        ? {
            isPremium: true,
            price,
            currency: 'USD',
            billingPeriod: 'monthly',
            paymentProvider: null,       // 'paystack' | 'flutterwave' — set at integration time
            subscriberCount: 0,
            totalEarnings: 0
          }
        : {
            isPremium: false,
            price: 0,
            currency: 'USD',
            billingPeriod: null,
            paymentProvider: null,
            subscriberCount: 0,
            totalEarnings: 0
          },

      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };

    await setDoc(groupRef, groupData);

    // Owner membership record lives in a subcollection so member
    // lookups/queries scale independently of the group document.
    const ownerMemberRef = doc(db, 'groups', groupId, 'members', user.uid);
    await setDoc(ownerMemberRef, {
      uid: user.uid,
      displayName: user.displayName || 'VitalStar Member',
      photoURL: user.photoURL || '',
      role: 'owner', // owner | admin | moderator | member
      status: 'active',
      joinedAt: serverTimestamp()
    });

    showToast('Group created! Taking you there now…', 'success');
    setTimeout(() => {
      window.location.href = `group.html?id=${groupId}`;
    }, 900);
  } catch (error) {
    console.error('Error creating group:', error);
    showToast(error.message || 'Something went wrong creating your group. Please try again.', 'error');
    state.isSubmitting = false;
    createGroupBtn.disabled = false;
    createGroupBtn.classList.remove('is-loading');
  }
});

// ============================================================
// INIT
// ============================================================
renderRules();
syncNamePreview();
syncDescPreview();
syncCategoryPreview();
syncPrivacyPreview();
syncGroupTypePreview();