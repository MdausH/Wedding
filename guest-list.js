const RSVP_STORAGE_KEY = "wedding-rsvps";

const rsvpCount = document.querySelector("#rsvp-count");
const namedCount = document.querySelector("#named-count");
const guestTotal = document.querySelector("#guest-total");
const latestRsvp = document.querySelector("#latest-rsvp");
const guestListRows = document.querySelector("#guest-list-rows");
const guestListFeedback = document.querySelector("#guest-list-feedback");
const refreshButton = document.querySelector("#guest-list-refresh");
let currentRows = [];

const supabaseConfig = window.WEDDING_SUPABASE_CONFIG || {};
const hasSupabaseConfig = Boolean(supabaseConfig.url && supabaseConfig.anonKey);

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
  new Date(value).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit"
  });

const setFeedback = (message, state = "info") => {
  if (!guestListFeedback) {
    return;
  }

  guestListFeedback.textContent = message;
  guestListFeedback.dataset.state = state;
};

const normalizeRsvp = (entry) => ({
  id: entry.id ?? null,
  name: String(entry.name || "").trim(),
  email: String(entry.email || "").trim(),
  guests: Number(entry.guests || 0),
  notes: String(entry.notes || "").trim(),
  date: entry.date || new Date().toISOString()
});

const getLocalRowKey = (entry) =>
  JSON.stringify([
    String(entry.name || "").trim(),
    String(entry.email || "").trim(),
    String(entry.guests || ""),
    String(entry.notes || "").trim(),
    String(entry.date || "")
  ]);

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

const renderRows = (rows) => {
  if (!guestListRows) {
    return;
  }

  if (!rows.length) {
    guestListRows.innerHTML = `
      <tr>
        <td colspan="6">No RSVP submissions yet.</td>
      </tr>
    `;
    return;
  }

  guestListRows.innerHTML = "";

  rows.forEach((row) => {
    const tr = document.createElement("tr");
    const values = [
      (row.name || "").trim() || "Guest",
      (row.email || "").trim() || "-",
      String(row.guests || "-"),
      (row.notes || "").trim() || "-",
      row.date ? formatDate(row.date) : "-"
    ];

    values.forEach((value) => {
      const td = document.createElement("td");
      td.textContent = value;
      tr.appendChild(td);
    });

    const actionCell = document.createElement("td");
    const deleteButton = document.createElement("button");

    deleteButton.type = "button";
    deleteButton.className = "button button-secondary button-small guest-delete-button";
    deleteButton.textContent = "Delete";
    if (row.id !== null && row.id !== undefined) {
      deleteButton.dataset.id = String(row.id);
    } else {
      deleteButton.dataset.localKey = getLocalRowKey(row);
    }

    actionCell.appendChild(deleteButton);
    tr.appendChild(actionCell);

    guestListRows.appendChild(tr);
  });
};

const deleteLocalRsvp = (localKey) => {
  const rows = readItems(RSVP_STORAGE_KEY);
  const nextRows = rows.filter((entry) => getLocalRowKey(entry) !== localKey);
  saveItems(RSVP_STORAGE_KEY, nextRows);
};

const deleteRsvp = async ({ id, localKey }) => {
  if (id) {
    await fetchSupabase(`/rest/v1/rsvps?id=eq.${encodeURIComponent(id)}`, {
      method: "DELETE",
      headers: {
        Prefer: "return=minimal"
      }
    });

    const localRows = readItems(RSVP_STORAGE_KEY).filter((entry) => String(entry.id ?? "") !== String(id));
    saveItems(RSVP_STORAGE_KEY, localRows);
    return;
  }

  if (localKey) {
    deleteLocalRsvp(localKey);
  }
};

const loadRsvps = async () => {
  if (!hasSupabaseConfig) {
    return {
      rows: readItems(RSVP_STORAGE_KEY)
        .slice()
        .sort((a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime()),
      source: "local"
    };
  }

  const rows = await fetchSupabase("/rest/v1/rsvps?select=id,name,email,guests,notes,date&order=date.desc");
  const normalized = Array.isArray(rows) ? rows.map(normalizeRsvp) : [];
  saveItems(RSVP_STORAGE_KEY, normalized);

  return {
    rows: normalized.slice().sort((a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime()),
    source: "supabase"
  };
};

const updateGuestList = async () => {
  try {
    const { rows, source } = await loadRsvps();
    currentRows = rows;
    const namedGuests = rows.filter((entry) => (entry.name || "").trim().length > 0);
    const seats = rows.reduce((total, entry) => total + Number(entry.guests || 0), 0);

    if (rsvpCount) {
      rsvpCount.textContent = String(rows.length);
    }

    if (namedCount) {
      namedCount.textContent = String(namedGuests.length);
    }

    if (guestTotal) {
      guestTotal.textContent = String(seats);
    }

    if (latestRsvp) {
      if (!rows.length) {
        latestRsvp.textContent = "No RSVP submissions yet.";
      } else {
        const last = rows[0];
        const latestName = (last.name || "").trim() || "Guest";
        const latestSeats = last.guests
          ? `${last.guests} guest${Number(last.guests) > 1 ? "s" : ""}`
          : "Guest count not provided";
        latestRsvp.textContent = `${latestName} - ${latestSeats} - ${formatDate(last.date)}`;
      }
    }

    renderRows(rows);
    setFeedback(
      source === "supabase"
        ? "Guest list loaded from Supabase."
        : "Supabase not configured yet. Showing this browser's saved RSVPs.",
      "success"
    );
  } catch (error) {
    console.error("Guest list load failed:", error);
    renderRows([]);
    setFeedback(
      formatSupabaseError(error, "Guest list could not be loaded from Supabase."),
      "error"
    );
  }
};

if (refreshButton) {
  refreshButton.addEventListener("click", () => {
    updateGuestList();
  });
}

if (guestListRows) {
  guestListRows.addEventListener("click", async (event) => {
    const deleteButton = event.target instanceof HTMLElement
      ? event.target.closest(".guest-delete-button")
      : null;

    if (!(deleteButton instanceof HTMLButtonElement)) {
      return;
    }

    const rowId = deleteButton.dataset.id || "";
    const localKey = deleteButton.dataset.localKey || "";
    const targetRow = currentRows.find((entry) =>
      rowId ? String(entry.id ?? "") === rowId : getLocalRowKey(entry) === localKey
    );
    const guestName = targetRow && targetRow.name ? targetRow.name : "this guest";
    const confirmed = window.confirm(`Delete RSVP for ${guestName}?`);

    if (!confirmed) {
      return;
    }

    deleteButton.disabled = true;

    try {
      await deleteRsvp({ id: rowId, localKey });
      setFeedback(`RSVP for ${guestName} deleted.`, "success");
      await updateGuestList();
    } catch (error) {
      console.error("Guest delete failed:", error);
      setFeedback(
        formatSupabaseError(error, `Could not delete RSVP for ${guestName}.`),
        "error"
      );
      deleteButton.disabled = false;
    }
  });
}

window.addEventListener("storage", (event) => {
  if (event.key === RSVP_STORAGE_KEY) {
    updateGuestList();
  }
});

updateGuestList();
