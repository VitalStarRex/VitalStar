// ============================================================
// VITALSTAR — create-group.js
// ============================================================

import { auth, db } from './firebase.js';

import {
  onAuthStateChanged
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';

import {
  doc,
  collection,
  setDoc,
  serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';


// ============================================================
// CONFIG
// ============================================================

const CLOUDINARY_CLOUD_NAME = 'm0scmqqv';
const CLOUDINARY_UPLOAD_PRESET = 'vitalstar_upload';

const PREMIUM_ACTIVATION_FEE = 1500;
const FOLLOWER_FEE = 100;
const CURRENCY = 'NGN';

const PAYMENT_FUNCTION_URL =
  'https://caolbkawexnilpsgrwyz.supabase.co/functions/v1/create-group-payment';


// ============================================================
// CLOUDINARY
// ============================================================

async function uploadToCloudinary(file) {

  const type =
    file.type.startsWith('video')
      ? 'video'
      : 'image';

  const formData = new FormData();

  formData.append('file', file);
  formData.append(
    'upload_preset',
    CLOUDINARY_UPLOAD_PRESET
  );

  const uploadURL =
    `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/${type}/upload`;

  const response = await fetch(
    uploadURL,
    {
      method: 'POST',
      body: formData
    }
  );

  const data =
    await response.json();

  if (!response.ok) {
    throw new Error(
      data.error?.message ||
      'Cloudinary upload failed.'
    );
  }

  return data.secure_url || '';
}


// ============================================================
// DOM
// ============================================================

const form =
  document.getElementById('createGroupForm');

const createGroupBtn =
  document.getElementById('createGroupBtn');

const nameInput =
  document.getElementById('groupNameInput');

const nameField =
  document.getElementById('groupNameField');

const nameCharCount =
  document.getElementById('nameCharCount');

const descInput =
  document.getElementById('groupDescInput');

const descField =
  document.getElementById('groupDescField');

const descCharCount =
  document.getElementById('descCharCount');

const categorySelect =
  document.getElementById('categorySelect');

const categoryField =
  document.getElementById('categoryField');

const coverDropzone =
  document.getElementById('coverDropzone');

const coverUploadInput =
  document.getElementById('coverUploadInput');

const avatarDropzone =
  document.getElementById('avatarDropzone');

const avatarUploadInput =
  document.getElementById('avatarUploadInput');

const privacyRadios =
  document.querySelectorAll(
    'input[name="privacy"]'
  );

const groupTypeRadios =
  document.querySelectorAll(
    'input[name="groupType"]'
  );

const premiumPriceWrapper =
  document.getElementById(
    'premiumPriceWrapper'
  );

const rulesList =
  document.getElementById('rulesList');

const rulesEmptyState =
  document.getElementById(
    'rulesEmptyState'
  );

const ruleInput =
  document.getElementById('ruleInput');

const addRuleBtn =
  document.getElementById('addRuleBtn');

const navUserAvatar =
  document.getElementById('navUserAvatar');

const previewCover =
  document.getElementById('previewCover');

const previewAvatar =
  document.getElementById('previewAvatar');

const previewName =
  document.getElementById('previewName');

const previewDesc =
  document.getElementById('previewDesc');

const previewPrivacyBadge =
  document.getElementById(
    'previewPrivacyBadge'
  );

const previewPremiumBadge =
  document.getElementById(
    'previewPremiumBadge'
  );

const previewCategoryChip =
  document.getElementById(
    'previewCategoryChip'
  );

const previewCategoryText =
  document.getElementById(
    'previewCategoryText'
  );

const toastContainer =
  document.getElementById(
    'toast-container'
  );


// ============================================================
// STATE
// ============================================================

const state = {

  currentUser: null,

  coverFile: null,
  avatarFile: null,

  coverObjectUrl: null,
  avatarObjectUrl: null,

  rules: [],

  isSubmitting: false
};


// ============================================================
// CATEGORY LABELS
// ============================================================

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
// TOAST
// ============================================================

function showToast(
  message,
  type = 'info'
) {

  const icons = {

    success: 'fa-circle-check',
    error: 'fa-circle-exclamation',
    info: 'fa-circle-info'

  };

  const toast =
    document.createElement('div');

  toast.className =
    `toast toast--${type}`;

  toast.innerHTML = `
    <i class="fa-solid ${
      icons[type] || icons.info
    }"></i>

    <span>
      ${escapeHtml(message)}
    </span>
  `;

  toastContainer.appendChild(toast);

  setTimeout(() => {

    toast.classList.add(
      'is-leaving'
    );

    toast.addEventListener(
      'animationend',
      () => toast.remove(),
      { once: true }
    );

  }, 3800);
}


function escapeHtml(str) {

  const div =
    document.createElement('div');

  div.textContent = str;

  return div.innerHTML;
}


// ============================================================
// AUTH
// ============================================================

onAuthStateChanged(
  auth,
  (user) => {

    if (!user) {

      window.location.href =
        'login.html';

      return;
    }

    state.currentUser =
      user;

    if (
      user.photoURL &&
      navUserAvatar
    ) {

      navUserAvatar.style.backgroundImage =
        `url(${user.photoURL})`;

      navUserAvatar.style.backgroundSize =
        'cover';

      navUserAvatar.style.backgroundPosition =
        'center';

      navUserAvatar.innerHTML = '';
    }

  }
);


// ============================================================
// PREVIEW
// ============================================================

function syncNamePreview() {

  const value =
    nameInput.value.trim();

  previewName.textContent =
    value || 'Your group name';

  nameCharCount.textContent =
    `${nameInput.value.length}/60`;
}


function syncDescPreview() {

  const value =
    descInput.value.trim();

  descCharCount.textContent =
    `${descInput.value.length}/500`;

  if (value) {

    previewDesc.textContent =
      value;

    previewDesc.classList.remove(
      'is-empty'
    );

  } else {

    previewDesc.textContent =
      'Your group description will appear here as you type.';

    previewDesc.classList.add(
      'is-empty'
    );
  }
}


function syncCategoryPreview() {

  const value =
    categorySelect.value;

  if (value) {

    previewCategoryChip.style.display =
      'inline-flex';

    previewCategoryText.textContent =
      CATEGORY_LABELS[value] ||
      value;

  } else {

    previewCategoryChip.style.display =
      'none';
  }
}


function syncPrivacyPreview() {

  const checked =
    document.querySelector(
      'input[name="privacy"]:checked'
    );

  if (!checked) return;

  if (checked.value === 'private') {

    previewPrivacyBadge.className =
      'badge badge--private';

    previewPrivacyBadge.innerHTML =
      '<i class="fa-solid fa-lock" style="font-size:9px;"></i> Private';

  } else {

    previewPrivacyBadge.className =
      'badge badge--public';

    previewPrivacyBadge.innerHTML =
      '<i class="fa-solid fa-globe" style="font-size:9px;"></i> Public';
  }
}


function syncGroupTypePreview() {

  const checked =
    document.querySelector(
      'input[name="groupType"]:checked'
    );

  if (!checked) return;

  const isPremium =
    checked.value === 'premium';

  previewPremiumBadge.style.display =
    isPremium
      ? 'inline-flex'
      : 'none';

  premiumPriceWrapper.classList.toggle(
    'is-visible',
    isPremium
  );
}


nameInput.addEventListener(
  'input',
  syncNamePreview
);

descInput.addEventListener(
  'input',
  syncDescPreview
);

categorySelect.addEventListener(
  'change',
  syncCategoryPreview
);

privacyRadios.forEach(
  radio => {

    radio.addEventListener(
      'change',
      syncPrivacyPreview
    );

  }
);

groupTypeRadios.forEach(
  radio => {

    radio.addEventListener(
      'change',
      syncGroupTypePreview
    );

  }
);


// ============================================================
// COVER
// ============================================================

coverDropzone.addEventListener(
  'click',
  () => coverUploadInput.click()
);

coverUploadInput.addEventListener(
  'change',
  () => {

    const file =
      coverUploadInput.files[0];

    if (!file) return;

    if (!file.type.startsWith('image/')) {

      showToast(
        'Please choose an image for the cover.',
        'error'
      );

      coverUploadInput.value = '';

      return;
    }

    if (file.size > 8 * 1024 * 1024) {

      showToast(
        'Cover photo must be under 8MB.',
        'error'
      );

      coverUploadInput.value = '';

      return;
    }

    state.coverFile = file;

    if (state.coverObjectUrl) {
      URL.revokeObjectURL(
        state.coverObjectUrl
      );
    }

    const objectUrl =
      URL.createObjectURL(file);

    state.coverObjectUrl =
      objectUrl;

    coverDropzone.style.backgroundImage =
      `url(${objectUrl})`;

    coverDropzone.classList.add(
      'has-image'
    );

    previewCover.style.backgroundImage =
      `url(${objectUrl})`;
  }
);


// ============================================================
// AVATAR
// ============================================================

avatarDropzone.addEventListener(
  'click',
  () => avatarUploadInput.click()
);

avatarUploadInput.addEventListener(
  'change',
  () => {

    const file =
      avatarUploadInput.files[0];

    if (!file) return;

    if (!file.type.startsWith('image/')) {

      showToast(
        'Please choose an image for the profile picture.',
        'error'
      );

      avatarUploadInput.value = '';

      return;
    }

    if (file.size > 5 * 1024 * 1024) {

      showToast(
        'Profile picture must be under 5MB.',
        'error'
      );

      avatarUploadInput.value = '';

      return;
    }

    state.avatarFile = file;

    if (state.avatarObjectUrl) {
      URL.revokeObjectURL(
        state.avatarObjectUrl
      );
    }

    const objectUrl =
      URL.createObjectURL(file);

    state.avatarObjectUrl =
      objectUrl;

    avatarDropzone.style.backgroundImage =
      `url(${objectUrl})`;

    avatarDropzone.classList.add(
      'has-image'
    );

    previewAvatar.style.backgroundImage =
      `url(${objectUrl})`;

    previewAvatar.innerHTML = '';
  }
);


// ============================================================
// RULES
// ============================================================

function renderRules() {

  rulesList.innerHTML = '';

  if (state.rules.length === 0) {

    rulesEmptyState.style.display =
      'block';

    return;
  }

  rulesEmptyState.style.display =
    'none';

  state.rules.forEach(
    (rule, index) => {

      const item =
        document.createElement('div');

      item.className =
        'rule-item';

      item.innerHTML = `
        <span class="rule-item__index">
          ${index + 1}
        </span>

        <span class="rule-item__text"></span>

        <button
          type="button"
          class="rule-item__remove"
          aria-label="Remove rule"
        >
          <i class="fa-solid fa-xmark"></i>
        </button>
      `;

      item.querySelector(
        '.rule-item__text'
      ).textContent = rule;

      item.querySelector(
        '.rule-item__remove'
      ).addEventListener(
        'click',
        () => {

          state.rules.splice(
            index,
            1
          );

          renderRules();
        }
      );

      rulesList.appendChild(
        item
      );
    }
  );
}


function addRuleFromInput() {

  const value =
    ruleInput.value.trim();

  if (!value) return;

  if (state.rules.length >= 20) {

    showToast(
      'You can add up to 20 rules.',
      'error'
    );

    return;
  }

  state.rules.push(value);

  ruleInput.value = '';

  renderRules();
}


addRuleBtn.addEventListener(
  'click',
  addRuleFromInput
);

ruleInput.addEventListener(
  'keydown',
  event => {

    if (event.key === 'Enter') {

      event.preventDefault();

      addRuleFromInput();
    }
  }
);


// ============================================================
// VALIDATION
// ============================================================

function setFieldError(
  field,
  hasError
) {

  field.classList.toggle(
    'has-error',
    hasError
  );
}


function validateForm() {

  let valid = true;

  const name =
    nameInput.value.trim();

  if (
    name.length < 2 ||
    name.length > 60
  ) {

    setFieldError(
      nameField,
      true
    );

    valid = false;

  } else {

    setFieldError(
      nameField,
      false
    );
  }


  const description =
    descInput.value.trim();

  if (
    description.length < 10 ||
    description.length > 500
  ) {

    setFieldError(
      descField,
      true
    );

    valid = false;

  } else {

    setFieldError(
      descField,
      false
    );
  }


  if (!categorySelect.value) {

    setFieldError(
      categoryField,
      true
    );

    valid = false;

  } else {

    setFieldError(
      categoryField,
      false
    );
  }

  return valid;
}


// ============================================================
// SLUG
// ============================================================

function slugify(text) {

  return text
    .toLowerCase()
    .trim()
    .replace(
      /[^a-z0-9\s-]/g,
      ''
    )
    .replace(
      /\s+/g,
      '-'
    )
    .replace(
      /-+/g,
      '-'
    )
    .slice(
      0,
      50
    );
}


// ============================================================
// SEARCH TOKENS
// ============================================================

function buildSearchTokens(
  name,
  category
) {

  const tokens =
    new Set();

  const words =
    `${name} ${category}`
      .toLowerCase()
      .split(/\s+/)
      .filter(Boolean);

  words.forEach(
    word => {

      for (
        let i = 1;
        i <= word.length;
        i++
      ) {

        tokens.add(
          word.slice(0, i)
        );
      }
    }
  );

  return Array.from(tokens)
    .slice(0, 150);
}


// ============================================================
// START PAYMENT
// ============================================================

async function startPremiumPayment(
  groupId
) {

  const user =
    auth.currentUser;

  if (!user) {

    throw new Error(
      'Please sign in again.'
    );
  }


  if (!user.email) {

    throw new Error(
      'Your account needs an email address before payment.'
    );
  }


  const idToken =
    await user.getIdToken(
      true
    );


  const response =
    await fetch(
      PAYMENT_FUNCTION_URL,
      {
        method: 'POST',

        headers: {
          'Content-Type':
            'application/json',

          'Authorization':
            `Bearer ${idToken}`
        },

        body: JSON.stringify({

          action:
            'initialize',

          groupId,

          amount:
            PREMIUM_ACTIVATION_FEE,

          currency:
            CURRENCY,

          callbackUrl:
            `${window.location.origin}/create-group.html`
        })
      }
    );


  const data =
    await response.json();


  if (!response.ok) {

    throw new Error(
      data.error ||
      'Unable to start Premium payment.'
    );
  }


  if (!data.authorization_url) {

    throw new Error(
      'Payment checkout URL was not returned.'
    );
  }


  window.location.href =
    data.authorization_url;
}


// ============================================================
// FORM SUBMISSION
// ============================================================

form.addEventListener(
  'submit',
  async event => {

    event.preventDefault();

    if (state.isSubmitting) return;

    if (!state.currentUser) {

      showToast(
        'You need to be signed in.',
        'error'
      );

      return;
    }

    if (!validateForm()) {

      showToast(
        'Please fix the highlighted fields.',
        'error'
      );

      return;
    }


    state.isSubmitting =
      true;

    createGroupBtn.disabled =
      true;

    createGroupBtn.classList.add(
      'is-loading'
    );


    try {

      let coverURL = '';
      let avatarURL = '';


      if (state.coverFile) {

        coverURL =
          await uploadToCloudinary(
            state.coverFile
          );
      }


      if (state.avatarFile) {

        avatarURL =
          await uploadToCloudinary(
            state.avatarFile
          );
      }


      const name =
        nameInput.value.trim();

      const description =
        descInput.value.trim();

      const category =
        categorySelect.value;

      const privacy =
        document.querySelector(
          'input[name="privacy"]:checked'
        ).value;

      const groupType =
        document.querySelector(
          'input[name="groupType"]:checked'
        ).value;

      const isPremium =
        groupType === 'premium';


      const groupRef =
        doc(
          collection(
            db,
            'groups'
          )
        );

      const groupId =
        groupRef.id;

      const user =
        state.currentUser;


      const groupData = {

        groupId,

        name,

        slug:
          `${slugify(name)}-${groupId.slice(0, 6)}`,

        description,

        category,

        searchTokens:
          buildSearchTokens(
            name,
            category
          ),

        coverURL,

        avatarURL,

        privacy,

        type:
          groupType,

        ownerId:
          user.uid,

        ownerName:
          user.displayName ||
          'VitalStar Member',

        verified:
          false,

        level:
          1,

        memberCount:
          1,

        followerCount:
          1,

        postCount:
          0,

        onlineCount:
          1,

        rules:
          state.rules,

        premiumActivation: {

          required:
            isPremium,

          amount:
            isPremium
              ? PREMIUM_ACTIVATION_FEE
              : 0,

          currency:
            CURRENCY,

          status:
            isPremium
              ? 'pending_payment'
              : 'not_required',

          paymentId:
            null,

          reference:
            null,

          paidAt:
            null
        },

        followerFee: {

          enabled:
            isPremium,

          amount:
            isPremium
              ? FOLLOWER_FEE
              : 0,

          currency:
            CURRENCY,

          paymentRecipient:
            isPremium
              ? 'group_owner'
              : null
        },

        premiumStatus:
          isPremium
            ? 'pending_payment'
            : 'not_applicable',

        paymentProvider:
          isPremium
            ? 'paystack'
            : null,

        createdAt:
          serverTimestamp(),

        updatedAt:
          serverTimestamp()
      };


      await setDoc(
        groupRef,
        groupData
      );


      const ownerMemberRef =
        doc(
          db,
          'groups',
          groupId,
          'members',
          user.uid
        );


      await setDoc(
        ownerMemberRef,
        {

          uid:
            user.uid,

          displayName:
            user.displayName ||
            'VitalStar Member',

          photoURL:
            user.photoURL ||
            '',

          role:
            'owner',

          status:
            'active',

          joinedAt:
            serverTimestamp()
        }
      );


      /* FREE GROUP */

      if (!isPremium) {

        showToast(
          'Group created successfully!',
          'success'
        );

        setTimeout(
          () => {

            window.location.href =
              `group.html?id=${groupId}`;

          },
          900
        );

        return;
      }


      /* PREMIUM GROUP */

      showToast(
        'Starting your ₦1,500 Premium activation payment…',
        'info'
      );


      await startPremiumPayment(
        groupId
      );

    } catch (error) {

      console.error(
        'Create group error:',
        error
      );

      showToast(
        error.message ||
        'Unable to create the group.',
        'error'
      );

      state.isSubmitting =
        false;

      createGroupBtn.disabled =
        false;

      createGroupBtn.classList.remove(
        'is-loading'
      );
    }

  }
);


// ============================================================
// INIT
// ============================================================

renderRules();

syncNamePreview();

syncDescPreview();

syncCategoryPreview();

syncPrivacyPreview();

syncGroupTypePreview();