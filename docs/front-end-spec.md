### UI/UX Specification

#### Overall UX Goals & Principles

**Target User Personas**
* **Primary User: Jonathan (SEO Expert)**: A core, power user who needs a tool to streamline his personal workflow and act as a central hub for multiple clients. He needs to oversee the entire process, ensure quality, and manage all projects.
* **Secondary User: Clark (Team Researcher)**: A user who handles the repetitive research process. He requires a clear, linear workflow with obvious steps to prevent him from missing a crucial action. The interface should be intuitive and easy to follow.
* **Tertiary User: Fiona (Client Reviewer)**: A user who is a client and only needs to review and approve the final output. She needs a clean, simple, and uncluttered interface to quickly review suggestions and provide feedback without getting lost in the complexities of the tool.

**Usability Goals**
* **Efficiency for Experts**: The tool should reduce the time spent on a full keyword optimization workflow from start to finish.
* **Clarity for Researchers**: The interface should be obvious and easy to follow, clearly indicating the user's current location in the research process.
* **Simplicity for Clients**: The client-facing interface for reviewing suggestions must be clean and simple, enabling quick decision-making.

**Design Principles**
* **Structure over Complexity**: While cleverness in the UI is welcome, the information architecture must be clear and well-organized to prevent confusion.
* **Guidance by Design**: The user interface should actively guide the user through the multi-stage process to ensure no steps are missed.
* **Consistent Patterns**: UI patterns should be consistent throughout the application to ensure that users (especially secondary users) can easily navigate and learn the system.
* **Purposeful Presentation**: The interface should adapt to the user's role, presenting a simple view for clients and a more detailed, powerful view for the research team.

---

#### Information Architecture (IA)

**Site Map and Navigation**
* **Dashboard**: This would be the landing page for both Managers and Users. It would provide an overview of all ongoing projects and a high-level summary of progress.
* **Projects**: This section is the core of the application for Managers and Users. It would contain a list of all projects and allow users to create, edit, and manage projects.
* **Reports**: This section would be accessible to Managers and would provide a deeper level of analysis and reporting on all projects. It's likely where you would find the ability to export data in formats like CSV.
* **Admin**: This section would be restricted to Managers. It would include functionality for user management, tenant administration, and setting API keys.
* **Client Portal**: This section would be the landing page for Clients. It would only display the projects and pages that they have been invited to access.

---

#### User Flows

**Onboarding & Project Creation User Flow**
1. **User Signup**: A new user signs up with a standard username (email) and password. We will accept the email verbatim for the MVP.
2. **Tenant Action**: The user is presented with two options:
   * **Create a new tenant**: The user creates a new tenant. They are automatically assigned as the administrator for this new tenant.
   * **Join an existing tenant**: The user requests to join a tenant by entering an ID provided to them by an existing user.
3. **Tenant Administration**: Once the new tenant is created, the administrator can invite other users, remove them, and assign or remove admin rights. The administrator also has the capability to grant or deny users access to specific projects.
4. **Project Creation**: The new user (who is also the administrator) creates a new project, giving it a name that is unique within that tenant. They also associate a domain with the project, which does not need to be unique to the project.
5. **New User Onboarding**: A new user who joins an existing tenant will need an administrator to add them to a project before they can begin their work.

**Keyword Research Workflow**
1. **Content Ingestion**: The user initiates the process by either entering a URL for the app to scrape or by manually pasting in HTML, Markdown, or raw text if the URL is not accessible.
2. **Initial AI Generation**: The application uses a customizable AI prompt and model to generate an initial list of up to 100 potential keywords from the ingested content.
3. **Data Export to External Tool (e.g., Semrush)**: The user copies the AI-generated keywords to their clipboard.
4. **External Analysis & Data Export**: The user pastes the keywords into their external tool (Semrush or Ahrefs), runs the analysis, and exports the results as a CSV file.
5. **Data Import & Matching**: The application automatically detects the exported file, imports the data, and matches the keywords from the export with the existing keywords in the system. The system should be able to handle the different data columns from both Semrush and Ahrefs.
6. **Refinement & Selection**: The user is presented with a display of the updated keyword data. They can sort the keywords by any column to refine the list and select the best 10 keywords they want to research further with Google Keyword Planner.
7. **Data Export to Google Keyword Planner**: The user copies their selected keywords to the clipboard.
8. **External Analysis & New Keyword Generation**: The user pastes the keywords into Google Keyword Planner. The tool analyzes the keywords and generates new long-tail keyword suggestions.
9. **Data Import & Appending**: The user exports the results from Google Keyword Planner as a CSV. The application detects and imports this file, appending the new data set and keywords to the existing list.
10. **Iterative Process**: This entire workflow from step 6 onward can be repeated multiple times until the user is satisfied with the results.
11. **Final Selection**: The user should be able to mark a final choice (e.g., their top 3) of keywords. The primary keyword will be selected for the article.
12. **Named Keyword Lists**: At any point in this process, the user can select keywords and add them to independent, named lists that are associated with the project for future use.

