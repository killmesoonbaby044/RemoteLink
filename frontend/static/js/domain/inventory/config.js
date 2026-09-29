// Static config for domain/inventory. Unlike `dom.endpoint` (the schema
// list endpoint, wired per-page via `.schema-page`'s data-endpoint), the
// users-lookup endpoint is a fixed backend route, not something the
// template varies - so it lives here rather than in dom.js.

export const USERS_ENDPOINT = "/domain/script/get_users";
