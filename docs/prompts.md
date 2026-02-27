Work Mode options:

- On-site
- Hybrid
- Remote
- Relocation

Location behavior based on selected Work Mode:

1. If Work Mode is "On-site" or "Hybrid":
   - Show the Location field immediately.
   - The Location field should be a standard location selector: primarily countries + cities/regions within the selected country (cascading: first country, then cities).
   - Default/focus on user's current location (e.g., Azerbaijan, Baku) or nearby countries.
   - Purpose: These modes require physical presence, so filter jobs strictly by the selected physical location.
   - Do NOT show "Worldwide" or broad regions as primary options.

2. If Work Mode is "Remote":
   - Show the Location field, but make it optional or less restrictive.
   - Options include: "Worldwide", "Any Location", specific regions (Europe Remote, US Remote, etc.), or countries with timezone/language preferences.
   - Many remote jobs have location restrictions (e.g., EU only, US only, specific timezones), so allow filtering by country/region even for remote.
   - If no location selected → show truly global remote jobs.

3. If Work Mode is "Relocation":
   - This mode means the user is willing to move to a new country/region for the job, often with relocation package.
   - Immediately show a cascading selector:
     - First: Region dropdown (e.g., North America, Europe, Asia Pacific, Middle East, Latin America, Any Region / Worldwide).
     - After region selected: Country dropdown filtered to countries in that region (e.g., North America → USA, Canada, Mexico).
   - Below the location selector, add a section with checkboxes for relocation package details (all optional, user can uncheck):
     - Visa Sponsorship Required (default: checked — because most relocation from Azerbaijan needs visa support)
     - Moving Expenses / Household Goods Shipment (default: checked)
     - Travel Expenses / Flights Covered (default: checked)
     - Temporary Housing Provided (default: checked)
     - Home Buying/Selling or Lease Break Assistance (default: unchecked)
     - Tax Gross-Up Assistance (default: unchecked)
     - Family/Spousal Support (default: unchecked)
   - Purpose: Allow users to target specific relocation destinations and filter jobs that offer meaningful relocation support.
   - Search logic: Combine "relocation assistance" OR "relocation package" keywords with selected country/region, and add visa/moving keywords only if checkboxes are checked.

General rules for all modes:

- Make the UI conditional: hide/show fields dynamically based on Work Mode selection.
- For search query: append appropriate keywords/filters (e.g., for relocation + USA + visa → include "visa sponsorship" "relocation to USA").

Provide a clear, structured description of this logic, including:

- UI flow step-by-step
- Example React-like pseudocode for conditional rendering
- Backend search query examples
- Why this logic improves UX for relocation seekers