**Client Review & Approval Flow**
1. **Invitation and Access**: An administrator or user invites a client to a specific project via a unique link. This link grants the client access only to the pages that the user has selected for their review.
2. **Login**: The client uses the unique link to log in and is presented with a clean, simple interface. They do not have access to any other parts of the system.
3. **Review**: For each optimized page, the client sees the user's final choices for article titles, meta descriptions, and other SEO elements.
4. **Action**: The client can then either:
   * **Accept**: The client approves the user's choices, finalizing them in the system.
   * **Reject**: The client rejects the choices, sending them back to the user for revision.
   * **Select their own**: The client can choose their preferred option from the list of suggestions that the user has already shortlisted.

---

#### Wireframes & Mockups

**Dashboard**
* **Primary Purpose**: A personalized landing page that provides a quick overview of a user's projects.
* **Key Elements**:
   * A list or grid of all projects, prominently displayed.
   * For each project, a high-level summary of its status (e.g., "In Progress," "Needs Review," "Complete").
   * A clear and accessible button to **"Create New Project"** or **"Start a New Session"**.
   * A navigation bar that provides easy access to other main sections like **"Admin," "Reports,"** and **"Account Settings."**

**Projects List**
* **Primary Purpose**: A central hub for managing all projects.
* **Key Elements**:
   * A sortable and searchable list of projects.
   * Each project entry should display key information, such as the project name, associated domain, and a status indicator.
   * Actions to **"Open," "Edit,"** or **"Delete"** a project.
   * A prominent **"Create New Project"** button.
   * For multi-tenant users, a visual indicator showing which projects belong to which team or client.

**Keyword Research Workflow Screen**
* **Primary Purpose**: The primary workspace for the multi-stage keyword research process.
* **Key Elements**:
   * A clear, step-by-step indicator showing the user where they are in the workflow (e.g., a progress bar or a numbered list of steps).
   * A main content area for ingesting data (e.g., a text box for pasting HTML or a field for a URL).
   * An interactive display for showing the AI-generated keywords and the imported data. This display should allow for sorting, filtering, and selection of keywords.
   * Prominent buttons for key actions like **"Generate Keywords," "Copy to Clipboard," "Import CSV,"** and **"Select Final Keyword."**
   * A side panel or a dedicated section for managing named keyword lists and viewing their stats.
   * A clear section that allows the user to customize the AI prompt and model.

---

#### Component Library / Design System

* **Design System Approach:** We will adopt **Material UI** as the core design system for the application. This will provide a consistent visual language, a robust set of pre-built components, and established best practices for a polished user experience.
* **Core Components:**
   * **Data Tables:** This is a critical component for the application. It will be a sortable data table that supports multiple functions, including row selection. It will be used to display keyword research results from various sources.
   * **Buttons:** Standard button components in various styles (e.g., primary, secondary, text) and states (e.g., active, disabled, loading).
   * **Forms:** A set of form components including input fields, checkboxes, and radio buttons for user input and configuration.
   * **Navigation:** Components for a consistent navigation bar and side panel to guide users through the different sections of the app.
* **Branding & Style Guide:** As there is no existing branding, the application will use the default Material UI color palette and typography. This can be customized later in the project if needed.

---

#### Branding & Style Guide

* **Visual Identity**: We will use a modern, vibrant, and clean visual identity. The design will use color purposefully to highlight key data points and guide the user's attention, making a repetitive and data-heavy task more engaging.
* **Color Palette**: The application will feature a vibrant yet professional color palette. The primary color will be a bright, engaging hue (e.g., a vivid blue or green), and the secondary color will be used to highlight interactive elements and call-to-actions. A set of neutral colors will be used for backgrounds, text, and borders to ensure readability.
* **Typography**: The application will use a clean, sans-serif typeface to ensure maximum readability, especially for tables and numerical data. The font size and weight will be carefully selected to create a clear hierarchy and guide the user through the information.
* **Iconography**: We will use **Material Icons** as the primary icon library to ensure a consistent, professional, and easily scalable set of icons throughout the application.

