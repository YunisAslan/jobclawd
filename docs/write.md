### 🟢 Scenario A: User Selects "Remote" 🌍

**Logic:** The user wants to work from home (Baku), but the company can be anywhere. We filter by **Scope/Country**.

1.  **Input Label/Placeholder:** Changes to `Region / Country`
2.  **Default Value:** `Worldwide` (Null/Empty in backend)
3.  **Dropdown Data (The "List" to show):**
    - **Option 1 (Top):** `Global / Worldwide` (Value: `null`)
    - **Option 2 (Local):** `Azerbaijan` (Value: `AZ`) → _Logic: Companies in AZ allowing remote._
    - **Option 3 (Timezone Friendly):** `Europe (EMEA)` (Value: `EMEA`) → _Logic: UK, Germany, Netherlands, etc._
    - **Option 4 (Language Friendly):** `Turkey` (Value: `TR`), `CIS/Russia` (Value: `CIS`).
    - **Option 5 (High Salary):** `USA` (Value: `US`).
4.  **Typing Logic:** If user types manually, searching strictly for **Countries** or **Regions** (e.g., "Asia"). **Do not** show specific cities like "London".

---

### 🔵 Scenario B: User Selects "On-site" or "Hybrid" 📍

**Logic:** The user must physically go to an office. We filter by **Specific City**.

1.  **Input Label/Placeholder:** Changes to `City`
2.  **Default Value:** `Baku` (User's Current Location Profile Data)
3.  **Dropdown Data (The "List" to show):**
    - **Option 1 (Current):** `Baku, Azerbaijan` (Value: `Baku`).
    - **Option 2 (Nearby):** `Sumqayit`, `Ganja` (Value: `Sumqayit`, `Ganja`).
    - **Option 3 (Relocation Hubs):** _Logic: Show top tech hubs accepting expats._
      - `Dubai, UAE`
      - `Berlin, Germany`
      - `Amsterdam, Netherlands`
      - `Warsaw, Poland`
4.  **Typing Logic:** If user types manually, search strictly for **Cities** via Google Places/Mapbox API.

---

### 🟠 Scenario C: User Selects "Remote" AND "On-site" (Both)

**Logic:** The user is open to everything.

- **Priority:** Show **Cities** (Scenario B logic) because "On-site" is the stricter constraint.
- **Add-on:** Add a special static option at the top: `Include Worldwide Remote`.
