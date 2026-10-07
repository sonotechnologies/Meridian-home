import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  geometry,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  serial,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

/* ---------- Enums ---------- */

export const roleEnum = pgEnum("role", ["buyer", "agent", "admin"]);
export const agentStatusEnum = pgEnum("agent_status", ["pending", "verified", "rejected", "suspended"]);
export const listingTypeEnum = pgEnum("listing_type", ["rent", "sale", "shortlet"]);
export const propertyTypeEnum = pgEnum("property_type", [
  "apartment",
  "self-contain",
  "duplex",
  "detached-house",
  "terrace",
  "bungalow",
  "land",
  "commercial",
]);
export const listingStatusEnum = pgEnum("listing_status", [
  "draft",
  "pending",
  "active",
  "expired",
  "closed",
  "rejected",
]);
export const closedReasonEnum = pgEnum("closed_reason", [
  "meridian",
  "elsewhere",
  "withdrawn",
]);
export const titleDocumentEnum = pgEnum("title_document", [
  "c-of-o",
  "governors-consent",
  "deed-of-assignment",
  "registered-survey",
  "excision",
  "other",
]);
export const leadChannelEnum = pgEnum("lead_channel", ["whatsapp", "callback"]);
export const leadStatusEnum = pgEnum("lead_status", ["new", "contacted", "viewing", "closed"]);
export const reportReasonEnum = pgEnum("report_reason", [
  "taken",
  "fake",
  "wrong-price",
  "wrong-location",
  "other",
]);

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
};

/* ---------- Auth (Better Auth core tables; `users` carries the role) ---------- */

export const users = pgTable("users", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  role: roleEnum("role").notNull().default("buyer"),
  suspended: boolean("suspended").notNull().default(false),
  isDemo: boolean("is_demo").notNull().default(false),
  ...timestamps,
});

export const session = pgTable("session", {
  id: text("id").primaryKey(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  token: text("token").notNull().unique(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  ...timestamps,
});

export const account = pgTable("account", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at", { withTimezone: true }),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at", { withTimezone: true }),
  scope: text("scope"),
  password: text("password"),
  ...timestamps,
});

export const verification = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  ...timestamps,
});

/** Better Auth's rate-limit counters, in the database so limits hold across serverless instances. */
export const rateLimit = pgTable("rate_limit", {
  id: text("id").primaryKey(),
  key: text("key").notNull().unique(),
  count: integer("count").notNull(),
  lastRequest: bigint("last_request", { mode: "number" }).notNull(),
});

/* ---------- Agents and areas ---------- */

export const agentProfiles = pgTable(
  "agent_profiles",
  {
    userId: text("user_id")
      .primaryKey()
      .references(() => users.id, { onDelete: "cascade" }),
    slug: text("slug").notNull(),
    fullName: text("full_name").notNull(),
    agencyName: text("agency_name").notNull(),
    phone: text("phone").notNull(),
    whatsapp: text("whatsapp").notNull(),
    bio: text("bio"),
    photoUrl: text("photo_url"),
    /** Private storage key, never a public URL. Deleted 30 days after a decision. */
    idDocumentUrl: text("id_document_url"),
    cacNumber: text("cac_number"),
    status: agentStatusEnum("status").notNull().default("pending"),
    rejectionReason: text("rejection_reason"),
    decidedAt: timestamp("decided_at", { withTimezone: true }),
    approvedListingCount: integer("approved_listing_count").notNull().default(0),
    isDemo: boolean("is_demo").notNull().default(false),
    ...timestamps,
  },
  (t) => [uniqueIndex("agent_profiles_slug_idx").on(t.slug), index("agent_profiles_status_idx").on(t.status)],
);

export const areas = pgTable("areas", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  centre: geometry("centre", { type: "point", mode: "xy", srid: 4326 }).notNull(),
  defaultZoom: integer("default_zoom").notNull().default(14),
  isActive: boolean("is_active").notNull().default(true),
});

/* ---------- Listings ---------- */

export const listings = pgTable(
  "listings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    agentId: text("agent_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    areaId: integer("area_id").references(() => areas.id),
    slug: text("slug").notNull(),
    type: listingTypeEnum("type").notNull().default("rent"),
    propertyType: propertyTypeEnum("property_type").notNull().default("apartment"),
    title: text("title").notNull().default(""),
    description: text("description").notNull().default(""),
    /** Naira, whole numbers. Per year for rent, total for sale, per night for shortlet. */
    price: bigint("price", { mode: "number" }).notNull().default(0),
    status: listingStatusEnum("status").notNull().default("draft"),
    /** Exact pin from the agent. Never returned in a public response. */
    location: geometry("location", { type: "point", mode: "xy", srid: 4326 }),
    /** Exact pin shifted by a fixed random offset of up to 150 m, generated once. */
    publicLocation: geometry("public_location", { type: "point", mode: "xy", srid: 4326 }),
    streetName: text("street_name"),
    showStreet: boolean("show_street").notNull().default(false),
    bedrooms: integer("bedrooms").notNull().default(0),
    bathrooms: integer("bathrooms").notNull().default(0),
    toilets: integer("toilets").notNull().default(0),
    parking: integer("parking").notNull().default(0),
    sizeSqm: integer("size_sqm"),
    furnished: boolean("furnished").notNull().default(false),
    serviced: boolean("serviced").notNull().default(false),
    amenities: text("amenities").array().notNull().default(sql`'{}'::text[]`),
    isDemo: boolean("is_demo").notNull().default(false),
    /** Created or edited from a demo agent session: never shown in public search, reset nightly. */
    sandbox: boolean("sandbox").notNull().default(false),
    /** Last form step the agent reached, for resuming drafts. */
    draftStep: integer("draft_step").notNull().default(1),
    viewCount: integer("view_count").notNull().default(0),
    /** Set when unresolved reports reach three; hides the listing until review. */
    hiddenByReports: boolean("hidden_by_reports").notNull().default(false),
    rejectionReason: text("rejection_reason"),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    expiryRemindedAt: timestamp("expiry_reminded_at", { withTimezone: true }),
    closedReason: closedReasonEnum("closed_reason"),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("listings_slug_idx").on(t.slug),
    index("listings_public_location_gist").using("gist", t.publicLocation),
    index("listings_location_gist").using("gist", t.location),
    index("listings_status_idx").on(t.status),
    index("listings_type_idx").on(t.type),
    index("listings_area_idx").on(t.areaId),
    index("listings_price_idx").on(t.price),
    index("listings_agent_idx").on(t.agentId),
  ],
);

