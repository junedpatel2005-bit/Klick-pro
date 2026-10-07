Register page Prompt:

You’re right. For Codex, it’s better to **tell it to inspect and use the existing Supabase database**, not invent table or column names.

Use this corrected prompt:

> Build the complete **Client Signup + Client Profile Setup** flow for our existing application.
>
> Tech stack:
>
> - Next.js
> - TypeScript
> - Supabase
>
> The website has **2 roles**:
>
> - Client
> - Professional
>
> For this task, focus on the **Client signup and Client profile flow**, but make sure the existing role system is respected.
>
> **Very important:** use the **existing Supabase database structure**. Inspect the current database, existing user/profile tables, relationships, authentication setup, and existing code before making changes.
>
> Do **not** create new database tables, columns, enums, or duplicate user/profile structures unless they are genuinely required. Reuse the current database structure and adapt the implementation to it.
>
> Supabase database should be the main source of truth for the authenticated user, role, profile information, and profile completion status.
>
> Do not invent database field names in the implementation. First inspect what already exists and use those existing fields and relationships.
>
> ---
>
> ### Signup
>
> Build a clean responsive signup page.
>
> The user should be able to choose their role:
>
> **Client**
>
> **Professional**
>
> For this flow, when the user chooses **Client**, continue with Client registration.
>
> Signup should include:
>
> - Full name
> - Email
> - Phone number
> - Password
> - Confirm password
> - Terms & Conditions checkbox
>
> Use proper validation for every field.
>
> Email must be valid.
>
> Phone number must be valid.
>
> Password must have strong validation and Confirm Password must match.
>
> Terms must be accepted before signup.
>
> Show useful inline validation messages.
>
> Use Supabase Auth for authentication.
>
> Never store plain-text passwords in the application database.
>
> ---
>
> ### Phone OTP
>
> We currently do **not have a phone/SMS OTP API**.
>
> For development only, use:
>
> **OTP: `2412`**
>
> Flow:
>
> User enters phone number
> → OTP verification screen opens
> → User enters `2412`
> → Phone number is treated as verified
> → Signup continues
>
> Any other OTP must show an invalid OTP error.
>
> Do not visibly display `2412` in the signup UI.
>
> Keep this temporary OTP logic separated so it can easily be replaced later by a real SMS provider.
>
> Prefer validating the temporary OTP on the server side rather than putting the comparison directly inside the React component.
>
> Add a clear TODO comment that this development OTP must be replaced before production.
>
> Add OTP UI with:
>
> - 4 digit input
> - Auto focus next digit
> - Backspace support
> - Paste support
> - Numeric input only
> - Verify button/loading state
> - Invalid OTP message
> - Success message
> - Change phone number option
> - Resend OTP option
>
> ---
>
> ### Client Profile
>
> After successful Client signup, send the user to the Client Profile Setup flow.
>
> The Client should be able to add and manage:
>
> - Name
> - Company name — optional
> - Address
> - Profile photo
> - Saved locations
>
> Also include useful Client profile information such as:
>
> - Email
> - Phone number
> - Phone verification status
> - Preferred contact method if suitable for the existing system
> - Client type such as individual/business if suitable
>
> Do not unnecessarily add fields if the current product/database already has a defined structure.
>
> The main required Client profile experience should stay focused on:
>
> **Name**
>
> **Company Name (optional)**
>
> **Address**
>
> **Profile Photo**
>
> **Saved Locations**
>
> ---
>
> ### Profile Photo
>
> Allow the Client to:
>
> - Upload profile photo
> - Replace profile photo
> - Remove profile photo
>
> Use the application's existing Supabase Storage setup if one already exists.
>
> Do not create a duplicate storage setup if the project already has one.
>
> Validate file type and size.
>
> Show a default avatar when the user has no profile photo.
>
> ---
>
> ### Address
>
> Provide a good address form based on the current database structure.
>
> Use the existing address fields already available in the database.
>
> Do not invent a new address schema unless the project has no address structure yet.
>
> Validate required address information properly.
>
> ---
>
> ### Saved Locations
>
> Client should be able to:
>
> - Add a saved location
> - Edit a saved location
> - Delete a saved location
> - Choose a default saved location if supported
> - Reuse a saved location later
>
> Examples:
>
> - Home
> - Office
> - Warehouse
> - Site
>
> Again, inspect the existing database first and use the existing saved-location/location structure.
>
> Do not create a new locations table if an appropriate one already exists.
>
> If no saved-location structure currently exists and one is required, first clearly identify that gap before adding the minimum necessary database change.
>
> ---
>
> ### Client Profile Setup UI
>
> Make the setup simple and professional.
>
> A good flow can be:
>
> **Step 1 — Personal Information**
>
> - Profile photo
> - Name
> - Company name if applicable
>
> **Step 2 — Address**
>
> - Client address
>
> **Step 3 — Saved Locations**
>
> - Add first saved location
> - Option to use current address as a saved location if appropriate
>
> **Step 4 — Complete Profile**
>
> Save the data using the existing Supabase database and mark the profile as complete using the project's existing profile-completion logic.
>
> Do not invent a new completion field if the project already handles this another way.
>
> ---
>
> ### Roles
>
> The application contains:
>
> **Client**
>
> **Professional**
>
> The selected role must be persisted using the application's existing database/role architecture.
>
> Do not identify the role only using frontend state or URL parameters.
>
> After authentication, use the existing Supabase user/profile data to determine whether the logged-in account is a Client or Professional.
>
> Client users should go to the Client experience.
>
> Professional users should go to the Professional experience.
>
> Do not allow a Client to access Professional-only pages just by changing the URL.
>
> Use the existing authorization/RLS system and improve it if necessary.
>
> ---
>
> ### Validation
>
> Add complete validation for:
>
> - Required fields
> - Full name
> - Email format
> - Duplicate email
> - Phone format
> - Duplicate phone if applicable
> - OTP
> - Password strength
> - Confirm password
> - Terms acceptance
> - Address
> - Image upload
>
> Handle Supabase/database errors with user-friendly messages.
>
> Do not show raw database errors or technical stack traces to the user.
>
> Prevent duplicate form submission.
>
> Preserve user-entered values when validation fails.
>
> ---
>
> ### Existing Code First
>
> Before coding:
>
> 1. Inspect the existing authentication implementation.
> 2. Inspect the Supabase setup.
> 3. Inspect the current database types/schema available in the project.
> 4. Inspect existing user/profile logic.
> 5. Inspect existing role handling.
> 6. Inspect existing storage implementation.
> 7. Inspect existing UI components and form patterns.
>
> Reuse existing components, helpers, types, routes, Supabase utilities, and design system wherever possible.
>
> Avoid duplicate code.
>
> Do not redesign working parts unnecessarily.
>
> ---
>
> ### Database Requirement
>
> **Do not assume database table names or column names.**
>
> Inspect the current Supabase database/schema/types first and use what already exists.
>
> The database is the main source of truth.
>
> If something required for this feature does not exist, make only the minimum necessary change and clearly explain why it is required.
>
> Do not make speculative database changes.
>
> ---
>
> ### Final Expected Flow
>
> Client selects **Client**
>
> → fills signup form
>
> → form validates
>
> → verifies phone with development OTP `2412`
>
> → Supabase account is created
>
> → existing database user/profile information is updated
>
> → Client goes to profile setup
>
> → adds Name, optional Company Name, Address, Profile Photo and Saved Locations
>
> → profile saves into the existing Supabase database
>
> → profile setup completes
>
> → Client is redirected to the Client dashboard.
>
> Implement this using the project's **existing database and architecture**, not a newly invented schema.

This wording gives Codex room to inspect your Supabase schema first and prevents it from randomly creating `profiles`, `client_profiles`, or other columns/tables that may not match your project.
