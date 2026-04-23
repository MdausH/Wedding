const RSVP_STORAGE_KEY = "wedding-rsvps";
const WISH_STORAGE_KEY = "wedding-wishes";

const sampleWishes = [
  //{
    //author: "Firdaus",
    //message: "May your home always be filled with laughter, mercy, and excellent desserts.",
    //date: "2026-04-10T10:00:00Z"
 // },
 // {
    //author: "Marcus",
   //message: "Wishing you a marriage full of tiny adventures, patient love, and unforgettable dance floors.",
    //date: "2026-04-09T14:20:00Z"
 // }
];

const rsvpForm = document.querySelector("#rsvp-form");
const wishForm = document.querySelector("#wish-form");
const rsvpFeedback = document.querySelector("#rsvp-feedback");
const wishFeedback = document.querySelector("#wish-feedback");
const rsvpCount = document.querySelector("#rsvp-count");
const namedCount = document.querySelector("#named-count");
const guestTotal = document.querySelector("#guest-total");
const latestRsvp = document.querySelector("#latest-rsvp");
const wishList = document.querySelector("#wish-list");
const clearWishesButton = document.querySelector("#clear-wishes");
const wishSubmitButton = wishForm ? wishForm.querySelector('button[type="submit"]') : null;
const countdownDays = document.querySelector("#countdown-days");
const countdownHours = document.querySelector("#countdown-hours");
const countdownMinutes = document.querySelector("#countdown-minutes");
const countdownSeconds = document.querySelector("#countdown-seconds");
const countdownMessage = document.querySelector("#countdown-message");
const menuToggle = document.querySelector(".menu-toggle");
const siteNav = document.querySelector("#site-nav");
const navLinks = siteNav ? siteNav.querySelectorAll("a") : [];
const thankYouPopup = document.querySelector("#thank-you-popup");
const popupTitle = document.querySelector("#thank-you-title");
const popupMessage = document.querySelector("#thank-you-message");
const popupClose = document.querySelector("#popup-close");
const popupAction = document.querySelector("#popup-action");

const weddingDate = new Date("2026-06-20T11:30:00+08:00");
const supabaseConfig = window.WEDDING_SUPABASE_CONFIG || {};
const hasSupabaseConfig = Boolean(supabaseConfig.url && supabaseConfig.anonKey);
let lastFocusedElement = null;
let editingWishId = null;

const readItems = (key, fallback = []) => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
};

const saveItems = (key, value) => {
  localStorage.setItem(key, JSON.stringify(value));
};

const formatDate = (value) =>
  new Date(value).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric"
  });