export const listingRentTerms = pgTable(
  "listing_rent_terms",
  {
    listingId: uuid("listing_id")
      .primaryKey()
      .references(() => listings.id, { onDelete: "cascade" }),
    agencyFee: bigint("agency_fee", { mode: "number" }).notNull().default(0),
    legalFee: bigint("legal_fee", { mode: "number" }).notNull().default(0),
    cautionDeposit: bigint("caution_deposit", { mode: "number" }).notNull().default(0),
    serviceCharge: bigint("service_charge", { mode: "number" }).notNull().default(0),
    /** Stored, not computed on read, so it can be indexed and filtered. */
    totalUpfront: bigint("total_upfront", { mode: "number" }).notNull().default(0),
  },
  (t) => [index("listing_rent_terms_total_idx").on(t.totalUpfront)],
);

export const listingSaleTerms = pgTable("listing_sale_terms", {
  listingId: uuid("listing_id")
    .primaryKey()
    .references(() => listings.id, { onDelete: "cascade" }),
  titleDocument: titleDocumentEnum("title_document").notNull().default("c-of-o"),
  negotiable: boolean("negotiable").notNull().default(false),
});

export const listingShortletTerms = pgTable("listing_shortlet_terms", {
  listingId: uuid("listing_id")
    .primaryKey()
    .references(() => listings.id, { onDelete: "cascade" }),
  minNights: integer("min_nights").notNull().default(1),
  cleaningFee: bigint("cleaning_fee", { mode: "number" }).notNull().default(0),
  cautionDeposit: bigint("caution_deposit", { mode: "number" }).notNull().default(0),
});

export const listingImages = pgTable(
  "listing_images",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    listingId: uuid("listing_id")
      .notNull()
      .references(() => listings.id, { onDelete: "cascade" }),
    url: text("url").notNull(),
    position: integer("position").notNull().default(0),
  },
  (t) => [index("listing_images_listing_idx").on(t.listingId, t.position)],
);

/* ---------- Buyers, leads, reports ---------- */

export const leads = pgTable(
  "leads",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    listingId: uuid("listing_id")
      .notNull()
      .references(() => listings.id, { onDelete: "cascade" }),
    agentId: text("agent_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    userId: text("user_id").references(() => users.id, { onDelete: "set null" }),
    name: text("name"),
    phone: text("phone"),
    message: text("message"),
    channel: leadChannelEnum("channel").notNull(),
    status: leadStatusEnum("status").notNull().default("new"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("leads_agent_idx").on(t.agentId, t.createdAt), index("leads_listing_idx").on(t.listingId)],
);

export const favourites = pgTable(
  "favourites",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    listingId: uuid("listing_id")
      .notNull()
      .references(() => listings.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.listingId] })],
);

export type Bounds = { west: number; south: number; east: number; north: number };

export const savedSearches = pgTable(
  "saved_searches",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    filters: jsonb("filters").$type<Record<string, string>>().notNull(),
    bounds: jsonb("bounds").$type<Bounds | null>(),
    alertsOn: boolean("alerts_on").notNull().default(true),
    /** Secret for the one-click unsubscribe link in alert emails. */
    unsubscribeToken: text("unsubscribe_token").notNull(),
    lastAlertedAt: timestamp("last_alerted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("saved_searches_user_idx").on(t.userId), uniqueIndex("saved_searches_token_idx").on(t.unsubscribeToken)],
);

export const reports = pgTable(
  "reports",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    listingId: uuid("listing_id")
      .notNull()
      .references(() => listings.id, { onDelete: "cascade" }),
    reason: reportReasonEnum("reason").notNull(),
    note: text("note"),
    resolved: boolean("resolved").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("reports_listing_idx").on(t.listingId, t.resolved)],
);

export type User = typeof users.$inferSelect;
export type Listing = typeof listings.$inferSelect;
export type AgentProfile = typeof agentProfiles.$inferSelect;
export type Area = typeof areas.$inferSelect;
export type Lead = typeof leads.$inferSelect;
export type SavedSearch = typeof savedSearches.$inferSelect;
