import { auth, db } from "./firebase.js";

import {
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

import {
  doc,
  collection,
  setDoc,
  updateDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const CLOUDINARY =
  "https://api.cloudinary.com/v1_1/m0scmqqv/image/upload";

const UPLOAD_PRESET = "vitalstar_upload";

const PAYMENT_URL =
  "https://caolbkawexnilpsgrwyz.supabase.co/functions/v1/create-group-payment";

const ACTIVATION_FEE = 1500;
const MEMBER_FEE = 100;
const CURRENCY = "NGN";

const $ = id => document.getElementById(id);

const form = $("createGroupForm");
const btn = $("createGroupBtn");

const nameInput = $("groupNameInput");
const descInput = $("groupDescInput");
const category = $("categorySelect");

const nameField = $("groupNameField");
const descField = $("groupDescField");
const categoryField = $("categoryField");

const nameCount = $("nameCharCount");
const descCount = $("descCharCount");

const coverZone = $("coverDropzone");
const coverInput = $("coverUploadInput");

const avatarZone = $("avatarDropzone");
const avatarInput = $("avatarUploadInput");

const premiumWrapper = $("premiumPriceWrapper");

const rulesList = $("rulesList");
const rulesEmpty = $("rulesEmptyState");
const ruleInput = $("ruleInput");
const addRuleBtn = $("addRuleBtn");

const navAvatar = $("navUserAvatar");

const previewCover = $("previewCover");
const previewAvatar = $("previewAvatar");
const previewName = $("previewName");
const previewDesc = $("previewDesc");
const previewPrivacy = $("previewPrivacyBadge");
const previewPremium = $("previewPremiumBadge");
const previewCategory = $("previewCategoryChip");
const previewCategoryText = $("previewCategoryText");

const toastContainer = $("toast-container");
const submitStatus = $("submitStatusText");

let user = null;
let coverFile = null;
let avatarFile = null;
let rules = [];
let submitting = false;

const categoryLabels = {
  technology: "Technology",
  gaming: "Gaming",
  programming: "Programming",
  music: "Music",
  "movies-tv": "Movies & TV",
  anime: "Anime",
  sports: "Sports",
  education: "Education",
  business: "Business",
  entertainment: "Entertainment",
  news: "News",
  science: "Science",
  fashion: "Fashion",
  travel: "Travel",
  politics: "Politics",
  religion: "Religion",
  general: "General",
  other: "Other"
};


/* ============================================================
   TOAST
============================================================ */

function toast(message, type = "info") {
  const icons = {
    success: "fa-circle-check",
    error: "fa-circle-exclamation",
    info: "fa-circle-info"
  };

  const el = document.createElement("div");

  el.className = `toast toast--${type}`;

  el.innerHTML = `
    <i class="fa-solid ${icons[type] || icons.info}"></i>
    <span></span>
  `;

  el.querySelector("span").textContent = message;

  toastContainer.appendChild(el);

  setTimeout(() => el.remove(), 5000);
}


/* ============================================================
   AUTH
============================================================ */

onAuthStateChanged(auth, currentUser => {
  if (!currentUser) {
    location.href = "login.html";
    return;
  }

  user = currentUser;

  if (currentUser.photoURL && navAvatar) {
    navAvatar.style.backgroundImage =
      `url("${currentUser.photoURL}")`;

    navAvatar.style.backgroundSize = "cover";
    navAvatar.style.backgroundPosition = "center";
    navAvatar.innerHTML = "";
  }
});


/* ============================================================
   RADIO VALUE
============================================================ */

function selected(name) {
  return document.querySelector(
    `input[name="${name}"]:checked`
  )?.value;
}


/* ============================================================
   PREVIEW
============================================================ */

function updatePreview() {
  const name = nameInput.value.trim();
  const desc = descInput.value.trim();

  const type =
    selected("groupType");

  const privacy =
    selected("privacy");

  previewName.textContent =
    name || "Your group name";

  previewDesc.textContent =
    desc ||
    "Your group description will appear here as you type.";

  previewDesc.classList.toggle(
    "is-empty",
    !desc
  );

  nameCount.textContent =
    `${nameInput.value.length}/60`;

  descCount.textContent =
    `${descInput.value.length}/500`;

  previewPremium.style.display =
    type === "premium"
      ? "inline-flex"
      : "none";

  premiumWrapper.classList.toggle(
    "is-visible",
    type === "premium"
  );

  submitStatus.textContent =
    type === "premium"
      ? "₦1,500 activation payment required"
      : "You'll be the Owner of this group";

  if (privacy === "private") {
    previewPrivacy.className =
      "badge badge--private";

    previewPrivacy.innerHTML =
      '<i class="fa-solid fa-lock"></i> Private';
  } else {
    previewPrivacy.className =
      "badge badge--public";

    previewPrivacy.innerHTML =
      '<i class="fa-solid fa-globe"></i> Public';
  }

  if (category.value) {
    previewCategory.style.display =
      "inline-flex";

    previewCategoryText.textContent =
      categoryLabels[category.value] ||
      category.value;
  } else {
    previewCategory.style.display =
      "none";
  }
}

[nameInput, descInput].forEach(el => {
  el.addEventListener(
    "input",
    updatePreview
  );
});

category.addEventListener(
  "change",
  updatePreview
);

document
  .querySelectorAll(
    'input[name="privacy"],input[name="groupType"]'
  )
  .forEach(el => {
    el.addEventListener(
      "change",
      updatePreview
    );
  });


/* ============================================================
   IMAGE VALIDATION
============================================================ */

const allowedImageExtensions = [
  "jpg",
  "jpeg",
  "png",
  "webp",
  "gif",
  "bmp",
  "avif",
  "heic",
  "heif",
  "tif",
  "tiff"
];

const allowedImageTypes = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/bmp",
  "image/avif",
  "image/heic",
  "image/heif",
  "image/tiff"
];

function getExtension(file) {
  return file.name
    .split(".")
    .pop()
    .toLowerCase();
}

function isSupportedImage(file) {
  if (!file) return false;

  const type =
    (file.type || "").toLowerCase();

  const extension =
    getExtension(file);

  return (
    allowedImageTypes.includes(type) ||
    allowedImageExtensions.includes(extension) ||
    type.startsWith("image/")
  );
}

function imageTypeName(file) {
  const extension =
    getExtension(file);

  if (extension)
    return extension.toUpperCase();

  if (file.type)
    return file.type;

  return "unknown";
}


/* ============================================================
   IMAGE PICKER
============================================================ */

function chooseImage(
  input,
  zone,
  callback,
  maxSize,
  label
) {
  input.addEventListener(
    "change",
    () => {
      const file =
        input.files?.[0];

      if (!file) return;

      if (!isSupportedImage(file)) {
        toast(
          `${label}: unsupported image type (${imageTypeName(file)}).`,
          "error"
        );

        input.value = "";
        return;
      }

      if (file.size > maxSize) {
        toast(
          `${label}: image must be under ${maxSize / 1024 / 1024}MB.`,
          "error"
        );

        input.value = "";
        return;
      }

      callback(file);

      const url =
        URL.createObjectURL(file);

      zone.style.backgroundImage =
        `url("${url}")`;

      zone.style.backgroundSize =
        "cover";

      zone.style.backgroundPosition =
        "center";

      zone.classList.add(
        "has-image"
      );
    }
  );
}


/* ============================================================
   IMAGE ZONES
============================================================ */

coverZone.addEventListener(
  "click",
  () => coverInput.click()
);

avatarZone.addEventListener(
  "click",
  () => avatarInput.click()
);

chooseImage(
  coverInput,
  coverZone,
  file => {
    coverFile = file;

    const url =
      URL.createObjectURL(file);

    previewCover.style.backgroundImage =
      `url("${url}")`;

    previewCover.style.backgroundSize =
      "cover";

    previewCover.style.backgroundPosition =
      "center";
  },
  8 * 1024 * 1024,
  "Group cover"
);

chooseImage(
  avatarInput,
  avatarZone,
  file => {
    avatarFile = file;

    const url =
      URL.createObjectURL(file);

    previewAvatar.style.backgroundImage =
      `url("${url}")`;

    previewAvatar.style.backgroundSize =
      "cover";

    previewAvatar.style.backgroundPosition =
      "center";

    previewAvatar.innerHTML = "";
  },
  5 * 1024 * 1024,
  "Group profile picture"
);


/* ============================================================
   CLOUDINARY UPLOAD
============================================================ */

async function uploadImage(file, label) {
  if (!file)
    return "";

  const data =
    new FormData();

  data.append(
    "file",
    file
  );

  data.append(
    "upload_preset",
    UPLOAD_PRESET
  );

  let response;

  try {
    response = await fetch(
      CLOUDINARY,
      {
        method: "POST",
        body: data
      }
    );
  } catch (error) {
    console.error(
      `${label} network error:`,
      error
    );

    throw new Error(
      `${label} upload failed: unable to connect to Cloudinary. Check your internet connection or Cloudinary configuration.`
    );
  }

  let result = null;
  let responseText = "";

  try {
    responseText =
      await response.text();

    result =
      JSON.parse(responseText);
  } catch {
    console.error(
      `${label} invalid Cloudinary response:`,
      responseText
    );
  }

  console.log(
    `${label} Cloudinary response:`,
    result
  );

  if (
    !response.ok ||
    !result?.secure_url
  ) {
    const cloudinaryError =
      result?.error?.message;

    if (cloudinaryError) {
      throw new Error(
        `${label} upload failed: ${cloudinaryError}`
      );
    }

    if (response.status === 400) {
      throw new Error(
        `${label} upload failed: Cloudinary rejected the image. Check the file type, upload preset, or file size.`
      );
    }

    if (response.status === 401) {
      throw new Error(
        `${label} upload failed: Cloudinary authentication/configuration error.`
      );
    }

    if (response.status === 413) {
      throw new Error(
        `${label} upload failed: image is too large.`
      );
    }

    throw new Error(
      `${label} upload failed: Cloudinary returned HTTP ${response.status}.`
    );
  }

  return result.secure_url;
}


/* ============================================================
   RULES
============================================================ */

function renderRules() {
  rulesList.innerHTML = "";

  rulesEmpty.style.display =
    rules.length
      ? "none"
      : "block";

  rules.forEach(
    (rule, index) => {
      const item =
        document.createElement("div");

      item.className =
        "rule-item";

      item.innerHTML = `
        <span class="rule-item__index">
          ${index + 1}
        </span>

        <span class="rule-item__text"></span>

        <button
          type="button"
          class="rule-item__remove"
        >
          <i class="fa-solid fa-xmark"></i>
        </button>
      `;

      item.querySelector(
        ".rule-item__text"
      ).textContent = rule;

      item.querySelector(
        ".rule-item__remove"
      ).onclick = () => {
        rules.splice(
          index,
          1
        );

        renderRules();
      };

      rulesList.appendChild(
        item
      );
    }
  );
}

function addRule() {
  const value =
    ruleInput.value.trim();

  if (!value) {
    toast(
      "Enter a rule first."
    );
    return;
  }

  if (value.length < 3) {
    toast(
      "Rule must contain at least 3 characters.",
      "error"
    );
    return;
  }

  if (rules.length >= 20) {
    toast(
      "Maximum 20 rules allowed.",
      "error"
    );
    return;
  }

  rules.push(value);

  ruleInput.value = "";

  renderRules();
}

addRuleBtn.onclick =
  addRule;

ruleInput.addEventListener(
  "keydown",
  e => {
    if (e.key === "Enter") {
      e.preventDefault();
      addRule();
    }
  }
);


/* ============================================================
   VALIDATION
============================================================ */

function validate() {
  const name =
    nameInput.value.trim();

  const desc =
    descInput.value.trim();

  const nameError =
    name.length < 2 ||
    name.length > 60;

  const descError =
    desc.length < 10 ||
    desc.length > 500;

  const categoryError =
    !category.value;

  nameField.classList.toggle(
    "has-error",
    nameError
  );

  descField.classList.toggle(
    "has-error",
    descError
  );

  categoryField.classList.toggle(
    "has-error",
    categoryError
  );

  return !(
    nameError ||
    descError ||
    categoryError
  );
}


/* ============================================================
   SLUG
============================================================ */

function slugify(text) {
  return text
    .toLowerCase()
    .trim()
    .replace(
      /[^a-z0-9\s-]/g,
      ""
    )
    .replace(
      /\s+/g,
      "-"
    )
    .replace(
      /-+/g,
      "-"
    )
    .slice(
      0,
      50
    );
}


/* ============================================================
   SEARCH TOKENS
============================================================ */

function searchTokens(
  name,
  cat
) {
  const set =
    new Set();

  `${name} ${cat}`
    .toLowerCase()
    .split(/\s+/)
    .forEach(word => {
      for (
        let i = 1;
        i <= word.length;
        i++
      ) {
        set.add(
          word.slice(
            0,
            i
          )
        );
      }
    });

  return [
    ...set
  ].slice(
    0,
    150
  );
}


/* ============================================================
   PAYMENT
============================================================ */

async function initializePayment(
  groupId
) {
  if (!user?.email) {
    throw new Error(
      "Your account needs an email address before payment."
    );
  }

  let res;

  try {
    res = await fetch(
      PAYMENT_URL,
      {
        method: "POST",
        headers: {
          "Content-Type":
            "application/json"
        },
        body: JSON.stringify({
          action:
            "initialize",
          groupId,
          amount:
            ACTIVATION_FEE,
          currency:
            CURRENCY,
          email:
            user.email,
          callbackUrl:
            `${location.origin}/create-group.html?groupId=${encodeURIComponent(groupId)}`
        })
      }
    );
  } catch {
    throw new Error(
      "Unable to connect to the payment server."
    );
  }

  let data;

  try {
    data =
      await res.json();
  } catch {
    throw new Error(
      "The payment server returned an invalid response."
    );
  }

  if (!res.ok) {
    throw new Error(
      data.error ||
      "Unable to start payment."
    );
  }

  if (!data.authorization_url) {
    throw new Error(
      "Paystack checkout URL was not returned."
    );
  }

  location.href =
    data.authorization_url;
}


/* ============================================================
   CREATE GROUP
============================================================ */

async function createGroup() {
  if (!user)
    throw new Error(
      "You need to be signed in."
    );

  const name =
    nameInput.value.trim();

  const description =
    descInput.value.trim();

  const cat =
    category.value;

  const privacy =
    selected("privacy") ||
    "public";

  const type =
    selected("groupType") ||
    "free";

  const premium =
    type === "premium";

  const ref =
    doc(
      collection(
        db,
        "groups"
      )
    );

  const groupId =
    ref.id;

  let coverURL = "";
  let avatarURL = "";


  /* ---------------------------
     COVER
  --------------------------- */

  if (coverFile) {
    submitStatus.textContent =
      "Uploading group cover...";

    toast(
      "Uploading group cover...",
      "info"
    );

    coverURL =
      await uploadImage(
        coverFile,
        "Group cover"
      );
  }


  /* ---------------------------
     PROFILE PICTURE
  --------------------------- */

  if (avatarFile) {
    submitStatus.textContent =
      "Uploading group profile picture...";

    toast(
      "Uploading group profile picture...",
      "info"
    );

    avatarURL =
      await uploadImage(
        avatarFile,
        "Group profile picture"
      );
  }


  /* ---------------------------
     FIRESTORE
  --------------------------- */

  await setDoc(
    ref,
    {
      groupId,

      name,

      slug:
        `${slugify(name)}-${groupId.slice(0, 6)}`,

      description,

      category:
        cat,

      searchTokens:
        searchTokens(
          name,
          cat
        ),

      coverURL,

      avatarURL,

      privacy,

      type,

      ownerId:
        user.uid,

      ownerName:
        user.displayName ||
        "VitalStar Member",

      ownerEmail:
        user.email ||
        null,

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
        [...rules],

      members: {
        [user.uid]: {
          role:
            "owner",

          status:
            "active",

          joinedAt:
            serverTimestamp()
        }
      },

      premiumActivation: {
        required:
          premium,

        amount:
          premium
            ? ACTIVATION_FEE
            : 0,

        currency:
          CURRENCY,

        status:
          premium
            ? "pending_payment"
            : "not_required",

        paymentId:
          null,

        reference:
          null,

        paidAt:
          null
      },

      followerFee: {
        enabled:
          premium,

        amount:
          premium
            ? MEMBER_FEE
            : 0,

        currency:
          CURRENCY,

        paymentRecipient:
          premium
            ? "group_owner"
            : null
      },

      premiumStatus:
        premium
          ? "pending_payment"
          : "not_applicable",

      paymentProvider:
        premium
          ? "paystack"
          : null,

      status:
        premium
          ? "pending_payment"
          : "active",

      createdAt:
        serverTimestamp(),

      updatedAt:
        serverTimestamp()
    }
  );

  return {
    groupId,
    premium
  };
}


/* ============================================================
   FORM SUBMIT
============================================================ */

form.addEventListener(
  "submit",
  async e => {
    e.preventDefault();

    if (submitting)
      return;

    if (!user) {
      toast(
        "Please sign in.",
        "error"
      );
      return;
    }

    if (!validate()) {
      toast(
        "Please fix the highlighted fields.",
        "error"
      );
      return;
    }

    submitting =
      true;

    btn.disabled =
      true;

    btn.classList.add(
      "is-loading"
    );

    try {
      const result =
        await createGroup();

      if (!result.premium) {
        toast(
          "Your group was created!",
          "success"
        );

        setTimeout(
          () => {
            location.href =
              `group.html?id=${result.groupId}`;
          },
          800
        );

        return;
      }

      toast(
        "Starting ₦1,500 activation payment...",
        "info"
      );

      await initializePayment(
        result.groupId
      );

    } catch (error) {
      console.error(
        "CREATE GROUP ERROR:",
        error
      );

      toast(
        error?.message ||
        "Unable to create the group.",
        "error"
      );

      submitStatus.textContent =
        error?.message ||
        "Unable to create the group.";

      submitting =
        false;

      btn.disabled =
        false;

      btn.classList.remove(
        "is-loading"
      );
    }
  }
);


/* ============================================================
   VERIFY PAYMENT
============================================================ */

async function verifyPayment(
  groupId,
  reference
) {
  let res;

  try {
    res = await fetch(
      PAYMENT_URL,
      {
        method: "POST",
        headers: {
          "Content-Type":
            "application/json"
        },
        body: JSON.stringify({
          action:
            "verify",

          reference
        })
      }
    );
  } catch {
    throw new Error(
      "Unable to connect to the payment server."
    );
  }

  let data;

  try {
    data =
      await res.json();
  } catch {
    throw new Error(
      "The payment server returned an invalid response."
    );
  }

  if (
    !res.ok ||
    !data.verified
  ) {
    throw new Error(
      data.error ||
      "Payment could not be verified."
    );
  }

  await updateDoc(
    doc(
      db,
      "groups",
      groupId
    ),
    {
      "premiumActivation.status":
        "paid",

      "premiumActivation.reference":
        data.reference,

      "premiumActivation.paymentId":
        data.reference,

      "premiumActivation.paidAt":
        data.paid_at ||
        serverTimestamp(),

      premiumStatus:
        "active",

      status:
        "active",

      updatedAt:
        serverTimestamp()
    }
  );
}


/* ============================================================
   PAYMENT RETURN
============================================================ */

async function paymentReturn() {
  const params =
    new URLSearchParams(
      location.search
    );

  const groupId =
    params.get(
      "groupId"
    );

  const reference =
    params.get(
      "reference"
    ) ||
    params.get(
      "trxref"
    );

  if (
    !groupId ||
    !reference
  ) {
    return;
  }

  try {
    submitStatus.textContent =
      "Verifying payment...";

    toast(
      "Verifying your payment...",
      "info"
    );

    await verifyPayment(
      groupId,
      reference
    );

    toast(
      "Payment verified! Your group is active.",
      "success"
    );

    setTimeout(
      () => {
        location.href =
          `group.html?id=${encodeURIComponent(groupId)}`;
      },
      900
    );

  } catch (error) {
    console.error(
      "PAYMENT VERIFICATION ERROR:",
      error
    );

    toast(
      error?.message ||
      "Payment verification failed.",
      "error"
    );

    submitStatus.textContent =
      error?.message ||
      "Payment verification failed.";

    btn.disabled =
      false;

    submitting =
      false;
  }
}


/* ============================================================
   INITIALIZE
============================================================ */

updatePreview();

renderRules();

paymentReturn();