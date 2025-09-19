# Data Models

  * **User**: This entity represents a single user in the system. It will contain a username, password, and be linked to a specific tenant.
  * **Tenant**: This entity represents a team or client. It will be the central container for all users, projects, and AI API keys. The system will be designed to handle an unknown number of AI API keys, which will be securely stored against this tenant entity.
  * **Project**: This entity represents a keyword research project. It will be linked to a tenant and an associated domain. It will contain all the keyword research data and named lists for a specific web page.
  * **AI Prompt**: This new entity will store the customizable prompt text and the selected AI model to be used for keyword generation. It will be linked to a specific tenant for shared use by a team.
  * **Keyword List**: This entity represents a named list of keywords within a project.
  * **Keyword**: This entity represents a single keyword and its associated stats (e.g., search volume, difficulty) from external tools. It will be linked to a keyword list.
  * **Page**: This entity represents a single web page that is being optimized within a project. It will be linked to a project and will contain the final keyword, titles, and descriptions.
  * **SEO Items**: This new entity will store the generated article titles, meta titles, and meta descriptions. It will be linked to a specific page and will also contain the selected favorites and the final choice.
  * **Invitation**: This new entity will manage access for clients. It will store which pages a user has been granted access to and will be linked to a specific user and a project.