const createWishId = () =>
  `wish-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const normalizeRsvp = (entry) => ({
  name: String(entry.name || "").trim(),
  email: String(entry.email || "").trim(),
  guests: Number(entry.guests || 0),
  notes: String(entry.notes || "").trim(),
  date: entry.date || new Date().toISOString()
});

const mergeLocalRsvp = (entry) => {
  const rsvps = readItems(RSVP_STORAGE_KEY);
  rsvps.push(entry);
  saveItems(RSVP_STORAGE_KEY, rsvps);
};

const fetchSupabase = async (path, options = {}) => {
  if (!hasSupabaseConfig) {
    throw new Error("Supabase is not configured.");
  }

  const response = await fetch(`${supabaseConfig.url}${path}`, {
    ...options,
    headers: {
      apikey: supabaseConfig.anonKey,
      Authorization: `Bearer ${supabaseConfig.anonKey}`,
      "Content-Type": "application/json",
      ...(options.headers || {})
    }
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || "Supabase request failed.");
  }

  if (response.status === 204) {
    return null;
  }

  const responseText = await response.text();
  return responseText ? JSON.parse(responseText) : null;
};

const formatSupabaseError = (error, fallbackMessage) => {
  const rawMessage = error instanceof Error ? error.message : String(error || "");

  try {
    const parsed = JSON.parse(rawMessage);
    const details = [parsed.message, parsed.details, parsed.hint].filter(Boolean).join(" ");
    return details || fallbackMessage;
  } catch {
    return rawMessage || fallbackMessage;
  }
};

const normalizeWish = (entry) => ({
  id: entry.id || createWishId(),
  author: String(entry.author || "").trim(),
  message: String(entry.message || "").trim(),
  date: entry.date || new Date().toISOString()
});

const mergeLocalWish = (entry) => {
  const wishes = readItems(WISH_STORAGE_KEY).map(normalizeWish);
  wishes.push(entry);
  saveItems(WISH_STORAGE_KEY, wishes);
};

const replaceLocalWish = (entry) => {
  const wishes = readItems(WISH_STORAGE_KEY).map(normalizeWish);
  const nextWishes = wishes.map((wish) => (wish.id === entry.id ? entry : wish));
  saveItems(WISH_STORAGE_KEY, nextWishes);
};

const removeLocalWish = (wishId) => {
  const wishes = readItems(WISH_STORAGE_KEY).map(normalizeWish);
  saveItems(
    WISH_STORAGE_KEY,
    wishes.filter((wish) => wish.id !== wishId)
  );
};

const readWishes = () => {
  const fallbackWishes = sampleWishes.map(normalizeWish);
  const wishes = readItems(WISH_STORAGE_KEY);

  if (!wishes.length) {
    saveItems(WISH_STORAGE_KEY, fallbackWishes);
    return fallbackWishes;
  }

  const normalized = wishes.map(normalizeWish);
  saveItems(WISH_STORAGE_KEY, normalized);
  return normalized;
};

const setWishFormMode = (mode = "create") => {
  if (!wishSubmitButton) {
    return;
  }

  wishSubmitButton.textContent = mode === "edit" ? "Update Wish" : "Hantar";
};

const resetWishFormState = () => {
  editingWishId = null;
  setWishFormMode("create");
  if (wishForm) {
    wishForm.reset();
  }
};

const fetchRsvps = async () => {
  if (!hasSupabaseConfig) {
    return readItems(RSVP_STORAGE_KEY);
  }

  const rows = await fetchSupabase("/rest/v1/rsvps?select=name,email,guests,notes,date&order=date.desc");
  const normalized = Array.isArray(rows) ? rows.map(normalizeRsvp) : [];
  saveItems(RSVP_STORAGE_KEY, normalized);
  return normalized;
};

const saveRsvp = async (entry) => {
  const normalizedEntry = normalizeRsvp(entry);

  if (!hasSupabaseConfig) {
    mergeLocalRsvp(normalizedEntry);
    return { source: "local" };
  }

  await fetchSupabase("/rest/v1/rsvps", {
    method: "POST",
    headers: {
      Prefer: "return=minimal"
    },
    body: JSON.stringify(normalizedEntry)
  });

  mergeLocalRsvp(normalizedEntry);
  return { source: "supabase" };
};

const fetchWishes = async () => {
  if (!hasSupabaseConfig) {
    return readWishes();
  }

  const rows = await fetchSupabase("/rest/v1/wishes?select=id,author,message,date&order=date.desc");
  const normalized = Array.isArray(rows) ? rows.map(normalizeWish) : [];
  saveItems(WISH_STORAGE_KEY, normalized);
  return normalized;
};

const saveWish = async (entry) => {
  const normalizedEntry = normalizeWish(entry);

  if (!hasSupabaseConfig) {
    mergeLocalWish(normalizedEntry);
    return { source: "local" };
  }

  await fetchSupabase("/rest/v1/wishes", {
    method: "POST",
    headers: {
      Prefer: "return=minimal"
    },
    body: JSON.stringify(normalizedEntry)
  });

  mergeLocalWish(normalizedEntry);
  return { source: "supabase" };
};

const updateWish = async (entry) => {
  const normalizedEntry = normalizeWish(entry);

  if (!hasSupabaseConfig) {
    replaceLocalWish(normalizedEntry);
    return { source: "local" };
  }

  await fetchSupabase(`/rest/v1/wishes?id=eq.${encodeURIComponent(normalizedEntry.id)}`, {
    method: "PATCH",
    headers: {
      Prefer: "return=minimal"
    },
    body: JSON.stringify({
      author: normalizedEntry.author,
      message: normalizedEntry.message
    })
  });

  replaceLocalWish(normalizedEntry);
  return { source: "supabase" };
};

const deleteWishItem = async (wishId) => {
  if (!hasSupabaseConfig) {
    removeLocalWish(wishId);
    return { source: "local" };
  }

  await fetchSupabase(`/rest/v1/wishes?id=eq.${encodeURIComponent(wishId)}`, {
    method: "DELETE",
    headers: {
      Prefer: "return=minimal"
    }
  });

  removeLocalWish(wishId);
  return { source: "supabase" };
};

const closeThankYouPopup = () => {
  if (!thankYouPopup) {
    return;
  }

  thankYouPopup.hidden = true;
  document.body.classList.remove("popup-open");

  if (lastFocusedElement instanceof HTMLElement) {
    lastFocusedElement.focus();
  }
};

const openThankYouPopup = ({ title, message }) => {
  if (!thankYouPopup || !popupTitle || !popupMessage) {
    return;
  }

  lastFocusedElement = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  popupTitle.textContent = title;
  popupMessage.textContent = message;
  thankYouPopup.hidden = false;
  document.body.classList.add("popup-open");

  if (popupAction) {
    popupAction.focus();
  }
};

const syncMobileNav = () => {
  if (!menuToggle || !siteNav) {
    return;
  }

  const isDesktop = window.innerWidth > 760;
  const isOpen = !isDesktop && menuToggle.getAttribute("aria-expanded") === "true";

  if (isDesktop) {
    menuToggle.setAttribute("aria-expanded", "false");
    menuToggle.setAttribute("aria-label", "Open navigation menu");
    siteNav.classList.remove("is-open");
    return;
  }

  siteNav.classList.toggle("is-open", isOpen);
  menuToggle.setAttribute("aria-label", isOpen ? "Close navigation menu" : "Open navigation menu");
};

const updateCountdown = () => {
  if (!countdownDays || !countdownHours || !countdownMinutes || !countdownSeconds || !countdownMessage) {
    return;
  }

  const now = new Date();
  const difference = weddingDate.getTime() - now.getTime();

  if (difference <= 0) {
    countdownDays.textContent = "0";
    countdownHours.textContent = "0";
    countdownMinutes.textContent = "0";
    countdownSeconds.textContent = "0";
    countdownMessage.textContent = "Today is the day. Kami tidak sabar untuk meraikan bersama anda.";
    return;
  }

  const totalSeconds = Math.floor(difference / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  countdownDays.textContent = String(days);
  countdownHours.textContent = String(hours);
  countdownMinutes.textContent = String(minutes);
  countdownSeconds.textContent = String(seconds);
  countdownMessage.textContent = "Kami tidak sabar untuk meraikan bersama anda.";
};

const updateRsvpSummary = async () => {
  if (!rsvpCount || !namedCount || !guestTotal || !latestRsvp) {
    return;
  }

  const rsvps = await fetchRsvps();
  const namedGuests = rsvps.filter((entry) => (entry.name || "").trim().length > 0);
  const seats = rsvps.reduce((total, entry) => total + Number(entry.guests || 0), 0);

  rsvpCount.textContent = String(rsvps.length);
  namedCount.textContent = String(namedGuests.length);
  guestTotal.textContent = String(seats);

  if (!rsvps.length) {
    latestRsvp.textContent = "No RSVP submissions yet.";
    return;
  }

  const last = rsvps[rsvps.length - 1];
  const latestName = (last.name || "").trim() || "Guest";
  const latestSeats = last.guests ? `${last.guests} guest${Number(last.guests) > 1 ? "s" : ""}` : "Guest count not provided";
  latestRsvp.textContent = `${latestName} - ${latestSeats} - ${formatDate(last.date)}`;
};

const renderWishes = () => {
  if (!wishList) {
    return;
  }

  const wishes = readItems(WISH_STORAGE_KEY).map(normalizeWish);

  wishList.innerHTML = "";

  wishes
    .slice()
    .reverse()
    .forEach((wish) => {
      const card = document.createElement("article");
      const meta = document.createElement("div");
      const metaMain = document.createElement("div");
      const metaActions = document.createElement("div");
      const author = document.createElement("strong");
      const date = document.createElement("span");
      const message = document.createElement("p");
      const menuToggle = document.createElement("button");
      const menu = document.createElement("div");
      const editButton = document.createElement("button");
      const deleteButton = document.createElement("button");

      card.className = "wish-card";
      meta.className = "wish-meta";
      metaMain.className = "wish-meta-main";
      metaActions.className = "wish-card-actions";
      menu.className = "wish-card-menu";
      author.textContent = wish.author;
      date.textContent = formatDate(wish.date);
      message.textContent = wish.message;
      menuToggle.type = "button";
      menuToggle.className = "wish-menu-toggle";
      menuToggle.setAttribute("aria-expanded", "false");
      menuToggle.setAttribute("aria-label", `Open actions for ${wish.author || "wish"}`);
      menuToggle.dataset.wishId = wish.id;
      menuToggle.textContent = "...";
      menu.hidden = true;
      editButton.type = "button";
      editButton.className = "wish-menu-item";
      editButton.dataset.action = "edit";
      editButton.dataset.wishId = wish.id;
      editButton.textContent = "Edit";
      deleteButton.type = "button";
      deleteButton.className = "wish-menu-item";
      deleteButton.dataset.action = "delete";
      deleteButton.dataset.wishId = wish.id;
      deleteButton.textContent = "Delete";

      metaMain.append(author, date);
      menu.append(editButton, deleteButton);
      metaActions.append(menuToggle, menu);
      meta.append(metaMain, metaActions);
      card.append(meta, message);
      wishList.appendChild(card);
    });

  if (!wishes.length) {
    wishList.innerHTML = '<div class="empty-state">No wishes yet. Be the first to leave one.</div>';
  }
};

const closeWishMenus = () => {
  if (!wishList) {
    return;
  }

  wishList.querySelectorAll(".wish-card-menu").forEach((menu) => {
    menu.hidden = true;
  });

  wishList.querySelectorAll(".wish-menu-toggle").forEach((button) => {
    button.setAttribute("aria-expanded", "false");
  });
};

const editWish = (wishId) => {
  if (!wishForm) {
    return;
  }

  const wishes = readItems(WISH_STORAGE_KEY).map(normalizeWish);
  const wish = wishes.find((entry) => entry.id === wishId);

  if (!wish) {
    return;
  }

  editingWishId = wishId;
  wishForm.elements.author.value = wish.author;
  wishForm.elements.message.value = wish.message;
  setWishFormMode("edit");
  wishForm.scrollIntoView({ behavior: "smooth", block: "center" });
  wishForm.elements.author.focus();

  if (wishFeedback) {
    wishFeedback.textContent = "Editing selected wish.";
  }
};

const deleteWish = async (wishId) => {
  const wishes = readItems(WISH_STORAGE_KEY).map(normalizeWish);
  const wish = wishes.find((entry) => entry.id === wishId);

  if (!wish) {
    return;
  }

  const confirmed = window.confirm(`Delete wish from ${wish.author || "this guest"}?`);

  if (!confirmed) {
    return;
  }

  try {
    const result = await deleteWishItem(wishId);

    if (editingWishId === wishId) {
      resetWishFormState();
    }

    if (wishFeedback) {
      wishFeedback.dataset.state = "success";
      wishFeedback.textContent = result.source === "supabase"
        ? `Wish from ${wish.author || "guest"} deleted from Supabase.`
        : `Wish from ${wish.author || "guest"} deleted.`;
    }

    await loadAndRenderWishes();
  } catch (error) {
    console.error("Wish delete failed:", error);
    if (wishFeedback) {
      wishFeedback.dataset.state = "error";
      wishFeedback.textContent = formatSupabaseError(
        error,
        `Could not delete wish from ${wish.author || "guest"}.`
      );
    }
  }
};

const loadAndRenderWishes = async () => {
  try {
    await fetchWishes();
    renderWishes();
  } catch (error) {
    console.error("Wish load failed:", error);
    renderWishes();
    if (wishFeedback) {
      wishFeedback.dataset.state = "error";
      wishFeedback.textContent = formatSupabaseError(
        error,
        "Wish wall could not be loaded from Supabase."
      );
    }
  }
};

if (rsvpForm) {
  rsvpForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const submitButton = rsvpForm.querySelector('button[type="submit"]');
    const formData = new FormData(rsvpForm);
    const entry = Object.fromEntries(formData.entries());
    entry.date = new Date().toISOString();

    if (submitButton) {
      submitButton.disabled = true;
    }

    try {
      const result = await saveRsvp(entry);

      rsvpForm.reset();
      rsvpForm.elements.guests.value = 1;
      if (rsvpFeedback) {
        rsvpFeedback.textContent = result.source === "supabase"
          ? "Your RSVP has been saved and synced."
          : "Your RSVP has been saved on this browser. Add Supabase config to sync online.";
      }
      openThankYouPopup({
        title: "Terima kasih untuk RSVP anda",
        message: "Kehadiran anda amat bermakna buat kami. Kami tak sabar untuk meraikan hari bahagia ini bersama anda."
      });
      await updateRsvpSummary();
    } catch (error) {
      console.error("RSVP save failed:", error);
      if (rsvpFeedback) {
        rsvpFeedback.textContent = formatSupabaseError(
          error,
          "We couldn't save your RSVP online just now. Please try again."
        );
      }
    } finally {
      if (submitButton) {
        submitButton.disabled = false;
      }
    }
  });
}

if (wishForm) {
  wishForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const formData = new FormData(wishForm);
    const entry = normalizeWish(Object.fromEntries(formData.entries()));

    try {
      if (editingWishId) {
        const existingWish = readItems(WISH_STORAGE_KEY)
          .map(normalizeWish)
          .find((wish) => wish.id === editingWishId);
        const result = await updateWish({
          ...(existingWish || {}),
          id: editingWishId,
          author: entry.author,
          message: entry.message
        });

        if (wishFeedback) {
          wishFeedback.textContent = result.source === "supabase"
            ? "Your wish has been updated in Supabase."
            : "Your wish has been updated.";
        }
        resetWishFormState();
      } else {
        entry.date = new Date().toISOString();
        const result = await saveWish(entry);

        if (wishForm) {
          wishForm.reset();
        }
        if (wishFeedback) {
          wishFeedback.textContent = result.source === "supabase"
            ? "Your wish is on the wall and synced."
            : "Your wish is on the wall.";
        }
        openThankYouPopup({
          title: "Terima kasih atas ucapan anda",
          message: "Ucapan anda telah selamat diterima dan dipaparkan pada laman ucapan kami."
        });
      }

      closeWishMenus();
      if (wishFeedback) {
        wishFeedback.dataset.state = "success";
      }
      await loadAndRenderWishes();
    } catch (error) {
      console.error("Wish save failed:", error);
      if (wishFeedback) {
        wishFeedback.dataset.state = "error";
        wishFeedback.textContent = formatSupabaseError(
          error,
          "Your wish could not be saved just now."
        );
      }
    }
  });
}

if (clearWishesButton) {
  clearWishesButton.addEventListener("click", () => {
    saveItems(WISH_STORAGE_KEY, sampleWishes.map(normalizeWish));
    resetWishFormState();
    if (wishFeedback) {
      wishFeedback.textContent = "Wish wall reset to demo messages.";
    }
    renderWishes();
  });
}

if (wishList) {
  wishList.addEventListener("click", (event) => {
    const target = event.target instanceof HTMLElement ? event.target : null;

    if (!target) {
      return;
    }

    const toggle = target.closest(".wish-menu-toggle");
    const actionButton = target.closest(".wish-menu-item");

    if (toggle instanceof HTMLButtonElement) {
      const actionGroup = toggle.parentElement;
      const menu = actionGroup ? actionGroup.querySelector(".wish-card-menu") : null;
      const isOpen = toggle.getAttribute("aria-expanded") === "true";

      closeWishMenus();

      if (menu instanceof HTMLElement && !isOpen) {
        menu.hidden = false;
        toggle.setAttribute("aria-expanded", "true");
      }

      return;
    }

    if (actionButton instanceof HTMLButtonElement) {
      const { action, wishId } = actionButton.dataset;

      closeWishMenus();

      if (!wishId) {
        return;
      }

      if (action === "edit") {
        editWish(wishId);
      }

      if (action === "delete") {
        deleteWish(wishId);
      }
    }
  });
}

if (menuToggle && siteNav) {
  menuToggle.addEventListener("click", () => {
    const isOpen = menuToggle.getAttribute("aria-expanded") === "true";
    menuToggle.setAttribute("aria-expanded", String(!isOpen));
    syncMobileNav();
  });

  navLinks.forEach((link) => {
    link.addEventListener("click", () => {
      if (window.innerWidth <= 760) {
        menuToggle.setAttribute("aria-expanded", "false");
        syncMobileNav();
      }
    });
  });

  window.addEventListener("resize", syncMobileNav);
  syncMobileNav();
}

if (popupClose) {
  popupClose.addEventListener("click", closeThankYouPopup);
}

if (popupAction) {
  popupAction.addEventListener("click", closeThankYouPopup);
}

if (thankYouPopup) {
  thankYouPopup.addEventListener("click", (event) => {
    if (event.target === thankYouPopup) {
      closeThankYouPopup();
    }
  });
}

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && thankYouPopup && !thankYouPopup.hidden) {
    closeThankYouPopup();
  }

  if (event.key === "Escape") {
    closeWishMenus();
  }
});

document.addEventListener("click", (event) => {
  if (!wishList) {
    return;
  }

  const target = event.target instanceof HTMLElement ? event.target : null;

  if (target && !target.closest(".wish-card-actions")) {
    closeWishMenus();
  }
});

updateRsvpSummary().catch((error) => {
  console.error("RSVP summary load failed:", error);
  if (rsvpFeedback) {
    rsvpFeedback.textContent = formatSupabaseError(
      error,
      "Supabase RSVP summary could not be loaded."
    );
  }
});
loadAndRenderWishes();
updateCountdown();
setInterval(updateCountdown, 1000);

