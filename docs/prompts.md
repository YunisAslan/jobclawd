I have an existing project and I want to redesign the feed job search architecture for better performance.

Current stack:

* Frontend: Next.js + React Query (TanStack Query)
* Backend: Python API with scraping logic
* Database: currently SQLite
* No Redis

I want to migrate the database from SQLite to PostgreSQL and implement database-based caching with TTL, without using Redis.

Requirements:

1. All existing database logic should be migrated from SQLite to PostgreSQL.

   * Suggest proper schema changes if needed
   * Keep it compatible with Python backend

2. The app has heavy search / scraping that takes 5–10 seconds.
   I want search results to be cached in database.

3. Cache rules:

   * Cache key must depend on filters
   * Same filters → return cached result instantly
   * Cache must expire after 1 hour (TTL)
   * After expiration → backend should scrape again and update cache
   * Do NOT use Redis, only PostgreSQL

4. Filters must be stored in URL query params on frontend.

   * Page refresh must keep filters
   * Navigation away and back must keep filters
   * Same filters should load cached result fast

5. Frontend must use React Query correctly:

   * queryKey based on filters
   * staleTime usage
   * avoid unnecessary refetch
   * results should stay when user navigates away and comes back

6. Backend logic flow must be like:
   user search →
   check cache in PostgreSQL →
   if exists and not expired → return
   if not → run scraping → save cache → return

7. Provide database cache table design:

   * filters_hash
   * filters_json
   * result_json
   * created_at
   * expires_at

8. Provide backend pseudo code in Python.

9. Provide best practices for performance, indexing, and scaling.

Explain like a senior backend architect designing a production system.
